"""
Base Model Abstract Class for ML Gateway

Provides a unified interface for all ML models in the gateway.
Each model wrapper should inherit from this class and implement
the abstract methods.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from datetime import datetime


class BaseModel(ABC):
    """
    Abstract base class for all ML model wrappers.

    Attributes:
        name: Unique identifier for the model
        timeout_seconds: Maximum time allowed for inference
        is_eager: If True, model loads at startup; if False, loads on first request
        parameters_count: Approximate number of model parameters
    """

    def __init__(
        self,
        name: str,
        timeout_seconds: int,
        is_eager: bool = True,
        parameters_count: int = 0
    ):
        self._name = name
        self._timeout_seconds = timeout_seconds
        self._is_eager = is_eager
        self._parameters_count = parameters_count
        self._is_loaded = False
        self._load_time: Optional[datetime] = None
        self._last_used: Optional[datetime] = None
        self._request_count: int = 0

    @property
    def name(self) -> str:
        """Model unique identifier."""
        return self._name

    @property
    def timeout_seconds(self) -> int:
        """Maximum inference timeout in seconds."""
        return self._timeout_seconds

    @property
    def is_eager(self) -> bool:
        """Whether model should load at startup."""
        return self._is_eager

    @property
    def parameters_count(self) -> int:
        """Approximate number of model parameters."""
        return self._parameters_count

    @property
    def is_loaded(self) -> bool:
        """Whether model weights are currently in memory."""
        return self._is_loaded

    @property
    def load_time(self) -> Optional[datetime]:
        """When the model was last loaded."""
        return self._load_time

    @property
    def last_used(self) -> Optional[datetime]:
        """When the model was last used for inference."""
        return self._last_used

    @property
    def request_count(self) -> int:
        """Total number of inference requests handled."""
        return self._request_count

    @abstractmethod
    def load(self) -> None:
        """
        Load model weights into memory.

        Should set self._is_loaded = True upon successful load.
        Should set self._load_time to current timestamp.

        Raises:
            RuntimeError: If model fails to load
        """
        pass

    @abstractmethod
    def unload(self) -> None:
        """
        Release model from memory to free resources.

        Should set self._is_loaded = False upon successful unload.
        Should release GPU memory if applicable.
        """
        pass

    @abstractmethod
    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run inference on input data.

        Args:
            input_data: Dictionary containing model-specific input data.
                       Common keys include 'image', 'prompts', etc.

        Returns:
            Dictionary containing inference results.
            Should include 'success': True/False and model-specific outputs.

        Raises:
            RuntimeError: If model is not loaded
            ValueError: If input data is invalid
        """
        pass

    def _update_usage_stats(self) -> None:
        """Update usage statistics after inference."""
        self._last_used = datetime.utcnow()
        self._request_count += 1

    def get_status(self) -> Dict[str, Any]:
        """
        Get current model status for health checks.

        Returns:
            Dictionary with model status information
        """
        return {
            "name": self._name,
            "loaded": self._is_loaded,
            "eager": self._is_eager,
            "timeout_seconds": self._timeout_seconds,
            "parameters_count": self._parameters_count,
            "load_time": self._load_time.isoformat() if self._load_time else None,
            "last_used": self._last_used.isoformat() if self._last_used else None,
            "request_count": self._request_count
        }

    def __repr__(self) -> str:
        status = "loaded" if self._is_loaded else "unloaded"
        return f"<{self.__class__.__name__}(name='{self._name}', status={status})>"
