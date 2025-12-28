"""
MONAI-based Brain Segmentation Service
Provides medical image preprocessing and segmentation using MONAI
"""

import os
import numpy as np
import nibabel as nib
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from monai.transforms import (
    Compose,
    LoadImaged,
    EnsureChannelFirstd,
    Spacingd,
    Orientationd,
    ScaleIntensityRanged,
    CropForegroundd,
    Resized,
    ToTensord,
)
from monai.networks.nets import UNet
from monai.inferers import sliding_window_inference
import tempfile
import base64
from PIL import Image
import io

app = Flask(__name__)
CORS(app)

# MONAI preprocessing pipeline
def get_preprocessing_transforms():
    """
    Get MONAI preprocessing transforms for brain MRI
    """
    return Compose([
        LoadImaged(keys=["image"]),
        EnsureChannelFirstd(keys=["image"]),
        Spacingd(
            keys=["image"],
            pixdim=(1.0, 1.0, 1.0),
            mode=("bilinear"),
        ),
        Orientationd(keys=["image"], axcodes="RAS"),
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

# Initialize MONAI UNet model (for demonstration)
def get_segmentation_model():
    """
    Get MONAI UNet model for brain segmentation
    """
    model = UNet(
        spatial_dims=3,
        in_channels=1,
        out_channels=3,  # Background, Gray Matter, White Matter
        channels=(16, 32, 64, 128, 256),
        strides=(2, 2, 2, 2),
        num_res_units=2,
    )
    
    # In production, load pretrained weights here
    # model.load_state_dict(torch.load('model_weights.pth'))
    
    model.eval()
    return model

# Global model instance
model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def initialize_model():
    """Initialize the segmentation model"""
    global model
    if model is None:
        print("Initializing MONAI segmentation model...")
        model = get_segmentation_model()
        model.to(device)
        print(f"Model initialized on {device}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'MONAI Brain Segmentation',
        'device': str(device),
        'model_loaded': model is not None
    })

@app.route('/preprocess', methods=['POST'])
def preprocess_image():
    """
    Preprocess MRI image using MONAI transforms
    """
    try:
        # Get image data
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        try:
            # Apply MONAI transforms
            transforms = get_preprocessing_transforms()
            data = transforms({"image": tmp_path})
            
            # Get preprocessed image
            preprocessed = data["image"]
            
            # Convert to numpy for analysis
            if isinstance(preprocessed, torch.Tensor):
                preprocessed_np = preprocessed.cpu().numpy()
            else:
                preprocessed_np = preprocessed
            
            # Get statistics
            stats = {
                'shape': list(preprocessed_np.shape),
                'min': float(preprocessed_np.min()),
                'max': float(preprocessed_np.max()),
                'mean': float(preprocessed_np.mean()),
                'std': float(preprocessed_np.std()),
            }
            
            return jsonify({
                'success': True,
                'stats': stats,
                'message': 'Image preprocessed successfully with MONAI'
            })
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/segment', methods=['POST'])
def segment_brain():
    """
    Segment brain MRI using MONAI model
    """
    try:
        initialize_model()
        
        # Get image data
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        try:
            # Apply preprocessing
            transforms = get_preprocessing_transforms()
            data = transforms({"image": tmp_path})
            
            # Get image tensor
            image = data["image"].unsqueeze(0).to(device)
            
            # Run inference
            with torch.no_grad():
                # Use sliding window inference for large volumes
                outputs = sliding_window_inference(
                    inputs=image,
                    roi_size=(96, 96, 96),
                    sw_batch_size=4,
                    predictor=model,
                    overlap=0.5,
                )
                
                # Get segmentation predictions
                predictions = torch.argmax(outputs, dim=1).cpu().numpy()[0]
            
            # Calculate volumes for each region
            voxel_volume = 1.0  # 1mm^3 per voxel after spacing normalization
            
            volumes = {
                'background': int((predictions == 0).sum()),
                'gray_matter': int((predictions == 1).sum()),
                'white_matter': int((predictions == 2).sum()),
            }
            
            # Convert volumes to mm^3
            volumes_mm3 = {k: v * voxel_volume for k, v in volumes.items()}
            
            # Calculate percentages
            total_brain = volumes['gray_matter'] + volumes['white_matter']
            percentages = {
                'gray_matter': (volumes['gray_matter'] / total_brain * 100) if total_brain > 0 else 0,
                'white_matter': (volumes['white_matter'] / total_brain * 100) if total_brain > 0 else 0,
            }
            
            # Generate visualization (middle slice)
            middle_slice = predictions.shape[2] // 2
            slice_data = predictions[:, :, middle_slice]
            
            # Create colored segmentation overlay
            colored = np.zeros((*slice_data.shape, 3), dtype=np.uint8)
            colored[slice_data == 1] = [255, 0, 0]    # Gray matter: red
            colored[slice_data == 2] = [0, 0, 255]    # White matter: blue
            
            # Convert to base64
            img = Image.fromarray(colored)
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return jsonify({
                'success': True,
                'volumes': volumes_mm3,
                'percentages': percentages,
                'total_brain_volume': volumes_mm3['gray_matter'] + volumes_mm3['white_matter'],
                'segmentation_preview': f'data:image/png;base64,{img_base64}',
                'regions': {
                    'gray_matter': {
                        'volume_mm3': volumes_mm3['gray_matter'],
                        'percentage': percentages['gray_matter'],
                        'color': '#FF0000'
                    },
                    'white_matter': {
                        'volume_mm3': volumes_mm3['white_matter'],
                        'percentage': percentages['white_matter'],
                        'color': '#0000FF'
                    }
                }
            })
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/info', methods=['GET'])
def get_info():
    """Get information about the MONAI service"""
    return jsonify({
        'service': 'MONAI Brain Segmentation',
        'version': '1.0.0',
        'capabilities': [
            'Medical image preprocessing',
            'Brain tissue segmentation',
            'Volumetric analysis',
            'DICOM and NIfTI support',
        ],
        'models': {
            'unet': {
                'architecture': '3D UNet',
                'parameters': '~8M',
                'output_classes': 3,
                'classes': ['background', 'gray_matter', 'white_matter']
            }
        },
        'device': str(device),
        'cuda_available': torch.cuda.is_available()
    })

if __name__ == '__main__':
    print("Starting MONAI Brain Segmentation Service...")
    print(f"Device: {device}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    
    # Initialize model on startup
    initialize_model()
    
    # Run server
    port = int(os.environ.get('MONAI_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
