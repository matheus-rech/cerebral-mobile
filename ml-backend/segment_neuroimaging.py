"""
Neuroimaging Segmentation Module
Zero-shot and few-shot segmentation for brain USG and MRI

Author: Matheus Rech, MD
Version: 1.0.0
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class Modality(Enum):
    USG = "ultrasound"
    T1_GD = "t1_gadolinium"
    T2 = "t2_weighted"
    FLAIR = "flair"


@dataclass
class SegmentationResult:
    """Container for segmentation results"""
    masks: Dict[str, np.ndarray]
    overlay: np.ndarray
    contours: Dict[str, List]
    metadata: Dict
    

# Standard color palette
COLORS = {
    'tumor': (255, 80, 80),         # Red
    'ventricles': (0, 150, 255),    # Blue
    'csf': (0, 150, 255),           # Blue (alias)
    'parenchyma': (100, 200, 100),  # Green
    'cortex': (100, 200, 100),      # Green (alias)
    'edema': (100, 150, 255),       # Light blue
    'enhancement': (255, 200, 0),   # Yellow
    'necrotic': (255, 50, 50),      # Dark red
    'hemorrhage': (200, 50, 100),   # Maroon
    'calcification': (255, 255, 200), # Light yellow
}


# Default thresholds by modality
THRESHOLDS = {
    Modality.USG: {
        'tumor': (160, 255),
        'csf': (0, 40),
        'parenchyma': (50, 150),
        'hemorrhage_acute': (140, 255),
        'edema': (40, 80),
    },
    Modality.T1_GD: {
        'enhancement': (170, 255),
        'necrotic': (0, 45),
        'edema': (45, 85),
        'csf': (0, 35),
        'parenchyma': (85, 165),
    },
    Modality.T2: {
        'csf': (180, 255),
        'edema': (150, 200),
        'parenchyma': (80, 150),
    },
    Modality.FLAIR: {
        'edema': (160, 255),
        'parenchyma': (80, 150),
        'csf': (0, 50),
    },
}


def preprocess_image(image_path: str) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Load and preprocess image for segmentation.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Tuple of (original_rgb, grayscale, blurred)
    """
    img = cv2.imread(image_path)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    return img_rgb, gray, blurred


def create_roi_mask(blurred: np.ndarray, threshold: int = 15) -> np.ndarray:
    """
    Create ROI mask to exclude background.
    
    Args:
        blurred: Blurred grayscale image
        threshold: Minimum intensity to consider as foreground
        
    Returns:
        Binary mask of the region of interest
    """
    _, roi = cv2.threshold(blurred, threshold, 255, cv2.THRESH_BINARY)
    kernel = np.ones((10, 10), np.uint8)
    roi = cv2.morphologyEx(roi, cv2.MORPH_CLOSE, kernel, iterations=3)
    return roi


def apply_threshold(
    blurred: np.ndarray,
    roi_mask: np.ndarray,
    low: int,
    high: int,
    invert: bool = False
) -> np.ndarray:
    """
    Apply threshold to create a binary mask.
    
    Args:
        blurred: Blurred grayscale image
        roi_mask: ROI mask to apply
        low: Lower threshold
        high: Upper threshold
        invert: If True, use inverted threshold
        
    Returns:
        Binary mask
    """
    if invert:
        _, mask = cv2.threshold(blurred, low, 255, cv2.THRESH_BINARY_INV)
    else:
        mask = cv2.inRange(blurred, low, high)
    
    mask = cv2.bitwise_and(mask, roi_mask)
    return mask


def morphological_cleanup(
    mask: np.ndarray,
    kernel_size: int = 5,
    close_iter: int = 2,
    open_iter: int = 2
) -> np.ndarray:
    """
    Apply morphological operations to clean up mask.
    
    Args:
        mask: Binary mask
        kernel_size: Size of morphological kernel
        close_iter: Number of closing iterations
        open_iter: Number of opening iterations
        
    Returns:
        Cleaned mask
    """
    kernel = np.ones((kernel_size, kernel_size), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=close_iter)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=open_iter)
    return mask


