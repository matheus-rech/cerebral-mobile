"""
Unit tests for the retry module.

Tests retry decorator and context manager functionality.
"""

import time
import pytest
from unittest.mock import Mock, patch, call
from gateway.utils.retry import (
    with_retry,
    RetryContext,
    retry_with_result,
)


class TestWithRetryDecorator:
    """Tests for the with_retry decorator."""

    def test_successful_first_attempt(self):
        """Function should succeed on first attempt."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01)
        def successful_func():
            nonlocal call_count
            call_count += 1
            return "success"

        result = successful_func()
        assert result == "success"
        assert call_count == 1

    def test_retry_on_failure(self):
        """Function should retry after failure."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01)
        def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ValueError("Temporary failure")
            return "success"

        result = flaky_func()
        assert result == "success"
        assert call_count == 2

    def test_max_attempts_exceeded(self):
        """Should raise exception after max attempts."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01)
        def always_fails():
            nonlocal call_count
            call_count += 1
            raise ValueError("Always fails")

        with pytest.raises(ValueError, match="Always fails"):
            always_fails()

        assert call_count == 3

    def test_backoff_delay(self):
        """Should wait between retry attempts."""
        call_times = []

        @with_retry(max_attempts=3, backoff_seconds=0.1)
        def timed_func():
            call_times.append(time.time())
            if len(call_times) < 3:
                raise ValueError("Retry")
            return "done"

        timed_func()

        # Check that there was a delay between calls
        assert len(call_times) == 3
        delay1 = call_times[1] - call_times[0]
        delay2 = call_times[2] - call_times[1]
        assert delay1 >= 0.08  # Allow some tolerance
        assert delay2 >= 0.08

    def test_exponential_backoff(self):
        """Exponential backoff should double the wait time."""
        call_times = []

        @with_retry(max_attempts=4, backoff_seconds=0.05, exponential=True)
        def timed_func():
            call_times.append(time.time())
            if len(call_times) < 4:
                raise ValueError("Retry")
            return "done"

        timed_func()

        # Second delay should be roughly double the first
        delay1 = call_times[1] - call_times[0]
        delay2 = call_times[2] - call_times[1]
        delay3 = call_times[3] - call_times[2]

        # With exponential backoff: 0.05, 0.1, 0.2
        assert delay1 < delay2
        assert delay2 < delay3

    def test_specific_exceptions_only(self):
        """Should only retry on specified exception types."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01, exceptions=(ValueError,))
        def selective_retry():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ValueError("Retry this")
            if call_count == 2:
                raise TypeError("Don't retry this")
            return "success"

        with pytest.raises(TypeError, match="Don't retry"):
            selective_retry()

        assert call_count == 2  # Tried once, retried for ValueError, failed on TypeError

    def test_on_retry_callback(self):
        """on_retry callback should be called on each retry."""
        callback = Mock()
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01, on_retry=callback)
        def flaky():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError(f"Attempt {call_count}")
            return "success"

        result = flaky()

        assert result == "success"
        assert callback.call_count == 2  # Called on retries 1 and 2

    def test_preserves_function_metadata(self):
        """Decorated function should preserve name and docstring."""

        @with_retry(max_attempts=2)
        def documented_func():
            """This is the docstring."""
            return 42

        assert documented_func.__name__ == "documented_func"
        assert documented_func.__doc__ == "This is the docstring."

    def test_invalid_max_attempts(self):
        """Should raise ValueError for invalid max_attempts."""
        with pytest.raises(ValueError, match="at least 1"):
            @with_retry(max_attempts=0)
            def invalid():
                pass

    def test_negative_backoff(self):
        """Should raise ValueError for negative backoff."""
        with pytest.raises(ValueError, match="non-negative"):
            @with_retry(backoff_seconds=-1)
            def invalid():
                pass


