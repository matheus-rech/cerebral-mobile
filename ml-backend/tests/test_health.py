"""
Unit tests for the health module.

Tests health check utilities for models and system.
"""

import time
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
from gateway.utils.health import (
    init_start_time,
    get_uptime_seconds,
    check_model_health,
    check_all_models_health,
    get_system_health,
    format_health_response,
    HealthChecker,
    check_system_health,
    get_memory_info,
    get_disk_info,
    get_gpu_info,
    get_cpu_info,
    _determine_overall_status,
)


class TestUptimeTracking:
    """Tests for uptime tracking functions."""

    def test_init_start_time(self):
        """init_start_time should set start time."""
        init_start_time()
        uptime = get_uptime_seconds()
        assert uptime >= 0
        assert uptime < 1.0  # Should be very small just after init

    def test_get_uptime_seconds_after_delay(self):
        """get_uptime_seconds should return elapsed time."""
        init_start_time()
        time.sleep(0.1)
        uptime = get_uptime_seconds()
        assert uptime >= 0.1
        assert uptime < 1.0


class TestCheckModelHealth:
    """Tests for check_model_health function."""

    def test_model_without_is_loaded_method(self):
        """Should report error for model without is_loaded."""
        model = Mock(spec=[])  # No methods
        result = check_model_health(model)

        assert result["loaded"] is False
        assert result["healthy"] is False
        assert "is_loaded" in result["error"]

    def test_model_not_loaded(self):
        """Model not loaded should be healthy (valid state)."""
        model = Mock()
        model.is_loaded.return_value = False

        result = check_model_health(model)

        assert result["loaded"] is False
        assert result["healthy"] is True
        assert "error" not in result

    def test_model_loaded_and_healthy(self):
        """Loaded model should be marked healthy."""
        model = Mock()
        model.is_loaded.return_value = True

        result = check_model_health(model)

        assert result["loaded"] is True
        assert result["healthy"] is True

    def test_model_with_last_used_datetime(self):
        """Should include last_used if model has it as datetime."""
        model = Mock()
        model.is_loaded.return_value = True
        model.last_used = datetime(2025, 12, 31, 12, 0, 0, tzinfo=timezone.utc)

        result = check_model_health(model)

        assert "last_used" in result
        assert "2025-12-31" in result["last_used"]

    def test_model_with_last_used_timestamp(self):
        """Should include last_used if model has it as timestamp."""
        model = Mock()
        model.is_loaded.return_value = True
        model.last_used = 1704020400.0  # Unix timestamp

        result = check_model_health(model)

        assert "last_used" in result

    def test_model_with_request_count(self):
        """Should include request count if model has it."""
        model = Mock()
        model.is_loaded.return_value = True
        model.request_count = 42

        result = check_model_health(model)

        assert result["requests"] == 42

    def test_model_health_check_passes(self):
        """Should be healthy when model.health_check() returns True."""
        model = Mock()
        model.is_loaded.return_value = True
        model.health_check.return_value = True

        with patch('gateway.utils.timeout.run_with_timeout', return_value=True):
            result = check_model_health(model)

        assert result["healthy"] is True

    def test_model_health_check_fails(self):
        """Should be unhealthy when model.health_check() returns False."""
        model = Mock()
        model.is_loaded.return_value = True
        model.health_check.return_value = False

        with patch('gateway.utils.timeout.run_with_timeout', return_value=False):
            result = check_model_health(model)

        assert result["healthy"] is False
        assert "error" in result

    def test_model_health_check_exception(self):
        """Should be unhealthy when model.health_check() raises."""
        model = Mock()
        model.is_loaded.return_value = True

        with patch('gateway.utils.timeout.run_with_timeout', side_effect=RuntimeError("check failed")):
            result = check_model_health(model)

        assert result["healthy"] is False
        assert "error" in result


class TestCheckAllModelsHealth:
    """Tests for check_all_models_health function."""

    def test_multiple_models(self):
        """Should check health of all provided models."""
        model1 = Mock()
        model1.is_loaded.return_value = True
        model2 = Mock()
        model2.is_loaded.return_value = False
        model3 = Mock()
        model3.is_loaded.return_value = True

        models = {"unet": model1, "synthseg": model2, "sam3": model3}
        result = check_all_models_health(models)

        assert len(result) == 3
        assert result["unet"]["loaded"] is True
        assert result["synthseg"]["loaded"] is False
        assert result["sam3"]["loaded"] is True

    def test_empty_models_dict(self):
        """Should handle empty models dictionary."""
        result = check_all_models_health({})
        assert result == {}


