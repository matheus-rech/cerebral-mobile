"""
Neuroimaging Segmentation Service
Production Flask API for brain USG and MRI segmentation

Integrates the zero-shot segmentation skill with critical finding detection
Based on best practices from BIDS apps, RadiologyAI, and medical imaging pipelines
"""

import os
import sys
import json
import base64
import tempfile
import traceback
from io import BytesIO
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

import cv2
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

# Import the segmentation module
from segment_neuroimaging import (
    segment_neurousg,
    segment_mri_t1gd,
    segment_brain_image,
    create_overlay,
    add_annotations,
    create_comparison,
    COLORS,
    THRESHOLDS,
    Modality,
    SegmentationResult
)

app = Flask(__name__)
CORS(app)

# Critical finding severity levels (inspired by RadiologyAI)
class Severity(Enum):
    RED = "critical"      # Life-threatening
    ORANGE = "urgent"     # Requires prompt attention
    YELLOW = "significant" # Needs follow-up
    GREEN = "routine"     # Normal finding


@dataclass
class CriticalFinding:
    """Critical finding with severity classification"""
    structure: str
    finding: str
    severity: str
    description: str
    area_pixels: int
    area_percentage: float
    recommendation: str


def classify_finding_severity(
    structure: str,
    area_percentage: float,
    modality: str
) -> Tuple[str, str, str]:
    """
    Classify finding severity based on structure and size.
    
    Returns: (severity, description, recommendation)
    """
    # Tumor findings
    if structure in ['tumor', 'enhancement']:
        if area_percentage > 10:
            return (
                Severity.RED.value,
                f"Large {structure} detected ({area_percentage:.1f}% of brain area)",
                "URGENT: Immediate neurosurgical consultation recommended"
            )
        elif area_percentage > 5:
            return (
                Severity.ORANGE.value,
                f"Significant {structure} detected ({area_percentage:.1f}% of brain area)",
                "Prompt neurosurgical evaluation recommended within 24-48 hours"
            )
        elif area_percentage > 1:
            return (
                Severity.YELLOW.value,
                f"Small {structure} detected ({area_percentage:.1f}% of brain area)",
                "Follow-up imaging recommended in 1-2 weeks"
            )
        else:
            return (
                Severity.GREEN.value,
                f"Minimal hyperechoic region ({area_percentage:.1f}%)",
                "Monitor with routine follow-up"
            )
    
    # Necrotic center (indicates aggressive tumor)
    if structure == 'necrotic':
        if area_percentage > 2:
            return (
                Severity.RED.value,
                f"Central necrosis detected ({area_percentage:.1f}%)",
                "URGENT: Suggests high-grade malignancy. Immediate oncology consultation"
            )
        else:
            return (
                Severity.ORANGE.value,
                f"Small necrotic region ({area_percentage:.1f}%)",
                "Biopsy may be indicated to determine tumor grade"
            )
    
    # Edema
    if structure == 'edema':
        if area_percentage > 15:
            return (
                Severity.RED.value,
                f"Extensive perilesional edema ({area_percentage:.1f}%)",
                "URGENT: Risk of herniation. Consider immediate decompression"
            )
        elif area_percentage > 8:
            return (
                Severity.ORANGE.value,
                f"Significant edema ({area_percentage:.1f}%)",
                "Consider corticosteroid therapy. Monitor for mass effect"
            )
        else:
            return (
                Severity.YELLOW.value,
                f"Mild edema ({area_percentage:.1f}%)",
                "Monitor for progression"
            )
    
    # Ventricles/CSF
    if structure in ['ventricles', 'csf']:
        if area_percentage > 20:
            return (
                Severity.ORANGE.value,
                f"Enlarged ventricles ({area_percentage:.1f}%)",
                "Evaluate for hydrocephalus. Consider CSF diversion if symptomatic"
            )
        elif area_percentage < 2 and modality == 'USG':
            return (
                Severity.YELLOW.value,
                f"Small/compressed ventricles ({area_percentage:.1f}%)",
                "Evaluate for mass effect or cerebral edema"
            )
        else:
            return (
                Severity.GREEN.value,
                f"Normal ventricular system ({area_percentage:.1f}%)",
                "No intervention required"
            )
    
    # Parenchyma (normal brain)
    if structure == 'parenchyma':
        return (
            Severity.GREEN.value,
            f"Normal brain parenchyma ({area_percentage:.1f}%)",
            "No abnormality detected in this region"
        )
    
    # Default
    return (
        Severity.GREEN.value,
        f"{structure.title()} detected ({area_percentage:.1f}%)",
        "Routine follow-up"
    )


