"""
Unit tests for the timeout module.

Tests timeout decorator, context manager, and executor functionality.
"""

import time
import pytest
from unittest.mock import Mock, patch
from gateway.utils.timeout import (
    timeout,
    with_timeout,
    run_with_timeout,
    TimeoutError,
    TimeoutExecutor,
    get_global_executor,
    shutdown_global_executor,
)


class TestRunWithTimeout:
    """Tests for the run_with_timeout function."""

    def test_successful_fast_function(self):
        """Fast function should complete successfully."""

        def fast_func(x, y):
            return x + y

        result = run_with_timeout(fast_func, 1.0, 3, 4)
        assert result == 7

    def test_timeout_on_slow_function(self):
        """Slow function should raise TimeoutError."""

        def slow_func():
            time.sleep(2.0)
            return "done"

        with pytest.raises(TimeoutError) as exc_info:
            run_with_timeout(slow_func, 0.1)

        assert exc_info.value.timeout_seconds == 0.1
        assert "0.1" in str(exc_info.value)

    def test_function_exception_propagates(self):
        """Exceptions from the function should propagate."""

        def failing_func():
            raise ValueError("Something went wrong")

        with pytest.raises(ValueError, match="Something went wrong"):
            run_with_timeout(failing_func, 1.0)

    def test_kwargs_passed_through(self):
        """Keyword arguments should be passed to function."""

        def func_with_kwargs(a, b=10, c=20):
            return a + b + c

        result = run_with_timeout(func_with_kwargs, 1.0, 5, b=15, c=25)
        assert result == 45

    def test_invalid_timeout_value(self):
        """Should raise ValueError for non-positive timeout."""
        with pytest.raises(ValueError, match="positive"):
            run_with_timeout(lambda: None, 0)

        with pytest.raises(ValueError, match="positive"):
            run_with_timeout(lambda: None, -1)


class TestWithTimeoutDecorator:
    """Tests for the with_timeout decorator."""

    def test_fast_function_succeeds(self):
        """Fast function should succeed."""

        @with_timeout(1.0)
        def fast():
            return "quick"

        result = fast()
        assert result == "quick"

    def test_slow_function_times_out(self):
        """Slow function should timeout."""

        @with_timeout(0.1)
        def slow():
            time.sleep(2.0)
            return "slow"

        with pytest.raises(TimeoutError):
            slow()

    def test_custom_error_message(self):
        """Should use custom error message."""

        @with_timeout(0.1, message="Custom timeout message")
        def slow():
            time.sleep(2.0)

        with pytest.raises(TimeoutError, match="Custom timeout message"):
            slow()

    def test_preserves_function_metadata(self):
        """Decorated function should preserve metadata."""

        @with_timeout(1.0)
        def documented_func():
            """This is a docstring."""
            return 42

        assert documented_func.__name__ == "documented_func"
        assert documented_func.__doc__ == "This is a docstring."

    def test_invalid_seconds(self):
        """Should raise ValueError for invalid seconds."""
        with pytest.raises(ValueError, match="positive"):
            @with_timeout(0)
            def invalid():
                pass

    def test_arguments_preserved(self):
        """Function arguments should be preserved."""

        @with_timeout(1.0)
        def with_args(a, b, c=10):
            return a * b + c

        result = with_args(2, 3, c=5)
        assert result == 11


class TestTimeoutContextManager:
    """Tests for the timeout context manager."""

    def test_context_manager_exists(self):
        """Context manager should be usable."""
        with timeout(1.0):
            x = 1 + 1
        assert x == 2

    def test_invalid_seconds_raises(self):
        """Should raise ValueError for invalid seconds."""
        with pytest.raises(ValueError, match="positive"):
            with timeout(0):
                pass

        with pytest.raises(ValueError, match="positive"):
            with timeout(-5):
                pass


