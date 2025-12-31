"""
MCP Server for CEREBRAL ML Gateway.

Exposes ML inference tools for AI agents via Model Context Protocol.
Supports both stdio and SSE transports.

The MCP tools wrap the gateway's REST endpoints via HTTP calls, providing
a consistent interface for AI agents while leveraging the gateway's
built-in retry logic, timeouts, and error handling.

Tools:
- ml_detect_lesions: Run UNet lesion detection
- ml_segment_brain: Run SynthSeg 32-structure parcellation
- ml_segment_interactive: Run MedSAM2 with point/box prompts
- ml_segment_text: Run SAM3 with text prompt
- ml_health_check: Get gateway and model status
- ml_load_model: Pre-load a model for faster first inference
- ml_unload_model: Unload a model to free memory
- ml_list_models: List all available models

Usage:
    # Standalone MCP server
    python -m gateway.mcp_server --transport stdio

    # As part of gateway (same process)
    from gateway.mcp_server import start_mcp_server_thread
    start_mcp_server_thread()
"""

import asyncio
import base64
import io
import json
import logging
import os
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Literal

import aiohttp

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import nibabel as nib
    HAS_NIBABEL = True
except ImportError:
    HAS_NIBABEL = False

from mcp.server.fastmcp import FastMCP

from .config import get_config, get_available_models, get_model_config

logger = logging.getLogger(__name__)

# Gateway URL for internal HTTP calls
GATEWAY_URL = os.environ.get("ML_GATEWAY_URL", "http://localhost:5000")


# Initialize MCP server
# FastMCP takes name as positional arg, with optional instructions for context
mcp = FastMCP(
    name="CEREBRAL ML Gateway",
    instructions="ML inference tools for brain MRI analysis. Provides tools for lesion detection (UNet), brain parcellation (SynthSeg), interactive segmentation (MedSAM2), and text-based segmentation (SAM3)."
)


# ============================================================================
# HTTP Client Helpers
# ============================================================================

async def _get_http_session() -> aiohttp.ClientSession:
    """Get or create an aiohttp session."""
    return aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=180)  # 3 minute timeout for large models
    )


async def _gateway_request(
    method: str,
    endpoint: str,
    json_data: Optional[Dict] = None,
    form_data: Optional[aiohttp.FormData] = None,
) -> Dict[str, Any]:
    """
    Make an HTTP request to the gateway REST API.

    Args:
        method: HTTP method (GET, POST)
        endpoint: API endpoint (e.g., "/api/ml/unet/detect")
        json_data: JSON body for the request
        form_data: Form data for file uploads

    Returns:
        Response JSON as dictionary
    """
    url = f"{GATEWAY_URL}{endpoint}"

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=180)) as session:
        try:
            if method.upper() == "GET":
                async with session.get(url) as response:
                    result = await response.json()
                    if not response.ok:
                        logger.error(f"Gateway request failed: {response.status} - {result}")
                    return result
            elif method.upper() == "POST":
                if form_data:
                    async with session.post(url, data=form_data) as response:
                        result = await response.json()
                        if not response.ok:
                            logger.error(f"Gateway request failed: {response.status} - {result}")
                        return result
                else:
                    async with session.post(url, json=json_data) as response:
                        result = await response.json()
                        if not response.ok:
                            logger.error(f"Gateway request failed: {response.status} - {result}")
                        return result
            else:
                return {
                    "success": False,
                    "error": f"Unsupported HTTP method: {method}",
                    "error_code": "INVALID_METHOD"
                }
        except aiohttp.ClientError as e:
            logger.error(f"HTTP client error: {e}")
            return {
                "success": False,
                "error": f"Gateway connection error: {str(e)}",
                "error_code": "CONNECTION_ERROR"
            }
        except asyncio.TimeoutError:
            logger.error(f"Gateway request timeout for {endpoint}")
            return {
                "success": False,
                "error": "Gateway request timed out",
                "error_code": "TIMEOUT"
            }
        except Exception as e:
            logger.error(f"Unexpected error calling gateway: {e}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "INTERNAL_ERROR"
            }


# ============================================================================
# File and Image Helpers
# ============================================================================

def load_image_from_path(image_path: str) -> bytes:
    """Load image from file path and return bytes."""
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    return path.read_bytes()


