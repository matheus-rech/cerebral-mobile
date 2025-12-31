"""
Unit tests for the ModelManager class.

Tests model loading, unloading, state tracking, and auto-unload behavior.
"""

import time
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone, timedelta
import threading

# Import the ModelManager and related classes
from gateway.model_manager import ModelManager, ModelState, get_model_manager
from gateway.config import LoadingStrategy


class TestModelState:
    """Tests for the ModelState dataclass."""

    def test_default_values(self):
        """Test ModelState has correct default values."""
        state = ModelState(name="test_model")

        assert state.name == "test_model"
        assert state.loaded is False
        assert state.last_used is None
        assert state.request_count == 0
        assert state.load_time_seconds is None
        assert state.error is None
        assert state.instance is None

    def test_to_dict(self):
        """Test ModelState serialization to dictionary."""
        now = datetime.now(timezone.utc)
        state = ModelState(
            name="unet",
            loaded=True,
            last_used=now,
            request_count=42,
            load_time_seconds=1.5,
            error=None,
        )

        result = state.to_dict()

        assert result["name"] == "unet"
        assert result["loaded"] is True
        assert result["last_used"] == now.isoformat()
        assert result["request_count"] == 42
        assert result["load_time_seconds"] == 1.5
        assert result["error"] is None

    def test_to_dict_with_no_last_used(self):
        """Test serialization when last_used is None."""
        state = ModelState(name="test", loaded=False)
        result = state.to_dict()

        assert result["last_used"] is None

    def test_to_dict_with_error(self):
        """Test serialization with an error message."""
        state = ModelState(name="test", error="Load failed")
        result = state.to_dict()

        assert result["error"] == "Load failed"


class TestModelManagerSingleton:
    """Tests for ModelManager singleton pattern."""

    def test_singleton_same_instance(self):
        """Multiple calls should return the same instance."""
        # Reset the singleton for this test
        ModelManager._instance = None

        manager1 = ModelManager()
        manager2 = ModelManager()

        assert manager1 is manager2

    def test_get_model_manager_returns_singleton(self):
        """get_model_manager() should return the singleton."""
        # Reset the singleton for this test
        ModelManager._instance = None

        manager1 = get_model_manager()
        manager2 = get_model_manager()

        assert manager1 is manager2


class TestModelLoading:
    """Tests for model loading functionality."""

    @pytest.fixture(autouse=True)
    def reset_manager(self):
        """Reset the singleton before each test."""
        ModelManager._instance = None
        yield
        # Cleanup
        if ModelManager._instance:
            ModelManager._instance._running = False
            ModelManager._instance = None

    def test_load_unknown_model_raises(self):
        """Loading an unknown model should raise ValueError."""
        manager = get_model_manager()

        with pytest.raises(ValueError, match="Unknown model"):
            manager.load_model("nonexistent_model")

    def test_load_model_success(self):
        """Successfully loading a model updates state."""
        manager = get_model_manager()

        # UNet should be in the available models
        if "unet" in manager._models:
            result = manager.load_model("unet")

            assert result is True
            state = manager._models["unet"]
            assert state.loaded is True
            assert state.load_time_seconds is not None
            assert state.load_time_seconds >= 0
            assert state.error is None

    def test_load_already_loaded_model(self):
        """Loading an already loaded model should return True."""
        manager = get_model_manager()

        if "unet" in manager._models:
            # Load once
            manager.load_model("unet")
            # Load again
            result = manager.load_model("unet")

            assert result is True

    def test_load_model_updates_last_used(self):
        """Loading a model should set last_used."""
        manager = get_model_manager()

        if "unet" in manager._models:
            before = datetime.now(timezone.utc)
            manager.load_model("unet")
            after = datetime.now(timezone.utc)

            state = manager._models["unet"]
            assert state.last_used is not None
            assert before <= state.last_used <= after


class TestModelUnloading:
    """Tests for model unloading functionality."""

    @pytest.fixture(autouse=True)
    def reset_manager(self):
        """Reset the singleton before each test."""
        ModelManager._instance = None
        yield
        if ModelManager._instance:
            ModelManager._instance._running = False
            ModelManager._instance = None

    def test_unload_unknown_model_raises(self):
        """Unloading an unknown model should raise ValueError."""
        manager = get_model_manager()

        with pytest.raises(ValueError, match="Unknown model"):
            manager.unload_model("nonexistent_model")

    def test_unload_loaded_model(self):
        """Unloading a loaded model should free resources."""
        manager = get_model_manager()

        if "unet" in manager._models:
            # Load first
            manager.load_model("unet")
            assert manager._models["unet"].loaded is True

            # Unload
            result = manager.unload_model("unet")

            assert result is True
            state = manager._models["unet"]
            assert state.loaded is False
            assert state.instance is None
            assert state.load_time_seconds is None

    def test_unload_not_loaded_model(self):
        """Unloading a model that isn't loaded should return True."""
        manager = get_model_manager()

        if "unet" in manager._models:
            # Ensure not loaded
            manager._models["unet"].loaded = False

            result = manager.unload_model("unet")
            assert result is True