class TestTimeoutExecutor:
    """Tests for the TimeoutExecutor class."""

    def test_run_fast_function(self):
        """Should run fast functions successfully."""
        executor = TimeoutExecutor(max_workers=2)
        try:
            result = executor.run(lambda x: x * 2, 1.0, 5)
            assert result == 10
        finally:
            executor.shutdown()

    def test_run_slow_function_times_out(self):
        """Should timeout on slow functions."""
        executor = TimeoutExecutor(max_workers=2)
        try:
            with pytest.raises(TimeoutError):
                executor.run(lambda: time.sleep(2.0), 0.1)
        finally:
            executor.shutdown()

    def test_multiple_runs(self):
        """Should handle multiple runs."""
        executor = TimeoutExecutor(max_workers=4)
        try:
            results = []
            for i in range(5):
                result = executor.run(lambda x: x ** 2, 1.0, i)
                results.append(result)
            assert results == [0, 1, 4, 9, 16]
        finally:
            executor.shutdown()

    def test_shutdown_wait(self):
        """Shutdown with wait=True should wait for completion."""
        executor = TimeoutExecutor(max_workers=1)
        start = time.time()
        executor.run(lambda: time.sleep(0.2) or "done", 1.0)
        executor.shutdown(wait=True)
        # Should complete quickly since we already got the result
        assert time.time() - start < 1.0

    def test_run_after_shutdown_raises(self):
        """Running after shutdown should raise RuntimeError."""
        executor = TimeoutExecutor(max_workers=2)
        executor.shutdown()

        with pytest.raises(RuntimeError, match="shut down"):
            executor.run(lambda: None, 1.0)

    def test_context_manager_usage(self):
        """Should work as context manager."""
        with TimeoutExecutor(max_workers=2) as executor:
            result = executor.run(lambda x: x + 1, 1.0, 10)
            assert result == 11
        # After context, should be shut down
        with pytest.raises(RuntimeError):
            executor.run(lambda: None, 1.0)


class TestGlobalExecutor:
    """Tests for global executor functions."""

    def test_get_global_executor(self):
        """Should return a singleton executor."""
        exec1 = get_global_executor()
        exec2 = get_global_executor()
        assert exec1 is exec2

    def test_shutdown_global_executor(self):
        """Should shutdown and clear global executor."""
        _ = get_global_executor()
        shutdown_global_executor()
        # Getting it again should create a new one
        exec_new = get_global_executor()
        assert exec_new is not None
        shutdown_global_executor()  # Clean up


class TestTimeoutErrorAttributes:
    """Tests for TimeoutError exception attributes."""

    def test_timeout_error_message(self):
        """TimeoutError should have informative message."""
        error = TimeoutError("Test timeout", 30.0)
        assert "Test timeout" in str(error)
        assert error.timeout_seconds == 30.0

    def test_timeout_error_from_run_with_timeout(self):
        """TimeoutError from run_with_timeout should have correct attributes."""

        def slow():
            time.sleep(2.0)

        try:
            run_with_timeout(slow, 0.1)
            pytest.fail("Should have raised TimeoutError")
        except TimeoutError as e:
            assert e.timeout_seconds == 0.1
            assert "slow" in str(e)


class TestTimeoutWithDifferentWorkloads:
    """Tests for timeout with various workloads."""

    def test_cpu_bound_work(self):
        """Should timeout on CPU-bound work."""

        def cpu_work():
            result = 0
            for i in range(10**9):  # Long loop
                result += i
            return result

        with pytest.raises(TimeoutError):
            run_with_timeout(cpu_work, 0.1)

    def test_io_simulation(self):
        """Should timeout on simulated I/O."""

        def io_work():
            time.sleep(2.0)  # Simulates I/O wait
            return "done"

        with pytest.raises(TimeoutError):
            run_with_timeout(io_work, 0.1)

    def test_quick_work_succeeds(self):
        """Quick work should complete within timeout."""

        def quick():
            return sum(range(1000))

        result = run_with_timeout(quick, 1.0)
        assert result == 499500


class TestTimeoutThreadSafety:
    """Tests for thread safety of timeout utilities."""

    def test_concurrent_timeouts(self):
        """Multiple concurrent timeouts should work correctly."""
        import concurrent.futures

        def work(n):
            time.sleep(0.1)
            return n * 2

        with TimeoutExecutor(max_workers=4) as executor:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as thread_pool:
                futures = [
                    thread_pool.submit(executor.run, work, 1.0, i)
                    for i in range(10)
                ]
                results = [f.result() for f in futures]

        assert results == [i * 2 for i in range(10)]

    def test_executor_handles_many_requests(self):
        """Executor should handle many sequential requests."""
        with TimeoutExecutor(max_workers=2) as executor:
            results = []
            for i in range(20):
                result = executor.run(lambda x: x * 3, 1.0, i)
                results.append(result)

        assert results == [i * 3 for i in range(20)]
