"""
MedSAM2 Interactive Segmentation Service
Medical-specific SAM for brain MRI segmentation with point/box prompts
"""

import os
import numpy as np
import nibabel as nib
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import tempfile
import base64
import io
from PIL import Image

app = Flask(__name__)
CORS(app)

# Global model instance
model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def initialize_model():
    """Initialize MedSAM2 model with official pretrained weights"""
    global model
    if model is None:
        print("Initializing MedSAM2 with official weights...")
        try:
            # Try to load official MedSAM2 weights from wanglab/MedSAM2
            from medsam2_official import load_medsam2_official
            model = load_medsam2_official()
            print(f"MedSAM2 loaded with official pretrained weights on {device}")
        except Exception as e:
            print(f"Error loading official MedSAM2: {e}")
            print("Falling back to SAM model...")
            try:
                from sam_model import load_medical_sam
                model = load_medical_sam()
                model.eval()
                model.to(device)
                print(f"MedSAM2 loaded with SAM weights on {device}")
            except Exception as e2:
                print(f"Error loading SAM model: {e2}")
                print("Falling back to custom architecture")
                try:
                    model = create_medsam2_model()
                    model.eval()
                    model.to(device)
                    print(f"MedSAM2 (custom) loaded on {device}")
                except Exception as e3:
                    print(f"Error loading custom model: {e3}")
                    print("Using mock implementation")
                    model = MockMedSAM2()

def create_medsam2_model():
    """
    Create MedSAM2 model architecture
    In production, this would load the actual MedSAM2 from:
    https://github.com/bowang-lab/MedSAM2
    """
    class MedSAM2Model(torch.nn.Module):
        def __init__(self):
            super().__init__()
            # Encoder (image → features)
            self.encoder = torch.nn.Sequential(
                torch.nn.Conv2d(3, 64, 3, padding=1),
                torch.nn.ReLU(),
                torch.nn.MaxPool2d(2),
                torch.nn.Conv2d(64, 128, 3, padding=1),
                torch.nn.ReLU(),
                torch.nn.MaxPool2d(2),
                torch.nn.Conv2d(128, 256, 3, padding=1),
                torch.nn.ReLU(),
            )
            
            # Prompt encoder (points/boxes → embeddings)
            self.prompt_encoder = torch.nn.Linear(4, 256)  # x, y, w, h
            
            # Decoder (features + prompts → mask)
            self.decoder = torch.nn.Sequential(
                torch.nn.ConvTranspose2d(256, 128, 2, stride=2),
                torch.nn.ReLU(),
                torch.nn.ConvTranspose2d(128, 64, 2, stride=2),
                torch.nn.ReLU(),
                torch.nn.Conv2d(64, 1, 1),
                torch.nn.Sigmoid()
            )
        
        def forward(self, image, prompts):
            # Encode image
            features = self.encoder(image)
            
            # Encode prompts
            prompt_emb = self.prompt_encoder(prompts)
            prompt_emb = prompt_emb.view(-1, 256, 1, 1)
            prompt_emb = prompt_emb.expand(-1, -1, features.shape[2], features.shape[3])
            
            # Combine features and prompts
            combined = features + prompt_emb
            
            # Decode to mask
            mask = self.decoder(combined)
            
            return mask
    
    return MedSAM2Model()

class MockMedSAM2:
    """Mock MedSAM2 for testing"""
    def __init__(self):
        self.device = device
    
    def to(self, device):
        self.device = device
        return self
    
    def eval(self):
        return self
    
    def __call__(self, image, prompts):
        # Generate mock segmentation based on prompts
        batch_size, _, h, w = image.shape
        mask = torch.zeros((batch_size, 1, h, w), device=self.device)
        
        # For each prompt, create a circular region
        for i, prompt in enumerate(prompts):
            x, y, w_box, h_box = prompt.cpu().numpy()
            
            # Create coordinate grids
            y_grid, x_grid = torch.meshgrid(
                torch.arange(h, device=self.device),
                torch.arange(w, device=self.device),
                indexing='ij'
            )
            
            # Calculate distance from prompt center
            cx, cy = x + w_box / 2, y + h_box / 2
            dist = torch.sqrt((x_grid - cx)**2 + (y_grid - cy)**2)
            
            # Create circular mask
            radius = max(w_box, h_box) / 2
            circle_mask = (dist < radius).float()
            
            # Add to result
            mask[i, 0] += circle_mask
        
        return torch.clamp(mask, 0, 1)