def encode_image_base64(image_bytes: bytes) -> str:
    """Encode image bytes to base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")


def decode_image_base64(base64_str: str) -> bytes:
    """Decode base64 string to image bytes."""
    return base64.b64decode(base64_str)


def validate_nifti_path(image_path: str) -> Optional[Dict[str, Any]]:
    """
    Validate that image path exists and is a valid NIfTI file.

    Returns None if valid, error dict if invalid.
    """
    if not image_path:
        return {
            "success": False,
            "error": "image_path is required",
            "error_code": "INVALID_INPUT"
        }

    if not os.path.exists(image_path):
        return {
            "success": False,
            "error": f"File not found: {image_path}",
            "error_code": "FILE_NOT_FOUND"
        }

    path_lower = image_path.lower()
    if not (path_lower.endswith('.nii') or path_lower.endswith('.nii.gz')):
        return {
            "success": False,
            "error": f"Expected NIfTI file (.nii or .nii.gz), got: {image_path}",
            "error_code": "INVALID_INPUT"
        }

    return None


async def prepare_file_upload(image_path: str) -> aiohttp.FormData:
    """
    Prepare a file for upload via multipart form data.

    Args:
        image_path: Path to the file to upload

    Returns:
        aiohttp FormData object ready for upload
    """
    path = Path(image_path)
    file_bytes = path.read_bytes()

    form = aiohttp.FormData()
    form.add_field(
        'file',
        file_bytes,
        filename=path.name,
        content_type='application/octet-stream'
    )
    return form


# ============================================================================
# MCP Tools
# ============================================================================

@mcp.tool()
async def ml_detect_lesions(image_path: str) -> dict:
    """
    Detect lesions in a brain MRI using the UNet model.

    Analyzes the input MRI image and identifies hyperintense lesions
    (such as tumors, white matter lesions, or other pathological regions).
    Returns lesion count, volumes, and a visualization overlay.

    This tool wraps the gateway REST endpoint: POST /api/ml/unet/detect

    Args:
        image_path: Absolute path to NIfTI file (.nii or .nii.gz)

    Returns:
        Dictionary containing:
        - success: Boolean indicating success
        - num_lesions: Number of detected lesions
        - total_lesion_volume_mm2: Total lesion area
        - lesions: List of individual lesion details (top 10)
        - impression: Clinical impression text
        - lesion_overlay: Base64-encoded overlay image (PNG, data URI)
        - model: Model name and info
    """
    # Validate input path
    error = validate_nifti_path(image_path)
    if error:
        return error

    try:
        # Prepare file for upload
        form_data = await prepare_file_upload(image_path)

        # Call gateway REST endpoint
        result = await _gateway_request(
            method="POST",
            endpoint="/api/ml/unet/detect",
            form_data=form_data
        )

        return result

    except FileNotFoundError as e:
        return {
            "success": False,
            "error": str(e),
            "error_code": "FILE_NOT_FOUND"
        }
    except Exception as e:
        logger.error(f"UNet lesion detection failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_code": "INFERENCE_ERROR"
        }


@mcp.tool()
async def ml_segment_brain(image_path: str) -> dict:
    """
    Segment brain into 32 anatomical structures using SynthSeg.

    Performs automated brain parcellation to identify and measure
    32 distinct brain structures including cortical regions,
    subcortical structures, ventricles, and white matter.

    This tool wraps the gateway REST endpoint: POST /api/ml/synthseg/segment

    Structures include:
    - Cerebral cortex (left/right)
    - White matter
    - Ventricles (lateral, 3rd, 4th)
    - Hippocampus, Amygdala
    - Thalamus, Caudate, Putamen, Pallidum
    - Cerebellum, Brain stem

    Args:
        image_path: Absolute path to NIfTI file (.nii or .nii.gz)

    Returns:
        Dictionary containing:
        - success: Boolean indicating success
        - total_brain_volume_mm3: Total brain volume
        - total_brain_volume_ml: Total brain volume in milliliters
        - num_structures_detected: Number of structures found
        - structures: Dict mapping structure name to volume info
        - top_structures: Top 10 structures by volume
        - segmentation_preview: Base64-encoded preview image (PNG, data URI)
        - model: Model info
    """
    # Validate input path
    error = validate_nifti_path(image_path)
    if error:
        return error

    try:
        # Prepare file for upload
        form_data = await prepare_file_upload(image_path)

        # Call gateway REST endpoint
        result = await _gateway_request(
            method="POST",
            endpoint="/api/ml/synthseg/segment",
            form_data=form_data
        )

        return result

    except FileNotFoundError as e:
        return {
            "success": False,
            "error": str(e),
            "error_code": "FILE_NOT_FOUND"
        }
    except Exception as e:
        logger.error(f"SynthSeg brain segmentation failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_code": "INFERENCE_ERROR"
        }


@dataclass
class PointPrompt:
    """A point prompt for interactive segmentation."""
    x: int
    y: int
    label: int = 1  # 1 for foreground, 0 for background


@dataclass
class BoxPrompt:
    """A bounding box prompt for interactive segmentation."""
    x1: int
    y1: int
    x2: int
    y2: int


@mcp.tool()
async def ml_segment_interactive(
    image_path: str,
    points: Optional[List[Dict[str, int]]] = None,
    boxes: Optional[List[Dict[str, int]]] = None
) -> dict:
    """
    Interactive segmentation using MedSAM2 with point/box prompts.

    Allows precise segmentation of specific regions by providing
    point clicks or bounding boxes as prompts. Useful for
    interactive annotation and targeted region analysis.

    This tool wraps the gateway REST endpoint: POST /api/ml/medsam2/segment

    Args:
        image_path: Absolute path to NIfTI file (.nii or .nii.gz)
        points: List of point prompts, each with 'x' and 'y' coordinates
                Optional 'label': 1 for foreground, 0 for background
                Example: [{"x": 128, "y": 128}]
        boxes: List of box prompts, each with corner coordinates
               Format 1: {"x1": int, "y1": int, "x2": int, "y2": int}
               Format 2: {"x": int, "y": int, "w": int, "h": int}

    Returns:
        Dictionary containing:
        - success: Boolean indicating success
        - mask: Base64-encoded segmentation mask (PNG)
        - area_pixels: Segmented area in pixels
        - confidence: Segmentation confidence score (0-1)
        - prompts_used: Number of prompts used
        - model: Model info
    """
    # Validate input path
    error = validate_nifti_path(image_path)
    if error:
        return error

    # Validate prompts - at least one required
    if not points and not boxes:
        return {
            "success": False,
            "error": "At least one prompt (points or boxes) is required for interactive segmentation",
            "error_code": "INVALID_INPUT"
        }

    # Validate point prompts
    if points:
        for i, p in enumerate(points):
            if not isinstance(p, dict):
                return {
                    "success": False,
                    "error": f"Point {i} must be a dictionary with 'x' and 'y' keys",
                    "error_code": "INVALID_INPUT"
                }
            if "x" not in p or "y" not in p:
                return {
                    "success": False,
                    "error": f"Point {i} missing required 'x' or 'y' field",
                    "error_code": "INVALID_INPUT"
                }

    # Validate box prompts
    if boxes:
        for i, b in enumerate(boxes):
            if not isinstance(b, dict):
                return {
                    "success": False,
                    "error": f"Box {i} must be a dictionary",
                    "error_code": "INVALID_INPUT"
                }
            # Check for either format
            has_corners = all(k in b for k in ["x1", "y1", "x2", "y2"])
            has_dims = all(k in b for k in ["x", "y", "w", "h"])
            if not has_corners and not has_dims:
                return {
                    "success": False,
                    "error": f"Box {i} must have either (x1, y1, x2, y2) or (x, y, w, h)",
                    "error_code": "INVALID_INPUT"
                }

    try:
        # Prepare file for upload with prompts
        path = Path(image_path)
        file_bytes = path.read_bytes()

        form = aiohttp.FormData()
        form.add_field(
            'file',
            file_bytes,
            filename=path.name,
            content_type='application/octet-stream'
        )

        # Add prompts as JSON string fields
        if points:
            form.add_field('points', json.dumps(points))
        if boxes:
            form.add_field('boxes', json.dumps(boxes))

        # Call gateway REST endpoint
        result = await _gateway_request(
            method="POST",
            endpoint="/api/ml/medsam2/segment",
            form_data=form
        )

        return result

    except FileNotFoundError as e:
        return {
            "success": False,
            "error": str(e),
            "error_code": "FILE_NOT_FOUND"
        }
    except Exception as e:
        logger.error(f"MedSAM2 interactive segmentation failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_code": "INFERENCE_ERROR"
        }


@mcp.tool()
async def ml_segment_text(image_path: str, prompt: str) -> dict:
    """
    Text-guided segmentation using SAM3 with natural language prompts.

    Segments regions described by text prompts. Can identify anatomical
    structures, pathological regions, or any describable area.

    This tool wraps the gateway REST endpoint: POST /api/ml/sam3/segment

    Args:
        image_path: Absolute path to NIfTI file (.nii or .nii.gz)
        prompt: Text description of what to segment
                Examples: "tumor", "left ventricle", "white matter lesion",
                "hippocampus", "frontal lobe", "cerebellum"

    Returns:
        Dictionary containing:
        - success: Boolean indicating success
        - mask: Base64-encoded segmentation mask (PNG)
        - area_pixels: Segmented area in pixels
        - confidence: Segmentation confidence score (0-1)
        - prompt_used: The text prompt that was used
        - model: Model info
    """
    # Validate input path
    error = validate_nifti_path(image_path)
    if error:
        return error

    # Validate prompt
    if not prompt or not prompt.strip():
        return {
            "success": False,
            "error": "Text prompt is required and cannot be empty",
            "error_code": "INVALID_INPUT"
        }

    try:
        # Prepare file for upload with text prompt
        path = Path(image_path)
        file_bytes = path.read_bytes()
        text_prompt = prompt.strip()

        form = aiohttp.FormData()
        form.add_field(
            'file',
            file_bytes,
            filename=path.name,
            content_type='application/octet-stream'
        )
        form.add_field('text_prompt', text_prompt)

        # Call gateway REST endpoint
        result = await _gateway_request(
            method="POST",
            endpoint="/api/ml/sam3/segment",
            form_data=form
        )

        # Add prompt_used to result
        if result.get('success'):
            result['prompt_used'] = text_prompt

        return result

    except FileNotFoundError as e:
        return {
            "success": False,
            "error": str(e),
            "error_code": "FILE_NOT_FOUND"
        }
    except Exception as e:
        logger.error(f"SAM3 text segmentation failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_code": "INFERENCE_ERROR"
        }


@mcp.tool()
async def ml_health_check() -> dict:
    """
    Get gateway and model status.

    Returns comprehensive health information about the ML gateway
    including:
    - Overall status (healthy/degraded/starting)
    - Uptime
    - Status of each model (loaded, last_used, request_count)

    This tool wraps the gateway REST endpoint: GET /health

    Returns:
        Dictionary containing:
        - status: Overall gateway status
        - uptime_seconds: How long the gateway has been running
        - models_loaded: Number of currently loaded models
        - models_total: Total number of available models
        - models: Per-model status information
    """
    try:
        result = await _gateway_request(
            method="GET",
            endpoint="/health"
        )
        return result

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "error_code": "HEALTH_CHECK_FAILED"
        }


@mcp.tool()
async def ml_load_model(
    model_name: Literal["unet", "synthseg", "medsam2", "sam3"]
) -> dict:
    """
    Pre-load a model for faster first inference.

    Models are normally loaded lazily on first request. Use this tool
    to pre-load a model before it's needed, reducing latency on the
    first inference call.

    This tool wraps the gateway REST endpoint: POST /models/{name}/load

    Args:
        model_name: Name of the model to load. One of:
            - "unet": UNet lesion detector (~7.7M params, fast)
            - "synthseg": SynthSeg brain parcellation (~18M params)
            - "medsam2": MedSAM2 interactive segmentation (~89M params)
            - "sam3": SAM3 text/point/box segmentation (~636M params, largest)

    Returns:
        Dictionary containing:
        - success: Boolean indicating if model was loaded
        - model: Model name
        - message: Status message
        - load_time_ms: Time taken to load in milliseconds (if newly loaded)
    """
    try:
        available = get_available_models()
        if model_name not in available:
            return {
                "success": False,
                "model": model_name,
                "error": f"Unknown model: {model_name}. Available: {available}",
                "error_code": "INVALID_MODEL"
            }

        # Call gateway REST endpoint
        result = await _gateway_request(
            method="POST",
            endpoint=f"/models/{model_name}/load"
        )

        return result

    except Exception as e:
        logger.error(f"Failed to load model {model_name}: {e}")
        return {
            "success": False,
            "model": model_name,
            "error": str(e),
            "error_code": "LOAD_ERROR"
        }


# ============================================================================
# Additional MCP Tools
# ============================================================================

@mcp.tool()
async def ml_unload_model(
    model_name: Literal["unet", "synthseg", "medsam2", "sam3"]
) -> dict:
    """
    Unload a model to free memory.

    Removes the specified model from memory. The model will be
    automatically reloaded on the next inference request.

    This tool wraps the gateway REST endpoint: POST /models/{name}/unload

    Args:
        model_name: Name of the model to unload. One of:
            - "unet", "synthseg", "medsam2", "sam3"

    Returns:
        Dictionary containing:
        - success: Boolean indicating if model was unloaded
        - model: Model name
        - message: Status message
    """
    try:
        available = get_available_models()
        if model_name not in available:
            return {
                "success": False,
                "model": model_name,
                "error": f"Unknown model: {model_name}. Available: {available}",
                "error_code": "INVALID_MODEL"
            }

        # Call gateway REST endpoint
        result = await _gateway_request(
            method="POST",
            endpoint=f"/models/{model_name}/unload"
        )

        return result

    except Exception as e:
        logger.error(f"Failed to unload model {model_name}: {e}")
        return {
            "success": False,
            "model": model_name,
            "error": str(e),
            "error_code": "UNLOAD_ERROR"
        }


@mcp.tool()
async def ml_list_models() -> dict:
    """
    List all available ML models and their configurations.

    Returns information about each model including its purpose,
    timeout settings, and current load status.

    This tool wraps the gateway REST endpoint: GET /models

    Returns:
        Dictionary containing:
        - success: Boolean indicating success
        - models: Dictionary of model configurations and states
        - available_actions: Dict mapping model names to available actions
    """
    try:
        # Call gateway REST endpoint
        result = await _gateway_request(
            method="GET",
            endpoint="/models"
        )

        return result

    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_code": "LIST_ERROR"
        }


# ============================================================================
# Server lifecycle
# ============================================================================

def create_mcp_server() -> FastMCP:
    """
    Create and configure the MCP server.

    Returns:
        Configured FastMCP server instance
    """
    return mcp


def run_mcp_stdio():
    """
    Run the MCP server with stdio transport.

    This is the primary mode for Claude Code and similar tools.
    """
    logger.info("Starting MCP server with stdio transport")
    mcp.run(transport="stdio")


def run_mcp_sse(host: str = "0.0.0.0", port: int = 5001):
    """
    Run the MCP server with SSE (Server-Sent Events) transport.

    This allows web-based clients to connect.

    Args:
        host: Host to bind to
        port: Port to listen on
    """
    logger.info(f"Starting MCP server with SSE transport on {host}:{port}")
    mcp.run(transport="sse")


async def start_mcp_server_async():
    """
    Start the MCP server asynchronously.

    Used when integrating with the FastAPI gateway.
    Returns the MCP server instance.
    """
    logger.info("MCP server initialized and ready")
    return mcp


def start_mcp_server_thread() -> threading.Thread:
    """
    Start MCP server in a background thread.

    This allows the MCP server to run alongside the FastAPI
    gateway in the same process but on a different thread.
    Uses stdio transport for Claude Code compatibility.

    Returns:
        The background thread running the MCP server
    """
    def run_server():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            logger.info("Starting MCP server in background thread (stdio transport)")
            mcp.run(transport="stdio")
        except Exception as e:
            logger.error(f"MCP server error: {e}")
        finally:
            loop.close()

    thread = threading.Thread(
        target=run_server,
        name="MCP-Server-Thread",
        daemon=True
    )
    thread.start()
    logger.info("MCP server started in background thread")
    return thread


def get_mcp_server() -> FastMCP:
    """
    Get the MCP server instance.

    Returns:
        The FastMCP server instance
    """
    return mcp


# ============================================================================
# Main entry point
# ============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="CEREBRAL ML Gateway MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="Transport mode (default: stdio)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5001,
        help="Port for SSE transport (default: 5001)"
    )
    parser.add_argument(
        "--gateway-url",
        type=str,
        default="http://localhost:5000",
        help="ML Gateway URL (default: http://localhost:5000)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    args = parser.parse_args()

    # Configure logging
    level = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Set gateway URL from args
    global GATEWAY_URL
    GATEWAY_URL = args.gateway_url
    logger.info(f"MCP server will connect to gateway at: {GATEWAY_URL}")

    # Run server (MCP tools make HTTP calls to the gateway, no model manager needed)
    if args.transport == "stdio":
        run_mcp_stdio()
    else:
        run_mcp_sse(port=args.port)
