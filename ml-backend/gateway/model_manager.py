"""
Model Manager - Singleton for managing ML model lifecycle.

Handles loading, unloading, and state tracking for all ML models.
Implements auto-unload for unused models and memory management.
"""

import time
import threading
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Callable

from .config import (
    get_config,
    get_model_config,
    get_available_models,
    LoadingStrategy,
)

logger = logging.getLogger(__name__)


@dataclass
class ModelState:
    """State tracking for a single model."""
    name: str
    loaded: bool = False
    last_used: Optional[datetime] = None
    request_count: int = 0
    load_time_seconds: Optional[float] = None
    error: Optional[str] = None
    # The actual model instance (wrapper)
    instance: Any = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "name": self.name,
            "loaded": self.loaded,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "request_count": self.request_count,
            "load_time_seconds": self.load_time_seconds,
            "error": self.error,
        }


class ModelManager:
    """
    Singleton manager for all ML models.

    Handles:
    - Loading/unloading models
    - Tracking model state (loaded, last_used, request_count)
    - Auto-unloading unused models
    - Memory management
    """

    _instance: Optional["ModelManager"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "ModelManager":
        """Ensure only one instance exists (singleton pattern)."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize the model manager."""
        if self._initialized:
            return

        self._initialized = True
        self._models: Dict[str, ModelState] = {}
        self._model_locks: Dict[str, threading.Lock] = {}
        self._cleanup_thread: Optional[threading.Thread] = None
        self._running = False
        self._start_time = datetime.now(timezone.utc)

        # Initialize state for all configured models
        for model_name in get_available_models():
            self._models[model_name] = ModelState(name=model_name)
            self._model_locks[model_name] = threading.Lock()

        logger.info(f"ModelManager initialized with models: {list(self._models.keys())}")

    def start(self) -> None:
        """Start the model manager (load eager models, start cleanup thread)."""
        if self._running:
            return

        self._running = True

        # Load eager models
        config = get_config()
        for model_name, model_config in config.models.items():
            if model_config.loading_strategy == LoadingStrategy.EAGER:
                logger.info(f"Loading eager model: {model_name}")
                try:
                    self.load_model(model_name)
                except Exception as e:
                    logger.error(f"Failed to load eager model {model_name}: {e}")

        # Start cleanup thread
        self._cleanup_thread = threading.Thread(
            target=self._cleanup_loop,
            daemon=True,
            name="ModelManager-Cleanup"
        )
        self._cleanup_thread.start()
        logger.info("ModelManager started")

    def stop(self) -> None:
        """Stop the model manager and unload all models."""
        self._running = False

        # Unload all models
        for model_name in list(self._models.keys()):
            try:
                self.unload_model(model_name)
            except Exception as e:
                logger.error(f"Error unloading model {model_name}: {e}")

        logger.info("ModelManager stopped")

    def load_model(self, name: str) -> bool:
        """
        Load a model into memory.

        Args:
            name: Model name (e.g., "unet", "synthseg")

        Returns:
            True if model was loaded successfully, False otherwise
        """
        if name not in self._models:
            raise ValueError(f"Unknown model: {name}")

        with self._model_locks[name]:
            state = self._models[name]

            if state.loaded:
                logger.debug(f"Model {name} already loaded")
                return True

            logger.info(f"Loading model: {name}")
            start_time = time.time()

            try:
                # Create actual model wrapper instance and load weights
                state.instance = self._create_model_instance(name)
                state.loaded = True
                state.load_time_seconds = time.time() - start_time
                state.error = None
                state.last_used = datetime.now(timezone.utc)

                logger.info(f"Model {name} loaded in {state.load_time_seconds:.2f}s")
                return True

            except Exception as e:
                state.error = str(e)
                state.loaded = False
                logger.error(f"Failed to load model {name}: {e}")
                import traceback
                traceback.print_exc()
                return False

    def unload_model(self, name: str) -> bool:
        """
        Unload a model from memory.

        Args:
            name: Model name

        Returns:
            True if model was unloaded, False otherwise
        """
        if name not in self._models:
            raise ValueError(f"Unknown model: {name}")

        with self._model_locks[name]:
            state = self._models[name]

            if not state.loaded:
                logger.debug(f"Model {name} not loaded")
                return True

            logger.info(f"Unloading model: {name}")

            try:
                # Clean up model instance
                if state.instance is not None:
                    # Call the model's unload method to release GPU memory
                    if hasattr(state.instance, 'unload'):
                        state.instance.unload()
                    del state.instance
                    state.instance = None

                state.loaded = False
                state.load_time_seconds = None
                logger.info(f"Model {name} unloaded")
                return True

            except Exception as e:
                state.error = str(e)
                logger.error(f"Failed to unload model {name}: {e}")
                return False

    def get_model(self, name: str) -> Any:
        """
        Get a loaded model, loading it if necessary (lazy loading).

        Args:
            name: Model name

        Returns:
            Model instance

        Raises:
            ValueError: If model is unknown
            RuntimeError: If model fails to load
        """
        if name not in self._models:
            raise ValueError(f"Unknown model: {name}")

        state = self._models[name]

        # Load if not already loaded
        if not state.loaded:
            if not self.load_model(name):
                raise RuntimeError(f"Failed to load model: {name}")

        # Update usage tracking
        with self._model_locks[name]:
            state.last_used = datetime.now(timezone.utc)
            state.request_count += 1

        return state.instance

    def get_status(self) -> dict:
        """
        Get status of all models and the gateway.

        Returns:
            Dictionary with gateway status and per-model status
        """
        uptime = (datetime.now(timezone.utc) - self._start_time).total_seconds()

        models_status = {}
        for name, state in self._models.items():
            models_status[name] = state.to_dict()

        # Determine overall status
        loaded_count = sum(1 for s in self._models.values() if s.loaded)
        has_errors = any(s.error for s in self._models.values())

        if has_errors:
            overall_status = "degraded"
        elif loaded_count > 0:
            overall_status = "healthy"
        else:
            overall_status = "starting"

        return {
            "status": overall_status,
            "uptime_seconds": round(uptime, 2),
            "models_loaded": loaded_count,
            "models_total": len(self._models),
            "models": models_status,
        }

    def get_model_state(self, name: str) -> Optional[ModelState]:
        """Get state for a specific model."""
        return self._models.get(name)

    def is_model_loaded(self, name: str) -> bool:
        """Check if a model is currently loaded."""
        state = self._models.get(name)
        return state.loaded if state else False

    def _create_model_instance(self, name: str) -> Any:
        """
        Create an actual model wrapper instance.

        Uses the model registry to instantiate the correct model class.
        """
        from .models import create_model

        # Create the model instance
        model_instance = create_model(name)

        # Load the model weights
        model_instance.load()

        return model_instance

    def _cleanup_loop(self) -> None:
        """Background thread that auto-unloads unused models."""
        config = get_config()
        check_interval = 60  # Check every minute

        while self._running:
            time.sleep(check_interval)

            if not self._running:
                break

            now = datetime.now(timezone.utc)
            auto_unload_seconds = config.auto_unload_minutes * 60

            for name, state in self._models.items():
                if not state.loaded:
                    continue

                if state.last_used is None:
                    continue

                # Check if model has been unused for too long
                unused_seconds = (now - state.last_used).total_seconds()

                if unused_seconds > auto_unload_seconds:
                    model_config = get_model_config(name)

                    # Only auto-unload lazy models
                    if model_config and model_config.loading_strategy == LoadingStrategy.LAZY:
                        logger.info(
                            f"Auto-unloading {name} (unused for {unused_seconds:.0f}s)"
                        )
                        try:
                            self.unload_model(name)
                        except Exception as e:
                            logger.error(f"Error auto-unloading {name}: {e}")


# Convenience function to get the singleton instance
def get_model_manager() -> ModelManager:
    """Get the global ModelManager instance."""
    return ModelManager()
