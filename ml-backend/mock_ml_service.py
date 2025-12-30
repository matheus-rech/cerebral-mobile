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

# Complete FreeSurfer-compatible brain structures (32+ regions)
BRAIN_STRUCTURES = [
    # Subcortical structures (bilateral)
    {"id": 2, "name": "Left Cerebral White Matter", "volume_ml": 219.5, "percentile": 52, "color": "#F5F5DC"},
    {"id": 41, "name": "Right Cerebral White Matter", "volume_ml": 221.3, "percentile": 54, "color": "#F5F5DC"},
    {"id": 3, "name": "Left Cerebral Cortex", "volume_ml": 232.1, "percentile": 48, "color": "#CD853F"},
    {"id": 42, "name": "Right Cerebral Cortex", "volume_ml": 234.8, "percentile": 50, "color": "#CD853F"},
    {"id": 4, "name": "Left Lateral Ventricle", "volume_ml": 8.2, "percentile": 45, "color": "#4169E1"},
    {"id": 43, "name": "Right Lateral Ventricle", "volume_ml": 7.9, "percentile": 43, "color": "#4169E1"},
    {"id": 5, "name": "Left Inferior Lateral Ventricle", "volume_ml": 0.8, "percentile": 40, "color": "#6495ED"},
    {"id": 44, "name": "Right Inferior Lateral Ventricle", "volume_ml": 0.7, "percentile": 38, "color": "#6495ED"},
    {"id": 7, "name": "Left Cerebellar White Matter", "volume_ml": 12.4, "percentile": 51, "color": "#DC143C"},
    {"id": 46, "name": "Right Cerebellar White Matter", "volume_ml": 12.6, "percentile": 53, "color": "#DC143C"},
    {"id": 8, "name": "Left Cerebellar Cortex", "volume_ml": 52.1, "percentile": 49, "color": "#8B0000"},
    {"id": 47, "name": "Right Cerebellar Cortex", "volume_ml": 53.2, "percentile": 51, "color": "#8B0000"},
    {"id": 10, "name": "Left Thalamus", "volume_ml": 7.8, "percentile": 55, "color": "#00FF00"},
    {"id": 49, "name": "Right Thalamus", "volume_ml": 7.6, "percentile": 53, "color": "#00FF00"},
    {"id": 11, "name": "Left Caudate", "volume_ml": 3.5, "percentile": 48, "color": "#7CFC00"},
    {"id": 50, "name": "Right Caudate", "volume_ml": 3.4, "percentile": 46, "color": "#7CFC00"},
    {"id": 12, "name": "Left Putamen", "volume_ml": 4.9, "percentile": 52, "color": "#FF69B4"},
    {"id": 51, "name": "Right Putamen", "volume_ml": 5.0, "percentile": 54, "color": "#FF69B4"},
    {"id": 13, "name": "Left Pallidum", "volume_ml": 1.8, "percentile": 50, "color": "#0000CD"},
    {"id": 52, "name": "Right Pallidum", "volume_ml": 1.7, "percentile": 48, "color": "#0000CD"},
    {"id": 14, "name": "Third Ventricle", "volume_ml": 1.1, "percentile": 42, "color": "#CC00FF"},
    {"id": 15, "name": "Fourth Ventricle", "volume_ml": 1.8, "percentile": 44, "color": "#CC00FF"},
    {"id": 16, "name": "Brain Stem", "volume_ml": 22.5, "percentile": 51, "color": "#FFDAB9"},
    {"id": 17, "name": "Left Hippocampus", "volume_ml": 4.1, "percentile": 47, "color": "#FFFF00"},
    {"id": 53, "name": "Right Hippocampus", "volume_ml": 4.0, "percentile": 45, "color": "#FFFF00"},
    {"id": 18, "name": "Left Amygdala", "volume_ml": 1.6, "percentile": 49, "color": "#66CDAA"},
    {"id": 54, "name": "Right Amygdala", "volume_ml": 1.5, "percentile": 47, "color": "#66CDAA"},
    {"id": 24, "name": "CSF", "volume_ml": 28.3, "percentile": 55, "color": "#00FFFF"},
    {"id": 26, "name": "Left Accumbens Area", "volume_ml": 0.6, "percentile": 52, "color": "#FF4500"},
    {"id": 58, "name": "Right Accumbens Area", "volume_ml": 0.5, "percentile": 50, "color": "#FF4500"},
    {"id": 28, "name": "Left Ventral DC", "volume_ml": 3.8, "percentile": 48, "color": "#A52A2A"},
    {"id": 60, "name": "Right Ventral DC", "volume_ml": 3.9, "percentile": 50, "color": "#A52A2A"},
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


def generate_synthseg_overlay(input_image_base64=None, width=256, height=256):
    """Generate a colored brain structure overlay on top of the actual MRI image"""
    
    # If we have an input image, use it as the base
    if input_image_base64:
        try:
            # Handle data URI format
            if ',' in input_image_base64:
                input_image_base64 = input_image_base64.split(',')[1]
            
            img_data = base64.b64decode(input_image_base64)
            base_img = Image.open(io.BytesIO(img_data)).convert('RGBA')
            width, height = base_img.size
            
            # Create overlay on top of the actual image
            overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            overlay_pixels = overlay.load()
            
            # Scale regions based on image size
            scale_x = width / 256
            scale_y = height / 256
            
            # Define anatomical regions relative to brain center
            cx_center = width // 2
            cy_center = height // 2
            
            # Create anatomical-looking regions with different colors
            regions = [
                # Ventricles (blue, center)
                {"cx": cx_center, "cy": int(cy_center * 0.78), "rx": int(15 * scale_x), "ry": int(25 * scale_y), "color": (65, 105, 225, 140)},
                # Thalamus (green, bilateral)
                {"cx": int(cx_center - 23 * scale_x), "cy": int(cy_center * 0.86), "rx": int(18 * scale_x), "ry": int(15 * scale_y), "color": (0, 255, 0, 130)},
                {"cx": int(cx_center + 23 * scale_x), "cy": int(cy_center * 0.86), "rx": int(18 * scale_x), "ry": int(15 * scale_y), "color": (0, 255, 0, 130)},
                # Hippocampus (yellow, bilateral)
                {"cx": int(cx_center - 38 * scale_x), "cy": int(cy_center * 1.1), "rx": int(20 * scale_x), "ry": int(10 * scale_y), "color": (255, 255, 0, 140)},
                {"cx": int(cx_center + 38 * scale_x), "cy": int(cy_center * 1.1), "rx": int(20 * scale_x), "ry": int(10 * scale_y), "color": (255, 255, 0, 140)},
                # Caudate (lime green, bilateral)
                {"cx": int(cx_center - 28 * scale_x), "cy": int(cy_center * 0.66), "rx": int(12 * scale_x), "ry": int(18 * scale_y), "color": (124, 252, 0, 120)},
                {"cx": int(cx_center + 28 * scale_x), "cy": int(cy_center * 0.66), "rx": int(12 * scale_x), "ry": int(18 * scale_y), "color": (124, 252, 0, 120)},
                # Putamen (pink, bilateral)
                {"cx": int(cx_center - 43 * scale_x), "cy": int(cy_center * 0.82), "rx": int(15 * scale_x), "ry": int(12 * scale_y), "color": (255, 105, 180, 130)},
                {"cx": int(cx_center + 43 * scale_x), "cy": int(cy_center * 0.82), "rx": int(15 * scale_x), "ry": int(12 * scale_y), "color": (255, 105, 180, 130)},
                # Cerebellum (dark red, bottom)
                {"cx": cx_center, "cy": int(cy_center * 1.56), "rx": int(50 * scale_x), "ry": int(30 * scale_y), "color": (139, 0, 0, 110)},
                # Brain stem (peach, bottom center)
                {"cx": cx_center, "cy": int(cy_center * 1.37), "rx": int(12 * scale_x), "ry": int(25 * scale_y), "color": (255, 218, 185, 120)},
                # Amygdala (teal, bilateral)
                {"cx": int(cx_center - 33 * scale_x), "cy": int(cy_center * 1.02), "rx": int(10 * scale_x), "ry": int(8 * scale_y), "color": (102, 205, 170, 140)},
                {"cx": int(cx_center + 33 * scale_x), "cy": int(cy_center * 1.02), "rx": int(10 * scale_x), "ry": int(8 * scale_y), "color": (102, 205, 170, 140)},
            ]
            
            for region in regions:
                cx, cy = region["cx"], region["cy"]
                rx, ry = max(1, region["rx"]), max(1, region["ry"])
                color = region["color"]
                
                for x in range(max(0, cx - rx - 2), min(width, cx + rx + 2)):
                    for y in range(max(0, cy - ry - 2), min(height, cy + ry + 2)):
                        # Ellipse equation
                        if ((x - cx) ** 2 / (rx ** 2) + (y - cy) ** 2 / (ry ** 2)) <= 1:
                            overlay_pixels[x, y] = color
            
            # Composite overlay on base image
            result = Image.alpha_composite(base_img, overlay)
            
            buffer = io.BytesIO()
            result.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
            
        except Exception as e:
            print(f"Error processing input image: {e}")
            # Fall through to generate standalone overlay
    
    # Generate standalone overlay if no input image
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    pixels = img.load()
    
    # Create anatomical-looking regions with different colors
    regions = [
        # Ventricles (blue, center)
        {"cx": 128, "cy": 100, "rx": 15, "ry": 25, "color": (65, 105, 225, 180)},
        {"cx": 128, "cy": 100, "rx": 8, "ry": 15, "color": (65, 105, 225, 200)},
        # Thalamus (green, bilateral)
        {"cx": 105, "cy": 110, "rx": 18, "ry": 15, "color": (0, 255, 0, 160)},
        {"cx": 151, "cy": 110, "rx": 18, "ry": 15, "color": (0, 255, 0, 160)},
        # Hippocampus (yellow, bilateral)
        {"cx": 90, "cy": 140, "rx": 20, "ry": 10, "color": (255, 255, 0, 170)},
        {"cx": 166, "cy": 140, "rx": 20, "ry": 10, "color": (255, 255, 0, 170)},
        # Caudate (lime green, bilateral)
        {"cx": 100, "cy": 85, "rx": 12, "ry": 18, "color": (124, 252, 0, 150)},
        {"cx": 156, "cy": 85, "rx": 12, "ry": 18, "color": (124, 252, 0, 150)},
        # Putamen (pink, bilateral)
        {"cx": 85, "cy": 105, "rx": 15, "ry": 12, "color": (255, 105, 180, 160)},
        {"cx": 171, "cy": 105, "rx": 15, "ry": 12, "color": (255, 105, 180, 160)},
        # Cerebellum (dark red, bottom)
        {"cx": 128, "cy": 200, "rx": 50, "ry": 30, "color": (139, 0, 0, 140)},
        # Brain stem (peach, bottom center)
        {"cx": 128, "cy": 175, "rx": 12, "ry": 25, "color": (255, 218, 185, 150)},
        # Amygdala (teal, bilateral)
        {"cx": 95, "cy": 130, "rx": 10, "ry": 8, "color": (102, 205, 170, 170)},
        {"cx": 161, "cy": 130, "rx": 10, "ry": 8, "color": (102, 205, 170, 170)},
    ]
    
    for region in regions:
        cx, cy = region["cx"], region["cy"]
        rx, ry = region["rx"], region["ry"]
        color = region["color"]
        
        for x in range(max(0, cx - rx - 5), min(width, cx + rx + 5)):
            for y in range(max(0, cy - ry - 5), min(height, cy + ry + 5)):
                # Ellipse equation
                if ((x - cx) ** 2 / (rx ** 2) + (y - cy) ** 2 / (ry ** 2)) <= 1:
                    # Blend with existing pixel
                    existing = pixels[x, y]
                    if existing[3] == 0:
                        pixels[x, y] = color
                    else:
                        # Simple alpha blending
                        alpha = color[3] / 255
                        new_r = int(existing[0] * (1 - alpha) + color[0] * alpha)
                        new_g = int(existing[1] * (1 - alpha) + color[1] * alpha)
                        new_b = int(existing[2] * (1 - alpha) + color[2] * alpha)
                        pixels[x, y] = (new_r, new_g, new_b, max(existing[3], color[3]))
    
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
                "status": f["severity"],  # Add status field
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
        "mask_base64": generate_mock_mask(),
        "inference_time": "0.2s",
        "prompt_type": "text" if text_prompt else ("point" if points else "box"),
        "num_prompts": len(points) + len(boxes) + (1 if text_prompt else 0)
    })


