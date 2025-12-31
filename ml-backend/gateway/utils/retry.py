"""
Retry decorator with exponential backoff for the ML Gateway.

Provides a decorator to automatically retry failed function calls
with configurable attempts and backoff timing. Supports both sync
and async functions.
"""

import asyncio
import functools
import inspect
import logging
import time
from typing import Callable, TypeVar, Optional, Tuple, Type, Union

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable)


def with_retry(
    max_attempts: int = 2,
    backoff_seconds: float = 1.0,
    exponential: bool = False,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[Exception, int, float], None]] = None,
) -> Callable[[F], F]:
    """
    Decorator that retries a function on failure.

    Args:
        max_attempts: Maximum number of attempts (including initial try).
            Default is 2 (one retry).
        backoff_seconds: Time to wait between attempts. Default is 1.0.
        exponential: If True, backoff doubles after each attempt.
        exceptions: Tuple of exception types to catch and retry on.
            Default is all exceptions.
        on_retry: Optional callback called before each retry with
            (exception, attempt_number, next_backoff).

    Returns:
        Decorated function that will retry on failure.

    Example:
        @with_retry(max_attempts=3, backoff_seconds=0.5)
        def flaky_function():
            # might fail sometimes
            pass

        @with_retry(max_attempts=2, exceptions=(ConnectionError, TimeoutError))
        def network_call():
            # only retries on network-related errors
            pass
    """
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least 1")
    if backoff_seconds < 0:
        raise ValueError("backoff_seconds must be non-negative")

    def decorator(func: F) -> F:
        # Check if the function is async (use inspect for Python 3.14+ compatibility)
        is_async = inspect.iscoroutinefunction(func)

        if is_async:
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                last_exception: Optional[Exception] = None
                current_backoff = backoff_seconds

                for attempt in range(1, max_attempts + 1):
                    try:
                        return await func(*args, **kwargs)
                    except exceptions as e:
                        last_exception = e

                        if attempt == max_attempts:
                            # No more retries, raise the exception
                            logger.warning(
                                f"Async function '{func.__name__}' failed after {max_attempts} attempts. "
                                f"Last error: {e}"
                            )
                            raise

                        # Log the retry
                        logger.info(
                            f"Async function '{func.__name__}' failed on attempt {attempt}/{max_attempts}: {e}. "
                            f"Retrying in {current_backoff:.2f}s..."
                        )

                        # Call the on_retry callback if provided
                        if on_retry is not None:
                            on_retry(e, attempt, current_backoff)

                        # Wait before retrying (async sleep)
                        await asyncio.sleep(current_backoff)

                        # Apply exponential backoff if enabled
                        if exponential:
                            current_backoff *= 2

                # This should not be reached, but just in case
                if last_exception is not None:
                    raise last_exception
                raise RuntimeError(f"Unexpected state in retry decorator for {func.__name__}")

            return async_wrapper  # type: ignore
        else:
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                last_exception: Optional[Exception] = None
                current_backoff = backoff_seconds

                for attempt in range(1, max_attempts + 1):
                    try:
                        return func(*args, **kwargs)
                    except exceptions as e:
                        last_exception = e

                        if attempt == max_attempts:
                            # No more retries, raise the exception
                            logger.warning(
                                f"Function '{func.__name__}' failed after {max_attempts} attempts. "
                                f"Last error: {e}"
                            )
                            raise

                        # Log the retry
                        logger.info(
                            f"Function '{func.__name__}' failed on attempt {attempt}/{max_attempts}: {e}. "
                            f"Retrying in {current_backoff:.2f}s..."
                        )

                        # Call the on_retry callback if provided
                        if on_retry is not None:
                            on_retry(e, attempt, current_backoff)

                        # Wait before retrying
                        time.sleep(current_backoff)

                        # Apply exponential backoff if enabled
                        if exponential:
                            current_backoff *= 2

                # This should not be reached, but just in case
                if last_exception is not None:
                    raise last_exception
                raise RuntimeError(f"Unexpected state in retry decorator for {func.__name__}")

            return wrapper  # type: ignore

    return decorator


class RetryContext:
    """
    Context manager for retry logic with more control.

    Allows manual retry control for more complex scenarios.

    Example:
        with RetryContext(max_attempts=3, backoff_seconds=1.0) as retry:
            while retry.should_continue():
                try:
                    result = risky_operation()
                    retry.success()
                    break
                except Exception as e:
                    retry.failed(e)
    """

    def __init__(
        self,
        max_attempts: int = 2,
        backoff_seconds: float = 1.0,
        exponential: bool = False,
    ):
        self.max_attempts = max_attempts
        self.backoff_seconds = backoff_seconds
        self.exponential = exponential
        self.current_attempt = 0
        self.current_backoff = backoff_seconds
        self.last_exception: Optional[Exception] = None
        self._succeeded = False
        self._exhausted = False

    def __enter__(self) -> "RetryContext":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        # Don't suppress exceptions
        return False

    def should_continue(self) -> bool:
        """Check if more attempts should be made."""
        return not self._succeeded and not self._exhausted

    def attempt(self) -> int:
        """
        Start a new attempt. Returns the attempt number (1-indexed).
        """
        self.current_attempt += 1
        if self.current_attempt > self.max_attempts:
            self._exhausted = True
            if self.last_exception:
                raise self.last_exception
            raise RuntimeError("Retry attempts exhausted")
        return self.current_attempt

    def success(self) -> None:
        """Mark the current attempt as successful."""
        self._succeeded = True

    def failed(self, exception: Exception) -> None:
        """
        Mark the current attempt as failed.

        Args:
            exception: The exception that caused the failure.

        Raises:
            The exception if max attempts have been reached.
        """
        self.last_exception = exception

        if self.current_attempt >= self.max_attempts:
            self._exhausted = True
            logger.warning(
                f"Retry exhausted after {self.max_attempts} attempts. "
                f"Last error: {exception}"
            )
            raise exception

        logger.info(
            f"Attempt {self.current_attempt}/{self.max_attempts} failed: {exception}. "
            f"Waiting {self.current_backoff:.2f}s before retry..."
        )

        time.sleep(self.current_backoff)

        if self.exponential:
            self.current_backoff *= 2

    @property
    def attempts_made(self) -> int:
        """Return the number of attempts made so far."""
        return self.current_attempt

    @property
    def succeeded(self) -> bool:
        """Return whether the operation succeeded."""
        return self._succeeded


def retry_with_result(
    func: Callable[[], Tuple[bool, any]],
    max_attempts: int = 2,
    backoff_seconds: float = 1.0,
) -> any:
    """
    Retry a function that returns (success: bool, result) tuple.

    This is useful when you want to retry based on the return value
    rather than exceptions.

    Args:
        func: Function that returns (success, result) tuple
        max_attempts: Maximum number of attempts
        backoff_seconds: Time to wait between attempts

    Returns:
        The result from the first successful call

    Raises:
        RuntimeError: If all attempts return success=False
    """
    last_result = None

    for attempt in range(1, max_attempts + 1):
        success, result = func()
        last_result = result

        if success:
            return result

        if attempt < max_attempts:
            logger.info(
                f"Attempt {attempt}/{max_attempts} returned failure. "
                f"Retrying in {backoff_seconds:.2f}s..."
            )
            time.sleep(backoff_seconds)

    raise RuntimeError(
        f"All {max_attempts} attempts returned failure. Last result: {last_result}"
    )
