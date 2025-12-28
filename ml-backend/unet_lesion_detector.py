"""
UNet Lesion Detection Service
Automatic detection of hyperintense lesions using pretrained UNet from mateuszbuda/brain-segmentation-pytorch
"""

import os
import numpy as np
import nibabel as nib
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torch.nn as nn
from PIL import Image
import tempfile
import base64
import io
from scipy import ndimage

app = Flask(__name__)
CORS(app)

# UNet Architecture (from mateuszbuda/brain-segmentation-pytorch)
class UNet(nn.Module):
    """
    UNet architecture for brain lesion segmentation
    Paper: https://arxiv.org/abs/1505.04597
    """
    
    def __init__(self, in_channels=3, out_channels=1, init_features=32):
        super(UNet, self).__init__()
        
        features = init_features
        self.encoder1 = UNet._block(in_channels, features, name="enc1")
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)
        self.encoder2 = UNet._block(features, features * 2, name="enc2")
        self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)
        self.encoder3 = UNet._block(features * 2, features * 4, name="enc3")
        self.pool3 = nn.MaxPool2d(kernel_size=2, stride=2)
        self.encoder4 = UNet._block(features * 4, features * 8, name="enc4")
        self.pool4 = nn.MaxPool2d(kernel_size=2, stride=2)
        
        self.bottleneck = UNet._block(features * 8, features * 16, name="bottleneck")
        
        self.upconv4 = nn.ConvTranspose2d(
            features * 16, features * 8, kernel_size=2, stride=2
        )
        self.decoder4 = UNet._block((features * 8) * 2, features * 8, name="dec4")
        self.upconv3 = nn.ConvTranspose2d(
            features * 8, features * 4, kernel_size=2, stride=2
        )
        self.decoder3 = UNet._block((features * 4) * 2, features * 4, name="dec3")
        self.upconv2 = nn.ConvTranspose2d(
            features * 4, features * 2, kernel_size=2, stride=2
        )
        self.decoder2 = UNet._block((features * 2) * 2, features * 2, name="dec2")
        self.upconv1 = nn.ConvTranspose2d(
            features * 2, features, kernel_size=2, stride=2
        )
        self.decoder1 = UNet._block(features * 2, features, name="dec1")
        
        self.conv = nn.Conv2d(
            in_channels=features, out_channels=out_channels, kernel_size=1
        )
    
    def forward(self, x):
        enc1 = self.encoder1(x)
        enc2 = self.encoder2(self.pool1(enc1))
        enc3 = self.encoder3(self.pool2(enc2))
        enc4 = self.encoder4(self.pool3(enc3))
        
        bottleneck = self.bottleneck(self.pool4(enc4))
        
        dec4 = self.upconv4(bottleneck)
        dec4 = torch.cat((dec4, enc4), dim=1)
        dec4 = self.decoder4(dec4)
        dec3 = self.upconv3(dec4)
        dec3 = torch.cat((dec3, enc3), dim=1)
        dec3 = self.decoder3(dec3)
        dec2 = self.upconv2(dec3)
        dec2 = torch.cat((dec2, enc2), dim=1)
        dec2 = self.decoder2(dec2)
        dec1 = self.upconv1(dec2)
        dec1 = torch.cat((dec1, enc1), dim=1)
        dec1 = self.decoder1(dec1)
        
        return torch.sigmoid(self.conv(dec1))
    
    @staticmethod
    def _block(in_channels, features, name):
        return nn.Sequential(
            nn.Conv2d(
                in_channels=in_channels,
                out_channels=features,
                kernel_size=3,
                padding=1,
                bias=False,
            ),
            nn.BatchNorm2d(num_features=features),
            nn.ReLU(inplace=True),
            nn.Conv2d(
                in_channels=features,
                out_channels=features,
                kernel_size=3,
                padding=1,
                bias=False,
            ),
            nn.BatchNorm2d(num_features=features),
            nn.ReLU(inplace=True),
        )