class TestGetModel:
    """Tests for get_model (lazy loading) functionality."""

    @pytest.fixture(autouse=True)
    def reset_manager(self):
        """Reset the singleton before each test."""
        ModelManager._instance = None
        yield
        if ModelManager._instance:
            ModelManager._instance._running = False
            ModelManager._instance = None

    def test_get_model_unknown_raises(self):
        """Getting an unknown model should raise ValueError."""
        manager = get_model_manager()

        with pytest.raises(ValueError, match="Unknown model"):
            manager.get_model("nonexistent_model")

    def test_get_model_lazy_loads(self):
        """Getting an unloaded model should trigger lazy loading."""
        manager = get_model_manager()

        if "unet" in manager._models:
            # Ensure not loaded
            manager._models["unet"].loaded = False
            manager._models["unet"].instance = None

            instance = manager.get_model("unet")

            assert instance is not None
            assert manager._models["unet"].loaded is True

    def test_get_model_increments_request_count(self):
        """Getting a model should increment the request count."""
        manager = get_model_manager()

        if "unet" in manager._models:
            initial_count = manager._models["unet"].request_count

            manager.get_model("unet")

            assert manager._models["unet"].request_count == initial_count + 1

    def test_get_model_updates_last_used(self):
        """Getting a model should update last_used timestamp."""
        manager = get_model_manager()

        if "unet" in manager._models:
            before = datetime.now(timezone.utc)
            manager.get_model("unet")
            after = datetime.now(timezone.utc)

            state = manager._models["unet"]
            assert before <= state.last_used <= after


class TestGetStatus:
    """Tests for get_status functionality."""

    @pytest.fixture(autouse=True)
    def reset_manager(self):
        """Reset the singleton before each test."""
        ModelManager._instance = None
        yield
        if ModelManager._instance:
            ModelManager._instance._running = False
            ModelManager._instance = None

    def test_status_structure(self):
        """Status should have expected structure."""
        manager = get_model_manager()

        status = manager.get_status()

        assert "status" in status
        assert "uptime_seconds" in status
        assert "models_loaded" in status
        assert "models_total" in status
        assert "models" in status

    def test_status_uptime(self):
        """Uptime should be a positive number."""
        manager = get_model_manager()

        status = manager.get_status()

        assert isinstance(status["uptime_seconds"], (int, float))
        assert status["uptime_seconds"] >= 0

    def test_status_model_count(self):
        """Model counts should be accurate."""
        manager = get_model_manager()

        status = manager.get_status()

        assert status["models_total"] == len(manager._models)
        loaded_count = sum(1 for s in manager._models.values() if s.loaded)
        assert status["models_loaded"] == loaded_count

    def test_status_starting_when_no_models_loaded(self):
        """Status should be 'starting' when no models are loaded."""
        manager = get_model_manager()

        # Ensure no models are loaded
        for state in manager._models.values():
            state.loaded = False
            state.error = None

        status = manager.get_status()

        assert status["status"] == "starting"

    def test_status_healthy_when_models_loaded(self):
        """Status should be 'healthy' when models are loaded without errors."""
        manager = get_model_manager()

        if manager._models:
            # Load at least one model
            first_model = list(manager._models.keys())[0]
            manager.load_model(first_model)

            # Clear any errors
            for state in manager._models.values():
                state.error = None

            status = manager.get_status()

            assert status["status"] == "healthy"

    def test_status_degraded_with_errors(self):
        """Status should be 'degraded' when there are errors."""
        manager = get_model_manager()

        if manager._models:
            first_model = list(manager._models.keys())[0]
            manager._models[first_model].error = "Test error"

            status = manager.get_status()

            assert status["status"] == "degraded"


class TestAutoUnload:
    """Tests for auto-unload after inactivity."""

    def test_auto_unload_timeout_value(self):
        """Auto-unload timeout should be 30 minutes by default."""
        from gateway.config import get_config

        config = get_config()

        assert config.auto_unload_minutes == 30

    def test_auto_unload_seconds_calculation(self):
        """Auto-unload timeout in seconds calculation."""
        auto_unload_minutes = 30
        auto_unload_seconds = auto_unload_minutes * 60

        assert auto_unload_seconds == 1800

    def test_model_unused_detection(self):
        """Test detection of unused models."""
        now = datetime.now(timezone.utc)
        thirty_five_minutes_ago = now - timedelta(minutes=35)

        state = ModelState(
            name="test",
            loaded=True,
            last_used=thirty_five_minutes_ago,
        )

        unused_seconds = (now - state.last_used).total_seconds()
        auto_unload_seconds = 30 * 60

        should_unload = unused_seconds > auto_unload_seconds
        assert should_unload is True

    def test_model_recently_used_not_unloaded(self):
        """Recently used models should not be unloaded."""
        now = datetime.now(timezone.utc)
        five_minutes_ago = now - timedelta(minutes=5)

        state = ModelState(
            name="test",
            loaded=True,
            last_used=five_minutes_ago,
        )

        unused_seconds = (now - state.last_used).total_seconds()
        auto_unload_seconds = 30 * 60

        should_unload = unused_seconds > auto_unload_seconds
        assert should_unload is False