def analyze_segmentation(
    result: SegmentationResult,
    total_roi_area: int
) -> List[CriticalFinding]:
    """
    Analyze segmentation results and generate critical findings.
    """
    findings = []
    modality = result.metadata.get('modality', 'USG')
    
    for structure, mask in result.masks.items():
        area_pixels = int(np.sum(mask > 0))
        area_percentage = (area_pixels / total_roi_area * 100) if total_roi_area > 0 else 0
        
        severity, description, recommendation = classify_finding_severity(
            structure, area_percentage, modality
        )
        
        finding = CriticalFinding(
            structure=structure,
            finding=f"{structure.title()} segmented",
            severity=severity,
            description=description,
            area_pixels=area_pixels,
            area_percentage=round(area_percentage, 2),
            recommendation=recommendation
        )
        findings.append(finding)
    
    # Sort by severity (RED first)
    severity_order = {
        Severity.RED.value: 0,
        Severity.ORANGE.value: 1,
        Severity.YELLOW.value: 2,
        Severity.GREEN.value: 3
    }
    findings.sort(key=lambda f: severity_order.get(f.severity, 4))
    
    return findings


def encode_image_base64(image: np.ndarray) -> str:
    """Encode numpy image to base64 string."""
    if len(image.shape) == 3 and image.shape[2] == 3:
        image_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    else:
        image_bgr = image
    
    _, buffer = cv2.imencode('.png', image_bgr)
    return base64.b64encode(buffer).decode('utf-8')


def encode_mask_base64(mask: np.ndarray) -> str:
    """Encode binary mask to base64 string."""
    _, buffer = cv2.imencode('.png', mask)
    return base64.b64encode(buffer).decode('utf-8')


def decode_image_base64(base64_string: str) -> np.ndarray:
    """Decode base64 string to numpy image."""
    image_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(image_data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'neuroimaging-segmentation',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat(),
        'capabilities': {
            'modalities': ['USG', 'T1_GD', 'T2', 'FLAIR'],
            'structures': {
                'USG': ['tumor', 'ventricles', 'parenchyma', 'hemorrhage', 'edema'],
                'T1_GD': ['enhancement', 'necrotic', 'edema', 'csf', 'parenchyma'],
                'T2': ['csf', 'edema', 'parenchyma'],
                'FLAIR': ['edema', 'parenchyma', 'csf']
            },
            'critical_finding_detection': True,
            'zero_shot': True,
            'few_shot': True
        }
    })