# ============ SAM3 Service (Port 5006) ============
@app.route('/segment-point', methods=['POST'])
def sam3_segment_point():
    """SAM3 point-based segmentation endpoint"""
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
        "mask_base64": generate_mock_mask(),
        "inference_time": "0.2s",
        "auto_detected_regions": random.randint(3, 8)
    })


@app.route('/segment-box', methods=['POST'])
def sam3_segment_box():
    """SAM3 box-based segmentation endpoint"""
    data = request.json or {}
    
    import time
    time.sleep(0.2)
    
    confidence = random.uniform(0.55, 0.92)
    area = random.randint(1000, 10000)
    
    return jsonify({
        "success": True,
        "model": "SAM3",
        "confidence": confidence,
        "area_pixels": area,
        "mask_base64": generate_mock_mask(),
        "inference_time": "0.2s",
        "auto_detected_regions": random.randint(2, 6)
    })


@app.route('/segment-text', methods=['POST'])
def sam3_segment_text():
    """SAM3 text-based segmentation endpoint"""
    data = request.json or {}
    text_prompt = data.get('text', '')
    
    import time
    time.sleep(0.3)
    
    confidence = random.uniform(0.40, 0.85)
    area = random.randint(500, 8000)
    
    return jsonify({
        "success": True,
        "model": "SAM3",
        "confidence": confidence,
        "area_pixels": area,
        "mask_base64": generate_mock_mask(),
        "inference_time": "0.3s",
        "text_prompt": text_prompt,
        "detected_structure": text_prompt.replace('segment the ', '').title() if text_prompt else 'Unknown'
    })