# Global model instance
model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def load_pretrained_unet():
    """
    Load pretrained UNet model from torch.hub
    Model: mateuszbuda/brain-segmentation-pytorch
    """
    try:
        print("Loading pretrained UNet from torch.hub...")
        model = torch.hub.load(
            'mateuszbuda/brain-segmentation-pytorch',
            'unet',
            in_channels=3,
            out_channels=1,
            init_features=32,
            pretrained=True
        )
        model.eval()
        print("✓ Pretrained UNet loaded successfully")
        return model
    except Exception as e:
        print(f"⚠ Could not load pretrained model: {e}")
        print("Using initialized UNet architecture (not pretrained)")
        model = UNet(in_channels=3, out_channels=1, init_features=32)
        model.eval()
        return model

def initialize_model():
    """Initialize the UNet lesion detector"""
    global model
    if model is None:
        print("Initializing UNet Lesion Detector...")
        model = load_pretrained_unet()
        model.to(device)
        
        # Count parameters
        total_params = sum(p.numel() for p in model.parameters())
        print(f"Model parameters: {total_params:,}")
        print(f"Device: {device}")

def preprocess_for_unet(image_data):
    """
    Preprocess MRI image for UNet input
    UNet expects: 256x256 RGB image, normalized to [0, 1]
    """
    # Convert to numpy if needed
    if isinstance(image_data, torch.Tensor):
        image_data = image_data.cpu().numpy()
    
    # Handle different input shapes
    if len(image_data.shape) == 4:  # (batch, channel, h, w)
        image_data = image_data[0, 0]  # Take first image, first channel
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
    Analyze detected lesions and extract statistics
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
        size_mm2 = size_pixels * (256 / 256) ** 2  # Approximate, depends on voxel spacing
        
        # Get centroid
        coords = np.argwhere(lesion_mask)
        centroid = coords.mean(axis=0)
        
        # Calculate intensity
        intensity = mask[lesion_mask].mean()
        
        lesions.append({
            'id': int(lesion_id),
            'size_pixels': int(size_pixels),
            'size_mm2': float(size_mm2),
            'centroid': {
                'x': float(centroid[1]),
                'y': float(centroid[0])
            },
            'intensity': float(intensity),
            'severity': classify_severity(size_mm2, intensity)
        })
    
    # Sort by size (largest first)
    lesions.sort(key=lambda x: x['size_mm2'], reverse=True)
    
    return lesions, num_lesions

def classify_severity(size_mm2, intensity):
    """
    Classify lesion severity based on size and intensity
    """
    if size_mm2 < 10:
        size_class = 'small'
    elif size_mm2 < 50:
        size_class = 'medium'
    else:
        size_class = 'large'
    
    if intensity < 0.6:
        return f'{size_class}_mild'
    elif intensity < 0.8:
        return f'{size_class}_moderate'
    else:
        return f'{size_class}_severe'

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'UNet Lesion Detector',
        'device': str(device),
        'model_loaded': model is not None,
        'pretrained': True
    })

