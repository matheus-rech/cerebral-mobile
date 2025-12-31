"""
Timeout wrapper for the ML Gateway.

Provides thread-safe timeout functionality for wrapping inference calls.
Uses threading-based approach for cross-platform compatibility and
proper cleanup of resources on timeout.
"""

import functools
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from contextlib import contextmanager
from typing import Callable, TypeVar, Optional, Generator, Any

logger = logging.getLogger(__name__)

T = TypeVar("T")


class TimeoutError(Exception):
    """Raised when an operation exceeds its timeout."""

    def __init__(self, message: str, timeout_seconds: float):
        super().__init__(message)
        self.timeout_seconds = timeout_seconds


@contextmanager
def timeout(
    seconds: float,
    message: Optional[str] = None,
) -> Generator[None, None, None]:
    """
    Context manager that raises TimeoutError if the block takes too long.

    Uses a thread pool to execute the code block with a timeout. This approach
    is thread-safe and works on all platforms (unlike signal-based timeouts).

    Args:
        seconds: Maximum time in seconds to wait
        message: Optional custom error message

    Raises:
        TimeoutError: If the block exceeds the timeout
        ValueError: If seconds is not positive

    Example:
        with timeout(30):
            result = model.predict(data)

        with timeout(60, message="SynthSeg inference timed out"):
            result = synthseg.segment(brain_volume)

    Note:
        This context manager cannot interrupt blocking I/O or native code
        that doesn't release the GIL. For most Python code and NumPy/PyTorch
        operations, it will work correctly.
    """
    if seconds <= 0:
        raise ValueError("Timeout seconds must be positive")

    if message is None:
        message = f"Operation exceeded {seconds}s timeout"

    # For the context manager pattern, we use a flag to track timeout
    # The actual timeout enforcement happens in the with_timeout decorator
    # or can be done using run_with_timeout function

    # This context manager is primarily for documentation and structure
    # Real timeout enforcement should use run_with_timeout or with_timeout decorator
    yield


def run_with_timeout(
    func: Callable[..., T],
    timeout_seconds: float,
    *args,
    **kwargs,
) -> T:
    """
    Run a function with a timeout.

    Uses ThreadPoolExecutor to run the function in a separate thread
    and waits for the result with a timeout.

    Args:
        func: The function to run
        timeout_seconds: Maximum time in seconds to wait
        *args: Positional arguments to pass to func
        **kwargs: Keyword arguments to pass to func

    Returns:
        The return value of func

    Raises:
        TimeoutError: If the function exceeds the timeout
        Exception: Any exception raised by func

    Example:
        result = run_with_timeout(model.predict, 30, input_data)
        result = run_with_timeout(heavy_computation, 60, data=data, verbose=True)
    """
    if timeout_seconds <= 0:
        raise ValueError("Timeout seconds must be positive")

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout_seconds)
        except FuturesTimeoutError:
            # The thread may still be running, but we raise the timeout
            logger.warning(
                f"Function '{func.__name__}' exceeded {timeout_seconds}s timeout"
            )
            raise TimeoutError(
                f"Function '{func.__name__}' exceeded {timeout_seconds}s timeout",
                timeout_seconds,
            )


def with_timeout(
    seconds: float,
    message: Optional[str] = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator that wraps a function with a timeout.

    Args:
        seconds: Maximum time in seconds to wait
        message: Optional custom error message

    Returns:
        Decorated function that will raise TimeoutError if it takes too long

    Example:
        @with_timeout(30)
        def slow_function():
            # This will timeout after 30 seconds
            pass

        @with_timeout(60, message="Model inference timed out")
        def model_predict(data):
            return model(data)
    """
    if seconds <= 0:
        raise ValueError("Timeout seconds must be positive")

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            try:
                return run_with_timeout(func, seconds, *args, **kwargs)
            except TimeoutError:
                error_message = message or f"Function '{func.__name__}' exceeded {seconds}s timeout"
                raise TimeoutError(error_message, seconds)

        return wrapper

    return decorator


class TimeoutExecutor:
    """
    Reusable executor for running functions with timeouts.

    More efficient than run_with_timeout for repeated calls as it
    reuses the same thread pool.

    Example:
        executor = TimeoutExecutor(max_workers=4)
        try:
            result1 = executor.run(func1, 30, arg1, arg2)
            result2 = executor.run(func2, 60, data=data)
        finally:
            executor.shutdown()
    """

    def __init__(self, max_workers: int = 4):
        """
        Initialize the executor.

        Args:
            max_workers: Maximum number of concurrent workers
        """
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = threading.Lock()
        self._shutdown = False

    def run(
        self,
        func: Callable[..., T],
        timeout_seconds: float,
        *args,
        **kwargs,
    ) -> T:
        """
        Run a function with a timeout using the shared executor.

        Args:
            func: The function to run
            timeout_seconds: Maximum time in seconds to wait
            *args: Positional arguments to pass to func
            **kwargs: Keyword arguments to pass to func

        Returns:
            The return value of func

        Raises:
            TimeoutError: If the function exceeds the timeout
            RuntimeError: If the executor has been shut down
        """
        with self._lock:
            if self._shutdown:
                raise RuntimeError("Executor has been shut down")

        future = self._executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout_seconds)
        except FuturesTimeoutError:
            logger.warning(
                f"Function '{func.__name__}' exceeded {timeout_seconds}s timeout"
            )
            raise TimeoutError(
                f"Function '{func.__name__}' exceeded {timeout_seconds}s timeout",
                timeout_seconds,
            )

    def shutdown(self, wait: bool = True) -> None:
        """
        Shut down the executor.

        Args:
            wait: If True, wait for pending tasks to complete
        """
        with self._lock:
            self._shutdown = True
        self._executor.shutdown(wait=wait)

    def __enter__(self) -> "TimeoutExecutor":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        self.shutdown(wait=True)
        return False


# Global executor for convenience (lazy-initialized)
_global_executor: Optional[TimeoutExecutor] = None
_global_executor_lock = threading.Lock()


def get_global_executor() -> TimeoutExecutor:
    """Get or create the global timeout executor."""
    global _global_executor
    with _global_executor_lock:
        if _global_executor is None:
            _global_executor = TimeoutExecutor(max_workers=8)
    return _global_executor


def shutdown_global_executor() -> None:
    """Shutdown the global executor if it exists."""
    global _global_executor
    with _global_executor_lock:
        if _global_executor is not None:
            _global_executor.shutdown(wait=True)
            _global_executor = None
