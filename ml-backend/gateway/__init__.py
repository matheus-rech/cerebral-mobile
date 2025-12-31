"""
Unified ML Gateway Package

Provides a single entry point for all ML models used in CEREBRAL Mobile.
Routes requests to the appropriate model, manages model lifecycle,
handles retries and timeouts transparently.

Modules:
    - app: FastAPI application with routes and middleware
    - config: Model configs, timeouts, ports
    - model_manager: Loads/unloads models, tracks state
    - mcp_server: MCP tool definitions for agent workflows
    - utils: Retry, timeout, and health utilities

Subpackages:
    - models: Model wrapper classes (UNet, SynthSeg, MedSAM2, SAM3)
"""

__version__ = "1.0.0"

# Lazy imports to avoid loading everything at once
def get_app():
    """Get the FastAPI application."""
    from .app import app
    return app


def get_mcp_server():
    """Get the MCP server instance."""
    from .mcp_server import mcp
    return mcp


def get_model_manager():
    """Get the ModelManager singleton."""
    from .model_manager import get_model_manager as _get_manager
    return _get_manager()