def filter_by_area(mask: np.ndarray, min_area: int = 300) -> np.ndarray:
    """
    Filter mask to remove small regions.
    
    Args:
        mask: Binary mask
        min_area: Minimum contour area to keep
        
    Returns:
        Filtered mask
    """
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filtered = np.zeros_like(mask)
    for cnt in contours:
        if cv2.contourArea(cnt) > min_area:
            cv2.drawContours(filtered, [cnt], -1, 255, -1)
    return filtered


def segment_neurousg(
    image_path: str,
    structures: List[str] = ['tumor', 'csf', 'parenchyma'],
    thresholds: Optional[Dict] = None
) -> SegmentationResult:
    """
    Segment brain ultrasound image.
    
    Args:
        image_path: Path to the ultrasound image
        structures: List of structures to segment
        thresholds: Optional custom thresholds
        
    Returns:
        SegmentationResult with masks, overlay, and metadata
    """
    # Load and preprocess
    img_rgb, gray, blurred = preprocess_image(image_path)
    roi_mask = create_roi_mask(blurred)
    
    # Get thresholds
    thresh = thresholds or THRESHOLDS[Modality.USG]
    
    masks = {}
    
    # Segment each structure
    if 'tumor' in structures:
        low, high = thresh.get('tumor', (160, 255))
        mask = apply_threshold(blurred, roi_mask, low, high)
        mask = morphological_cleanup(mask, close_iter=3, open_iter=2)
        masks['tumor'] = filter_by_area(mask, min_area=500)
    
    if 'csf' in structures or 'ventricles' in structures:
        low, high = thresh.get('csf', (0, 40))
        mask = apply_threshold(blurred, roi_mask, low, 255, invert=True)
        mask = morphological_cleanup(mask)
        masks['ventricles'] = filter_by_area(mask, min_area=300)
    
    if 'parenchyma' in structures or 'cortex' in structures:
        low, high = thresh.get('parenchyma', (50, 150))
        mask = apply_threshold(blurred, roi_mask, low, high)
        # Exclude other structures
        for key in ['tumor', 'ventricles']:
            if key in masks:
                mask = cv2.bitwise_and(mask, cv2.bitwise_not(masks[key]))
        mask = morphological_cleanup(mask)
        masks['parenchyma'] = mask
    
    # Create overlay
    overlay = create_overlay(img_rgb, masks)
    
    # Get contours
    contours = {}
    for name, mask in masks.items():
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours[name] = [cnt.tolist() for cnt in cnts if cv2.contourArea(cnt) > 200]
    
    # Metadata
    metadata = {
        'modality': 'USG',
        'structures_found': list(masks.keys()),
        'thresholds_used': thresh,
        'image_shape': img_rgb.shape,
    }
    
    return SegmentationResult(
        masks=masks,
        overlay=overlay,
        contours=contours,
        metadata=metadata
    )


def segment_mri_t1gd(
    image_path: str,
    structures: List[str] = ['enhancement', 'necrotic', 'edema', 'csf', 'parenchyma'],
    thresholds: Optional[Dict] = None,
    panel_rois: Optional[List[Tuple]] = None
) -> SegmentationResult:
    """
    Segment T1 post-gadolinium MRI.
    
    Args:
        image_path: Path to the MRI image
        structures: List of structures to segment
        thresholds: Optional custom thresholds
        panel_rois: Optional list of (x1, y1, x2, y2) ROIs for multi-panel images
        
    Returns:
        SegmentationResult with masks, overlay, and metadata
    """
    # Load and preprocess
    img_rgb, gray, blurred = preprocess_image(image_path)
    
    # Get thresholds
    thresh = thresholds or THRESHOLDS[Modality.T1_GD]
    
    if panel_rois:
        # Process each panel separately
        masks = {s: np.zeros_like(gray) for s in structures}
        
        for (x1, y1, x2, y2) in panel_rois:
            panel = blurred[y1:y2, x1:x2]
            panel_masks = _segment_mri_panel(panel, structures, thresh)
            
            for name, mask in panel_masks.items():
                masks[name][y1:y2, x1:x2] = mask
    else:
        roi_mask = create_roi_mask(blurred)
        masks = _segment_mri_panel(blurred, structures, thresh, roi_mask)
    
    # Create overlay
    overlay = create_overlay(img_rgb, masks)
    
    # Get contours
    contours = {}
    for name, mask in masks.items():
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours[name] = [cnt.tolist() for cnt in cnts if cv2.contourArea(cnt) > 50]
    
    # Metadata
    metadata = {
        'modality': 'T1_GD',
        'structures_found': list(masks.keys()),
        'thresholds_used': thresh,
        'image_shape': img_rgb.shape,
        'panel_rois': panel_rois,
    }
    
    return SegmentationResult(
        masks=masks,
        overlay=overlay,
        contours=contours,
        metadata=metadata
    )