# ============ SynthSeg Service (Port 5001/5002) ============
@app.route('/synthseg/segment', methods=['POST'])
def synthseg_segment():
    """SynthSeg brain structure volumetrics endpoint - returns 32+ brain structures"""
    data = request.json or {}
    
    import time
    time.sleep(1.0)  # SynthSeg is slower
    
    # Generate volumetric analysis with all 32 structures
    structures = []
    for struct in BRAIN_STRUCTURES:
        volume_variation = random.uniform(0.90, 1.10)
        percentile_variation = random.randint(-5, 5)
        
        # Determine status based on percentile
        adjusted_percentile = struct["percentile"] + percentile_variation
        if adjusted_percentile < 20:
            status = "low"
        elif adjusted_percentile > 80:
            status = "high"
        else:
            status = "normal"
        
        structures.append({
            "id": struct["id"],
            "name": struct["name"],
            "volume_ml": round(struct["volume_ml"] * volume_variation, 2),
            "volume_mm3": round(struct["volume_ml"] * volume_variation * 1000, 1),
            "percentile": adjusted_percentile,
            "status": status,
            "color": struct["color"]
        })
    
    # Calculate totals
    total_brain_volume = sum(s["volume_ml"] for s in structures)
    gray_matter_volume = sum(s["volume_ml"] for s in structures if "Cortex" in s["name"])
    white_matter_volume = sum(s["volume_ml"] for s in structures if "White Matter" in s["name"])
    ventricular_volume = sum(s["volume_ml"] for s in structures if "Ventricle" in s["name"] or "CSF" in s["name"])
    
    # Generate clinical impression
    low_structures = [s for s in structures if s["status"] == "low"]
    high_structures = [s for s in structures if s["status"] == "high"]
    
    if low_structures:
        impression = f"Volumetric analysis shows reduced volume in {len(low_structures)} structure(s): {', '.join([s['name'] for s in low_structures[:3]])}. Clinical correlation recommended."
    elif high_structures:
        impression = f"Volumetric analysis shows increased volume in {len(high_structures)} structure(s): {', '.join([s['name'] for s in high_structures[:3]])}. May indicate compensatory changes."
    else:
        impression = "All brain structures within normal volumetric ranges. No significant atrophy or enlargement detected."
    
    return jsonify({
        "success": True,
        "model": "SynthSeg",
        "structures": structures,
        "structure_count": len(structures),
        "summary": {
            "total_brain_volume_ml": round(total_brain_volume, 1),
            "intracranial_volume_ml": round(total_brain_volume * 1.15, 1),
            "gray_matter_volume_ml": round(gray_matter_volume, 1),
            "white_matter_volume_ml": round(white_matter_volume, 1),
            "ventricular_volume_ml": round(ventricular_volume, 1),
            "brain_parenchymal_fraction": round(random.uniform(0.78, 0.85), 3),
        },
        "impression": impression,
        "inference_time": "15s",
        "segmentation_overlay": generate_synthseg_overlay(data.get('image')),
        "quality_score": random.uniform(0.85, 0.98),
        "findings": [
            {
                "type": "volumetric",
                "location": s["name"],
                "status": s["status"],
                "volume_ml": s["volume_ml"],
                "percentile": s["percentile"],
                "confidence": random.uniform(0.85, 0.98)
            }
            for s in structures if s["status"] != "normal"
        ],
        "recommendations": [
            "Compare with prior imaging if available",
            "Clinical correlation with cognitive assessment recommended" if low_structures else "Routine follow-up as clinically indicated"
        ]
    })


if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5003
    print(f"Starting Mock ML Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
