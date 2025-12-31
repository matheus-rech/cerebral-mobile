"""
UNet Lesion Detection Model Wrapper

Self-contained UNet lesion detection using pretrained model from torch.hub.
"""

import os
import tempfile
from typing import Any, Dict, Optional
from datetime import datetime

import numpy as np
import torch
import nibabel as nib
from PIL import Image
import base64
import io
from scipy import ndimage

from .base import BaseModel


def preprocess_for_unet(image_data):
    """
    Preprocess MRI image for UNet input.
    UNet expects: 256x256 RGB image, normalized to [0, 1]
    """
    # Convert to numpy if needed
    if isinstance(image_data, torch.Tensor):
        image_data = image_data.cpu().numpy()

    # Handle different input shapes
    if len(image_data.shape) == 4:  # (batch, channel, h, w)
        image_data = image_data[0, 0]
    elif len(image_data.shape) == 3:
        if image_data.shape[0] <= 3:  # (channel, h, w)
            image_data = image_data[0]
        else:  # (h, w, channel)
            image_data = image_data[:, :, 0]

    # Normalize to 0-255 range
    image_data = (image_data - image_data.min()) / (image_data.max() - image_data.min() + 1e-8)
    image_data = (image_data * 255).astype(np.uint8)

    # Resize to 256x256
    img = Image.fromarray(image_data)
    img = img.resize((256, 256), Image.BILINEAR)

    # Convert to RGB (3 channels)
    img_rgb = Image.new('RGB', (256, 256))
    img_rgb.paste(img)

    # Convert to numpy array and normalize to [0, 1]
    img_array = np.array(img_rgb).astype(np.float32) / 255.0

    # Transpose to (C, H, W) format
    img_array = np.transpose(img_array, (2, 0, 1))

    return img_array


def analyze_lesions(mask):
    """
    Analyze detected lesions and extract statistics.
    """
    # Threshold mask
    binary_mask = (mask > 0.5).astype(np.uint8)

    # Label connected components
    labeled_mask, num_lesions = ndimage.label(binary_mask)

    lesions = []
    for lesion_id in range(1, num_lesions + 1):
        lesion_mask = (labeled_mask == lesion_id)

        # Calculate properties
        size_pixels = np.sum(lesion_mask)
        size_mm2 = size_pixels * (256 / 256) ** 2  # Approximate

        # Get centroid
        coords = np.argwhere(lesion_mask)
        centroid = coords.mean(axis=0)

        # Calculate intensity
        intensity = mask[lesion_mask].mean()

        # Classify severity
        if size_mm2 < 10:
            size_class = 'small'
        elif size_mm2 < 50:
            size_class = 'medium'
        else:
            size_class = 'large'

        if intensity < 0.6:
            severity = f'{size_class}_mild'
        elif intensity < 0.8:
            severity = f'{size_class}_moderate'
        else:
            severity = f'{size_class}_severe'

        lesions.append({
            'id': int(lesion_id),
            'size_pixels': int(size_pixels),
            'size_mm2': float(size_mm2),
            'centroid': {
                'x': float(centroid[1]),
                'y': float(centroid[0])
            },
            'intensity': float(intensity),
            'severity': severity
        })

    # Sort by size (largest first)
    lesions.sort(key=lambda x: x['size_mm2'], reverse=True)

    return lesions, num_lesions


def generate_impression(num_lesions, total_volume, lesions):
    """Generate clinical impression based on lesion analysis."""
    if num_lesions == 0:
        return "No hyperintense lesions detected. Normal appearance."

    # Count by severity
    severe_count = sum(1 for l in lesions if 'severe' in l['severity'])
    moderate_count = sum(1 for l in lesions if 'moderate' in l['severity'])

    impression = f"Detected {num_lesions} hyperintense lesion(s) with total volume of {total_volume:.1f} mm2. "

    if severe_count > 0:
        impression += f"{severe_count} severe lesion(s) requiring attention. "
    if moderate_count > 0:
        impression += f"{moderate_count} moderate lesion(s). "

    if num_lesions > 10:
        impression += "Multiple scattered lesions suggest possible demyelinating disease. "
    elif num_lesions > 3:
        impression += "Several lesions present. "

    impression += "Recommend clinical correlation and possible follow-up imaging."

    return impression


