"""
Tests for MCP Server Integration.

Verifies that MCP tools are registered correctly and
function as expected.
"""

import pytest
import sys
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Add the parent directory to the path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestMCPServerRegistration:
    """Test that MCP tools are registered correctly."""

    def test_mcp_server_import(self):
        """Test that MCP server module can be imported."""
        from gateway import mcp_server
        assert mcp_server is not None

    def test_mcp_instance_exists(self):
        """Test that the FastMCP instance is created."""
        from gateway.mcp_server import mcp
        assert mcp is not None
        assert mcp.name == "CEREBRAL ML Gateway"

    def test_tools_registered(self):
        """Test that all expected tools are registered."""
        from gateway.mcp_server import mcp

        # Get registered tools
        # FastMCP stores tools internally
        # We check by looking at the tool definitions

        expected_tools = [
            "ml_detect_lesions",
            "ml_segment_brain",
            "ml_segment_interactive",
            "ml_segment_text",
            "ml_health_check",
            "ml_load_model",
        ]

        # Access the internal tool registry
        # Note: FastMCP may expose tools differently depending on version
        for tool_name in expected_tools:
            # Check that the function exists in the module
            from gateway import mcp_server
            assert hasattr(mcp_server, tool_name), f"Tool {tool_name} not found"

    def test_ml_detect_lesions_signature(self):
        """Test ml_detect_lesions has correct signature."""
        from gateway.mcp_server import ml_detect_lesions
        import inspect

        sig = inspect.signature(ml_detect_lesions)
        params = list(sig.parameters.keys())

        assert "image_path" in params
        assert sig.parameters["image_path"].annotation == str

    def test_ml_segment_brain_signature(self):
        """Test ml_segment_brain has correct signature."""
        from gateway.mcp_server import ml_segment_brain
        import inspect

        sig = inspect.signature(ml_segment_brain)
        params = list(sig.parameters.keys())

        assert "image_path" in params
        assert sig.parameters["image_path"].annotation == str

    def test_ml_segment_interactive_signature(self):
        """Test ml_segment_interactive has correct signature."""
        from gateway.mcp_server import ml_segment_interactive
        import inspect

        sig = inspect.signature(ml_segment_interactive)
        params = list(sig.parameters.keys())

        assert "image_path" in params
        assert "points" in params
        assert "boxes" in params

    def test_ml_segment_text_signature(self):
        """Test ml_segment_text has correct signature."""
        from gateway.mcp_server import ml_segment_text
        import inspect

        sig = inspect.signature(ml_segment_text)
        params = list(sig.parameters.keys())

        assert "image_path" in params
        assert "prompt" in params
        assert sig.parameters["prompt"].annotation == str

    def test_ml_health_check_signature(self):
        """Test ml_health_check has correct signature."""
        from gateway.mcp_server import ml_health_check
        import inspect

        sig = inspect.signature(ml_health_check)
        # Should have no required parameters
        params = list(sig.parameters.keys())
        assert len(params) == 0

    def test_ml_load_model_signature(self):
        """Test ml_load_model has correct signature."""
        from gateway.mcp_server import ml_load_model
        import inspect

        sig = inspect.signature(ml_load_model)
        params = list(sig.parameters.keys())

        assert "model_name" in params