class TestGetSystemHealth:
    """Tests for get_system_health function."""

    def test_returns_expected_keys(self):
        """Should return dictionary with expected keys."""
        init_start_time()
        result = get_system_health()

        assert "uptime_seconds" in result
        assert "memory" in result
        assert "disk" in result
        assert "gpu" in result

    def test_uptime_is_included(self):
        """Should include uptime in result."""
        init_start_time()
        result = get_system_health()

        assert result["uptime_seconds"] >= 0


class TestGetMemoryInfo:
    """Tests for get_memory_info function."""

    def test_with_psutil_available(self):
        """Should return memory info when psutil is available."""
        result = get_memory_info()

        # Either has memory info or an error
        if "available" not in result or result.get("available") is not False:
            assert "total_mb" in result or "error" in result

    @patch.dict('sys.modules', {'psutil': None})
    def test_without_psutil(self):
        """Should handle missing psutil gracefully."""
        # This test verifies the fallback behavior is defined
        result = get_memory_info()
        assert isinstance(result, dict)


class TestGetDiskInfo:
    """Tests for get_disk_info function."""

    def test_returns_disk_info(self):
        """Should return disk usage information."""
        result = get_disk_info()

        if "available" not in result or result.get("available") is not False:
            assert "total_gb" in result or "error" in result


class TestGetGpuInfo:
    """Tests for get_gpu_info function."""

    def test_returns_gpu_info(self):
        """Should return GPU information."""
        result = get_gpu_info()

        assert "available" in result


class TestGetCpuInfo:
    """Tests for get_cpu_info function."""

    def test_returns_cpu_info(self):
        """Should return CPU information."""
        result = get_cpu_info()

        assert "count" in result or "error" in result


class TestFormatHealthResponse:
    """Tests for format_health_response function."""

    def test_basic_response_format(self):
        """Should format response with expected structure."""
        init_start_time()
        models_status = {
            "unet": {"loaded": True, "healthy": True, "requests": 10},
            "sam3": {"loaded": False, "healthy": True},
        }

        result = format_health_response(models_status)

        assert "status" in result
        assert "uptime_seconds" in result
        assert "models" in result
        assert "system" in result
        assert result["models"] == models_status

    def test_with_custom_system_health(self):
        """Should use provided system health."""
        models_status = {"unet": {"loaded": True, "healthy": True}}
        system_health = {
            "uptime_seconds": 3600,
            "memory": {"total_mb": 16000, "percent_used": 50},
            "cpu": {"percent": 25},
            "gpu": {"available": True},
        }

        result = format_health_response(models_status, system_health)

        assert result["uptime_seconds"] == 3600
        assert result["system"]["memory"]["total_mb"] == 16000


class TestDetermineOverallStatus:
    """Tests for _determine_overall_status function."""

    def test_healthy_status(self):
        """Should return healthy when all is well."""
        models = {"unet": {"loaded": True, "healthy": True}}
        system = {"memory": {"percent_used": 50}}

        status = _determine_overall_status(models, system)
        assert status == "healthy"

    def test_degraded_on_high_memory(self):
        """Should return degraded when memory usage is high."""
        models = {"unet": {"loaded": True, "healthy": True}}
        system = {"memory": {"percent_used": 90}}

        status = _determine_overall_status(models, system)
        assert status == "degraded"

    def test_unhealthy_on_critical_memory(self):
        """Should return unhealthy when memory usage is critical."""
        models = {"unet": {"loaded": True, "healthy": True}}
        system = {"memory": {"percent_used": 97}}

        status = _determine_overall_status(models, system)
        assert status == "unhealthy"

    def test_degraded_on_unhealthy_model(self):
        """Should return degraded when some models are unhealthy."""
        models = {
            "unet": {"loaded": True, "healthy": True},
            "sam3": {"loaded": True, "healthy": False},
        }
        system = {"memory": {"percent_used": 50}}

        status = _determine_overall_status(models, system)
        assert status == "degraded"

    def test_unhealthy_when_all_loaded_models_fail(self):
        """Should return unhealthy when all loaded models are unhealthy."""
        models = {
            "unet": {"loaded": True, "healthy": False},
            "sam3": {"loaded": True, "healthy": False},
            "synthseg": {"loaded": False, "healthy": True},  # Not loaded, doesn't count
        }
        system = {"memory": {"percent_used": 50}}

        status = _determine_overall_status(models, system)
        assert status == "unhealthy"