class UNetModel(BaseModel):
    """
    UNet lesion detection model wrapper.

    Provides automatic detection of hyperintense lesions using pretrained
    UNet from mateuszbuda/brain-segmentation-pytorch.

    Attributes:
        name: "unet"
        timeout_seconds: 30
        is_eager: True (loads at startup)
    """

    def __init__(self):
        super().__init__(
            name="unet",
            timeout_seconds=30,
            is_eager=True,
            parameters_count=7_700_000  # ~7.7M parameters
        )
        self._model = None
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def load(self) -> None:
        """Load pretrained UNet model from torch.hub."""
        if self._is_loaded:
            return

        try:
            print(f"Loading UNet model on {self._device}...")

            # Load pretrained UNet from torch.hub
            self._model = torch.hub.load(
                'mateuszbuda/brain-segmentation-pytorch',
                'unet',
                in_channels=3,
                out_channels=1,
                init_features=32,
                pretrained=True
            )
            self._model.train(False)  # Set to inference mode
            self._model.to(self._device)

            self._is_loaded = True
            self._load_time = datetime.utcnow()

            # Count parameters
            total_params = sum(p.numel() for p in self._model.parameters())
            print(f"UNet loaded successfully. Parameters: {total_params:,}")

        except Exception as e:
            self._is_loaded = False
            raise RuntimeError(f"Failed to load UNet model: {e}") from e

    def unload(self) -> None:
        """Release UNet model from memory."""
        if not self._is_loaded:
            return

        try:
            if self._model is not None:
                del self._model
                self._model = None

            # Clear GPU cache if using CUDA
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            self._is_loaded = False
            print("UNet model unloaded")

        except Exception as e:
            raise RuntimeError(f"Failed to unload UNet model: {e}") from e

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run lesion detection on input image.

        Args:
            input_data: Dictionary with:
                - 'image': Base64 encoded image or numpy array
                - 'slice_data': Optional pre-processed slice data (numpy array)
                - 'file_content': Raw NIfTI file bytes
                - 'file_name': Original filename

        Returns:
            Dictionary with:
                - 'success': True/False
                - 'num_lesions': Number of detected lesions
                - 'total_lesion_volume_mm2': Total lesion area
                - 'lesions': List of lesion details (top 10)
                - 'impression': Clinical impression text
                - 'lesion_overlay': Base64 encoded overlay image
                - 'model': Model identifier
        """
        if not self._is_loaded:
            raise RuntimeError("UNet model is not loaded. Call load() first.")

        try:
            slice_data = None
            tmp_path = None

            # Handle file_content (from gateway multipart upload)
            if 'file_content' in input_data and input_data['file_content']:
                file_content = input_data['file_content']
                file_name = input_data.get('file_name', 'upload.nii.gz')

                # Save to temp file and load with nibabel
                suffix = '.nii.gz' if file_name.endswith('.gz') else '.nii'
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(file_content)
                    tmp_path = tmp.name

                try:
                    nii = nib.load(tmp_path)
                    image_data = nii.get_fdata()

                    # Get middle slice (axial)
                    if len(image_data.shape) == 3:
                        middle_slice = image_data.shape[2] // 2
                        slice_data = image_data[:, :, middle_slice]
                    else:
                        slice_data = image_data
                finally:
                    if tmp_path and os.path.exists(tmp_path):
                        os.unlink(tmp_path)

            # Handle pre-processed slice data
            elif 'slice_data' in input_data:
                slice_data = input_data['slice_data']
                if not isinstance(slice_data, np.ndarray):
                    slice_data = np.array(slice_data)

            # Handle base64 image
            elif 'image' in input_data:
                if isinstance(input_data['image'], str):
                    image_bytes = base64.b64decode(input_data['image'])
                    image = Image.open(io.BytesIO(image_bytes))
                    if image.mode != 'L':
                        image = image.convert('L')
                    slice_data = np.array(image).astype(np.float32)
                elif isinstance(input_data['image'], np.ndarray):
                    slice_data = input_data['image'].astype(np.float32)
                else:
                    raise ValueError("Invalid image format")
            else:
                raise ValueError("No image data provided. Expected 'image', 'slice_data', or 'file_content' key.")

            slice_data = slice_data.astype(np.float32)

            # Preprocess for UNet
            input_tensor = preprocess_for_unet(slice_data)
            input_tensor = torch.from_numpy(input_tensor).unsqueeze(0).to(self._device)

            # Run inference
            with torch.no_grad():
                output = self._model(input_tensor)
                mask = output.cpu().numpy()[0, 0]

            # Analyze lesions
            lesions, num_lesions = analyze_lesions(mask)

            # Calculate total lesion load
            total_lesion_volume = sum(l['size_mm2'] for l in lesions)

            # Generate visualization
            slice_normalized = (slice_data - slice_data.min()) / (slice_data.max() - slice_data.min() + 1e-8)
            slice_uint8 = (slice_normalized * 255).astype(np.uint8)

            # Resize to 256x256
            img_original = Image.fromarray(slice_uint8).resize((256, 256), Image.BILINEAR)
            img_rgb = Image.new('RGB', (256, 256))
            img_rgb.paste(img_original)

            # Create overlay
            img_array = np.array(img_rgb)
            overlay = img_array.copy()

            # Add red overlay for lesions
            lesion_mask = (mask > 0.5)
            overlay[lesion_mask, 0] = np.minimum(overlay[lesion_mask, 0] + 100, 255)

            # Convert to base64
            img_overlay = Image.fromarray(overlay)
            buffer = io.BytesIO()
            img_overlay.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()

            # Generate clinical impression
            impression = generate_impression(num_lesions, total_lesion_volume, lesions)

            # Update usage stats
            self._update_usage_stats()

            return {
                'success': True,
                'num_lesions': num_lesions,
                'total_lesion_volume_mm2': total_lesion_volume,
                'lesions': lesions[:10],  # Top 10 lesions
                'impression': impression,
                'lesion_overlay': f'data:image/png;base64,{img_base64}',
                'model': 'UNet (mateuszbuda/brain-segmentation-pytorch)',
                'pretrained': True
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }

    def get_status(self) -> Dict[str, Any]:
        """Get UNet-specific status information."""
        status = super().get_status()
        status.update({
            "device": str(self._device),
            "cuda_available": torch.cuda.is_available(),
            "architecture": "UNet",
            "source": "mateuszbuda/brain-segmentation-pytorch",
            "parameters": "~7.7M"
        })
        return status