def _segment_mri_panel(
    blurred: np.ndarray,
    structures: List[str],
    thresh: Dict,
    roi_mask: Optional[np.ndarray] = None
) -> Dict[str, np.ndarray]:
    """Segment a single MRI panel."""
    if roi_mask is None:
        roi_mask = np.ones_like(blurred) * 255
    
    masks = {}
    kernel = np.ones((3, 3), np.uint8)
    
    if 'enhancement' in structures:
        low, high = thresh.get('enhancement', (170, 255))
        mask = apply_threshold(blurred, roi_mask, low, high)
        mask = morphological_cleanup(mask, close_iter=2, open_iter=1)
        masks['enhancement'] = mask
    
    if 'necrotic' in structures:
        low, high = thresh.get('necrotic', (0, 45))
        mask = apply_threshold(blurred, roi_mask, low, 255, invert=True)
        # Keep only near enhancement
        if 'enhancement' in masks:
            dilated = cv2.dilate(masks['enhancement'], kernel, iterations=12)
            mask = cv2.bitwise_and(mask, dilated)
        mask = morphological_cleanup(mask)
        masks['necrotic'] = mask
    
    if 'edema' in structures:
        low, high = thresh.get('edema', (45, 85))
        mask = apply_threshold(blurred, roi_mask, low, high)
        # Keep only near tumor
        if 'enhancement' in masks:
            dilated = cv2.dilate(masks['enhancement'], kernel, iterations=20)
            mask = cv2.bitwise_and(mask, dilated)
            # Exclude tumor core
            tumor_core = cv2.bitwise_or(
                masks.get('enhancement', np.zeros_like(mask)),
                masks.get('necrotic', np.zeros_like(mask))
            )
            mask = cv2.bitwise_and(mask, cv2.bitwise_not(tumor_core))
        mask = morphological_cleanup(mask, kernel_size=5)
        masks['edema'] = mask
    
    if 'csf' in structures:
        low, high = thresh.get('csf', (0, 35))
        mask = apply_threshold(blurred, roi_mask, low, 255, invert=True)
        # Exclude areas near tumor
        if 'enhancement' in masks:
            dilated = cv2.dilate(masks['enhancement'], kernel, iterations=20)
            mask = cv2.bitwise_and(mask, cv2.bitwise_not(dilated))
        mask = morphological_cleanup(mask)
        masks['csf'] = filter_by_area(mask, min_area=100)
    
    if 'parenchyma' in structures:
        low, high = thresh.get('parenchyma', (85, 165))
        mask = apply_threshold(blurred, roi_mask, low, high)
        # Exclude other structures
        all_other = np.zeros_like(mask)
        for key in ['enhancement', 'necrotic', 'edema', 'csf']:
            if key in masks:
                all_other = cv2.bitwise_or(all_other, masks[key])
        mask = cv2.bitwise_and(mask, cv2.bitwise_not(all_other))
        mask = morphological_cleanup(mask)
        masks['parenchyma'] = mask
    
    return masks