class TestMCPToolFunctions:
    """Test MCP tool function behavior."""

    @pytest.fixture
    def mock_model_manager(self):
        """Create a mock ModelManager."""
        with patch("gateway.mcp_server.get_model_manager") as mock:
            manager = MagicMock()
            manager.get_status.return_value = {
                "status": "healthy",
                "uptime_seconds": 100,
                "models_loaded": 2,
                "models_total": 4,
                "models": {
                    "unet": {"loaded": True, "request_count": 10},
                    "synthseg": {"loaded": True, "request_count": 5},
                    "medsam2": {"loaded": False, "request_count": 0},
                    "sam3": {"loaded": False, "request_count": 0},
                }
            }
            manager.is_model_loaded.return_value = False
            manager.load_model.return_value = True
            manager.get_model_state.return_value = MagicMock(
                load_time_seconds=1.5,
                error=None
            )
            mock.return_value = manager
            yield manager

    @pytest.mark.asyncio
    async def test_ml_health_check_returns_status(self, mock_model_manager):
        """Test that health check returns gateway status."""
        from gateway.mcp_server import ml_health_check

        result = await ml_health_check()

        assert result["status"] == "healthy"
        assert result["uptime_seconds"] == 100
        assert result["models_loaded"] == 2
        assert result["models_total"] == 4
        assert "models" in result

    @pytest.mark.asyncio
    async def test_ml_load_model_loads_unet(self, mock_model_manager):
        """Test loading UNet model."""
        from gateway.mcp_server import ml_load_model

        result = await ml_load_model("unet")

        assert result["success"] is True
        assert result["model"] == "unet"
        mock_model_manager.load_model.assert_called_once_with("unet")

    @pytest.mark.asyncio
    async def test_ml_load_model_invalid_name(self, mock_model_manager):
        """Test loading invalid model name returns error."""
        from gateway.mcp_server import ml_load_model

        result = await ml_load_model("invalid_model")

        assert result["success"] is False
        assert "error" in result
        assert result["error_code"] == "INVALID_MODEL"

    @pytest.mark.asyncio
    async def test_ml_detect_lesions_file_not_found(self, mock_model_manager):
        """Test lesion detection with non-existent file."""
        from gateway.mcp_server import ml_detect_lesions

        result = await ml_detect_lesions("/nonexistent/path/image.nii.gz")

        assert result["success"] is False
        assert result["error_code"] == "FILE_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_ml_detect_lesions_invalid_extension(self, mock_model_manager):
        """Test lesion detection with invalid file extension."""
        from gateway.mcp_server import ml_detect_lesions

        result = await ml_detect_lesions("/some/path/image.png")

        assert result["success"] is False
        assert result["error_code"] == "INVALID_INPUT"

    @pytest.mark.asyncio
    async def test_ml_segment_interactive_no_prompts(self, mock_model_manager):
        """Test interactive segmentation requires prompts."""
        from gateway.mcp_server import ml_segment_interactive
        import tempfile
        import os

        # Create a temporary NIfTI file path
        with tempfile.NamedTemporaryFile(suffix='.nii.gz', delete=False) as f:
            temp_path = f.name
            f.write(b'\x00' * 100)  # Write minimal content

        try:
            result = await ml_segment_interactive(
                temp_path,
                points=None,
                boxes=None
            )

            assert result["success"] is False
            assert result["error_code"] == "INVALID_INPUT"
            assert "prompt" in result["error"].lower()
        finally:
            os.unlink(temp_path)

    @pytest.mark.asyncio
    async def test_ml_segment_interactive_invalid_point(self, mock_model_manager):
        """Test interactive segmentation with invalid point format."""
        from gateway.mcp_server import ml_segment_interactive
        import tempfile
        import os

        # Create a temporary NIfTI file path
        with tempfile.NamedTemporaryFile(suffix='.nii.gz', delete=False) as f:
            temp_path = f.name
            f.write(b'\x00' * 100)

        try:
            result = await ml_segment_interactive(
                temp_path,
                points=[{"invalid": "point"}],  # Missing x, y
                boxes=None
            )

            assert result["success"] is False
            assert result["error_code"] == "INVALID_INPUT"
        finally:
            os.unlink(temp_path)

    @pytest.mark.asyncio
    async def test_ml_segment_text_empty_prompt(self, mock_model_manager):
        """Test text segmentation requires non-empty prompt."""
        from gateway.mcp_server import ml_segment_text
        import tempfile
        import os

        # Create a temporary NIfTI file path
        with tempfile.NamedTemporaryFile(suffix='.nii.gz', delete=False) as f:
            temp_path = f.name
            f.write(b'\x00' * 100)

        try:
            result = await ml_segment_text(temp_path, "")

            assert result["success"] is False
            assert result["error_code"] == "INVALID_INPUT"
        finally:
            os.unlink(temp_path)


class TestHelperFunctions:
    """Test helper functions."""

    def test_encode_decode_base64_roundtrip(self):
        """Test base64 encoding and decoding."""
        from gateway.mcp_server import encode_image_base64, decode_image_base64

        original_data = b"test image data bytes"
        encoded = encode_image_base64(original_data)
        decoded = decode_image_base64(encoded)

        assert decoded == original_data

    def test_load_image_from_path_not_found(self):
        """Test loading non-existent file raises error."""
        from gateway.mcp_server import load_image_from_path

        with pytest.raises(FileNotFoundError):
            load_image_from_path("/nonexistent/path/image.png")

    def test_validate_nifti_path_valid(self):
        """Test validate_nifti_path with valid path."""
        from gateway.mcp_server import validate_nifti_path
        import tempfile
        import os

        # Create temporary NIfTI file
        with tempfile.NamedTemporaryFile(suffix='.nii.gz', delete=False) as f:
            temp_path = f.name
            f.write(b'\x00' * 100)

        try:
            result = validate_nifti_path(temp_path)
            assert result is None  # None means valid
        finally:
            os.unlink(temp_path)

    def test_validate_nifti_path_not_found(self):
        """Test validate_nifti_path with non-existent file."""
        from gateway.mcp_server import validate_nifti_path

        result = validate_nifti_path("/nonexistent/path/image.nii.gz")
        assert result is not None
        assert result["success"] is False
        assert result["error_code"] == "FILE_NOT_FOUND"

    def test_validate_nifti_path_invalid_extension(self):
        """Test validate_nifti_path with invalid extension."""
        from gateway.mcp_server import validate_nifti_path
        import tempfile
        import os

        # Create temporary file with wrong extension
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            temp_path = f.name
            f.write(b'\x00' * 100)

        try:
            result = validate_nifti_path(temp_path)
            assert result is not None
            assert result["success"] is False
            assert result["error_code"] == "INVALID_INPUT"
        finally:
            os.unlink(temp_path)

    def test_validate_nifti_path_empty(self):
        """Test validate_nifti_path with empty path."""
        from gateway.mcp_server import validate_nifti_path

        result = validate_nifti_path("")
        assert result is not None
        assert result["success"] is False
        assert result["error_code"] == "INVALID_INPUT"


