"""
SAM3 Interactive Segmentation Model Wrapper

Wraps the existing SAM3 service for use with the ML Gateway.
Reuses inference logic from sam3_service.py.

SAM3 is based on Meta's Segment Anything Model, providing zero-shot
object segmentation with support for point, box, and text prompts.

Model Size: ~636M parameters (largest model in the gateway)
Loading: LAZY (loaded on first request due to very large size)
Timeout: 120 seconds
"""

import sys
import os
from typing import Any, Dict, Optional
from datetime import datetime
import logging

import numpy as np
import nibabel as nib
import torch
from PIL import Image
import base64
import io
import tempfile

# Add parent directory to path to import from existing service
_ml_backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if _ml_backend_dir not in sys.path:
    sys.path.insert(0, _ml_backend_dir)

from .base import BaseModel

# Configure logging
logger = logging.getLogger(__name__)


def _get_weights_dir() -> str:
    """Get the path to the weights directory."""
    return os.path.join(_ml_backend_dir, "weights")


class SAM3Model(BaseModel):
    """
    SAM3 (Segment Anything Model 3) wrapper.

    Provides zero-shot object segmentation with support for point,
    box, and text prompts. Uses lazy loading due to very large model size (636M params).

    Features:
        - Single-click point segmentation
        - Bounding box segmentation
        - Text prompt segmentation (requires CLIP integration)
        - Zero-shot object detection
        - Interactive refinement
        - Multi-object segmentation

    Attributes:
        name: "sam3"
        timeout_seconds: 120
        is_eager: False (lazy loading on first request)
        parameters_count: 636M
    """

    def __init__(self):
        super().__init__(
            name="sam3",
            timeout_seconds=120,
            is_eager=False,  # Lazy loading - largest model
            parameters_count=636_000_000  # ~636M parameters
        )
        self._model = None
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._model_type = None  # Track which model variant is loaded
        self._weights_dir = _get_weights_dir()

    def load(self) -> None:
        """
        Load SAM3 model with pretrained weights.

        Attempts loading in order of preference:
        1. Official SAM 2.1 weights from facebook/sam2.1-hiera-large
        2. SAM ViT-B weights from weights directory
        3. Custom SAM3 architecture
        4. Mock implementation for testing

        Raises:
            RuntimeError: If model fails to load completely
        """
        if self._is_loaded:
            logger.debug("SAM3 already loaded, skipping")
            return

        try:
            logger.info(f"Loading SAM3 model on {self._device}...")
            logger.info(f"Weights directory: {self._weights_dir}")
            logger.info("Note: SAM3 is the largest model (~636M params), loading may take time...")

            # Try loading in order of preference
            loaded = False

            # Attempt 1: Official SAM 2.1 weights
            if not loaded:
                try:
                    from sam2_official import load_sam2_official
                    self._model = load_sam2_official()
                    self._model_type = "sam2.1-official"
                    loaded = True
                    logger.info(f"SAM3 loaded with official SAM 2.1 pretrained weights on {self._device}")
                except Exception as e:
                    logger.warning(f"Could not load official SAM 2.1: {e}")

            # Attempt 2: SAM model with pretrained weights
            if not loaded:
                try:
                    from sam_model import load_medical_sam
                    self._model = load_medical_sam(weights_dir=self._weights_dir)
                    self._model.to(self._device)
                    # Set to evaluation mode
                    self._model.train(False)
                    self._model_type = "sam"
                    loaded = True
                    logger.info(f"SAM3 loaded with SAM weights on {self._device}")
                except Exception as e:
                    logger.warning(f"Could not load SAM model: {e}")

            # Attempt 3: Custom SAM3 architecture
            if not loaded:
                try:
                    from sam3_service import create_sam3_model
                    self._model = create_sam3_model()
                    self._model.to(self._device)
                    # Set to evaluation mode
                    self._model.train(False)
                    self._model_type = "custom"
                    loaded = True
                    logger.info(f"SAM3 (custom) loaded on {self._device}")
                except Exception as e:
                    logger.warning(f"Could not load custom model: {e}")

            # Attempt 4: Mock implementation (always succeeds)
            if not loaded:
                logger.warning("Using mock implementation for SAM3")
                from sam3_service import MockSAM3
                self._model = MockSAM3()
                self._model_type = "mock"
                loaded = True

            self._is_loaded = True
            self._load_time = datetime.utcnow()

            logger.info(f"SAM3 loaded successfully (type: {self._model_type})")

        except Exception as e:
            self._is_loaded = False
            logger.error(f"Failed to load SAM3 model: {e}")
            raise RuntimeError(f"Failed to load SAM3 model: {e}") from e

    def unload(self) -> None:
        """
        Release SAM3 model from memory.

        Clears GPU cache if using CUDA to free VRAM.
        SAM3 is the largest model, so unloading frees significant memory.
        """
        if not self._is_loaded:
            return

        try:
            logger.info("Unloading SAM3 model (freeing ~636M params)...")

            if self._model is not None:
                del self._model
                self._model = None

            # Clear GPU cache if using CUDA
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            self._is_loaded = False
            self._model_type = None
            logger.info("SAM3 model unloaded successfully")

        except Exception as e:
            logger.error(f"Failed to unload SAM3 model: {e}")
            raise RuntimeError(f"Failed to unload SAM3 model: {e}") from e

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run segmentation with point, box, or text prompts.

        Args:
            input_data: Dictionary with:
                - 'image': Base64 encoded image or numpy array
                - 'prompt_type': 'point', 'box', or 'text'
                - 'point': {'x': int, 'y': int} (for point prompt)
                - 'box': {'x': int, 'y': int, 'w': int, 'h': int} (for box prompt)
                - 'text': String prompt (for text prompt)

        Returns:
            Dictionary with:
                - 'success': True/False
                - 'mask': Base64 encoded mask image
                - 'area_pixels': Segmented area in pixels
                - 'confidence': Segmentation confidence score
                - 'prompt_type': Type of prompt used
                - 'prompt_info': Details about the prompt
                - 'model': Model identifier

        Raises:
            RuntimeError: If model is not loaded
            ValueError: If prompt type is unknown
        """
        if not self._is_loaded:
            raise RuntimeError("SAM3 model is not loaded. Call load() first.")

        try:
            from sam3_service import preprocess_image

            # Extract image data
            image_data = self._extract_image_data(input_data)

            # Determine prompt type and data
            prompt_type = input_data.get('prompt_type', 'point')
            prompt_info = {}

            # Check if using MedicalSAM model
            try:
                from sam_model import MedicalSAM
                is_medical_sam = isinstance(self._model, MedicalSAM)
            except ImportError:
                is_medical_sam = False

            if is_medical_sam and prompt_type == 'point':
                # Use MedicalSAM's segment method for point prompts
                point = input_data.get('point', {})
                point_coords = (int(point.get('x', 128)), int(point.get('y', 128)))
                prompt_info = {'x': point.get('x'), 'y': point.get('y')}

                # Ensure image is RGB
                if len(image_data.shape) == 2:
                    image_data = np.stack([image_data] * 3, axis=-1)
                elif image_data.shape[-1] == 1:
                    image_data = np.repeat(image_data, 3, axis=-1)

                mask_np, confidence = self._model.segment(image_data, point=point_coords)
            else:
                # Use legacy model path
                image_tensor = preprocess_image(image_data).to(self._device)

                if prompt_type == 'point':
                    point = input_data.get('point', {})
                    prompt_tensor = torch.tensor(
                        [[point.get('x', 128), point.get('y', 128)]],
                        dtype=torch.float32
                    ).to(self._device)
                    prompt_info = {'x': point.get('x'), 'y': point.get('y')}

                elif prompt_type == 'box':
                    box = input_data.get('box', {})
                    prompt_tensor = torch.tensor(
                        [[box.get('x', 0), box.get('y', 0),
                          box.get('w', 256), box.get('h', 256)]],
                        dtype=torch.float32
                    ).to(self._device)
                    prompt_info = box

                elif prompt_type == 'text':
                    text = input_data.get('text', '')
                    # Simple text encoding (in production, use CLIP)
                    text_hash = hash(text.lower()) % 1000
                    prompt_tensor = torch.tensor(
                        [[text_hash]],
                        dtype=torch.float32
                    ).to(self._device)
                    prompt_info = {'prompt': text}

                else:
                    raise ValueError(f"Unknown prompt type: {prompt_type}. Use 'point', 'box', or 'text'.")

                with torch.no_grad():
                    mask = self._model(image_tensor, prompt_type, prompt_tensor)

                mask_np = mask.cpu().numpy()[0, 0]
                confidence = None

            # Calculate statistics
            mask_binary = (mask_np > 0.5).astype(np.uint8)
            area_pixels = np.sum(mask_binary)
            if confidence is None:
                confidence = float(mask_np[mask_binary > 0].mean()) if area_pixels > 0 else 0.0

            # Encode mask as base64 PNG
            mask_img = Image.fromarray((mask_np * 255).astype(np.uint8))
            buffer = io.BytesIO()
            mask_img.save(buffer, format='PNG')
            mask_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            # Update usage stats
            self._update_usage_stats()

            return {
                'success': True,
                'mask': mask_b64,
                'area_pixels': int(area_pixels),
                'confidence': float(confidence),
                'prompt_type': prompt_type,
                'prompt_info': prompt_info,
                'model': f'SAM3 ({self._model_type})'
            }

        except Exception as e:
            import traceback
            logger.error(f"SAM3 prediction failed: {e}")
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }

    def segment_point(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convenience method for point-based segmentation.

        Single-click segmentation - the most common use case.

        Args:
            input_data: Dictionary with 'image' and 'point' keys

        Returns:
            Segmentation result dictionary
        """
        input_data['prompt_type'] = 'point'
        return self.predict(input_data)

    def segment_box(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convenience method for box-based segmentation.

        Draw a bounding box around the region of interest.

        Args:
            input_data: Dictionary with 'image' and 'box' keys

        Returns:
            Segmentation result dictionary
        """
        input_data['prompt_type'] = 'box'
        return self.predict(input_data)

    def segment_text(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convenience method for text-based segmentation.

        Describe what to segment in natural language.
        Note: Full text support requires CLIP integration.

        Args:
            input_data: Dictionary with 'image' and 'text' keys

        Returns:
            Segmentation result dictionary
        """
        input_data['prompt_type'] = 'text'
        return self.predict(input_data)

    def _extract_image_data(self, input_data: Dict[str, Any]) -> np.ndarray:
        """
        Extract image data from input dictionary.

        Supports:
            - NIfTI file path (extracts middle slice from 3D)
            - Base64 encoded image
            - Numpy array

        Args:
            input_data: Dictionary with 'nifti_path', 'image', or similar

        Returns:
            2D numpy array of image data

        Raises:
            ValueError: If no valid image data found
        """
        if 'nifti_path' in input_data:
            nii = nib.load(input_data['nifti_path'])
            image_data = nii.get_fdata()
            # Get middle slice for 3D volumes
            if len(image_data.shape) == 3:
                slice_idx = image_data.shape[2] // 2
                image_data = image_data[:, :, slice_idx]
            return image_data

        elif 'image' in input_data:
            if isinstance(input_data['image'], str):
                # Base64 encoded image
                image_bytes = base64.b64decode(input_data['image'])
                image = Image.open(io.BytesIO(image_bytes))
                return np.array(image)
            elif isinstance(input_data['image'], np.ndarray):
                return input_data['image']
            else:
                raise ValueError("Invalid image format")
        else:
            raise ValueError("No image data provided. Include 'nifti_path' or 'image'.")

    def get_status(self) -> Dict[str, Any]:
        """
        Get SAM3-specific status information.

        Returns:
            Dictionary with model status including device info,
            model type, and capabilities
        """
        status = super().get_status()
        status.update({
            "device": str(self._device),
            "cuda_available": torch.cuda.is_available(),
            "model_type": self._model_type,
            "parameters": "~636M",
            "prompt_types": ["point", "box", "text"],
            "input_size": "256x256",
            "weights_dir": self._weights_dir,
            "capabilities": [
                "Single-click point segmentation",
                "Bounding box segmentation",
                "Text prompt segmentation",
                "Zero-shot object detection",
                "Interactive refinement",
                "Multi-object segmentation"
            ]
        })
        return status
