"""
Configuration for the Unified ML Gateway.

Defines model configurations, timeouts, memory thresholds, and retry settings.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional


class LoadingStrategy(Enum):
    """Model loading strategy."""
    EAGER = "eager"  # Load at startup
    LAZY = "lazy"    # Load on first request


@dataclass
class ModelConfig:
    """Configuration for a single ML model."""
    name: str
    timeout_seconds: int
    loading_strategy: LoadingStrategy
    retry_enabled: bool = True
    max_retries: int = 2
    backoff_seconds: float = 1.0
    # Approximate model size in MB (for memory management)
    size_mb: int = 0
    # Human-readable description
    description: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "name": self.name,
            "timeout_seconds": self.timeout_seconds,
            "loading_strategy": self.loading_strategy.value,
            "retry_enabled": self.retry_enabled,
            "max_retries": self.max_retries,
            "backoff_seconds": self.backoff_seconds,
            "size_mb": self.size_mb,
            "description": self.description,
        }


@dataclass
class GatewayConfig:
    """Main gateway configuration."""

    # Server settings
    host: str = "0.0.0.0"
    port: int = 5000
    debug: bool = False

    # Memory management
    memory_warning_threshold_mb: int = 4096  # Warn if available memory below this
    memory_critical_threshold_mb: int = 2048  # Force unload if below this
    auto_unload_minutes: int = 30  # Unload models unused for this duration

    # Global retry settings (can be overridden per model)
    default_max_retries: int = 2
    default_backoff_seconds: float = 1.0

    # Request settings
    max_request_size_mb: int = 100  # Maximum request body size

    # Model configurations
    models: Dict[str, ModelConfig] = field(default_factory=dict)

    def __post_init__(self):
        """Initialize default model configurations."""
        if not self.models:
            self.models = {
                "unet": ModelConfig(
                    name="unet",
                    timeout_seconds=30,
                    loading_strategy=LoadingStrategy.EAGER,
                    size_mb=8,  # ~7.7M parameters
                    description="UNet lesion detection - fast tumor/lesion segmentation",
                ),
                "synthseg": ModelConfig(
                    name="synthseg",
                    timeout_seconds=60,
                    loading_strategy=LoadingStrategy.EAGER,
                    size_mb=18,  # ~18M parameters
                    description="SynthSeg brain parcellation - 32 anatomical structures",
                ),
                "medsam2": ModelConfig(
                    name="medsam2",
                    timeout_seconds=90,
                    loading_strategy=LoadingStrategy.LAZY,
                    size_mb=89,  # ~89M parameters
                    description="MedSAM2 interactive segmentation with prompts",
                ),
                "sam3": ModelConfig(
                    name="sam3",
                    timeout_seconds=120,
                    loading_strategy=LoadingStrategy.LAZY,
                    size_mb=636,  # ~636M parameters
                    description="SAM3 text/point/box segmentation - largest model",
                ),
            }


# Global configuration instance
_config: Optional[GatewayConfig] = None


def get_config() -> GatewayConfig:
    """Get the global gateway configuration."""
    global _config
    if _config is None:
        _config = GatewayConfig()
    return _config


def set_config(config: GatewayConfig) -> None:
    """Set the global gateway configuration."""
    global _config
    _config = config


# Convenience accessors
def get_model_config(model_name: str) -> Optional[ModelConfig]:
    """Get configuration for a specific model."""
    config = get_config()
    return config.models.get(model_name)


def get_available_models() -> list[str]:
    """Get list of available model names."""
    return list(get_config().models.keys())