@app.route('/segment/usg', methods=['POST'])
def segment_usg():
    """
    Segment brain ultrasound (neuroUSG) image.
    
    Request body:
    {
        "image": "base64_encoded_image",
        "structures": ["tumor", "csf", "parenchyma"],  // optional
        "thresholds": {...}  // optional custom thresholds
    }
    """
    try:
        data = request.get_json()
        
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        # Decode image
        image_rgb = decode_image_base64(data['image'])
        
        # Save to temp file for processing
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            temp_path = f.name
            cv2.imwrite(temp_path, cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR))
        
        try:
            # Get parameters
            structures = data.get('structures', ['tumor', 'csf', 'parenchyma'])
            thresholds = data.get('thresholds')
            
            # Perform segmentation
            result = segment_neurousg(temp_path, structures, thresholds)
            
            # Calculate total ROI area
            gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
            _, roi = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
            total_roi_area = int(np.sum(roi > 0))
            
            # Analyze findings
            findings = analyze_segmentation(result, total_roi_area)
            
            # Add annotations
            annotated = add_annotations(result.overlay, result.masks, "NeuroUSG Segmentation")
            
            # Create comparison image
            comparison = create_comparison(image_rgb, annotated, "Brain Ultrasound Analysis")
            
            # Encode results
            response = {
                'success': True,
                'modality': 'USG',
                'overlay': encode_image_base64(annotated),
                'comparison': encode_image_base64(comparison),
                'masks': {
                    name: encode_mask_base64(mask)
                    for name, mask in result.masks.items()
                },
                'structures_found': result.metadata['structures_found'],
                'findings': [asdict(f) for f in findings],
                'critical_count': sum(1 for f in findings if f.severity in ['critical', 'urgent']),
                'metadata': {
                    'image_shape': list(result.metadata['image_shape']),
                    'thresholds_used': {k: list(v) for k, v in result.metadata['thresholds_used'].items()},
                    'total_roi_area': total_roi_area,
                    'timestamp': datetime.utcnow().isoformat()
                }
            }
            
            return jsonify(response)
            
        finally:
            os.unlink(temp_path)
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@app.route('/segment/mri', methods=['POST'])
def segment_mri():
    """
    Segment MRI image (T1-Gd, T2, or FLAIR).
    
    Request body:
    {
        "image": "base64_encoded_image",
        "modality": "T1_GD",  // T1_GD, T2, or FLAIR
        "structures": ["enhancement", "necrotic", "edema", "csf", "parenchyma"],
        "thresholds": {...}  // optional
    }
    """
    try:
        data = request.get_json()
        
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        modality = data.get('modality', 'T1_GD').upper()
        if modality not in ['T1_GD', 'T2', 'FLAIR']:
            return jsonify({'error': f'Invalid modality: {modality}'}), 400
        
        # Decode image
        image_rgb = decode_image_base64(data['image'])
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            temp_path = f.name
            cv2.imwrite(temp_path, cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR))
        
        try:
            # Get parameters
            default_structures = {
                'T1_GD': ['enhancement', 'necrotic', 'edema', 'csf', 'parenchyma'],
                'T2': ['csf', 'edema', 'parenchyma'],
                'FLAIR': ['edema', 'parenchyma', 'csf']
            }
            structures = data.get('structures', default_structures.get(modality))
            thresholds = data.get('thresholds')
            
            # Perform segmentation
            if modality == 'T1_GD':
                result = segment_mri_t1gd(temp_path, structures, thresholds)
            else:
                result = segment_brain_image(temp_path, modality, structures)
            
            # Calculate total ROI area
            gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
            _, roi = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
            total_roi_area = int(np.sum(roi > 0))
            
            # Analyze findings
            findings = analyze_segmentation(result, total_roi_area)
            
            # Add annotations
            annotated = add_annotations(result.overlay, result.masks, f"{modality} Segmentation")
            
            # Create comparison
            comparison = create_comparison(image_rgb, annotated, f"MRI {modality} Analysis")
            
            # Encode results
            response = {
                'success': True,
                'modality': modality,
                'overlay': encode_image_base64(annotated),
                'comparison': encode_image_base64(comparison),
                'masks': {
                    name: encode_mask_base64(mask)
                    for name, mask in result.masks.items()
                },
                'structures_found': result.metadata['structures_found'],
                'findings': [asdict(f) for f in findings],
                'critical_count': sum(1 for f in findings if f.severity in ['critical', 'urgent']),
                'metadata': {
                    'image_shape': list(result.metadata['image_shape']),
                    'thresholds_used': {k: list(v) for k, v in result.metadata['thresholds_used'].items()},
                    'total_roi_area': total_roi_area,
                    'timestamp': datetime.utcnow().isoformat()
                }
            }
            
            return jsonify(response)
            
        finally:
            os.unlink(temp_path)
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@app.route('/segment/auto', methods=['POST'])
def segment_auto():
    """
    Auto-detect modality and segment.
    
    Request body:
    {
        "image": "base64_encoded_image",
        "hint": "USG"  // optional hint for modality
    }
    """
    try:
        data = request.get_json()
        
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        # Use hint or default to USG
        modality = data.get('hint', 'USG').upper()
        
        if modality in ['USG', 'ULTRASOUND', 'NEUROUSG']:
            # Forward to USG endpoint
            return segment_usg()
        else:
            # Forward to MRI endpoint
            data['modality'] = modality
            return segment_mri()
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/colors', methods=['GET'])
def get_colors():
    """Get the color palette used for segmentation."""
    return jsonify({
        'colors': {
            name: {
                'rgb': list(color),
                'hex': '#{:02x}{:02x}{:02x}'.format(*color)
            }
            for name, color in COLORS.items()
        }
    })


@app.route('/thresholds', methods=['GET'])
def get_thresholds():
    """Get default thresholds for each modality."""
    return jsonify({
        'thresholds': {
            modality.name: {
                structure: list(values)
                for structure, values in thresh.items()
            }
            for modality, thresh in THRESHOLDS.items()
        }
    })


if __name__ == '__main__':
    port = int(os.environ.get('NEUROIMAGING_PORT', 5010))
    print(f"Starting Neuroimaging Segmentation Service on port {port}")
    print(f"Endpoints:")
    print(f"  GET  /health - Health check")
    print(f"  POST /segment/usg - Segment brain ultrasound")
    print(f"  POST /segment/mri - Segment MRI (T1-Gd, T2, FLAIR)")
    print(f"  POST /segment/auto - Auto-detect and segment")
    print(f"  GET  /colors - Get color palette")
    print(f"  GET  /thresholds - Get default thresholds")
    app.run(host='0.0.0.0', port=port, debug=False)
