"""
Unit tests for the errors module.

Tests custom exceptions and error formatting.
"""

import pytest
from gateway.utils.errors import (
    ErrorCode,
    GatewayError,
    ModelNotFoundError,
    InferenceTimeoutError,
    ModelLoadError,
    InferenceError,
    ValidationError,
    MemoryError,
    format_error_response,
    format_success_response,
)


class TestErrorCode:
    """Tests for ErrorCode enum."""

    def test_error_codes_are_strings(self):
        """Error codes should be string values."""
        assert ErrorCode.TIMEOUT.value == "TIMEOUT"
        assert ErrorCode.MODEL_NOT_FOUND.value == "MODEL_NOT_FOUND"
        assert ErrorCode.MODEL_LOAD_ERROR.value == "MODEL_LOAD_ERROR"
        assert ErrorCode.INFERENCE_ERROR.value == "INFERENCE_ERROR"
        assert ErrorCode.VALIDATION_ERROR.value == "VALIDATION_ERROR"
        assert ErrorCode.MEMORY_ERROR.value == "MEMORY_ERROR"
        assert ErrorCode.INTERNAL_ERROR.value == "INTERNAL_ERROR"


class TestGatewayError:
    """Tests for GatewayError base class."""

    def test_basic_error(self):
        """Test basic error creation."""
        error = GatewayError("Something went wrong")
        assert str(error) == "Something went wrong"
        assert error.message == "Something went wrong"
        assert error.model is None
        assert error.error_code == ErrorCode.INTERNAL_ERROR
        assert error.retriable is False
        assert error.suggestion is None

    def test_error_with_all_fields(self):
        """Test error with all fields populated."""
        error = GatewayError(
            message="Test error",
            model="sam3",
            error_code=ErrorCode.TIMEOUT,
            retriable=True,
            suggestion="Try again later",
            cause=ValueError("root cause"),
        )
        assert error.message == "Test error"
        assert error.model == "sam3"
        assert error.error_code == ErrorCode.TIMEOUT
        assert error.retriable is True
        assert error.suggestion == "Try again later"
        assert isinstance(error.cause, ValueError)

    def test_to_dict(self):
        """Test conversion to dictionary."""
        error = GatewayError(
            message="Test error",
            model="unet",
            error_code=ErrorCode.INFERENCE_ERROR,
            retriable=True,
            suggestion="Check input format",
        )
        result = error.to_dict()

        assert result["code"] == "INFERENCE_ERROR"
        assert result["message"] == "Test error"
        assert result["model"] == "unet"
        assert result["retriable"] is True
        assert result["suggestion"] == "Check input format"

    def test_to_dict_minimal(self):
        """Test to_dict with minimal fields."""
        error = GatewayError("Simple error")
        result = error.to_dict()

        assert result["code"] == "INTERNAL_ERROR"
        assert result["message"] == "Simple error"
        assert result["retriable"] is False
        assert "model" not in result
        assert "suggestion" not in result


class TestModelNotFoundError:
    """Tests for ModelNotFoundError."""

    def test_default_message(self):
        """Test default error message."""
        error = ModelNotFoundError("sam3")
        assert "sam3" in error.message
        assert error.model == "sam3"
        assert error.error_code == ErrorCode.MODEL_NOT_FOUND
        assert error.retriable is False

    def test_custom_message(self):
        """Test custom error message."""
        error = ModelNotFoundError(
            model="unet",
            message="UNet model not configured",
            suggestion="Check your config file",
        )
        assert error.message == "UNet model not configured"
        assert error.suggestion == "Check your config file"

    def test_default_suggestion(self):
        """Test default suggestion."""
        error = ModelNotFoundError("medsam2")
        assert "GET /models" in error.suggestion


class TestInferenceTimeoutError:
    """Tests for InferenceTimeoutError."""

    def test_default_message(self):
        """Test default error message."""
        error = InferenceTimeoutError("sam3", 120.0)
        assert "sam3" in error.message
        assert "120" in error.message
        assert error.timeout_seconds == 120.0
        assert error.error_code == ErrorCode.TIMEOUT
        assert error.retriable is False

    def test_custom_message(self):
        """Test custom error message."""
        error = InferenceTimeoutError(
            model="synthseg",
            timeout_seconds=60.0,
            message="SynthSeg took too long",
            suggestion="Use a smaller brain volume",
        )
        assert error.message == "SynthSeg took too long"
        assert error.suggestion == "Use a smaller brain volume"
        assert error.timeout_seconds == 60.0


class TestModelLoadError:
    """Tests for ModelLoadError."""

    def test_default_message(self):
        """Test default error message."""
        error = ModelLoadError("sam3")
        assert "sam3" in error.message
        assert error.error_code == ErrorCode.MODEL_LOAD_ERROR
        assert error.retriable is True  # Load errors are typically retriable

    def test_with_cause(self):
        """Test error with cause."""
        cause = RuntimeError("Out of memory")
        error = ModelLoadError("medsam2", cause=cause)
        assert error.cause is cause

    def test_default_suggestion(self):
        """Test default suggestion."""
        error = ModelLoadError("sam3")
        assert "unload" in error.suggestion.lower()


class TestInferenceError:
    """Tests for InferenceError."""

    def test_default_message(self):
        """Test default error message."""
        error = InferenceError("unet")
        assert "unet" in error.message
        assert error.error_code == ErrorCode.INFERENCE_ERROR
        assert error.retriable is True

    def test_with_cause(self):
        """Test error with cause exception."""
        cause = ValueError("Invalid input shape")
        error = InferenceError("synthseg", cause=cause)
        assert error.cause is cause


