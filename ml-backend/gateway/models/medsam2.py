"""
MedSAM2 Interactive Segmentation Model Wrapper

Wraps the existing MedSAM2 service for use with the ML Gateway.
Reuses inference logic from medsam2_service.py.

MedSAM2 is a medical-specific variant of SAM optimized for medical imaging,
particularly brain MRI segmentation with interactive point/box prompts.

Model Size: ~89M parameters
Loading: LAZY (loaded on first request due to large size)
Timeout: 90 seconds
"""

import sys
import os
from typing import Any, Dict, List, Optional, Tuple
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


class MedSAM2Model(BaseModel):
    """
    MedSAM2 interactive segmentation model wrapper.

    Provides medical-specific SAM for brain MRI segmentation with
    point/box prompts. Uses lazy loading due to larger model size.

    Features:
        - Point-based segmentation (click to segment)
        - Bounding box segmentation
        - Text prompt segmentation
        - Multi-prompt refinement
        - 2D slice and 3D volume segmentation

    Attributes:
        name: "medsam2"
        timeout_seconds: 90
        is_eager: False (lazy loading on first request)
        parameters_count: 89M
    """

    def __init__(self):
        super().__init__(
            name="medsam2",
            timeout_seconds=90,
            is_eager=False,  # Lazy loading - large model
            parameters_count=89_000_000  # ~89M parameters
        )
        self._model = None
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._model_type = None  # Track which model variant is loaded
        self._weights_dir = _get_weights_dir()

    def load(self) -> None:
        """
        Load MedSAM2 model with pretrained weights.

        Attempts loading in order of preference:
        1. Official MedSAM2 weights from wanglab/MedSAM2
        2. SAM ViT-B weights from weights directory
        3. Custom MedSAM2 architecture
        4. Mock implementation for testing

        Raises:
            RuntimeError: If model fails to load completely
        """
        if self._is_loaded:
            logger.debug("MedSAM2 already loaded, skipping")
            return

        try:
            logger.info(f"Loading MedSAM2 model on {self._device}...")
            logger.info(f"Weights directory: {self._weights_dir}")

            # Try loading in order of preference
            loaded = False

            # Attempt 1: Official MedSAM2 weights
            if not loaded:
                try:
                    from medsam2_official import load_medsam2_official
                    self._model = load_medsam2_official()
                    self._model_type = "official"
                    loaded = True
                    logger.info(f"MedSAM2 loaded with official pretrained weights on {self._device}")
                except Exception as e:
                    logger.warning(f"Could not load official MedSAM2: {e}")

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
                    logger.info(f"MedSAM2 loaded with SAM weights on {self._device}")
                except Exception as e:
                    logger.warning(f"Could not load SAM model: {e}")

            # Attempt 3: Custom MedSAM2 architecture
            if not loaded:
                try:
                    from medsam2_service import create_medsam2_model
                    self._model = create_medsam2_model()
                    self._model.to(self._device)
                    # Set to evaluation mode
                    self._model.train(False)
                    self._model_type = "custom"
                    loaded = True
                    logger.info(f"MedSAM2 (custom) loaded on {self._device}")
                except Exception as e:
                    logger.warning(f"Could not load custom model: {e}")

            # Attempt 4: Mock implementation (always succeeds)
            if not loaded:
                logger.warning("Using mock implementation for MedSAM2")
                from medsam2_service import MockMedSAM2
                self._model = MockMedSAM2()
                self._model_type = "mock"
                loaded = True

            self._is_loaded = True
            self._load_time = datetime.utcnow()

            logger.info(f"MedSAM2 loaded successfully (type: {self._model_type})")

        except Exception as e:
            self._is_loaded = False
            logger.error(f"Failed to load MedSAM2 model: {e}")
            raise RuntimeError(f"Failed to load MedSAM2 model: {e}") from e

    def unload(self) -> None:
        """
        Release MedSAM2 model from memory.

        Clears GPU cache if using CUDA to free VRAM.
        """
        if not self._is_loaded:
            return

        try:
            logger.info("Unloading MedSAM2 model...")

            if self._model is not None:
                del self._model
                self._model = None

            # Clear GPU cache if using CUDA
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            self._is_loaded = False
            self._model_type = None
            logger.info("MedSAM2 model unloaded successfully")

        except Exception as e:
            logger.error(f"Failed to unload MedSAM2 model: {e}")
            raise RuntimeError(f"Failed to unload MedSAM2 model: {e}") from e

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run interactive segmentation with point/box prompts.

        Args:
            input_data: Dictionary with:
                - 'image': Base64 encoded image or numpy array
                - 'prompts': Dictionary with 'points', 'boxes', and/or 'text'
                    - 'points': List of {'x': int, 'y': int}
                    - 'boxes': List of {'x': int, 'y': int, 'w': int, 'h': int}
                      or {'x1': int, 'y1': int, 'x2': int, 'y2': int}
                    - 'text': String prompt (converted to region)

        Returns:
            Dictionary with:
                - 'success': True/False
                - 'mask': Base64 encoded mask image
                - 'area_pixels': Segmented area in pixels
                - 'confidence': Segmentation confidence score
                - 'prompts_used': Number of prompts used
                - 'model': Model identifier

        Raises:
            RuntimeError: If model is not loaded
            ValueError: If no prompts are provided
        """
        if not self._is_loaded:
            raise RuntimeError("MedSAM2 model is not loaded. Call load() first.")

        try:
            from medsam2_service import preprocess_image, parse_prompts

            # Extract image data
            image_data = self._extract_image_data(input_data)

            # Get prompts
            prompts = input_data.get('prompts', {})
            if not prompts:
                raise ValueError("No prompts provided. Include 'points', 'boxes', or 'text'.")

            # Check if using MedicalSAM model
            try:
                from sam_model import MedicalSAM
                is_medical_sam = isinstance(self._model, MedicalSAM)
            except ImportError:
                is_medical_sam = False

            if is_medical_sam:
                # Use MedicalSAM's segment method
                point = None
                box = None

                if 'points' in prompts and prompts['points']:
                    p = prompts['points'][0]
                    point = (int(p.get('x', 128)), int(p.get('y', 128)))
                elif 'boxes' in prompts and prompts['boxes']:
                    b = prompts['boxes'][0]
                    if 'x1' in b:
                        box = (int(b.get('x1', 0)), int(b.get('y1', 0)),
                               int(b.get('x2', 256)), int(b.get('y2', 256)))
                    else:
                        box = (int(b.get('x', 0)), int(b.get('y', 0)),
                               int(b.get('x', 0)) + int(b.get('w', 256)),
                               int(b.get('y', 0)) + int(b.get('h', 256)))

                # Ensure image is RGB
                if len(image_data.shape) == 2:
                    image_data = np.stack([image_data] * 3, axis=-1)
                elif image_data.shape[-1] == 1:
                    image_data = np.repeat(image_data, 3, axis=-1)

                mask_np, confidence = self._model.segment(image_data, point=point, box=box)
            else:
                # Legacy model path
                image_tensor = preprocess_image(image_data).to(self._device)
                prompts_tensor = parse_prompts(prompts).to(self._device)

                with torch.no_grad():
                    mask = self._model(image_tensor, prompts_tensor)

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

            # Count prompts used
            prompts_count = 0
            if 'points' in prompts:
                prompts_count += len(prompts.get('points', []))
            if 'boxes' in prompts:
                prompts_count += len(prompts.get('boxes', []))

            # Update usage stats
            self._update_usage_stats()

            return {
                'success': True,
                'mask': mask_b64,
                'area_pixels': int(area_pixels),
                'confidence': float(confidence),
                'prompts_used': prompts_count,
                'model': f'MedSAM2 ({self._model_type})'
            }

        except Exception as e:
            import traceback
            logger.error(f"MedSAM2 prediction failed: {e}")
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }

    def predict_3d(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run 3D volume segmentation with prompts.

        Processes each slice of a 3D volume with the same prompts,
        creating a complete 3D segmentation mask.

        Args:
            input_data: Dictionary with:
                - 'nifti_path': Path to NIfTI file
                - 'prompts': Dictionary with 'points', 'boxes', and/or 'text'

        Returns:
            Dictionary with:
                - 'success': True/False
                - 'mask_nifti': Base64 encoded NIfTI mask
                - 'volume_voxels': Volume in voxels
                - 'volume_mm3': Volume in cubic millimeters
                - 'volume_ml': Volume in milliliters
                - 'num_slices': Number of slices processed
                - 'voxel_spacing': Voxel dimensions
                - 'model': Model identifier

        Raises:
            RuntimeError: If model is not loaded
            ValueError: If input is not a 3D volume
        """
        if not self._is_loaded:
            raise RuntimeError("MedSAM2 model is not loaded. Call load() first.")

        try:
            from medsam2_service import preprocess_image, parse_prompts

            if 'nifti_path' not in input_data:
                raise ValueError("No NIfTI file path provided")

            tmp_path = input_data['nifti_path']
            prompts = input_data.get('prompts', {})
            prompts_tensor = parse_prompts(prompts).to(self._device)

            # Load NIfTI file
            nii = nib.load(tmp_path)
            image_data = nii.get_fdata()

            if len(image_data.shape) != 3:
                raise ValueError("Expected 3D volume")

            # Segment all slices
            num_slices = image_data.shape[2]
            masks_3d = np.zeros(image_data.shape, dtype=np.float32)

            logger.info(f"Processing {num_slices} slices...")

            for slice_idx in range(num_slices):
                slice_data = image_data[:, :, slice_idx]

                # Preprocess
                image_tensor = preprocess_image(slice_data).to(self._device)

                # Segment
                with torch.no_grad():
                    mask = self._model(image_tensor, prompts_tensor)

                # Store
                masks_3d[:, :, slice_idx] = mask.cpu().numpy()[0, 0]

            # Calculate 3D statistics
            mask_binary = (masks_3d > 0.5).astype(np.uint8)
            volume_voxels = np.sum(mask_binary)
            voxel_spacing = nii.header.get_zooms()
            volume_mm3 = volume_voxels * np.prod(voxel_spacing)
            volume_ml = volume_mm3 / 1000.0

            # Save mask as NIfTI
            mask_nii = nib.Nifti1Image(masks_3d, nii.affine, nii.header)
            mask_path = tempfile.mktemp(suffix='_mask.nii.gz')
            nib.save(mask_nii, mask_path)

            # Encode as base64
            with open(mask_path, 'rb') as f:
                mask_b64 = base64.b64encode(f.read()).decode('utf-8')

            # Clean up temp file
            if os.path.exists(mask_path):
                os.unlink(mask_path)

            # Update usage stats
            self._update_usage_stats()

            return {
                'success': True,
                'mask_nifti': mask_b64,
                'volume_voxels': int(volume_voxels),
                'volume_mm3': float(volume_mm3),
                'volume_ml': float(volume_ml),
                'num_slices': num_slices,
                'voxel_spacing': list(voxel_spacing),
                'model': f'MedSAM2 3D ({self._model_type})'
            }

        except Exception as e:
            import traceback
            logger.error(f"MedSAM2 3D prediction failed: {e}")
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }

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
        Get MedSAM2-specific status information.

        Returns:
            Dictionary with model status including device info,
            model type, and capabilities
        """
        status = super().get_status()
        status.update({
            "device": str(self._device),
            "cuda_available": torch.cuda.is_available(),
            "model_type": self._model_type,
            "parameters": "~89M",
            "prompt_types": ["points", "boxes", "text"],
            "input_size": "256x256",
            "weights_dir": self._weights_dir,
            "capabilities": [
                "Point-based segmentation",
                "Bounding box segmentation",
                "Text prompt segmentation",
                "Multi-prompt refinement",
                "2D slice segmentation",
                "3D volume segmentation",
                "Interactive mask generation"
            ]
        })
        return status