class TestRetryContext:
    """Tests for the RetryContext context manager."""

    def test_successful_first_attempt(self):
        """Should succeed on first attempt."""
        result = None
        with RetryContext(max_attempts=3, backoff_seconds=0.01) as retry:
            while retry.should_continue():
                retry.attempt()
                result = "success"
                retry.success()
                break

        assert result == "success"
        assert retry.attempts_made == 1
        assert retry.succeeded is True

    def test_retry_after_failure(self):
        """Should retry after failure."""
        attempts = 0
        with RetryContext(max_attempts=3, backoff_seconds=0.01) as retry:
            while retry.should_continue():
                attempt_num = retry.attempt()
                attempts = attempt_num
                if attempt_num < 2:
                    retry.failed(ValueError("Temporary"))
                else:
                    retry.success()
                    break

        assert attempts == 2
        assert retry.succeeded is True

    def test_exhausted_attempts(self):
        """Should raise after exhausting attempts."""
        with RetryContext(max_attempts=2, backoff_seconds=0.01) as retry:
            with pytest.raises(ValueError, match="Always fails"):
                while retry.should_continue():
                    retry.attempt()
                    retry.failed(ValueError("Always fails"))

    def test_should_continue_after_success(self):
        """should_continue() should return False after success."""
        with RetryContext(max_attempts=3) as retry:
            retry.attempt()
            retry.success()
            assert retry.should_continue() is False

    def test_should_continue_after_exhaustion(self):
        """should_continue() should return False after exhaustion."""
        with RetryContext(max_attempts=2, backoff_seconds=0.01) as retry:
            try:
                while retry.should_continue():
                    retry.attempt()
                    retry.failed(ValueError("fail"))
            except ValueError:
                pass
            assert retry.should_continue() is False


class TestRetryWithResult:
    """Tests for the retry_with_result function."""

    def test_success_on_first_call(self):
        """Should return result on first successful call."""
        call_count = 0

        def always_succeeds():
            nonlocal call_count
            call_count += 1
            return (True, "result")

        result = retry_with_result(always_succeeds, max_attempts=3, backoff_seconds=0.01)

        assert result == "result"
        assert call_count == 1

    def test_retry_until_success(self):
        """Should retry until function returns success."""
        call_count = 0

        def succeeds_on_third():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return (False, f"failure {call_count}")
            return (True, "finally!")

        result = retry_with_result(succeeds_on_third, max_attempts=3, backoff_seconds=0.01)

        assert result == "finally!"
        assert call_count == 3

    def test_all_attempts_fail(self):
        """Should raise RuntimeError if all attempts return failure."""
        call_count = 0

        def always_fails():
            nonlocal call_count
            call_count += 1
            return (False, f"failure {call_count}")

        with pytest.raises(RuntimeError, match="All 3 attempts"):
            retry_with_result(always_fails, max_attempts=3, backoff_seconds=0.01)

        assert call_count == 3