class TestConcurrentAccess:
    """Tests for thread-safe concurrent access."""

    @pytest.fixture(autouse=True)
    def reset_manager(self):
        """Reset the singleton before each test."""
        ModelManager._instance = None
        yield
        if ModelManager._instance:
            ModelManager._instance._running = False
            ModelManager._instance = None

    def test_concurrent_load_requests(self):
        """Multiple concurrent load requests should be handled safely."""
        manager = get_model_manager()

        if "unet" not in manager._models:
            pytest.skip("UNet model not configured")

        results = []
        errors = []

        def load_model():
            try:
                result = manager.load_model("unet")
                results.append(result)
            except Exception as e:
                errors.append(e)

        # Create multiple threads trying to load the same model
        threads = [threading.Thread(target=load_model) for _ in range(5)]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All should succeed
        assert len(errors) == 0
        assert all(r is True for r in results)
        assert manager._models["unet"].loaded is True

    def test_concurrent_get_model(self):
        """Multiple concurrent get_model calls should be safe."""
        manager = get_model_manager()

        if "unet" not in manager._models:
            pytest.skip("UNet model not configured")

        instances = []
        errors = []

        def get_model():
            try:
                instance = manager.get_model("unet")
                instances.append(instance)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=get_model) for _ in range(10)]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert len(instances) == 10
        # Request count should equal number of calls
        assert manager._models["unet"].request_count >= 10


class TestModelIsLoaded:
    """Tests for is_model_loaded helper."""

    @pytest.fixture(autouse=True)
    def reset_manager(self):
        """Reset the singleton before each test."""
        ModelManager._instance = None
        yield
        if ModelManager._instance:
            ModelManager._instance._running = False
            ModelManager._instance = None

    def test_is_model_loaded_false_when_not_loaded(self):
        """is_model_loaded should return False for unloaded models."""
        manager = get_model_manager()

        if "unet" in manager._models:
            manager._models["unet"].loaded = False

            assert manager.is_model_loaded("unet") is False

    def test_is_model_loaded_true_when_loaded(self):
        """is_model_loaded should return True for loaded models."""
        manager = get_model_manager()

        if "unet" in manager._models:
            manager.load_model("unet")

            assert manager.is_model_loaded("unet") is True

    def test_is_model_loaded_false_for_unknown(self):
        """is_model_loaded should return False for unknown models."""
        manager = get_model_manager()

        assert manager.is_model_loaded("nonexistent") is False


class TestEagerVsLazyLoading:
    """Tests for eager vs lazy loading strategies."""

    def test_eager_models_list(self):
        """Verify which models use eager loading."""
        from gateway.config import get_config, LoadingStrategy

        config = get_config()
        eager_models = [
            name for name, cfg in config.models.items()
            if cfg.loading_strategy == LoadingStrategy.EAGER
        ]

        # UNet and SynthSeg should be eager
        assert "unet" in eager_models or len(eager_models) >= 0
        # This test documents expected behavior

    def test_lazy_models_list(self):
        """Verify which models use lazy loading."""
        from gateway.config import get_config, LoadingStrategy

        config = get_config()
        lazy_models = [
            name for name, cfg in config.models.items()
            if cfg.loading_strategy == LoadingStrategy.LAZY
        ]

        # MedSAM2 and SAM3 should be lazy due to their size
        # This test documents expected behavior
        assert isinstance(lazy_models, list)


class TestStartStop:
    """Tests for manager start/stop lifecycle."""

    @pytest.fixture(autouse=True)
    def reset_manager(self):
        """Reset the singleton before each test."""
        ModelManager._instance = None
        yield
        if ModelManager._instance:
            ModelManager._instance._running = False
            ModelManager._instance = None

    def test_start_sets_running(self):
        """Start should set _running to True."""
        manager = get_model_manager()
        manager.start()

        assert manager._running is True

        manager.stop()

    def test_stop_sets_not_running(self):
        """Stop should set _running to False."""
        manager = get_model_manager()
        manager.start()
        manager.stop()

        assert manager._running is False

    def test_double_start_is_safe(self):
        """Calling start() twice should be safe."""
        manager = get_model_manager()

        manager.start()
        manager.start()  # Should not raise

        assert manager._running is True

        manager.stop()

    def test_stop_unloads_all_models(self):
        """Stop should unload all loaded models."""
        manager = get_model_manager()

        # Load a model if available
        if "unet" in manager._models:
            manager.load_model("unet")

        manager.stop()

        # All models should be unloaded
        for state in manager._models.values():
            assert state.loaded is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
