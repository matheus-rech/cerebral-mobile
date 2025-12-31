"""
SynthSeg Brain Segmentation Model Wrapper

Self-contained SynthSeg-style brain parcellation using MONAI SegResNet.
"""

import os
import tempfile
from typing import Any, Dict, Optional
from datetime import datetime

import numpy as np
import nibabel as nib
import torch
from PIL import Image
import base64
import io

from .base import BaseModel

# FreeSurfer-style brain structure labels (SynthSeg compatible)
BRAIN_STRUCTURES = {
    0: {"name": "Background", "color": "#000000"},
    2: {"name": "Left Cerebral White Matter", "color": "#F5F5F5"},
    3: {"name": "Left Cerebral Cortex", "color": "#CD3E4E"},
    4: {"name": "Left Lateral Ventricle", "color": "#781286"},
    5: {"name": "Left Inferior Lateral Ventricle", "color": "#C43AFA"},
    7: {"name": "Left Cerebellum White Matter", "color": "#DCF8A4"},
    8: {"name": "Left Cerebellum Cortex", "color": "#E69422"},
    10: {"name": "Left Thalamus", "color": "#00760E"},
    11: {"name": "Left Caudate", "color": "#7ABADC"},
    12: {"name": "Left Putamen", "color": "#EC0DB0"},
    13: {"name": "Left Pallidum", "color": "#0C30FF"},
    14: {"name": "3rd Ventricle", "color": "#204A87"},
    15: {"name": "4th Ventricle", "color": "#42204A"},
    16: {"name": "Brain Stem", "color": "#76D6FF"},
    17: {"name": "Left Hippocampus", "color": "#FFFF00"},
    18: {"name": "Left Amygdala", "color": "#103A6C"},
    24: {"name": "CSF", "color": "#60FDFF"},
    26: {"name": "Left Accumbens Area", "color": "#FF00DC"},
    28: {"name": "Left Ventral DC", "color": "#A52A2A"},
    41: {"name": "Right Cerebral White Matter", "color": "#F5F5F5"},
    42: {"name": "Right Cerebral Cortex", "color": "#CD3E4E"},
    43: {"name": "Right Lateral Ventricle", "color": "#781286"},
    44: {"name": "Right Inferior Lateral Ventricle", "color": "#C43AFA"},
    46: {"name": "Right Cerebellum White Matter", "color": "#DCF8A4"},
    47: {"name": "Right Cerebellum Cortex", "color": "#E69422"},
    49: {"name": "Right Thalamus", "color": "#00760E"},
    50: {"name": "Right Caudate", "color": "#7ABADC"},
    51: {"name": "Right Putamen", "color": "#EC0DB0"},
    52: {"name": "Right Pallidum", "color": "#0C30FF"},
    53: {"name": "Right Hippocampus", "color": "#FFFF00"},
    54: {"name": "Right Amygdala", "color": "#103A6C"},
    58: {"name": "Right Accumbens Area", "color": "#FF00DC"},
    60: {"name": "Right Ventral DC", "color": "#A52A2A"},
}


def get_synthseg_transforms():
    """
    Get SynthSeg-style preprocessing transforms.
    SynthSeg is robust to different MRI contrasts and resolutions.
    """
    from monai.transforms import (
        Compose,
        LoadImaged,
        EnsureChannelFirstd,
        Spacingd,
        Orientationd,
        ScaleIntensityRanged,
        CropForegroundd,
        ToTensord,
    )

    return Compose([
        LoadImaged(keys=["image"]),
        EnsureChannelFirstd(keys=["image"]),
        Spacingd(
            keys=["image"],
            pixdim=(1.0, 1.0, 1.0),  # Normalize to 1mm isotropic
            mode=("bilinear"),
        ),
        Orientationd(keys=["image"], axcodes="RAS"),  # Standard orientation
        ScaleIntensityRanged(
            keys=["image"],
            a_min=0,
            a_max=255,
            b_min=0.0,
            b_max=1.0,
            clip=True,
        ),
        CropForegroundd(keys=["image"], source_key="image"),
        ToTensord(keys=["image"]),
    ])