class TestRetryLogging:
    """Tests for retry logging behavior."""

    @patch('gateway.utils.retry.logger')
    def test_logs_retry_attempts(self, mock_logger):
        """Should log retry attempts."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01)
        def flaky():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ValueError("Temporary")
            return "done"

        flaky()

        # Check that info was logged for the retry
        mock_logger.info.assert_called()

    @patch('gateway.utils.retry.logger')
    def test_logs_final_failure(self, mock_logger):
        """Should log when all attempts exhausted."""

        @with_retry(max_attempts=2, backoff_seconds=0.01)
        def always_fails():
            raise ValueError("Always")

        with pytest.raises(ValueError):
            always_fails()

        # Check that warning was logged for final failure
        mock_logger.warning.assert_called()


class TestRetryWithArguments:
    """Tests for retry with function arguments."""

    def test_positional_args_preserved(self):
        """Positional arguments should be passed through."""
        received_args = []

        @with_retry(max_attempts=2, backoff_seconds=0.01)
        def with_args(a, b, c):
            received_args.append((a, b, c))
            if len(received_args) < 2:
                raise ValueError("retry")
            return a + b + c

        result = with_args(1, 2, 3)

        assert result == 6
        assert len(received_args) == 2
        assert all(args == (1, 2, 3) for args in received_args)

    def test_keyword_args_preserved(self):
        """Keyword arguments should be passed through."""
        received_kwargs = []

        @with_retry(max_attempts=2, backoff_seconds=0.01)
        def with_kwargs(**kwargs):
            received_kwargs.append(kwargs.copy())
            if len(received_kwargs) < 2:
                raise ValueError("retry")
            return kwargs['x'] * kwargs['y']

        result = with_kwargs(x=3, y=4)

        assert result == 12
        assert len(received_kwargs) == 2
        assert all(kw == {'x': 3, 'y': 4} for kw in received_kwargs)


class TestAsyncRetry:
    """Tests for async function retry support."""

    @pytest.mark.asyncio
    async def test_async_successful_first_attempt(self):
        """Async function should succeed on first attempt."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01)
        async def async_successful():
            nonlocal call_count
            call_count += 1
            return "success"

        result = await async_successful()
        assert result == "success"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_async_retry_on_failure(self):
        """Async function should retry after failure."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01)
        async def async_flaky():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ValueError("Temporary failure")
            return "success"

        result = await async_flaky()
        assert result == "success"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_async_max_attempts_exceeded(self):
        """Async should raise exception after max attempts."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01)
        async def async_always_fails():
            nonlocal call_count
            call_count += 1
            raise ValueError("Always fails")

        with pytest.raises(ValueError, match="Always fails"):
            await async_always_fails()

        assert call_count == 3

    @pytest.mark.asyncio
    async def test_async_with_arguments(self):
        """Async function should preserve arguments."""
        received_args = []

        @with_retry(max_attempts=2, backoff_seconds=0.01)
        async def async_with_args(a, b, c=10):
            received_args.append((a, b, c))
            if len(received_args) < 2:
                raise ValueError("retry")
            return a + b + c

        result = await async_with_args(1, 2, c=3)

        assert result == 6
        assert len(received_args) == 2
        assert all(args == (1, 2, 3) for args in received_args)

    @pytest.mark.asyncio
    async def test_async_exponential_backoff(self):
        """Async exponential backoff should work."""
        import asyncio
        call_times = []

        @with_retry(max_attempts=4, backoff_seconds=0.05, exponential=True)
        async def async_timed():
            call_times.append(asyncio.get_event_loop().time())
            if len(call_times) < 4:
                raise ValueError("Retry")
            return "done"

        await async_timed()

        # Second delay should be roughly double the first
        delay1 = call_times[1] - call_times[0]
        delay2 = call_times[2] - call_times[1]
        delay3 = call_times[3] - call_times[2]

        assert delay1 < delay2
        assert delay2 < delay3

    @pytest.mark.asyncio
    async def test_async_specific_exceptions(self):
        """Async should only retry on specified exceptions."""
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01, exceptions=(ValueError,))
        async def async_selective():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ValueError("Retry this")
            if call_count == 2:
                raise TypeError("Don't retry this")
            return "success"

        with pytest.raises(TypeError, match="Don't retry"):
            await async_selective()

        assert call_count == 2

    def test_async_preserves_function_metadata(self):
        """Async decorated function should preserve metadata."""

        @with_retry(max_attempts=2)
        async def documented_async_func():
            """This is the async docstring."""
            return 42

        assert documented_async_func.__name__ == "documented_async_func"
        assert documented_async_func.__doc__ == "This is the async docstring."

    @pytest.mark.asyncio
    async def test_async_on_retry_callback(self):
        """Async on_retry callback should be called."""
        callback = Mock()
        call_count = 0

        @with_retry(max_attempts=3, backoff_seconds=0.01, on_retry=callback)
        async def async_flaky():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError(f"Attempt {call_count}")
            return "success"

        result = await async_flaky()

        assert result == "success"
        assert callback.call_count == 2