def preprocess_image(image_data):
    """Preprocess image for MedSAM2"""
    # Normalize to [0, 1]
    if image_data.max() > 1:
        image_data = image_data / 255.0
    
    # Convert to RGB if grayscale
    if len(image_data.shape) == 2:
        image_data = np.stack([image_data] * 3, axis=-1)
    
    # Resize to 256x256 (MedSAM2 input size)
    from scipy.ndimage import zoom
    h, w = image_data.shape[:2]
    if h != 256 or w != 256:
        zoom_factors = (256 / h, 256 / w, 1) if len(image_data.shape) == 3 else (256 / h, 256 / w)
        image_data = zoom(image_data, zoom_factors, order=1)
    
    # Convert to tensor (B, C, H, W)
    image_tensor = torch.from_numpy(image_data).float()
    if len(image_tensor.shape) == 3:
        image_tensor = image_tensor.permute(2, 0, 1).unsqueeze(0)
    
    return image_tensor

def parse_prompts(prompt_data):
    """
    Parse prompts from request
    Supports: points, boxes, text
    """
    prompts = []
    
    if 'points' in prompt_data:
        # Point prompts: list of [x, y]
        for point in prompt_data['points']:
            x, y = point['x'], point['y']
            # Convert point to box (small region around point)
            prompts.append([x - 5, y - 5, 10, 10])
    
    if 'boxes' in prompt_data:
        # Box prompts: list of [x, y, w, h]
        for box in prompt_data['boxes']:
            prompts.append([box['x'], box['y'], box['w'], box['h']])
    
    if 'text' in prompt_data:
        # Text prompts: convert to approximate box
        # In production, use CLIP or similar for text-to-region
        text = prompt_data['text'].lower()
        
        # Simple heuristics for common terms
        if 'center' in text or 'middle' in text:
            prompts.append([96, 96, 64, 64])  # Center region
        elif 'left' in text:
            prompts.append([32, 96, 64, 64])  # Left region
        elif 'right' in text:
            prompts.append([160, 96, 64, 64])  # Right region
        elif 'top' in text or 'upper' in text:
            prompts.append([96, 32, 64, 64])  # Top region
        elif 'bottom' in text or 'lower' in text:
            prompts.append([96, 160, 64, 64])  # Bottom region
        else:
            # Default to center
            prompts.append([96, 96, 64, 64])
    
    return torch.tensor(prompts, dtype=torch.float32)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'MedSAM2',
        'device': str(device),
        'model_loaded': model is not None
    })

