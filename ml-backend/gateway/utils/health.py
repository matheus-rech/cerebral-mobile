"""
Health check utilities for the ML Gateway.

Provides functions to check model health, system resources,
and format health responses for the API.
"""

import logging
import os
import platform
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Protocol

logger = logging.getLogger(__name__)

# Track gateway start time for uptime calculation
_start_time: Optional[float] = None


def init_start_time() -> None:
    """Initialize the start time. Call this at gateway startup."""
    global _start_time
    _start_time = time.time()


def get_uptime_seconds() -> float:
    """Get the gateway uptime in seconds."""
    if _start_time is None:
        return 0.0
    return time.time() - _start_time


class ModelProtocol(Protocol):
    """Protocol defining the interface a model must implement for health checks."""

    def is_loaded(self) -> bool:
        """Return True if the model is loaded and ready."""
        ...

    def get_name(self) -> str:
        """Return the model name."""
        ...


def check_model_health(
    model: Any,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """
    Verify that a model is healthy and responds.

    Performs a lightweight health check on the model to ensure it's
    loaded and functional. This should be fast and not impact inference.

    Args:
        model: The model instance to check. Should have is_loaded() and get_name() methods.
        timeout_seconds: Maximum time to wait for health check response.

    Returns:
        Dictionary with health status:
        {
            "loaded": bool,
            "healthy": bool,
            "last_used": "ISO timestamp or null",
            "requests": int,
            "error": "error message if unhealthy"
        }
    """
    result: Dict[str, Any] = {
        "loaded": False,
        "healthy": False,
    }

    try:
        # Check if model has required methods
        if not hasattr(model, "is_loaded"):
            result["error"] = "Model does not implement is_loaded()"
            return result

        # Check if loaded
        loaded = model.is_loaded()
        result["loaded"] = loaded

        if not loaded:
            result["healthy"] = True  # Not loaded is a valid healthy state
            return result

        # Model is loaded, check additional health info
        result["healthy"] = True

        # Get last used time if available
        if hasattr(model, "last_used"):
            last_used = model.last_used
            if last_used is not None:
                if isinstance(last_used, datetime):
                    result["last_used"] = last_used.isoformat()
                elif isinstance(last_used, (int, float)):
                    result["last_used"] = datetime.fromtimestamp(
                        last_used, tz=timezone.utc
                    ).isoformat()

        # Get request count if available
        if hasattr(model, "request_count"):
            result["requests"] = model.request_count

        # Try a health check method if available
        if hasattr(model, "health_check"):
            try:
                from .timeout import run_with_timeout
                health_ok = run_with_timeout(model.health_check, timeout_seconds)
                if not health_ok:
                    result["healthy"] = False
                    result["error"] = "Model health check returned False"
            except Exception as e:
                result["healthy"] = False
                result["error"] = f"Model health check failed: {str(e)}"

    except Exception as e:
        result["healthy"] = False
        result["error"] = f"Health check error: {str(e)}"
        logger.exception(f"Error checking model health: {e}")

    return result


def check_all_models_health(
    models: Dict[str, Any],
) -> Dict[str, Dict[str, Any]]:
    """
    Check health of all registered models.

    Args:
        models: Dictionary mapping model names to model instances.

    Returns:
        Dictionary mapping model names to their health status.
    """
    result = {}
    for name, model in models.items():
        result[name] = check_model_health(model)
    return result


def get_system_health() -> Dict[str, Any]:
    """
    Get system health metrics including memory, CPU, and uptime.

    Returns:
        Dictionary with system health information:
        {
            "uptime_seconds": float,
            "memory": { ... },
            "cpu": { ... },
            "gpu": { ... }
        }
    """
    return {
        "uptime_seconds": get_uptime_seconds(),
        "system": get_system_info(),
        "memory": get_memory_info(),
        "cpu": get_cpu_info(),
        "disk": get_disk_info(),
        "gpu": get_gpu_info(),
    }


def get_cpu_info() -> Dict[str, Any]:
    """Get CPU usage information."""
    try:
        import psutil
        return {
            "percent": psutil.cpu_percent(interval=0.1),
            "count": psutil.cpu_count(),
            "count_logical": psutil.cpu_count(logical=True),
        }
    except ImportError:
        return {
            "count": os.cpu_count() or 1,
            "available": False,
            "reason": "psutil not installed",
        }
    except Exception as e:
        return {"available": False, "error": str(e)}


def format_health_response(
    models_status: Dict[str, Dict[str, Any]],
    system_health: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Format health status for the API response.

    Combines model status and system health into the format
    defined in the design doc.

    Args:
        models_status: Dictionary mapping model names to their health status.
        system_health: Optional system health info from get_system_health().
            If None, will call get_system_health().

    Returns:
        Dictionary matching the design doc health response format:
        {
            "status": "healthy" | "degraded" | "unhealthy",
            "uptime_seconds": float,
            "models": {
                "unet": { "loaded": true, "last_used": "...", "requests": 42 },
                ...
            },
            "system": {
                "memory": { ... },
                "cpu": { ... },
                "gpu": { ... }
            }
        }
    """
    if system_health is None:
        system_health = get_system_health()

    # Determine overall status
    status = _determine_overall_status(models_status, system_health)

    response = {
        "status": status,
        "uptime_seconds": system_health.get("uptime_seconds", get_uptime_seconds()),
        "models": models_status,
        "system": {
            "memory": system_health.get("memory", {}),
            "cpu": system_health.get("cpu", {}),
            "gpu": system_health.get("gpu", {}),
        },
    }

    return response


def _determine_overall_status(
    models_status: Dict[str, Dict[str, Any]],
    system_health: Dict[str, Any],
) -> str:
    """
    Determine overall gateway status based on component health.

    Returns:
        "healthy": All components functioning normally
        "degraded": Some issues but gateway is operational
        "unhealthy": Critical issues, gateway may not function correctly
    """
    # Check for critical system issues
    memory_info = system_health.get("memory", {})
    if isinstance(memory_info, dict) and "percent_used" in memory_info:
        if memory_info["percent_used"] > 95:
            return "unhealthy"
        elif memory_info["percent_used"] > 85:
            return "degraded"

    # Check model health
    unhealthy_models = 0
    loaded_models = 0

    for model_name, status in models_status.items():
        if status.get("loaded"):
            loaded_models += 1
            if not status.get("healthy", True):
                unhealthy_models += 1

    # If any loaded model is unhealthy
    if unhealthy_models > 0:
        if unhealthy_models == loaded_models:
            return "unhealthy"
        return "degraded"

    return "healthy"


class HealthChecker:
    """
    Centralized health checking with caching.

    Caches health check results to avoid excessive resource usage
    when health endpoint is called frequently.
    """

    def __init__(
        self,
        cache_ttl_seconds: float = 5.0,
    ):
        """
        Initialize the health checker.

        Args:
            cache_ttl_seconds: How long to cache health check results.
        """
        self.cache_ttl_seconds = cache_ttl_seconds
        self._cache: Dict[str, Any] = {}
        self._cache_time: Optional[float] = None

    def get_health(
        self,
        models: Dict[str, Any],
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Get the current health status, using cache if valid.

        Args:
            models: Dictionary of model instances to check.
            force_refresh: If True, bypass the cache.

        Returns:
            Formatted health response.
        """
        now = time.time()

        # Check if cache is valid
        if (
            not force_refresh
            and self._cache_time is not None
            and (now - self._cache_time) < self.cache_ttl_seconds
            and self._cache
        ):
            return self._cache

        # Refresh health data
        models_status = check_all_models_health(models)
        system_health = get_system_health()
        response = format_health_response(models_status, system_health)

        # Update cache
        self._cache = response
        self._cache_time = now

        return response

    def invalidate_cache(self) -> None:
        """Invalidate the health cache."""
        self._cache = {}
        self._cache_time = None


def check_system_health() -> Dict[str, Any]:
    """
    Check overall system health.

    Returns:
        Dictionary with system health information
    """
    health = {
        "system": get_system_info(),
        "memory": get_memory_info(),
        "disk": get_disk_info(),
        "gpu": get_gpu_info(),
    }

    # Determine overall status
    warnings = []
    errors = []

    # Check memory
    if health["memory"].get("available_mb", float("inf")) < 2048:
        warnings.append("Low memory: less than 2GB available")

    if health["memory"].get("available_mb", float("inf")) < 1024:
        errors.append("Critical: less than 1GB memory available")

    # Check disk
    if health["disk"].get("free_gb", float("inf")) < 5:
        warnings.append("Low disk space: less than 5GB available")

    # Determine status
    if errors:
        health["status"] = "critical"
        health["errors"] = errors
    elif warnings:
        health["status"] = "warning"
        health["warnings"] = warnings
    else:
        health["status"] = "healthy"

    return health


def get_system_info() -> Dict[str, Any]:
    """Get basic system information."""
    return {
        "platform": platform.system(),
        "platform_version": platform.version(),
        "python_version": platform.python_version(),
        "processor": platform.processor(),
        "machine": platform.machine(),
    }


def get_memory_info() -> Dict[str, Any]:
    """Get memory usage information."""
    try:
        import psutil

        memory = psutil.virtual_memory()
        return {
            "total_mb": round(memory.total / (1024 * 1024), 2),
            "available_mb": round(memory.available / (1024 * 1024), 2),
            "used_mb": round(memory.used / (1024 * 1024), 2),
            "percent_used": memory.percent,
        }
    except ImportError:
        logger.debug("psutil not available, skipping memory info")
        return {"available": False, "reason": "psutil not installed"}
    except Exception as e:
        return {"available": False, "error": str(e)}


def get_disk_info() -> Dict[str, Any]:
    """Get disk usage information."""
    try:
        import psutil

        # Check the disk where the current directory is located
        disk = psutil.disk_usage(os.getcwd())
        return {
            "total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
            "free_gb": round(disk.free / (1024 * 1024 * 1024), 2),
            "used_gb": round(disk.used / (1024 * 1024 * 1024), 2),
            "percent_used": disk.percent,
        }
    except ImportError:
        logger.debug("psutil not available, skipping disk info")
        return {"available": False, "reason": "psutil not installed"}
    except Exception as e:
        return {"available": False, "error": str(e)}


def get_gpu_info() -> Dict[str, Any]:
    """Get GPU information (if available)."""
    try:
        import torch

        if torch.cuda.is_available():
            return {
                "available": True,
                "device_count": torch.cuda.device_count(),
                "current_device": torch.cuda.current_device(),
                "device_name": torch.cuda.get_device_name(0),
                "memory_allocated_mb": round(
                    torch.cuda.memory_allocated(0) / (1024 * 1024), 2
                ),
                "memory_cached_mb": round(
                    torch.cuda.memory_reserved(0) / (1024 * 1024), 2
                ),
            }
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            # Apple Silicon MPS
            return {
                "available": True,
                "device": "mps",
                "device_name": "Apple Silicon GPU",
            }
        else:
            return {"available": False, "reason": "No GPU detected"}
    except ImportError:
        return {"available": False, "reason": "torch not installed"}
    except Exception as e:
        return {"available": False, "error": str(e)}


def check_model_dependencies() -> Dict[str, Any]:
    """Check if required model dependencies are available."""
    dependencies = {}

    # Check PyTorch
    try:
        import torch

        dependencies["torch"] = {
            "available": True,
            "version": torch.__version__,
        }
    except ImportError:
        dependencies["torch"] = {"available": False}

    # Check MONAI
    try:
        import monai

        dependencies["monai"] = {
            "available": True,
            "version": monai.__version__,
        }
    except ImportError:
        dependencies["monai"] = {"available": False}

    # Check nibabel
    try:
        import nibabel

        dependencies["nibabel"] = {
            "available": True,
            "version": nibabel.__version__,
        }
    except ImportError:
        dependencies["nibabel"] = {"available": False}

    # Check numpy
    try:
        import numpy

        dependencies["numpy"] = {
            "available": True,
            "version": numpy.__version__,
        }
    except ImportError:
        dependencies["numpy"] = {"available": False}

    return dependencies


def check_memory_available(required_mb: float) -> bool:
    """
    Check if enough RAM is available for an operation.

    Args:
        required_mb: The amount of memory required in megabytes.

    Returns:
        True if enough memory is available, False otherwise.

    Example:
        if not check_memory_available(2048):
            raise MemoryError("Need at least 2GB free RAM")
    """
    try:
        import psutil
        memory = psutil.virtual_memory()
        available_mb = memory.available / (1024 * 1024)
        return available_mb >= required_mb
    except ImportError:
        # If psutil is not available, assume memory is available
        logger.warning("psutil not available, cannot check memory")
        return True
    except Exception as e:
        logger.warning(f"Error checking memory: {e}")
        return True


def get_system_stats() -> Dict[str, Any]:
    """
    Get system statistics including CPU, memory, and GPU if available.

    This is a convenience function that returns key system metrics
    in a simple format for monitoring and logging.

    Returns:
        Dictionary with system statistics:
        {
            "cpu_percent": float,
            "memory_percent": float,
            "memory_available_mb": float,
            "memory_total_mb": float,
            "gpu_available": bool,
            "gpu_memory_mb": float or None
        }

    Example:
        stats = get_system_stats()
        if stats["memory_percent"] > 90:
            logger.warning("High memory usage!")
    """
    stats: Dict[str, Any] = {}

    # CPU
    cpu_info = get_cpu_info()
    stats["cpu_percent"] = cpu_info.get("percent", 0.0)
    stats["cpu_count"] = cpu_info.get("count", 1)

    # Memory
    memory_info = get_memory_info()
    stats["memory_percent"] = memory_info.get("percent_used", 0.0)
    stats["memory_available_mb"] = memory_info.get("available_mb", 0.0)
    stats["memory_total_mb"] = memory_info.get("total_mb", 0.0)
    stats["memory_used_mb"] = memory_info.get("used_mb", 0.0)

    # GPU
    gpu_info = get_gpu_info()
    stats["gpu_available"] = gpu_info.get("available", False)
    if stats["gpu_available"]:
        stats["gpu_name"] = gpu_info.get("device_name")
        stats["gpu_memory_allocated_mb"] = gpu_info.get("memory_allocated_mb")
        stats["gpu_memory_cached_mb"] = gpu_info.get("memory_cached_mb")

    return stats


class HealthMonitor:
    """
    Tracks request counts, latencies, and errors per model.

    Provides real-time statistics for monitoring gateway performance
    and model health.

    Example:
        monitor = HealthMonitor()

        # Record a successful request
        monitor.record_request("unet", 0.5)

        # Record an error
        monitor.record_error("sam3", "TimeoutError")

        # Get stats
        stats = monitor.get_model_stats("unet")
        print(f"UNet requests: {stats['total_requests']}")
    """

    def __init__(self):
        """Initialize the health monitor."""
        self._lock = threading.Lock()
        self._model_stats: Dict[str, Dict[str, Any]] = {}
        self._global_stats: Dict[str, Any] = {
            "total_requests": 0,
            "total_errors": 0,
            "start_time": time.time(),
        }

    def _ensure_model(self, model: str) -> None:
        """Ensure model stats entry exists."""
        if model not in self._model_stats:
            self._model_stats[model] = {
                "total_requests": 0,
                "successful_requests": 0,
                "failed_requests": 0,
                "total_latency_ms": 0.0,
                "min_latency_ms": float("inf"),
                "max_latency_ms": 0.0,
                "errors": {},
                "last_request_time": None,
                "last_error_time": None,
            }

    def record_request(
        self,
        model: str,
        latency_seconds: float,
        success: bool = True,
    ) -> None:
        """
        Record a request for a model.

        Args:
            model: The model name (e.g., "unet", "sam3").
            latency_seconds: Request latency in seconds.
            success: Whether the request was successful.
        """
        latency_ms = latency_seconds * 1000

        with self._lock:
            self._ensure_model(model)
            stats = self._model_stats[model]

            stats["total_requests"] += 1
            stats["last_request_time"] = time.time()

            if success:
                stats["successful_requests"] += 1
                stats["total_latency_ms"] += latency_ms
                stats["min_latency_ms"] = min(stats["min_latency_ms"], latency_ms)
                stats["max_latency_ms"] = max(stats["max_latency_ms"], latency_ms)
            else:
                stats["failed_requests"] += 1

            self._global_stats["total_requests"] += 1

    def record_error(
        self,
        model: str,
        error_type: str,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Record an error for a model.

        Args:
            model: The model name.
            error_type: The type of error (e.g., "TimeoutError").
            error_message: Optional error message.
        """
        with self._lock:
            self._ensure_model(model)
            stats = self._model_stats[model]

            # Track error counts by type
            if error_type not in stats["errors"]:
                stats["errors"][error_type] = 0
            stats["errors"][error_type] += 1

            stats["last_error_time"] = time.time()
            self._global_stats["total_errors"] += 1

    def get_model_stats(self, model: str) -> Dict[str, Any]:
        """
        Get statistics for a specific model.

        Args:
            model: The model name.

        Returns:
            Dictionary with model statistics:
            {
                "total_requests": int,
                "successful_requests": int,
                "failed_requests": int,
                "avg_latency_ms": float,
                "min_latency_ms": float,
                "max_latency_ms": float,
                "error_rate": float (0.0 to 1.0),
                "errors": {error_type: count},
                "last_request_time": float or None,
                "last_error_time": float or None
            }
        """
        with self._lock:
            if model not in self._model_stats:
                return {
                    "total_requests": 0,
                    "successful_requests": 0,
                    "failed_requests": 0,
                    "avg_latency_ms": 0.0,
                    "min_latency_ms": 0.0,
                    "max_latency_ms": 0.0,
                    "error_rate": 0.0,
                    "errors": {},
                    "last_request_time": None,
                    "last_error_time": None,
                }

            stats = self._model_stats[model].copy()

            # Calculate derived metrics
            if stats["successful_requests"] > 0:
                stats["avg_latency_ms"] = (
                    stats["total_latency_ms"] / stats["successful_requests"]
                )
            else:
                stats["avg_latency_ms"] = 0.0

            if stats["min_latency_ms"] == float("inf"):
                stats["min_latency_ms"] = 0.0

            if stats["total_requests"] > 0:
                stats["error_rate"] = stats["failed_requests"] / stats["total_requests"]
            else:
                stats["error_rate"] = 0.0

            # Remove internal total_latency field
            del stats["total_latency_ms"]

            return stats

    def get_all_stats(self) -> Dict[str, Any]:
        """
        Get statistics for all models.

        Returns:
            Dictionary mapping model names to their statistics,
            plus global statistics.
        """
        with self._lock:
            result = {
                "models": {},
                "global": {
                    "total_requests": self._global_stats["total_requests"],
                    "total_errors": self._global_stats["total_errors"],
                    "uptime_seconds": time.time() - self._global_stats["start_time"],
                },
            }

            for model in self._model_stats:
                result["models"][model] = self.get_model_stats(model)

            return result

    def reset(self) -> None:
        """Reset all statistics."""
        with self._lock:
            self._model_stats.clear()
            self._global_stats = {
                "total_requests": 0,
                "total_errors": 0,
                "start_time": time.time(),
            }

    def reset_model(self, model: str) -> None:
        """Reset statistics for a specific model."""
        with self._lock:
            if model in self._model_stats:
                del self._model_stats[model]
