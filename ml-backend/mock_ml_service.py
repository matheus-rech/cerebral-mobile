#!/usr/bin/env python3
"""
Lightweight Mock ML Service for CEREBRAL Mobile
Provides realistic analysis results without requiring PyTorch/heavy dependencies
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import base64
import io
from PIL import Image
import numpy as np

app = Flask(__name__)
CORS(app)

# Sample findings for realistic responses
LESION_TYPES = [
    {"type": "hyperintense", "severity": "mild", "location": "frontal lobe"},
    {"type": "hypointense", "severity": "moderate", "location": "temporal lobe"},
    {"type": "enhancing", "severity": "significant", "location": "parietal region"},
    {"type": "non-enhancing", "severity": "mild", "location": "occipital lobe"},
    {"type": "periventricular", "severity": "moderate", "location": "white matter"},
]

BRAIN_STRUCTURES = [
    {"name": "Hippocampus", "volume_ml": 3.2, "percentile": 45},
    {"name": "Amygdala", "volume_ml": 1.8, "percentile": 52},
    {"name": "Thalamus", "volume_ml": 7.5, "percentile": 48},
    {"name": "Caudate", "volume_ml": 4.1, "percentile": 55},
    {"name": "Putamen", "volume_ml": 5.3, "percentile": 50},
    {"name": "Lateral Ventricle", "volume_ml": 12.4, "percentile": 42},
    {"name": "Cerebellum", "volume_ml": 142.0, "percentile": 51},
    {"name": "Brainstem", "volume_ml": 25.6, "percentile": 49},
]

def generate_mock_mask(width=256, height=256):
    """Generate a simple circular mask as base64"""
    img = Image.new('L', (width, height), 0)
    pixels = img.load()
    
    # Create a few random circular regions
    for _ in range(random.randint(1, 3)):
        cx = random.randint(50, width - 50)
        cy = random.randint(50, height - 50)
        radius = random.randint(15, 40)
        
        for x in range(max(0, cx - radius), min(width, cx + radius)):
            for y in range(max(0, cy - radius), min(height, cy + radius)):
                if (x - cx) ** 2 + (y - cy) ** 2 < radius ** 2:
                    pixels[x, y] = 255
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


# ============ UNet Service (Port 5003) ============
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "mock-ml-service", "models": ["unet", "medsam2", "sam3", "synthseg"]})


@app.route('/detect', methods=['POST'])
def unet_detect():
    """UNet lesion detection endpoint"""
    data = request.json or {}
    
    # Simulate processing time
    import time
    time.sleep(0.2)
    
    # Generate realistic findings
    num_lesions = random.randint(0, 3)
    findings = random.sample(LESION_TYPES, min(num_lesions, len(LESION_TYPES))) if num_lesions > 0 else []
    
    total_volume = sum(random.uniform(0.5, 5.0) for _ in findings)
    confidence = random.uniform(0.75, 0.95)
    
    # Generate impression based on findings
    if num_lesions == 0:
        impression = "No significant lesions detected. Brain parenchyma appears within normal limits."
        severity = "normal"
    elif num_lesions == 1:
        impression = f"Detected 1 {findings[0]['type']} lesion in the {findings[0]['location']} with {findings[0]['severity']} characteristics. Recommend clinical correlation."
        severity = findings[0]['severity']
    else:
        impression = f"Detected {num_lesions} lesions with total volume of {total_volume:.1f} mm³. {sum(1 for f in findings if f['severity'] == 'moderate')} moderate lesion(s). Recommend clinical correlation and possible follow-up imaging."
        severity = "moderate" if any(f['severity'] in ['moderate', 'significant'] for f in findings) else "mild"
    
    return jsonify({
        "success": True,
        "model": "UNet",
        "confidence": confidence,
        "modality": "T1",
        "view": random.choice(["Axial", "Coronal", "Sagittal"]),
        "findings": [
            {
                "type": f["type"],
                "location": f["location"],
                "severity": f["severity"],
                "volume_mm3": random.uniform(0.5, 5.0),
                "confidence": random.uniform(0.7, 0.95)
            }
            for f in findings
        ],
        "impression": impression,
        "severity": severity,
        "inference_time": "0.2s",
        "overlay": generate_mock_mask() if num_lesions > 0 else None,
        "recommendations": [
            "Clinical correlation recommended",
            "Consider follow-up MRI in 3-6 months" if num_lesions > 0 else "Routine follow-up as clinically indicated"
        ]
    })


# ============ MedSAM2 Service (Port 5005) ============
@app.route('/segment', methods=['POST'])
def medsam2_segment():
    """MedSAM2 interactive segmentation endpoint"""
    data = request.json or {}
    points = data.get('points', [])
    boxes = data.get('boxes', [])
    text_prompt = data.get('text_prompt', '')
    
    import time
    time.sleep(0.2)
    
    confidence = random.uniform(0.45, 0.85)
    area = random.randint(500, 5000)
    
    return jsonify({
        "success": True,
        "model": "MedSAM2",
        "confidence": confidence,
        "area_pixels": area,
        "mask": generate_mock_mask(),
        "inference_time": "0.2s",
        "prompt_type": "text" if text_prompt else ("point" if points else "box"),
        "num_prompts": len(points) + len(boxes) + (1 if text_prompt else 0)
    })


# ============ SAM3 Service (Port 5006) ============
@app.route('/segment-point', methods=['POST'])
def sam3_segment():
    """SAM3 zero-shot segmentation endpoint"""
    data = request.json or {}
    
    import time
    time.sleep(0.2)
    
    confidence = random.uniform(0.50, 0.90)
    area = random.randint(800, 8000)
    
    return jsonify({
        "success": True,
        "model": "SAM3",
        "confidence": confidence,
        "area_pixels": area,
        "mask": generate_mock_mask(),
        "inference_time": "0.2s",
        "auto_detected_regions": random.randint(3, 8)
    })


# ============ SynthSeg Service (Port 5001) ============
@app.route('/synthseg/segment', methods=['POST'])
def synthseg_segment():
    """SynthSeg brain structure volumetrics endpoint"""
    data = request.json or {}
    
    import time
    time.sleep(1.0)  # SynthSeg is slower
    
    # Generate volumetric analysis
    structures = []
    for struct in BRAIN_STRUCTURES:
        volume_variation = random.uniform(0.85, 1.15)
        structures.append({
            "name": struct["name"],
            "volume_ml": round(struct["volume_ml"] * volume_variation, 2),
            "percentile": struct["percentile"] + random.randint(-10, 10),
            "status": "normal" if abs(struct["percentile"] - 50) < 20 else "attention"
        })
    
    total_brain_volume = sum(s["volume_ml"] for s in structures)
    
    return jsonify({
        "success": True,
        "model": "SynthSeg",
        "structures": structures,
        "total_brain_volume_ml": round(total_brain_volume, 1),
        "intracranial_volume_ml": round(total_brain_volume * 1.15, 1),
        "brain_parenchymal_fraction": round(random.uniform(0.78, 0.85), 3),
        "inference_time": "15s",
        "segmentation_mask": generate_mock_mask(),
        "quality_score": random.uniform(0.85, 0.98)
    })


if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5003
    print(f"Starting Mock ML Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