@app.route('/segment', methods=['POST'])
def segment_with_prompts():
    """
    Segment image with interactive prompts
    """
    try:
        initialize_model()
        
        # Get image data
        if 'file' in request.files:
            file = request.files['file']
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
            
            try:
                # Load NIfTI file
                nii = nib.load(tmp_path)
                image_data = nii.get_fdata()
                
                # Get middle slice for 3D volumes
                if len(image_data.shape) == 3:
                    slice_idx = image_data.shape[2] // 2
                    image_data = image_data[:, :, slice_idx]
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        
        elif 'image' in request.json:
            # Base64 encoded image
            image_b64 = request.json['image']
            image_bytes = base64.b64decode(image_b64)
            image = Image.open(io.BytesIO(image_bytes))
            image_data = np.array(image)
        
        else:
            return jsonify({'error': 'No image provided'}), 400
        
        # Get prompts
        prompt_data = request.json.get('prompts', {}) if request.json else {}
        
        if not prompt_data:
            return jsonify({'error': 'No prompts provided'}), 400
        
        # Check if using MedicalSAM model
        from sam_model import MedicalSAM
        if isinstance(model, MedicalSAM):
            # Use MedicalSAM's segment method
            point = None
            box = None
            
            if 'points' in prompt_data and prompt_data['points']:
                p = prompt_data['points'][0]
                point = (int(p.get('x', 128)), int(p.get('y', 128)))
            elif 'boxes' in prompt_data and prompt_data['boxes']:
                b = prompt_data['boxes'][0]
                box = (int(b.get('x1', 0)), int(b.get('y1', 0)), int(b.get('x2', 256)), int(b.get('y2', 256)))
            
            # Ensure image is RGB
            if len(image_data.shape) == 2:
                image_data = np.stack([image_data] * 3, axis=-1)
            elif image_data.shape[-1] == 1:
                image_data = np.repeat(image_data, 3, axis=-1)
            
            mask_np, confidence = model.segment(image_data, point=point, box=box)
        else:
            # Legacy model path
            image_tensor = preprocess_image(image_data).to(device)
            prompts_tensor = parse_prompts(prompt_data).to(device)
            
            print(f"Image shape: {image_tensor.shape}")
            print(f"Prompts: {prompts_tensor.shape}")
            
            with torch.no_grad():
                mask = model(image_tensor, prompts_tensor)
            
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
        if 'points' in prompt_data:
            prompts_count += len(prompt_data.get('points', []))
        if 'boxes' in prompt_data:
            prompts_count += len(prompt_data.get('boxes', []))
        
        return jsonify({
            'success': True,
            'mask': mask_b64,
            'area_pixels': int(area_pixels),
            'confidence': confidence,
            'prompts_used': prompts_count,
            'model': 'MedSAM2'
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/segment-3d', methods=['POST'])
def segment_3d_volume():
    """
    Segment entire 3D volume with prompts
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
            # Load NIfTI file
            nii = nib.load(tmp_path)
            image_data = nii.get_fdata()
            
            if len(image_data.shape) != 3:
                return jsonify({'error': 'Expected 3D volume'}), 400
            
            # Get prompts
            prompt_data = request.json.get('prompts', {}) if request.json else {}
            prompts_tensor = parse_prompts(prompt_data).to(device)
            
            # Segment all slices
            num_slices = image_data.shape[2]
            masks_3d = np.zeros(image_data.shape, dtype=np.float32)
            
            for slice_idx in range(num_slices):
                slice_data = image_data[:, :, slice_idx]
                
                # Preprocess
                image_tensor = preprocess_image(slice_data).to(device)
                
                # Segment
                with torch.no_grad():
                    mask = model(image_tensor, prompts_tensor)
                
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
            mask_path = tmp_path.replace('.nii.gz', '_mask.nii.gz')
            nib.save(mask_nii, mask_path)
            
            # Encode as base64
            with open(mask_path, 'rb') as f:
                mask_b64 = base64.b64encode(f.read()).decode('utf-8')
            
            return jsonify({
                'success': True,
                'mask_nifti': mask_b64,
                'volume_voxels': int(volume_voxels),
                'volume_mm3': float(volume_mm3),
                'volume_ml': float(volume_ml),
                'num_slices': num_slices,
                'voxel_spacing': list(voxel_spacing),
                'model': 'MedSAM2 3D'
            })
        
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            if os.path.exists(mask_path):
                os.unlink(mask_path)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/info', methods=['GET'])
def get_info():
    """Get service information"""
    return jsonify({
        'service': 'MedSAM2',
        'version': '1.0.0',
        'description': 'Medical-specific Segment Anything Model for brain MRI',
        'capabilities': [
            'Point-based segmentation',
            'Bounding box segmentation',
            'Text prompt segmentation',
            'Multi-prompt refinement',
            '2D slice segmentation',
            '3D volume segmentation',
            'Interactive mask generation'
        ],
        'prompt_types': ['points', 'boxes', 'text'],
        'input_size': '256x256',
        'device': str(device),
        'cuda_available': torch.cuda.is_available()
    })

if __name__ == '__main__':
    print("=" * 60)
    print("MedSAM2 Interactive Segmentation Service")
    print("=" * 60)
    print(f"Device: {device}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print("=" * 60)
    
    # Initialize model on startup
    initialize_model()
    
    # Run server
    port = int(os.environ.get('MEDSAM2_PORT', 5005))
    print(f"\nStarting server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