class TestHealthChecker:
    """Tests for HealthChecker class."""

    def test_caches_health_results(self):
        """Should cache health check results."""
        checker = HealthChecker(cache_ttl_seconds=10.0)
        model = Mock()
        model.is_loaded.return_value = True

        init_start_time()

        # First call
        result1 = checker.get_health({"test": model})
        call_count1 = model.is_loaded.call_count

        # Second call (should use cache)
        result2 = checker.get_health({"test": model})
        call_count2 = model.is_loaded.call_count

        assert call_count1 == call_count2  # No additional calls

    def test_cache_expires(self):
        """Should refresh when cache expires."""
        checker = HealthChecker(cache_ttl_seconds=0.1)
        model = Mock()
        model.is_loaded.return_value = True

        init_start_time()

        # First call
        checker.get_health({"test": model})
        call_count1 = model.is_loaded.call_count

        # Wait for cache to expire
        time.sleep(0.15)

        # Second call (cache expired)
        checker.get_health({"test": model})
        call_count2 = model.is_loaded.call_count

        assert call_count2 > call_count1

    def test_force_refresh(self):
        """force_refresh should bypass cache."""
        checker = HealthChecker(cache_ttl_seconds=10.0)
        model = Mock()
        model.is_loaded.return_value = True

        init_start_time()

        # First call
        checker.get_health({"test": model})
        call_count1 = model.is_loaded.call_count

        # Force refresh
        checker.get_health({"test": model}, force_refresh=True)
        call_count2 = model.is_loaded.call_count

        assert call_count2 > call_count1

    def test_invalidate_cache(self):
        """invalidate_cache should clear the cache."""
        checker = HealthChecker(cache_ttl_seconds=10.0)
        model = Mock()
        model.is_loaded.return_value = True

        init_start_time()

        # First call
        checker.get_health({"test": model})
        call_count1 = model.is_loaded.call_count

        # Invalidate
        checker.invalidate_cache()

        # Next call should refresh
        checker.get_health({"test": model})
        call_count2 = model.is_loaded.call_count

        assert call_count2 > call_count1


class TestLegacyCheckSystemHealth:
    """Tests for the legacy check_system_health function."""

    def test_returns_status(self):
        """Should return a status field."""
        result = check_system_health()
        assert "status" in result
        assert result["status"] in ["healthy", "warning", "critical"]

    def test_includes_system_info(self):
        """Should include system information."""
        result = check_system_health()
        assert "system" in result
        assert "memory" in result
        assert "disk" in result
        assert "gpu" in result


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_model_with_none_last_used(self):
        """Should handle None last_used gracefully."""
        model = Mock()
        model.is_loaded.return_value = True
        model.last_used = None

        result = check_model_health(model)

        assert result["loaded"] is True
        assert "last_used" not in result

    def test_model_is_loaded_raises(self):
        """Should handle is_loaded() raising exception."""
        model = Mock()
        model.is_loaded.side_effect = RuntimeError("Model error")

        result = check_model_health(model)

        assert result["healthy"] is False
        assert "error" in result

    def test_empty_models_format_response(self):
        """Should handle empty models in format_health_response."""
        result = format_health_response({})

        assert result["status"] == "healthy"
        assert result["models"] == {}


class TestCheckMemoryAvailable:
    """Tests for check_memory_available function."""

    def test_returns_bool(self):
        """Should return a boolean."""
        from gateway.utils.health import check_memory_available
        result = check_memory_available(100)  # 100 MB
        assert isinstance(result, bool)

    def test_small_requirement_passes(self):
        """Small memory requirement should pass."""
        from gateway.utils.health import check_memory_available
        # 1 MB should definitely be available
        assert check_memory_available(1) is True

    def test_huge_requirement_fails(self):
        """Huge memory requirement should fail."""
        from gateway.utils.health import check_memory_available
        # 10 TB should not be available
        result = check_memory_available(10 * 1024 * 1024)  # 10 TB in MB
        assert result is False

    def test_zero_requirement(self):
        """Zero requirement should pass."""
        from gateway.utils.health import check_memory_available
        assert check_memory_available(0) is True

    def test_negative_requirement(self):
        """Negative requirement should pass."""
        from gateway.utils.health import check_memory_available
        assert check_memory_available(-100) is True


class TestGetSystemStats:
    """Tests for get_system_stats function."""

    def test_returns_expected_keys(self):
        """Should return dictionary with expected keys."""
        from gateway.utils.health import get_system_stats
        stats = get_system_stats()

        assert "cpu_percent" in stats
        assert "cpu_count" in stats
        assert "memory_percent" in stats
        assert "memory_available_mb" in stats
        assert "memory_total_mb" in stats
        assert "gpu_available" in stats

    def test_cpu_values_reasonable(self):
        """CPU values should be reasonable."""
        from gateway.utils.health import get_system_stats
        stats = get_system_stats()

        assert stats["cpu_percent"] >= 0
        assert stats["cpu_percent"] <= 100
        assert stats["cpu_count"] >= 1

    def test_memory_values_reasonable(self):
        """Memory values should be reasonable."""
        from gateway.utils.health import get_system_stats
        stats = get_system_stats()

        assert stats["memory_percent"] >= 0
        assert stats["memory_percent"] <= 100
        assert stats["memory_total_mb"] > 0