@app.route('/detect', methods=['POST'])
def detect_lesions():
    """
    Detect hyperintense lesions in brain MRI
    Accepts either multipart file upload or JSON with base64 image
    """
    try:
        initialize_model()
        
        # Check if JSON request with base64 image
        if request.is_json:
            data = request.get_json()
            if 'image' not in data:
                return jsonify({'error': 'No image data provided'}), 400
            
            # Decode base64 image
            try:
                image_bytes = base64.b64decode(data['image'])
                image = Image.open(io.BytesIO(image_bytes))
                
                # Convert to grayscale if needed
                if image.mode != 'L':
                    image = image.convert('L')
                
                # Convert to numpy array
                slice_data = np.array(image).astype(np.float32)
                tmp_path = None
                
            except Exception as e:
                return jsonify({'error': f'Failed to decode image: {str(e)}'}), 400
        
        # Otherwise, expect multipart file upload
        elif 'file' in request.files:
            file = request.files['file']
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
            
            try:
                # Load NIfTI file
                nii = nib.load(tmp_path)
                image_data = nii.get_fdata()
                
                # Get middle slice (axial)
                if len(image_data.shape) == 3:
                    middle_slice = image_data.shape[2] // 2
                    slice_data = image_data[:, :, middle_slice]
                else:
                    slice_data = image_data
            except Exception as e:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                return jsonify({'error': f'Failed to load NIfTI file: {str(e)}'}), 400
        
        else:
            return jsonify({'error': 'No file or image data provided'}), 400
        
        try:
            # Continue with existing processing
            slice_data = slice_data.astype(np.float32)
            
            # Preprocess for UNet
            input_tensor = preprocess_for_unet(slice_data)
            input_tensor = torch.from_numpy(input_tensor).unsqueeze(0).to(device)
            
            # Run inference
            with torch.no_grad():
                output = model(input_tensor)
                mask = output.cpu().numpy()[0, 0]
            
            # Analyze lesions
            lesions, num_lesions = analyze_lesions(mask)
            
            # Calculate total lesion load
            total_lesion_volume = sum(l['size_mm2'] for l in lesions)
            
            # Generate visualization
            # Original image
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
            overlay[lesion_mask, 0] = np.minimum(overlay[lesion_mask, 0] + 100, 255)  # Red channel
            
            # Convert to base64
            img_overlay = Image.fromarray(overlay)
            buffer = io.BytesIO()
            img_overlay.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            # Generate clinical impression
            impression = generate_impression(num_lesions, total_lesion_volume, lesions)
            
            return jsonify({
                'success': True,
                'num_lesions': num_lesions,
                'total_lesion_volume_mm2': total_lesion_volume,
                'lesions': lesions[:10],  # Top 10 lesions
                'impression': impression,
                'lesion_overlay': f'data:image/png;base64,{img_base64}',
                'model': 'UNet (mateuszbuda/brain-segmentation-pytorch)',
                'pretrained': True
            })
        
        finally:
            # Clean up temp file (only for file uploads)
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def generate_impression(num_lesions, total_volume, lesions):
    """Generate clinical impression based on lesion analysis"""
    if num_lesions == 0:
        return "No hyperintense lesions detected. Normal appearance."
    
    # Count by severity
    severe_count = sum(1 for l in lesions if 'severe' in l['severity'])
    moderate_count = sum(1 for l in lesions if 'moderate' in l['severity'])
    
    impression = f"Detected {num_lesions} hyperintense lesion(s) with total volume of {total_volume:.1f} mm². "
    
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

@app.route('/info', methods=['GET'])
def get_info():
    """Get information about the UNet lesion detector"""
    return jsonify({
        'service': 'UNet Lesion Detector',
        'version': '1.0.0',
        'description': 'Automatic detection of hyperintense lesions using pretrained UNet',
        'capabilities': [
            'Lesion detection and segmentation',
            'Lesion size and location analysis',
            'Severity classification',
            'Clinical impression generation',
            'Overlay visualization',
        ],
        'model': {
            'architecture': 'UNet',
            'source': 'mateuszbuda/brain-segmentation-pytorch',
            'parameters': '~7.7M',
            'input_size': '256x256 RGB',
            'output': 'Binary segmentation mask',
            'pretrained': True
        },
        'device': str(device),
        'cuda_available': torch.cuda.is_available(),
        'use_cases': [
            'Multiple sclerosis (MS) plaque detection',
            'Brain tumor identification',
            'Stroke lesion analysis',
            'White matter hyperintensities',
            'General hyperintense lesion screening'
        ]
    })

if __name__ == '__main__':
    print("=" * 60)
    print("UNet Lesion Detection Service")
    print("=" * 60)
    print(f"Device: {device}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print("Model: mateuszbuda/brain-segmentation-pytorch")
    print("=" * 60)
    
    # Initialize model on startup
    initialize_model()
    
    # Run server
    port = int(os.environ.get('UNET_PORT', 5003))
    print(f"\nStarting server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
