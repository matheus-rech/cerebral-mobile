"""
ML Gateway Models Package

Exports all model wrappers for use with the unified ML gateway.
Each model implements the BaseModel interface with load(), unload(), and predict() methods.

Models:
    - UNetModel: Lesion detection (7.7M params, eager loading)
    - SynthSegModel: Brain parcellation (18M params, eager loading)
    - MedSAM2Model: Interactive segmentation with prompts (89M params, lazy loading)
    - SAM3Model: Text/point/box segmentation (636M params, lazy loading)

Usage:
    from gateway.models import UNetModel, SynthSegModel, MedSAM2Model, SAM3Model

    # Create model instance
    unet = UNetModel()

    # Load model weights
    unet.load()

    # Run inference
    result = unet.predict({'image': base64_image_data})

    # Check status
    status = unet.get_status()

    # Release memory
    unet.unload()
"""

from .base import BaseModel
from .unet import UNetModel
from .synthseg import SynthSegModel
from .medsam2 import MedSAM2Model
from .sam3 import SAM3Model

# All available model classes
__all__ = [
    "BaseModel",
    "UNetModel",
    "SynthSegModel",
    "MedSAM2Model",
    "SAM3Model",
]

# Model registry for easy lookup by name
MODEL_REGISTRY = {
    "unet": UNetModel,
    "synthseg": SynthSegModel,
    "medsam2": MedSAM2Model,
    "sam3": SAM3Model,
}


def get_model_class(name: str) -> type:
    """
    Get model class by name.

    Args:
        name: Model name (unet, synthseg, medsam2, sam3)

    Returns:
        Model class

    Raises:
        ValueError: If model name is not recognized
    """
    if name not in MODEL_REGISTRY:
        raise ValueError(
            f"Unknown model: {name}. Available models: {list(MODEL_REGISTRY.keys())}"
        )
    return MODEL_REGISTRY[name]


def create_model(name: str) -> BaseModel:
    """
    Create a model instance by name.

    Args:
        name: Model name (unet, synthseg, medsam2, sam3)

    Returns:
        Model instance (not loaded)

    Raises:
        ValueError: If model name is not recognized
    """
    model_class = get_model_class(name)
    return model_class()


def get_eager_models() -> list:
    """
    Get list of models that should be loaded at startup.

    Returns:
        List of model names that have is_eager=True
    """
    eager = []
    for name, model_class in MODEL_REGISTRY.items():
        instance = model_class()
        if instance.is_eager:
            eager.append(name)
    return eager


def get_lazy_models() -> list:
    """
    Get list of models that should be loaded on first request.

    Returns:
        List of model names that have is_eager=False
    """
    lazy = []
    for name, model_class in MODEL_REGISTRY.items():
        instance = model_class()
        if not instance.is_eager:
            lazy.append(name)
    return lazy
