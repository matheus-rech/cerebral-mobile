#!/usr/bin/env python3
"""
Entry point for the CEREBRAL Unified ML Gateway.

Starts the FastAPI server with uvicorn, optionally with MCP server integration.

Usage:
    python start_gateway.py                     # Start gateway only
    python start_gateway.py --port 5000         # Custom port
    python start_gateway.py --reload            # Development mode
    python start_gateway.py --with-mcp          # Start with MCP server
    python start_gateway.py --mcp-only          # Start MCP server only (stdio)
"""

import argparse
import logging
import sys
import os

# Add the ml-backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="CEREBRAL Unified ML Gateway",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python start_gateway.py                    # Start with defaults (port 5000)
    python start_gateway.py --port 8000        # Use different port
    python start_gateway.py --reload           # Development mode
    python start_gateway.py --log-level debug  # Verbose logging
    python start_gateway.py --with-mcp         # Start with MCP server (same process)
    python start_gateway.py --mcp-only         # Start MCP server only (for Claude Code)
        """,
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5000,
        help="Port to listen on (default: 5000)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1, use 1 for ML models)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="info",
        choices=["debug", "info", "warning", "error", "critical"],
        help="Logging level (default: info)",
    )
    parser.add_argument(
        "--with-mcp",
        action="store_true",
        help="Also start MCP server in background thread (for AI agent integration)",
    )
    parser.add_argument(
        "--mcp-only",
        action="store_true",
        help="Start MCP server only (stdio transport, for Claude Code)",
    )

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger(__name__)

    # MCP-only mode
    if args.mcp_only:
        logger.info("=" * 60)
        logger.info("CEREBRAL ML Gateway - MCP Server Mode")
        logger.info("=" * 60)
        logger.info("Starting MCP server with stdio transport...")
        logger.info("This mode is for Claude Code integration.")
        logger.info("=" * 60)

        try:
            from gateway.mcp_server import run_mcp_stdio
            from gateway.model_manager import get_model_manager

            # Initialize model manager
            manager = get_model_manager()
            manager.start()

            # Run MCP server (blocking)
            run_mcp_stdio()

        except KeyboardInterrupt:
            logger.info("Shutting down MCP server...")
            manager = get_model_manager()
            manager.stop()
            sys.exit(0)
        except ImportError as e:
            logger.error(f"Failed to import MCP server: {e}")
            logger.error("Make sure 'mcp' package is installed: pip install mcp>=1.0.0")
            sys.exit(1)

        return

    # Normal gateway mode
    logger.info("=" * 60)
    logger.info("CEREBRAL Unified ML Gateway")
    logger.info("=" * 60)
    logger.info(f"Host: {args.host}")
    logger.info(f"Port: {args.port}")
    logger.info(f"Workers: {args.workers}")
    logger.info(f"Reload: {args.reload}")
    logger.info(f"Log Level: {args.log_level}")
    logger.info(f"MCP Server: {'enabled' if args.with_mcp else 'disabled'}")
    logger.info("=" * 60)

    try:
        import uvicorn
    except ImportError:
        logger.error("uvicorn not installed. Install with: pip install uvicorn[standard]")
        sys.exit(1)

    # Start MCP server in background thread if requested
    if args.with_mcp:
        try:
            from gateway.mcp_server import start_mcp_server_thread
            mcp_thread = start_mcp_server_thread()
            logger.info("MCP server started in background thread")
        except ImportError as e:
            logger.warning(f"Could not start MCP server: {e}")
            logger.warning("Install 'mcp' package for MCP support: pip install mcp>=1.0.0")

    # Start the FastAPI server
    uvicorn.run(
        "gateway.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,  # Reload requires single worker
        log_level=args.log_level,
    )


if __name__ == "__main__":
    main()
