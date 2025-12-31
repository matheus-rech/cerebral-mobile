"""
FastAPI Application for the Unified ML Gateway.

Provides REST endpoints for ML inference, health monitoring, and model management.
"""

import logging
import time
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .config import get_config, get_model_config, get_available_models
from .model_manager import get_model_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ============================================================================
# Pydantic Models for Request/Response
# ============================================================================


class ErrorDetail(BaseModel):
    """Structured error information."""
    code: str
    message: str
    model: Optional[str] = None
    retriable: bool = False
    suggestion: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response format."""
    success: bool = False
    error: ErrorDetail


class SuccessResponse(BaseModel):
    """Standard success response format."""
    success: bool = True
    data: Any


class ModelLoadRequest(BaseModel):
    """Request to load a model."""
    pass  # No additional fields needed


class InferenceResponse(BaseModel):
    """Response from inference endpoint."""
    success: bool
    model: str
    action: str
    result: Optional[dict] = None
    inference_time_ms: Optional[float] = None
    error: Optional[ErrorDetail] = None


# ============================================================================
# Error Codes and Helpers
# ============================================================================


class ErrorCode:
    """Standard error codes for the gateway."""
    UNKNOWN_MODEL = "UNKNOWN_MODEL"
    MODEL_NOT_LOADED = "MODEL_NOT_LOADED"
    MODEL_LOAD_FAILED = "MODEL_LOAD_FAILED"
    TIMEOUT = "TIMEOUT"
    INFERENCE_FAILED = "INFERENCE_FAILED"
    INVALID_REQUEST = "INVALID_REQUEST"
    INVALID_ACTION = "INVALID_ACTION"
    FILE_REQUIRED = "FILE_REQUIRED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


def create_error_response(
    code: str,
    message: str,
    model: Optional[str] = None,
    retriable: bool = False,
    suggestion: Optional[str] = None,
    status_code: int = 400,
) -> JSONResponse:
    """Create a standardized error response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "model": model,
                "retriable": retriable,
                "suggestion": suggestion,
            },
        },
    )


# ============================================================================
# Application Lifecycle
# ============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - handles startup and shutdown."""
    # Startup
    logger.info("Starting Unified ML Gateway...")
    manager = get_model_manager()
    manager.start()
    logger.info("ML Gateway started successfully")

    yield

    # Shutdown
    logger.info("Shutting down ML Gateway...")
    manager.stop()
    logger.info("ML Gateway shutdown complete")


# ============================================================================
# FastAPI Application
# ============================================================================


