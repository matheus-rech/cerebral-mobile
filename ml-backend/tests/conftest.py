"""
Pytest configuration for ML Gateway tests.

Provides shared fixtures and configuration for all tests.
"""

import sys
import os
import pytest
from pathlib import Path
from unittest.mock import Mock
from datetime import datetime, timezone

# Add the ml-backend directory to the path so we can import gateway modules
ml_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ml_backend_dir not in sys.path:
    sys.path.insert(0, ml_backend_dir)


@pytest.fixture
def fixtures_dir():
    """Return the fixtures directory path."""
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def small_brain_path(fixtures_dir):
    """Return the path to the small test brain NIfTI file."""
    return fixtures_dir / "small_brain.nii.gz"


@pytest.fixture
def gateway_url():
    """Return the default gateway URL."""
    return "http://localhost:5000"


@pytest.fixture
def gateway_endpoints(gateway_url):
    """Return all gateway endpoints."""
    return {
        "health": f"{gateway_url}/health",
        "models": f"{gateway_url}/models",
        "unet_detect": f"{gateway_url}/api/ml/unet/detect",
        "synthseg_segment": f"{gateway_url}/api/ml/synthseg/segment",
        "medsam2_segment": f"{gateway_url}/api/ml/medsam2/segment",
        "sam3_segment": f"{gateway_url}/api/ml/sam3/segment",
        "lesion3d_track": f"{gateway_url}/api/ml/lesion3d/track",
    }


@pytest.fixture
def timeout_configs():
    """Return timeout configurations for each model."""
    return {
        "unet": 30,
        "synthseg": 60,
        "medsam2": 90,
        "sam3": 120,
    }


@pytest.fixture
def model_configs():
    """Return model configurations."""
    return {
        "unet": {
            "name": "UNet",
            "parameters": 7_700_000,
            "loading_strategy": "eager",
        },
        "synthseg": {
            "name": "SynthSeg",
            "parameters": 18_000_000,
            "loading_strategy": "eager",
        },
        "medsam2": {
            "name": "MedSAM2",
            "parameters": 89_000_000,
            "loading_strategy": "lazy",
        },
        "sam3": {
            "name": "SAM3",
            "parameters": 636_000_000,
            "loading_strategy": "lazy",
        },
    }


@pytest.fixture
def sample_error_response():
    """Return a sample gateway error response."""
    return {
        "success": False,
        "error": {
            "code": "TIMEOUT",
            "message": "SAM3 inference exceeded 120s timeout",
            "model": "sam3",
            "retriable": True,
            "suggestion": "Try a smaller image or use UNet for faster results",
        },
    }


@pytest.fixture
def sample_health_response():
    """Return a sample health check response."""
    return {
        "status": "healthy",
        "uptime_seconds": 3600,
        "models": {
            "unet": {"loaded": True, "last_used": "2025-12-31T01:30:00Z", "requests": 42},
            "synthseg": {"loaded": True, "last_used": "2025-12-31T01:28:00Z", "requests": 15},
            "medsam2": {"loaded": False},
            "sam3": {"loaded": False},
        },
    }


@pytest.fixture(autouse=True)
def reset_start_time():
    """Reset the start time before each test."""
    try:
        from gateway.utils.health import init_start_time
        init_start_time()
    except ImportError:
        pass  # Skip if gateway not fully set up yet
    yield


@pytest.fixture
def mock_model():
    """Create a mock model for testing."""
    model = Mock()
    model.is_loaded.return_value = False
    model.get_name.return_value = "test_model"
    return model


@pytest.fixture
def loaded_model():
    """Create a mock loaded model for testing."""
    model = Mock()
    model.is_loaded.return_value = True
    model.get_name.return_value = "loaded_model"
    model.last_used = datetime.now(timezone.utc)
    model.request_count = 10
    return model


@pytest.fixture
def sample_models(mock_model, loaded_model):
    """Create a dictionary of sample models."""
    return {
        "unet": loaded_model,
        "synthseg": mock_model,
    }
