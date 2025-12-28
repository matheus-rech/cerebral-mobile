"""
3D Lesion Tracking Service
Multi-slice lesion detection and longitudinal analysis
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
import json
from datetime import datetime
from PIL import Image
from scipy import ndimage
from scipy.spatial.distance import cdist

# Import UNet model from lesion detector
import sys
sys.path.append(os.path.dirname(__file__))
from unet_lesion_detector import UNet, preprocess_for_unet, classify_severity

app = Flask(__name__)
CORS(app)

# Global model instance
model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Storage for longitudinal data
LONGITUDINAL_DATA_DIR = "/tmp/cerebral_longitudinal"
os.makedirs(LONGITUDINAL_DATA_DIR, exist_ok=True)

def initialize_model():
    """Initialize the UNet model"""
    global model
    if model is None:
        print("Initializing 3D Lesion Tracker...")
        try:
            model = torch.hub.load(
                'mateuszbuda/brain-segmentation-pytorch',
                'unet',
                in_channels=3,
                out_channels=1,
                init_features=32,
                pretrained=True
            )
        except:
            print("Using local UNet model")
            model = UNet(in_channels=3, out_channels=1, init_features=32)
        
        model.eval()
        model.to(device)
        print(f"Model loaded on {device}")

def process_slice(slice_data):
    """Process a single slice with UNet"""
    initialize_model()
    
    # Preprocess
    input_tensor = preprocess_for_unet(slice_data)
    input_tensor = torch.from_numpy(input_tensor).unsqueeze(0).to(device)
    
    # Inference
    with torch.no_grad():
        output = model(input_tensor)
        mask = output.cpu().numpy()[0, 0]
    
    return mask

def extract_lesions_from_mask(mask, slice_idx, voxel_spacing):
    """Extract individual lesions from segmentation mask"""
    # Threshold
    binary_mask = (mask > 0.5).astype(np.uint8)
    
    # Label connected components
    labeled_mask, num_lesions = ndimage.label(binary_mask)
    
    lesions = []
    for lesion_id in range(1, num_lesions + 1):
        lesion_mask = (labeled_mask == lesion_id)
        
        # Calculate properties
        size_pixels = np.sum(lesion_mask)
        size_mm2 = size_pixels * (voxel_spacing[0] * voxel_spacing[1])
        
        # Get centroid
        coords = np.argwhere(lesion_mask)
        centroid = coords.mean(axis=0)
        
        # Calculate intensity
        intensity = mask[lesion_mask].mean()
        
        lesions.append({
            'id': f'slice{slice_idx}_lesion{lesion_id}',
            'slice': slice_idx,
            'size_pixels': int(size_pixels),
            'size_mm2': float(size_mm2),
            'centroid': {
                'x': float(centroid[1]),
                'y': float(centroid[0]),
                'z': slice_idx
            },
            'intensity': float(intensity),
            'severity': classify_severity(size_mm2, intensity)
        })
    
    return lesions

def match_lesions_across_slices(all_lesions, max_distance=10.0):
    """
    Match lesions across consecutive slices to form 3D lesions
    """
    if not all_lesions:
        return []
    
    # Group by slice
    slices = {}
    for lesion in all_lesions:
        slice_idx = lesion['slice']
        if slice_idx not in slices:
            slices[slice_idx] = []
        slices[slice_idx].append(lesion)
    
    # Sort slices
    sorted_slices = sorted(slices.keys())
    
    # Track 3D lesions
    lesions_3d = []
    current_3d_lesions = []
    
    for i, slice_idx in enumerate(sorted_slices):
        current_slice_lesions = slices[slice_idx]
        
        if i == 0:
            # First slice - create new 3D lesions
            for lesion in current_slice_lesions:
                lesions_3d.append({
                    'id': f'lesion_3d_{len(lesions_3d) + 1}',
                    'slices': [lesion],
                    'start_slice': slice_idx,
                    'end_slice': slice_idx
                })
        else:
            # Match with previous slice
            prev_slice_idx = sorted_slices[i - 1]
            
            # Get centroids from active 3D lesions on previous slice
            active_3d = [l for l in lesions_3d if l['end_slice'] == prev_slice_idx]
            
            if active_3d and current_slice_lesions:
                # Calculate distances
                prev_centroids = np.array([[l['slices'][-1]['centroid']['x'], 
                                           l['slices'][-1]['centroid']['y']] 
                                          for l in active_3d])
                curr_centroids = np.array([[l['centroid']['x'], l['centroid']['y']] 
                                          for l in current_slice_lesions])
                
                distances = cdist(prev_centroids, curr_centroids)
                
                # Match lesions
                matched_curr = set()
                for j, lesion_3d in enumerate(active_3d):
                    min_dist_idx = np.argmin(distances[j])
                    min_dist = distances[j, min_dist_idx]
                    
                    if min_dist < max_distance and min_dist_idx not in matched_curr:
                        # Extend existing 3D lesion
                        lesion_3d['slices'].append(current_slice_lesions[min_dist_idx])
                        lesion_3d['end_slice'] = slice_idx
                        matched_curr.add(min_dist_idx)
                
                # Create new 3D lesions for unmatched
                for k, lesion in enumerate(current_slice_lesions):
                    if k not in matched_curr:
                        lesions_3d.append({
                            'id': f'lesion_3d_{len(lesions_3d) + 1}',
                            'slices': [lesion],
                            'start_slice': slice_idx,
                            'end_slice': slice_idx
                        })
            else:
                # No active lesions or no current lesions
                for lesion in current_slice_lesions:
                    lesions_3d.append({
                        'id': f'lesion_3d_{len(lesions_3d) + 1}',
                        'slices': [lesion],
                        'start_slice': slice_idx,
                        'end_slice': slice_idx
                    })
    
    return lesions_3d

def calculate_3d_volume(lesion_3d, voxel_spacing):
    """Calculate 3D volume of a lesion"""
    total_volume_mm3 = 0
    for slice_lesion in lesion_3d['slices']:
        slice_area_mm2 = slice_lesion['size_mm2']
        slice_thickness_mm = voxel_spacing[2]
        slice_volume_mm3 = slice_area_mm2 * slice_thickness_mm
        total_volume_mm3 += slice_volume_mm3
    
    return total_volume_mm3

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': '3D Lesion Tracker',
        'device': str(device),
        'model_loaded': model is not None
    })

@app.route('/track-3d', methods=['POST'])
def track_3d_lesions():
    """
    Track lesions across all slices in a 3D volume
    """
    try:
        initialize_model()
        
        # Get image data
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        patient_id = request.form.get('patient_id', 'unknown')
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        try:
            # Load NIfTI file
            nii = nib.load(tmp_path)
            image_data = nii.get_fdata()
            voxel_spacing = nii.header.get_zooms()
            
            print(f"Processing 3D volume: {image_data.shape}")
            print(f"Voxel spacing: {voxel_spacing}")
            
            # Process all slices
            all_lesions = []
            num_slices = image_data.shape[2] if len(image_data.shape) == 3 else 1
            
            for slice_idx in range(num_slices):
                if len(image_data.shape) == 3:
                    slice_data = image_data[:, :, slice_idx]
                else:
                    slice_data = image_data
                
                # Process slice
                mask = process_slice(slice_data)
                
                # Extract lesions
                lesions = extract_lesions_from_mask(mask, slice_idx, voxel_spacing)
                all_lesions.extend(lesions)
            
            print(f"Found {len(all_lesions)} lesions across {num_slices} slices")
            
            # Match lesions across slices to form 3D lesions
            lesions_3d = match_lesions_across_slices(all_lesions)
            
            print(f"Matched into {len(lesions_3d)} 3D lesions")
            
            # Calculate 3D volumes
            for lesion_3d in lesions_3d:
                volume_mm3 = calculate_3d_volume(lesion_3d, voxel_spacing)
                lesion_3d['volume_mm3'] = volume_mm3
                lesion_3d['volume_ml'] = volume_mm3 / 1000.0
                lesion_3d['num_slices'] = len(lesion_3d['slices'])
                
                # Calculate average intensity
                intensities = [s['intensity'] for s in lesion_3d['slices']]
                lesion_3d['avg_intensity'] = np.mean(intensities)
                
                # Overall severity
                lesion_3d['severity'] = classify_severity(
                    lesion_3d['volume_mm3'] / lesion_3d['num_slices'],
                    lesion_3d['avg_intensity']
                )
            
            # Sort by volume
            lesions_3d.sort(key=lambda x: x['volume_mm3'], reverse=True)
            
            # Calculate statistics
            total_lesion_volume_mm3 = sum(l['volume_mm3'] for l in lesions_3d)
            total_lesion_volume_ml = total_lesion_volume_mm3 / 1000.0
            
            # Generate report
            report = generate_3d_report(lesions_3d, total_lesion_volume_mm3, num_slices)
            
            # Save for longitudinal analysis
            save_longitudinal_data(patient_id, {
                'timestamp': datetime.now().isoformat(),
                'num_lesions': len(lesions_3d),
                'total_volume_mm3': total_lesion_volume_mm3,
                'total_volume_ml': total_lesion_volume_ml,
                'lesions': lesions_3d
            })
            
            return jsonify({
                'success': True,
                'num_lesions_3d': len(lesions_3d),
                'num_slices_processed': num_slices,
                'total_lesion_volume_mm3': total_lesion_volume_mm3,
                'total_lesion_volume_ml': total_lesion_volume_ml,
                'lesions_3d': lesions_3d[:20],  # Top 20
                'report': report,
                'voxel_spacing': list(voxel_spacing),
                'model': '3D Lesion Tracker with UNet'
            })
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def generate_3d_report(lesions_3d, total_volume_mm3, num_slices):
    """Generate clinical report for 3D lesion analysis"""
    num_lesions = len(lesions_3d)
    
    if num_lesions == 0:
        return {
            'summary': 'No lesions detected in 3D volume.',
            'impression': 'Normal appearance across all slices.',
            'recommendations': []
        }
    
    # Count by severity
    severe_count = sum(1 for l in lesions_3d if 'severe' in l['severity'])
    moderate_count = sum(1 for l in lesions_3d if 'moderate' in l['severity'])
    large_count = sum(1 for l in lesions_3d if 'large' in l['severity'])
    
    # Calculate lesion load
    lesion_load_percentage = (total_volume_mm3 / (256 * 256 * num_slices)) * 100
    
    summary = f"Detected {num_lesions} three-dimensional lesion(s) across {num_slices} slices. "
    summary += f"Total lesion load: {total_volume_mm3:.1f} mm³ ({total_volume_mm3/1000:.2f} ml). "
    
    impression = ""
    if severe_count > 0:
        impression += f"{severe_count} severe lesion(s) requiring immediate attention. "
    if moderate_count > 0:
        impression += f"{moderate_count} moderate lesion(s) present. "
    if large_count > 0:
        impression += f"{large_count} large lesion(s) detected. "
    
    if num_lesions > 10:
        impression += "Multiple scattered lesions suggest possible demyelinating disease (e.g., Multiple Sclerosis). "
    elif num_lesions > 3:
        impression += "Several lesions present. "
    
    impression += f"Lesion load: {lesion_load_percentage:.2f}% of total brain volume."
    
    recommendations = [
        "Clinical correlation recommended",
        "Consider follow-up MRI in 3-6 months",
        "Neurological consultation if symptomatic"
    ]
    
    if severe_count > 0:
        recommendations.insert(0, "Urgent neurological evaluation recommended")
    
    return {
        'summary': summary,
        'impression': impression,
        'recommendations': recommendations,
        'lesion_load_percentage': lesion_load_percentage
    }

def save_longitudinal_data(patient_id, data):
    """Save analysis data for longitudinal tracking"""
    patient_dir = os.path.join(LONGITUDINAL_DATA_DIR, patient_id)
    os.makedirs(patient_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(patient_dir, f"analysis_{timestamp}.json")
    
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"Saved longitudinal data: {filename}")

@app.route('/longitudinal/<patient_id>', methods=['GET'])
def get_longitudinal_data(patient_id):
    """Get longitudinal analysis for a patient"""
    try:
        patient_dir = os.path.join(LONGITUDINAL_DATA_DIR, patient_id)
        
        if not os.path.exists(patient_dir):
            return jsonify({'error': 'No data found for patient'}), 404
        
        # Load all analyses
        analyses = []
        for filename in sorted(os.listdir(patient_dir)):
            if filename.endswith('.json'):
                with open(os.path.join(patient_dir, filename), 'r') as f:
                    analyses.append(json.load(f))
        
        if not analyses:
            return jsonify({'error': 'No analyses found'}), 404
        
        # Calculate trends
        timestamps = [a['timestamp'] for a in analyses]
        lesion_counts = [a['num_lesions'] for a in analyses]
        volumes_ml = [a['total_volume_ml'] for a in analyses]
        
        # Calculate changes
        if len(analyses) >= 2:
            latest = analyses[-1]
            previous = analyses[-2]
            
            lesion_change = latest['num_lesions'] - previous['num_lesions']
            volume_change_ml = latest['total_volume_ml'] - previous['total_volume_ml']
            volume_change_percent = (volume_change_ml / previous['total_volume_ml'] * 100) if previous['total_volume_ml'] > 0 else 0
            
            trend = {
                'lesion_change': lesion_change,
                'volume_change_ml': volume_change_ml,
                'volume_change_percent': volume_change_percent,
                'status': 'stable' if abs(volume_change_percent) < 10 else ('improving' if volume_change_ml < 0 else 'worsening')
            }
        else:
            trend = None
        
        # Generate longitudinal report
        report = generate_longitudinal_report(analyses, trend)
        
        return jsonify({
            'success': True,
            'patient_id': patient_id,
            'num_analyses': len(analyses),
            'timestamps': timestamps,
            'lesion_counts': lesion_counts,
            'volumes_ml': volumes_ml,
            'trend': trend,
            'report': report,
            'latest_analysis': analyses[-1]
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def generate_longitudinal_report(analyses, trend):
    """Generate longitudinal analysis report"""
    num_timepoints = len(analyses)
    
    if num_timepoints == 1:
        return {
            'summary': 'Baseline analysis completed. No prior data for comparison.',
            'recommendation': 'Establish follow-up schedule for longitudinal monitoring.'
        }
    
    first = analyses[0]
    latest = analyses[-1]
    
    summary = f"Longitudinal analysis over {num_timepoints} timepoints. "
    
    if trend:
        if trend['status'] == 'stable':
            summary += "Disease appears stable with minimal change in lesion load. "
        elif trend['status'] == 'improving':
            summary += f"Improvement noted: lesion volume decreased by {abs(trend['volume_change_ml']):.2f} ml ({abs(trend['volume_change_percent']):.1f}%). "
        else:
            summary += f"Progression detected: lesion volume increased by {trend['volume_change_ml']:.2f} ml ({trend['volume_change_percent']:.1f}%). "
    
    recommendation = "Continue regular monitoring. "
    if trend and trend['status'] == 'worsening':
        recommendation += "Consider treatment adjustment or intensification."
    
    return {
        'summary': summary,
        'recommendation': recommendation,
        'baseline_date': first['timestamp'],
        'latest_date': latest['timestamp']
    }

@app.route('/info', methods=['GET'])
def get_info():
    """Get service information"""
    return jsonify({
        'service': '3D Lesion Tracker',
        'version': '1.0.0',
        'description': 'Multi-slice lesion tracking and longitudinal analysis',
        'capabilities': [
            '3D volume processing',
            'Multi-slice lesion detection',
            'Lesion matching across slices',
            '3D volume calculation',
            'Longitudinal tracking',
            'Progression analysis',
            'Clinical report generation'
        ],
        'device': str(device),
        'cuda_available': torch.cuda.is_available()
    })

if __name__ == '__main__':
    print("=" * 60)
    print("3D Lesion Tracker Service")
    print("=" * 60)
    print(f"Device: {device}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print("=" * 60)
    
    # Initialize model on startup
    initialize_model()
    
    # Run server
    port = int(os.environ.get('LESION_TRACKER_PORT', 5004))
    print(f"\nStarting server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