class TestMCPServerLifecycle:
    """Test MCP server lifecycle functions."""

    def test_create_mcp_server_returns_instance(self):
        """Test creating MCP server returns FastMCP instance."""
        from gateway.mcp_server import create_mcp_server

        server = create_mcp_server()

        assert server is not None
        assert hasattr(server, "run")

    def test_get_mcp_server_returns_instance(self):
        """Test getting MCP server returns the same instance."""
        from gateway.mcp_server import get_mcp_server, mcp

        server = get_mcp_server()

        assert server is not None
        assert server is mcp

    @pytest.mark.asyncio
    async def test_start_mcp_server_async(self):
        """Test async server startup."""
        with patch("gateway.mcp_server.get_model_manager") as mock_manager:
            manager = MagicMock()
            mock_manager.return_value = manager

            from gateway.mcp_server import start_mcp_server_async

            result = await start_mcp_server_async()

            assert result is not None

    def test_start_mcp_server_thread(self):
        """Test starting MCP server in background thread."""
        with patch("gateway.mcp_server.mcp") as mock_mcp:
            # Don't actually run the server
            mock_mcp.run = MagicMock()

            from gateway.mcp_server import start_mcp_server_thread

            # Start thread
            thread = start_mcp_server_thread()

            assert thread is not None
            assert thread.name == "MCP-Server-Thread"
            assert thread.daemon is True


class TestAdditionalMCPTools:
    """Test additional MCP tools."""

    @pytest.fixture
    def mock_model_manager(self):
        """Create a mock ModelManager."""
        with patch("gateway.mcp_server.get_model_manager") as mock:
            manager = MagicMock()
            manager.get_status.return_value = {
                "status": "healthy",
                "uptime_seconds": 100,
                "models_loaded": 2,
                "models_total": 4,
                "models": {
                    "unet": {"loaded": True, "request_count": 10},
                    "synthseg": {"loaded": True, "request_count": 5},
                    "medsam2": {"loaded": False, "request_count": 0},
                    "sam3": {"loaded": False, "request_count": 0},
                }
            }
            manager.is_model_loaded.return_value = True
            manager.unload_model.return_value = True
            mock.return_value = manager
            yield manager

    @pytest.mark.asyncio
    async def test_ml_unload_model_success(self, mock_model_manager):
        """Test successfully unloading a model."""
        from gateway.mcp_server import ml_unload_model

        result = await ml_unload_model("unet")

        assert result["success"] is True
        assert result["model"] == "unet"
        mock_model_manager.unload_model.assert_called_once_with("unet")

    @pytest.mark.asyncio
    async def test_ml_unload_model_invalid_name(self, mock_model_manager):
        """Test unloading invalid model name."""
        from gateway.mcp_server import ml_unload_model

        result = await ml_unload_model("invalid_model")

        assert result["success"] is False
        assert result["error_code"] == "INVALID_MODEL"

    @pytest.mark.asyncio
    async def test_ml_list_models(self, mock_model_manager):
        """Test listing all models."""
        from gateway.mcp_server import ml_list_models

        result = await ml_list_models()

        assert result["success"] is True
        assert "models" in result
        assert "available_models" in result


class TestMCPToolDocstrings:
    """Test that all tools have proper documentation."""

    def test_ml_detect_lesions_has_docstring(self):
        """Test ml_detect_lesions has documentation."""
        from gateway.mcp_server import ml_detect_lesions
        assert ml_detect_lesions.__doc__ is not None
        assert len(ml_detect_lesions.__doc__) > 50
        assert "lesion" in ml_detect_lesions.__doc__.lower()

    def test_ml_segment_brain_has_docstring(self):
        """Test ml_segment_brain has documentation."""
        from gateway.mcp_server import ml_segment_brain
        assert ml_segment_brain.__doc__ is not None
        assert len(ml_segment_brain.__doc__) > 50
        assert "brain" in ml_segment_brain.__doc__.lower()

    def test_ml_segment_interactive_has_docstring(self):
        """Test ml_segment_interactive has documentation."""
        from gateway.mcp_server import ml_segment_interactive
        assert ml_segment_interactive.__doc__ is not None
        assert len(ml_segment_interactive.__doc__) > 50
        assert "prompt" in ml_segment_interactive.__doc__.lower()

    def test_ml_segment_text_has_docstring(self):
        """Test ml_segment_text has documentation."""
        from gateway.mcp_server import ml_segment_text
        assert ml_segment_text.__doc__ is not None
        assert len(ml_segment_text.__doc__) > 50
        assert "text" in ml_segment_text.__doc__.lower()

    def test_ml_health_check_has_docstring(self):
        """Test ml_health_check has documentation."""
        from gateway.mcp_server import ml_health_check
        assert ml_health_check.__doc__ is not None
        assert "status" in ml_health_check.__doc__.lower()

    def test_ml_load_model_has_docstring(self):
        """Test ml_load_model has documentation."""
        from gateway.mcp_server import ml_load_model
        assert ml_load_model.__doc__ is not None
        assert "load" in ml_load_model.__doc__.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
