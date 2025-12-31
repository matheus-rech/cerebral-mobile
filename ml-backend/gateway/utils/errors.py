"""
Custom exceptions and error formatting for the ML Gateway.

Provides a hierarchy of errors and standardized error response formatting
matching the design doc specification.
"""

from typing import Optional, Dict, Any
from enum import Enum


class ErrorCode(str, Enum):
    """Standardized error codes for the gateway."""
    TIMEOUT = "TIMEOUT"
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"
    MODEL_LOAD_ERROR = "MODEL_LOAD_ERROR"
    INFERENCE_ERROR = "INFERENCE_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    MEMORY_ERROR = "MEMORY_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class GatewayError(Exception):
    """
    Base exception class for all gateway errors.

    Provides standardized error attributes for consistent error responses.
    """

    error_code: ErrorCode = ErrorCode.INTERNAL_ERROR
    retriable: bool = False
    suggestion: Optional[str] = None

    def __init__(
        self,
        message: str,
        model: Optional[str] = None,
        error_code: Optional[ErrorCode] = None,
        retriable: Optional[bool] = None,
        suggestion: Optional[str] = None,
        cause: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.message = message
        self.model = model
        if error_code is not None:
            self.error_code = error_code
        if retriable is not None:
            self.retriable = retriable
        if suggestion is not None:
            self.suggestion = suggestion
        self.cause = cause

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to a dictionary for JSON serialization."""
        result = {
            "code": self.error_code.value,
            "message": self.message,
            "retriable": self.retriable,
        }
        if self.model:
            result["model"] = self.model
        if self.suggestion:
            result["suggestion"] = self.suggestion
        return result


class ModelNotFoundError(GatewayError):
    """Raised when a requested model is not registered or available."""

    error_code = ErrorCode.MODEL_NOT_FOUND
    retriable = False

    def __init__(
        self,
        model: str,
        message: Optional[str] = None,
        suggestion: Optional[str] = None,
    ):
        if message is None:
            message = f"Model '{model}' not found or not available"
        if suggestion is None:
            suggestion = "Check available models at GET /models"
        super().__init__(
            message=message,
            model=model,
            suggestion=suggestion,
        )


class InferenceTimeoutError(GatewayError):
    """Raised when model inference exceeds the configured timeout."""

    error_code = ErrorCode.TIMEOUT
    retriable = False

    def __init__(
        self,
        model: str,
        timeout_seconds: float,
        message: Optional[str] = None,
        suggestion: Optional[str] = None,
    ):
        self.timeout_seconds = timeout_seconds
        if message is None:
            message = f"{model} inference exceeded {timeout_seconds}s timeout"
        if suggestion is None:
            suggestion = "Try a smaller image or use a faster model"
        super().__init__(
            message=message,
            model=model,
            suggestion=suggestion,
        )


class ModelLoadError(GatewayError):
    """Raised when a model fails to load."""

    error_code = ErrorCode.MODEL_LOAD_ERROR
    retriable = True  # Loading might succeed on retry after memory is freed

    def __init__(
        self,
        model: str,
        message: Optional[str] = None,
        suggestion: Optional[str] = None,
        cause: Optional[Exception] = None,
    ):
        if message is None:
            message = f"Failed to load model '{model}'"
        if suggestion is None:
            suggestion = "Try unloading other models to free memory"
        super().__init__(
            message=message,
            model=model,
            suggestion=suggestion,
            cause=cause,
        )


class InferenceError(GatewayError):
    """Raised when model inference fails for reasons other than timeout."""

    error_code = ErrorCode.INFERENCE_ERROR
    retriable = True

    def __init__(
        self,
        model: str,
        message: Optional[str] = None,
        suggestion: Optional[str] = None,
        cause: Optional[Exception] = None,
    ):
        if message is None:
            message = f"Inference failed for model '{model}'"
        if suggestion is None:
            suggestion = "Check input format and try again"
        super().__init__(
            message=message,
            model=model,
            suggestion=suggestion,
            cause=cause,
        )


class ValidationError(GatewayError):
    """Raised when request validation fails."""

    error_code = ErrorCode.VALIDATION_ERROR
    retriable = False

    def __init__(
        self,
        message: str,
        model: Optional[str] = None,
        suggestion: Optional[str] = None,
    ):
        if suggestion is None:
            suggestion = "Check request format and required fields"
        super().__init__(
            message=message,
            model=model,
            suggestion=suggestion,
        )


class MemoryError(GatewayError):
    """Raised when system memory is insufficient for model operation."""

    error_code = ErrorCode.MEMORY_ERROR
    retriable = True

    def __init__(
        self,
        message: Optional[str] = None,
        model: Optional[str] = None,
        suggestion: Optional[str] = None,
    ):
        if message is None:
            message = "Insufficient memory for operation"
        if suggestion is None:
            suggestion = "Unload unused models with POST /models/{name}/unload"
        super().__init__(
            message=message,
            model=model,
            suggestion=suggestion,
        )


def format_error_response(error: Exception) -> Dict[str, Any]:
    """
    Format an exception into a standardized error response.

    Args:
        error: The exception to format

    Returns:
        Dictionary matching the design doc error response format:
        {
            "success": false,
            "error": {
                "code": "TIMEOUT",
                "message": "...",
                "model": "sam3",
                "retriable": false,
                "suggestion": "..."
            }
        }
    """
    if isinstance(error, GatewayError):
        return {
            "success": False,
            "error": error.to_dict(),
        }

    # Handle non-gateway exceptions
    return {
        "success": False,
        "error": {
            "code": ErrorCode.INTERNAL_ERROR.value,
            "message": str(error) or "An unexpected error occurred",
            "retriable": False,
            "suggestion": "Please try again or contact support",
        },
    }


def format_success_response(data: Any) -> Dict[str, Any]:
    """
    Format a successful response.

    Args:
        data: The response data

    Returns:
        Dictionary with success=True and the data
    """
    return {
        "success": True,
        "data": data,
    }


# Alias for ModelNotFoundError to match common naming conventions
# The task requirements mentioned "ModelNotLoadedError" which is conceptually
# the same as ModelNotFoundError - the model is not available/loaded
ModelNotLoadedError = ModelNotFoundError
