"""
Utility modules for the ML Gateway.

Provides retry logic, timeout handling, health check utilities,
and custom exceptions.
"""

# Retry utilities
from .retry import (
    with_retry,
    RetryContext,
    retry_with_result,
)

# Timeout utilities
from .timeout import (
    timeout,
    with_timeout,
    run_with_timeout,
    TimeoutError,
    TimeoutExecutor,
    get_global_executor,
    shutdown_global_executor,
)

# Health check utilities
from .health import (
    check_system_health,
    check_model_health,
    check_all_models_health,
    check_memory_available,
    get_system_health,
    get_system_stats,
    format_health_response,
    init_start_time,
    get_uptime_seconds,
    HealthChecker,
    HealthMonitor,
)

# Error utilities
from .errors import (
    ErrorCode,
    GatewayError,
    ModelNotFoundError,
    ModelNotLoadedError,
    InferenceTimeoutError,
    ModelLoadError,
    InferenceError,
    ValidationError,
    MemoryError,
    format_error_response,
    format_success_response,
)

__all__ = [
    # Retry
    "with_retry",
    "RetryContext",
    "retry_with_result",
    # Timeout
    "timeout",
    "with_timeout",
    "run_with_timeout",
    "TimeoutError",
    "TimeoutExecutor",
    "get_global_executor",
    "shutdown_global_executor",
    # Health
    "check_system_health",
    "check_model_health",
    "check_all_models_health",
    "check_memory_available",
    "get_system_health",
    "get_system_stats",
    "format_health_response",
    "init_start_time",
    "get_uptime_seconds",
    "HealthChecker",
    "HealthMonitor",
    # Errors
    "ErrorCode",
    "GatewayError",
    "ModelNotFoundError",
    "ModelNotLoadedError",
    "InferenceTimeoutError",
    "ModelLoadError",
    "InferenceError",
    "ValidationError",
    "MemoryError",
    "format_error_response",
    "format_success_response",
]