class TestValidationError:
    """Tests for ValidationError."""

    def test_basic_validation_error(self):
        """Test basic validation error."""
        error = ValidationError("Invalid image format")
        assert error.message == "Invalid image format"
        assert error.error_code == ErrorCode.VALIDATION_ERROR
        assert error.retriable is False

    def test_with_model(self):
        """Test validation error with model context."""
        error = ValidationError(
            message="Image too large for SAM3",
            model="sam3",
            suggestion="Resize to max 1024x1024",
        )
        assert error.model == "sam3"
        assert "Resize" in error.suggestion


class TestMemoryError:
    """Tests for MemoryError."""

    def test_default_message(self):
        """Test default error message."""
        error = MemoryError()
        assert "memory" in error.message.lower()
        assert error.error_code == ErrorCode.MEMORY_ERROR
        assert error.retriable is True

    def test_default_suggestion(self):
        """Test default suggestion mentions unloading."""
        error = MemoryError()
        assert "unload" in error.suggestion.lower()


class TestFormatErrorResponse:
    """Tests for format_error_response function."""

    def test_gateway_error_formatting(self):
        """Test formatting GatewayError."""
        error = ModelNotFoundError("sam3")
        response = format_error_response(error)

        assert response["success"] is False
        assert "error" in response
        assert response["error"]["code"] == "MODEL_NOT_FOUND"
        assert "sam3" in response["error"]["message"]
        assert response["error"]["model"] == "sam3"
        assert response["error"]["retriable"] is False

    def test_timeout_error_formatting(self):
        """Test formatting InferenceTimeoutError."""
        error = InferenceTimeoutError("sam3", 120.0)
        response = format_error_response(error)

        assert response["success"] is False
        assert response["error"]["code"] == "TIMEOUT"
        assert "120" in response["error"]["message"]

    def test_non_gateway_error_formatting(self):
        """Test formatting non-gateway exceptions."""
        error = ValueError("Something unexpected")
        response = format_error_response(error)

        assert response["success"] is False
        assert response["error"]["code"] == "INTERNAL_ERROR"
        assert "Something unexpected" in response["error"]["message"]
        assert response["error"]["retriable"] is False

    def test_empty_message_handling(self):
        """Test handling error with empty message."""
        error = Exception()
        response = format_error_response(error)

        assert response["success"] is False
        assert response["error"]["message"]  # Should have a fallback message


class TestFormatSuccessResponse:
    """Tests for format_success_response function."""

    def test_basic_success(self):
        """Test basic success response."""
        data = {"result": "test", "value": 42}
        response = format_success_response(data)

        assert response["success"] is True
        assert response["data"] == data

    def test_success_with_list(self):
        """Test success response with list data."""
        data = [1, 2, 3]
        response = format_success_response(data)

        assert response["success"] is True
        assert response["data"] == [1, 2, 3]

    def test_success_with_none(self):
        """Test success response with None data."""
        response = format_success_response(None)

        assert response["success"] is True
        assert response["data"] is None


class TestErrorInheritance:
    """Tests for exception inheritance."""

    def test_all_errors_inherit_from_gateway_error(self):
        """All custom errors should inherit from GatewayError."""
        assert issubclass(ModelNotFoundError, GatewayError)
        assert issubclass(InferenceTimeoutError, GatewayError)
        assert issubclass(ModelLoadError, GatewayError)
        assert issubclass(InferenceError, GatewayError)
        assert issubclass(ValidationError, GatewayError)
        assert issubclass(MemoryError, GatewayError)

    def test_all_errors_inherit_from_exception(self):
        """All custom errors should be catchable as Exception."""
        assert issubclass(GatewayError, Exception)

    def test_can_catch_as_gateway_error(self):
        """Should be able to catch specific errors as GatewayError."""
        with pytest.raises(GatewayError):
            raise ModelNotFoundError("test")

        with pytest.raises(GatewayError):
            raise InferenceTimeoutError("test", 30.0)

        with pytest.raises(GatewayError):
            raise ModelLoadError("test")


class TestModelNotLoadedError:
    """Tests for ModelNotLoadedError alias."""

    def test_is_same_as_model_not_found_error(self):
        """ModelNotLoadedError should be an alias for ModelNotFoundError."""
        from gateway.utils.errors import ModelNotLoadedError, ModelNotFoundError
        assert ModelNotLoadedError is ModelNotFoundError

    def test_can_raise_model_not_loaded_error(self):
        """Should be able to raise ModelNotLoadedError."""
        from gateway.utils.errors import ModelNotLoadedError
        with pytest.raises(ModelNotLoadedError):
            raise ModelNotLoadedError("sam3")

    def test_model_not_loaded_error_message(self):
        """ModelNotLoadedError should have correct message."""
        from gateway.utils.errors import ModelNotLoadedError
        error = ModelNotLoadedError("sam3")
        assert "sam3" in error.message

    def test_can_catch_as_model_not_found(self):
        """ModelNotLoadedError should be catchable as ModelNotFoundError."""
        from gateway.utils.errors import ModelNotLoadedError, ModelNotFoundError
        with pytest.raises(ModelNotFoundError):
            raise ModelNotLoadedError("test")