def create_overlay(
    img_rgb: np.ndarray,
    masks: Dict[str, np.ndarray],
    alpha: float = 0.45,
    draw_contours: bool = True
) -> np.ndarray:
    """
    Create colored overlay visualization.
    
    Args:
        img_rgb: Original RGB image
        masks: Dictionary of structure masks
        alpha: Transparency for overlay
        draw_contours: Whether to draw contours
        
    Returns:
        RGB overlay image
    """
    overlay = img_rgb.copy()
    
    # Apply colors (order matters - later ones on top)
    order = ['parenchyma', 'csf', 'ventricles', 'edema', 'necrotic', 'enhancement', 'tumor']
    
    for name in order:
        if name in masks:
            color = COLORS.get(name, (200, 200, 200))
            overlay[masks[name] > 0] = color
    
    # Blend with original
    any_mask = np.zeros(masks[list(masks.keys())[0]].shape, dtype=np.uint8)
    for mask in masks.values():
        any_mask = cv2.bitwise_or(any_mask, mask)
    
    result = img_rgb.copy()
    for c in range(3):
        result[:, :, c] = np.where(
            any_mask > 0,
            (alpha * overlay[:, :, c] + (1 - alpha) * img_rgb[:, :, c]).astype(np.uint8),
            img_rgb[:, :, c]
        )
    
    # Draw contours
    if draw_contours:
        for name, mask in masks.items():
            color = COLORS.get(name, (200, 200, 200))
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                if cv2.contourArea(cnt) > 100:
                    cv2.drawContours(result, [cnt], -1, color, 2)
    
    return result