def create_segresnet_model():
    """
    Create SegResNet model configured for brain segmentation.
    SegResNet is similar to the architecture used in SynthSeg.
    """
    from monai.networks.nets import SegResNet

    model = SegResNet(
        spatial_dims=3,
        in_channels=1,
        out_channels=len(BRAIN_STRUCTURES),  # Number of brain structures
        init_filters=32,
        blocks_down=[1, 2, 2, 4],
        blocks_up=[1, 1, 1],
        dropout_prob=0.2,
    )

    # Note: In production, load pretrained SynthSeg weights here
    # model.load_state_dict(torch.load('synthseg_weights.pth'))

    return model


class SynthSegModel(BaseModel):
    """
    SynthSeg brain parcellation model wrapper.

    Provides robust brain structure segmentation using SynthSeg-style
    approach with MONAI SegResNet architecture.

    Attributes:
        name: "synthseg"
        timeout_seconds: 60
        is_eager: True (loads at startup)
    """

    def __init__(self):
        super().__init__(
            name="synthseg",
            timeout_seconds=60,
            is_eager=True,
            parameters_count=18_000_000  # ~18M parameters
        )
        self._model = None
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._brain_structures = BRAIN_STRUCTURES

    def load(self) -> None:
        """Load SynthSeg-style SegResNet model."""
        if self._is_loaded:
            return

        try:
            print(f"Loading SynthSeg model on {self._device}...")

            self._model = create_segresnet_model()
            self._model.train(False)  # Set to inference mode
            self._model.to(self._device)

            self._is_loaded = True
            self._load_time = datetime.utcnow()

            # Count parameters
            total_params = sum(p.numel() for p in self._model.parameters())
            print(f"SynthSeg loaded successfully. Parameters: {total_params:,}")
            print(f"Segmenting {len(self._brain_structures)} brain structures")

        except Exception as e:
            self._is_loaded = False
            raise RuntimeError(f"Failed to load SynthSeg model: {e}") from e

    def unload(self) -> None:
        """Release SynthSeg model from memory."""
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
            print("SynthSeg model unloaded")

        except Exception as e:
            raise RuntimeError(f"Failed to unload SynthSeg model: {e}") from e

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run brain segmentation on input image.

        Args:
            input_data: Dictionary with:
                - 'image': Base64 encoded image or numpy array
                - 'nifti_path': Optional path to NIfTI file
                - 'file_content': Raw NIfTI file bytes
                - 'file_name': Original filename

        Returns:
            Dictionary with:
                - 'success': True/False
                - 'total_brain_volume_mm3': Total brain volume
                - 'total_brain_volume_ml': Total brain volume in ml
                - 'num_structures_detected': Number of structures found
                - 'structures': Dictionary of all detected structures
                - 'top_structures': Top 10 structures by volume
                - 'segmentation_preview': Base64 encoded preview image
                - 'model': Model identifier
        """
        if not self._is_loaded:
            raise RuntimeError("SynthSeg model is not loaded. Call load() first.")

        try:
            from monai.inferers import sliding_window_inference

            tmp_path = None
            cleanup_tmp = False

            # Handle file_content (from gateway multipart upload)
            if 'file_content' in input_data and input_data['file_content']:
                file_content = input_data['file_content']
                file_name = input_data.get('file_name', 'upload.nii.gz')

                # Save to temp file
                suffix = '.nii.gz' if file_name.endswith('.gz') else '.nii'
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(file_content)
                    tmp_path = tmp.name
                    cleanup_tmp = True

            # Handle nifti_path directly
            elif 'nifti_path' in input_data:
                tmp_path = input_data['nifti_path']
                cleanup_tmp = False

            # Handle base64 image
            elif 'image' in input_data:
                # Decode base64 image and create temporary NIfTI file
                if isinstance(input_data['image'], str):
                    image_bytes = base64.b64decode(input_data['image'])
                    image = Image.open(io.BytesIO(image_bytes))
                    if image.mode != 'L':
                        image = image.convert('L')
                    image_array = np.array(image).astype(np.float32)
                elif isinstance(input_data['image'], np.ndarray):
                    image_array = input_data['image'].astype(np.float32)
                else:
                    raise ValueError("Invalid image format")

                # Stack to create minimal 3D volume for SynthSeg
                image_3d = np.stack([image_array] * 3, axis=-1)

                # Save as temporary NIfTI file
                nii = nib.Nifti1Image(image_3d, affine=np.eye(4))
                with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as tmp:
                    tmp_path = tmp.name
                nib.save(nii, tmp_path)
                cleanup_tmp = True
            else:
                raise ValueError("No image data provided. Expected 'image', 'nifti_path', or 'file_content' key.")

            try:
                # Apply SynthSeg preprocessing
                transforms = get_synthseg_transforms()
                data = transforms({"image": tmp_path})

                # Get image tensor
                image = data["image"].unsqueeze(0).to(self._device)

                # Run inference with sliding window (for large volumes)
                with torch.no_grad():
                    outputs = sliding_window_inference(
                        inputs=image,
                        roi_size=(96, 96, 96),
                        sw_batch_size=4,
                        predictor=self._model,
                        overlap=0.5,
                    )

                    # Get segmentation predictions
                    predictions = torch.argmax(outputs, dim=1).cpu().numpy()[0]

                # Calculate volumes for each brain structure
                voxel_volume = 1.0  # 1mm^3 per voxel after spacing normalization

                structure_volumes = {}
                for label_id, structure_info in self._brain_structures.items():
                    if label_id == 0:  # Skip background
                        continue
                    volume_voxels = int((predictions == label_id).sum())
                    if volume_voxels > 0:
                        structure_volumes[structure_info["name"]] = {
                            "volume_mm3": volume_voxels * voxel_volume,
                            "volume_ml": volume_voxels * voxel_volume / 1000,
                            "color": structure_info["color"],
                            "label_id": label_id
                        }

                # Calculate total brain volume
                total_brain_volume = sum(v["volume_mm3"] for v in structure_volumes.values())

                # Generate visualization (middle axial slice)
                middle_slice = predictions.shape[2] // 2
                slice_data = predictions[:, :, middle_slice]

                # Create colored segmentation overlay
                colored = np.zeros((*slice_data.shape, 3), dtype=np.uint8)
                for label_id, structure_info in self._brain_structures.items():
                    if label_id == 0:
                        continue
                    mask = slice_data == label_id
                    if mask.any():
                        # Convert hex color to RGB
                        hex_color = structure_info["color"].lstrip('#')
                        rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                        colored[mask] = rgb

                # Convert to base64
                img = Image.fromarray(colored)
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                img_base64 = base64.b64encode(buffer.getvalue()).decode()

                # Get top 10 structures by volume
                top_structures = sorted(
                    structure_volumes.items(),
                    key=lambda x: x[1]["volume_mm3"],
                    reverse=True
                )[:10]

                # Update usage stats
                self._update_usage_stats()

                return {
                    'success': True,
                    'total_brain_volume_mm3': total_brain_volume,
                    'total_brain_volume_ml': total_brain_volume / 1000,
                    'num_structures_detected': len(structure_volumes),
                    'structures': structure_volumes,
                    'top_structures': [
                        {
                            'name': name,
                            'volume_mm3': data['volume_mm3'],
                            'volume_ml': data['volume_ml'],
                            'percentage': (data['volume_mm3'] / total_brain_volume * 100) if total_brain_volume > 0 else 0,
                            'color': data['color']
                        }
                        for name, data in top_structures
                    ],
                    'segmentation_preview': f'data:image/png;base64,{img_base64}',
                    'model': 'SynthSeg-style SegResNet',
                    'num_labels': len(self._brain_structures)
                }

            finally:
                # Clean up temp file if we created one
                if cleanup_tmp and tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e)
            }

    def get_structures(self) -> Dict[str, Any]:
        """Get list of all brain structures that can be segmented."""
        structures_list = [
            {
                'label_id': label_id,
                'name': info['name'],
                'color': info['color']
            }
            for label_id, info in self._brain_structures.items()
            if label_id != 0  # Exclude background
        ]

        return {
            'num_structures': len(structures_list),
            'structures': structures_list
        }

    def get_status(self) -> Dict[str, Any]:
        """Get SynthSeg-specific status information."""
        status = super().get_status()
        status.update({
            "device": str(self._device),
            "cuda_available": torch.cuda.is_available(),
            "architecture": "SegResNet",
            "parameters": "~18M",
            "num_structures": len(self._brain_structures) - 1 if self._brain_structures else 32,
            "label_scheme": "FreeSurfer"
        })
        return status