class TestHealthMonitor:
    """Tests for HealthMonitor class."""

    def test_record_successful_request(self):
        """Should record successful request."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_request("unet", 0.5)

        stats = monitor.get_model_stats("unet")
        assert stats["total_requests"] == 1
        assert stats["successful_requests"] == 1
        assert stats["failed_requests"] == 0
        assert stats["avg_latency_ms"] == 500.0

    def test_record_failed_request(self):
        """Should record failed request."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_request("sam3", 0.1, success=False)

        stats = monitor.get_model_stats("sam3")
        assert stats["total_requests"] == 1
        assert stats["successful_requests"] == 0
        assert stats["failed_requests"] == 1

    def test_record_error(self):
        """Should record error with type."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_error("sam3", "TimeoutError")

        stats = monitor.get_model_stats("sam3")
        assert "TimeoutError" in stats["errors"]
        assert stats["errors"]["TimeoutError"] == 1

    def test_multiple_errors_same_type(self):
        """Should count multiple errors of same type."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_error("sam3", "TimeoutError")
        monitor.record_error("sam3", "TimeoutError")
        monitor.record_error("sam3", "MemoryError")

        stats = monitor.get_model_stats("sam3")
        assert stats["errors"]["TimeoutError"] == 2
        assert stats["errors"]["MemoryError"] == 1

    def test_latency_tracking(self):
        """Should track min/max/avg latency."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_request("unet", 0.1)  # 100ms
        monitor.record_request("unet", 0.2)  # 200ms
        monitor.record_request("unet", 0.3)  # 300ms

        stats = monitor.get_model_stats("unet")
        assert stats["min_latency_ms"] == 100.0
        assert stats["max_latency_ms"] == 300.0
        assert stats["avg_latency_ms"] == 200.0

    def test_error_rate_calculation(self):
        """Should calculate error rate correctly."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_request("unet", 0.1, success=True)
        monitor.record_request("unet", 0.1, success=True)
        monitor.record_request("unet", 0.1, success=False)
        monitor.record_request("unet", 0.1, success=False)

        stats = monitor.get_model_stats("unet")
        assert stats["error_rate"] == 0.5

    def test_get_all_stats(self):
        """Should return stats for all models."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_request("unet", 0.1)
        monitor.record_request("sam3", 0.2)
        monitor.record_request("synthseg", 0.3)

        all_stats = monitor.get_all_stats()

        assert "models" in all_stats
        assert "global" in all_stats
        assert "unet" in all_stats["models"]
        assert "sam3" in all_stats["models"]
        assert "synthseg" in all_stats["models"]
        assert all_stats["global"]["total_requests"] == 3

    def test_reset(self):
        """Should reset all statistics."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_request("unet", 0.1)
        monitor.reset()

        stats = monitor.get_model_stats("unet")
        assert stats["total_requests"] == 0

    def test_reset_model(self):
        """Should reset specific model statistics."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        monitor.record_request("unet", 0.1)
        monitor.record_request("sam3", 0.2)
        monitor.reset_model("unet")

        unet_stats = monitor.get_model_stats("unet")
        sam3_stats = monitor.get_model_stats("sam3")

        assert unet_stats["total_requests"] == 0
        assert sam3_stats["total_requests"] == 1

    def test_unknown_model_returns_empty_stats(self):
        """Should return empty stats for unknown model."""
        from gateway.utils.health import HealthMonitor
        monitor = HealthMonitor()

        stats = monitor.get_model_stats("nonexistent")

        assert stats["total_requests"] == 0
        assert stats["successful_requests"] == 0
        assert stats["error_rate"] == 0.0

    def test_last_request_time_updated(self):
        """Should update last request time."""
        from gateway.utils.health import HealthMonitor
        import time
        monitor = HealthMonitor()

        before = time.time()
        monitor.record_request("unet", 0.1)
        after = time.time()

        stats = monitor.get_model_stats("unet")
        assert before <= stats["last_request_time"] <= after

    def test_last_error_time_updated(self):
        """Should update last error time."""
        from gateway.utils.health import HealthMonitor
        import time
        monitor = HealthMonitor()

        before = time.time()
        monitor.record_error("unet", "TestError")
        after = time.time()

        stats = monitor.get_model_stats("unet")
        assert before <= stats["last_error_time"] <= after