def add_annotations(
    image: np.ndarray,
    masks: Dict[str, np.ndarray],
    title: str = "Segmentation"
) -> np.ndarray:
    """
    Add title, legend, and labels to the image.
    
    Args:
        image: RGB image (numpy array)
        masks: Dictionary of structure masks
        title: Title text
        
    Returns:
        Annotated image
    """
    pil_img = Image.fromarray(image)
    draw = ImageDraw.Draw(pil_img)
    height, width = image.shape[:2]
    
    # Try to load fonts
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
        font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except:
        font_title = ImageFont.load_default()
        font_label = font_title
    
    # Title
    draw.text((width // 2 - 80, 10), title, fill=(255, 255, 255), font=font_title)
    
    # Legend
    legend_x, legend_y = 15, height - 30 * len(masks) - 20
    box_height = 30 * len(masks) + 15
    
    draw.rectangle(
        [(legend_x, legend_y), (legend_x + 160, legend_y + box_height)],
        fill=(0, 0, 0, 180),
        outline=(150, 150, 150)
    )
    
    y = legend_y + 10
    for name in masks.keys():
        color = COLORS.get(name, (200, 200, 200))
        draw.rectangle([(legend_x + 10, y), (legend_x + 28, y + 16)], fill=color, outline=(200, 200, 200))
        label = name.replace('_', ' ').title()
        draw.text((legend_x + 35, y - 2), label, fill=(255, 255, 255), font=font_label)
        y += 25
    
    return np.array(pil_img)


def create_comparison(
    original: np.ndarray,
    segmented: np.ndarray,
    title: str = "Original vs Segmentation"
) -> np.ndarray:
    """
    Create side-by-side comparison image.
    
    Args:
        original: Original RGB image
        segmented: Segmented/annotated image
        title: Title text
        
    Returns:
        Comparison image
    """
    height, width = original.shape[:2]
    gap = 20
    
    # Create canvas
    comp_width = width * 2 + gap
    comp_height = height + 60
    comparison = np.zeros((comp_height, comp_width, 3), dtype=np.uint8)
    comparison[:, :] = (25, 25, 30)
    
    # Place images
    comparison[55:55 + height, 0:width] = original
    comparison[55:55 + height, width + gap:] = segmented
    
    # Add text
    pil_comp = Image.fromarray(comparison)
    draw = ImageDraw.Draw(pil_comp)
    
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    except:
        font = ImageFont.load_default()
    
    draw.text((width // 2 - 30, 20), "Original", fill=(200, 200, 200), font=font)
    draw.text((width + gap + width // 2 - 50, 20), "Segmentation", fill=(200, 200, 200), font=font)
    draw.text((comp_width // 2 - 100, 2), title, fill=(255, 255, 255), font=font)
    
    return np.array(pil_comp)


def learn_thresholds_from_examples(
    images: List[np.ndarray],
    masks: List[Dict[str, np.ndarray]]
) -> Dict[str, Tuple[int, int]]:
    """
    Learn optimal thresholds from annotated examples.
    
    Args:
        images: List of grayscale images
        masks: List of dictionaries with ground truth masks
        
    Returns:
        Dictionary of structure name -> (low, high) thresholds
    """
    structure_intensities = {}
    
    for img, mask_dict in zip(images, masks):
        for name, mask in mask_dict.items():
            if name not in structure_intensities:
                structure_intensities[name] = []
            intensities = img[mask > 0].flatten()
            structure_intensities[name].extend(intensities.tolist())
    
    thresholds = {}
    for name, intensities in structure_intensities.items():
        if len(intensities) > 0:
            low = int(np.percentile(intensities, 5))
            high = int(np.percentile(intensities, 95))
            thresholds[name] = (low, high)
    
    return thresholds


def segment_with_points(
    image: np.ndarray,
    foreground_points: List[Tuple[int, int]],
    background_points: Optional[List[Tuple[int, int]]] = None,
    expansion_factor: float = 1.5
) -> np.ndarray:
    """
    Segment using point prompts (SAM-style).
    
    Args:
        image: Grayscale image
        foreground_points: List of (x, y) points marking foreground
        background_points: Optional list of (x, y) points marking background
        expansion_factor: How much to expand the intensity range
        
    Returns:
        Binary mask
    """
    # Sample intensities at foreground points
    fg_intensities = [image[y, x] for x, y in foreground_points]
    
    # Calculate threshold range
    center = np.mean(fg_intensities)
    spread = np.std(fg_intensities) * expansion_factor
    
    low = max(0, int(center - spread * 2))
    high = min(255, int(center + spread * 2))
    
    # Create initial mask
    mask = cv2.inRange(image, low, high)
    
    # If background points provided, exclude those regions
    if background_points:
        bg_intensities = [image[y, x] for x, y in background_points]
        for bg_val in bg_intensities:
            if low <= bg_val <= high:
                # Adjust range to exclude background
                if bg_val < center:
                    low = bg_val + 1
                else:
                    high = bg_val - 1
        mask = cv2.inRange(image, low, high)
    
    # Cleanup
    mask = morphological_cleanup(mask)
    
    return mask


# Main function for easy use
def segment_brain_image(
    image_path: str,
    modality: str = 'USG',
    structures: Optional[List[str]] = None,
    output_path: Optional[str] = None
) -> SegmentationResult:
    """
    Main entry point for brain image segmentation.
    
    Args:
        image_path: Path to input image
        modality: 'USG', 'T1_GD', 'T2', or 'FLAIR'
        structures: Optional list of structures to segment
        output_path: Optional path to save result
        
    Returns:
        SegmentationResult
    """
    modality_enum = Modality[modality.upper()]
    
    if structures is None:
        if modality_enum == Modality.USG:
            structures = ['tumor', 'csf', 'parenchyma']
        elif modality_enum == Modality.T1_GD:
            structures = ['enhancement', 'necrotic', 'edema', 'csf', 'parenchyma']
        else:
            structures = ['parenchyma', 'csf']
    
    if modality_enum == Modality.USG:
        result = segment_neurousg(image_path, structures)
    elif modality_enum == Modality.T1_GD:
        result = segment_mri_t1gd(image_path, structures)
    else:
        # Generic segmentation for other modalities
        result = segment_neurousg(image_path, structures, THRESHOLDS.get(modality_enum, {}))
    
    # Add annotations
    annotated = add_annotations(result.overlay, result.masks, f"{modality} Segmentation")
    result.overlay = annotated
    
    # Save if output path provided
    if output_path:
        img_rgb, _, _ = preprocess_image(image_path)
        comparison = create_comparison(img_rgb, annotated, f"{modality} - Brain Segmentation")
        Image.fromarray(comparison).save(output_path)
        print(f"✓ Saved: {output_path}")
    
    return result


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python segment_neuroimaging.py <image_path> [modality] [output_path]")
        print("  modality: USG, T1_GD, T2, FLAIR (default: USG)")
        sys.exit(1)
    
    image_path = sys.argv[1]
    modality = sys.argv[2] if len(sys.argv) > 2 else 'USG'
    output_path = sys.argv[3] if len(sys.argv) > 3 else image_path.replace('.', '_segmented.')
    
    result = segment_brain_image(image_path, modality, output_path=output_path)
    print(f"Structures found: {result.metadata['structures_found']}")