app = FastAPI(
    title="CEREBRAL ML Gateway",
    description="Unified ML Gateway for CEREBRAL Mobile - manages UNet, SynthSeg, MedSAM2, and SAM3 models",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================================
# Middleware
# ============================================================================


# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log all requests and add timing information."""
    start_time = time.time()
    request_id = f"{int(start_time * 1000)}"

    logger.info(f"[{request_id}] {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"-> {response.status_code} ({duration_ms:.0f}ms)"
        )
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(round(duration_ms, 2))
        return response
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(
            f"[{request_id}] {request.method} {request.url.path} "
            f"-> ERROR ({duration_ms:.0f}ms): {e}"
        )
        raise


@app.middleware("http")
async def request_size_limit_middleware(request: Request, call_next):
    """Enforce request size limits."""
    config = get_config()
    max_size = config.max_request_size_mb * 1024 * 1024

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > max_size:
        return create_error_response(
            code=ErrorCode.INVALID_REQUEST,
            message=f"Request body too large. Maximum size is {config.max_request_size_mb}MB",
            status_code=413,
        )

    return await call_next(request)


# ============================================================================
# Health and Status Endpoints
# ============================================================================


@app.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns overall gateway status and per-model status.
    """
    manager = get_model_manager()
    status = manager.get_status()
    return status


@app.get("/models")
async def list_models():
    """
    List all available models and their current state.

    Returns configuration and runtime state for each model.
    """
    config = get_config()
    manager = get_model_manager()
    status = manager.get_status()

    models = {}
    for name, model_config in config.models.items():
        model_state = status["models"].get(name, {})
        models[name] = {
            "config": model_config.to_dict(),
            "state": model_state,
        }

    return {
        "success": True,
        "models": models,
        "available_actions": {
            "unet": ["detect"],
            "synthseg": ["segment"],
            "medsam2": ["segment"],
            "sam3": ["segment"],
        },
    }


# ============================================================================
# Model Management Endpoints
# ============================================================================


@app.post("/models/{name}/load")
async def load_model(name: str):
    """
    Force load a model into memory.

    Useful for warming up models before inference.
    """
    if name not in get_available_models():
        return create_error_response(
            code=ErrorCode.UNKNOWN_MODEL,
            message=f"Unknown model: {name}",
            model=name,
            suggestion=f"Available models: {', '.join(get_available_models())}",
            status_code=404,
        )

    manager = get_model_manager()

    try:
        start_time = time.time()
        success = manager.load_model(name)
        load_time_ms = (time.time() - start_time) * 1000

        if success:
            return {
                "success": True,
                "model": name,
                "message": f"Model {name} loaded successfully",
                "load_time_ms": round(load_time_ms, 2),
            }
        else:
            state = manager.get_model_state(name)
            return create_error_response(
                code=ErrorCode.MODEL_LOAD_FAILED,
                message=f"Failed to load model {name}",
                model=name,
                retriable=True,
                suggestion=state.error if state else None,
                status_code=500,
            )
    except Exception as e:
        logger.error(f"Error loading model {name}: {e}")
        return create_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message=str(e),
            model=name,
            status_code=500,
        )


@app.post("/models/{name}/unload")
async def unload_model(name: str):
    """
    Unload a model from memory.

    Frees memory but requires reload before next inference.
    """
    if name not in get_available_models():
        return create_error_response(
            code=ErrorCode.UNKNOWN_MODEL,
            message=f"Unknown model: {name}",
            model=name,
            suggestion=f"Available models: {', '.join(get_available_models())}",
            status_code=404,
        )

    manager = get_model_manager()

    try:
        success = manager.unload_model(name)

        if success:
            return {
                "success": True,
                "model": name,
                "message": f"Model {name} unloaded successfully",
            }
        else:
            return create_error_response(
                code=ErrorCode.INTERNAL_ERROR,
                message=f"Failed to unload model {name}",
                model=name,
                status_code=500,
            )
    except Exception as e:
        logger.error(f"Error unloading model {name}: {e}")
        return create_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message=str(e),
            model=name,
            status_code=500,
        )


# ============================================================================
# ML Inference Endpoint
# ============================================================================


@app.post("/api/ml/{model}/{action}")
async def ml_inference(
    model: str,
    action: str,
    request: Request,
    file: Optional[UploadFile] = File(None),
    # Common parameters that may be passed
    text_prompt: Optional[str] = Form(None),
    points: Optional[str] = Form(None),  # JSON string of point coordinates
    boxes: Optional[str] = Form(None),   # JSON string of bounding boxes
):
    """
    Unified ML inference endpoint.

    Routes requests to the appropriate model and action.

    Supported models and actions:
    - unet/detect: Lesion detection
    - synthseg/segment: Brain parcellation (32 structures)
    - medsam2/segment: Interactive segmentation with prompts
    - sam3/segment: Text/point/box segmentation
    """
    # Validate model
    if model not in get_available_models():
        return create_error_response(
            code=ErrorCode.UNKNOWN_MODEL,
            message=f"Unknown model: {model}",
            model=model,
            suggestion=f"Available models: {', '.join(get_available_models())}",
            status_code=404,
        )

    # Validate action for model
    valid_actions = {
        "unet": ["detect"],
        "synthseg": ["segment"],
        "medsam2": ["segment"],
        "sam3": ["segment"],
    }

    if action not in valid_actions.get(model, []):
        return create_error_response(
            code=ErrorCode.INVALID_ACTION,
            message=f"Invalid action '{action}' for model '{model}'",
            model=model,
            suggestion=f"Valid actions for {model}: {', '.join(valid_actions[model])}",
            status_code=400,
        )

    # Get model instance (loads if not already loaded)
    manager = get_model_manager()

    try:
        start_time = time.time()
        model_instance = manager.get_model(model)

        # Prepare input data
        input_data = {
            "action": action,
            "text_prompt": text_prompt,
            "points": points,
            "boxes": boxes,
        }

        # Read file if provided
        if file:
            input_data["file_content"] = await file.read()
            input_data["file_name"] = file.filename
            input_data["content_type"] = file.content_type

        # Run inference (placeholder for now)
        # TODO: Replace with actual model wrapper call
        result = model_instance.predict(input_data)

        inference_time_ms = (time.time() - start_time) * 1000

        return {
            "success": True,
            "model": model,
            "action": action,
            "result": result,
            "inference_time_ms": round(inference_time_ms, 2),
        }

    except ValueError as e:
        return create_error_response(
            code=ErrorCode.INVALID_REQUEST,
            message=str(e),
            model=model,
            status_code=400,
        )
    except RuntimeError as e:
        return create_error_response(
            code=ErrorCode.MODEL_LOAD_FAILED,
            message=str(e),
            model=model,
            retriable=True,
            status_code=503,
        )
    except TimeoutError as e:
        model_config = get_model_config(model)
        timeout = model_config.timeout_seconds if model_config else "unknown"
        return create_error_response(
            code=ErrorCode.TIMEOUT,
            message=f"{model} inference exceeded {timeout}s timeout",
            model=model,
            retriable=True,
            suggestion="Try a smaller image or use a faster model like UNet",
            status_code=504,
        )
    except Exception as e:
        logger.error(f"Inference error for {model}/{action}: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(
            code=ErrorCode.INFERENCE_FAILED,
            message=str(e),
            model=model,
            retriable=True,
            status_code=500,
        )


# ============================================================================
# Root Endpoint
# ============================================================================


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "CEREBRAL ML Gateway",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "GET /health",
            "models": "GET /models",
            "inference": "POST /api/ml/{model}/{action}",
            "load_model": "POST /models/{name}/load",
            "unload_model": "POST /models/{name}/unload",
        },
        "documentation": "/docs",
    }
