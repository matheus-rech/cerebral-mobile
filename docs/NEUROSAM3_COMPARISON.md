# NeuroSAM3 vs CEREBRAL Mobile - Feature Comparison

## Overview

This document compares the features of **NeuroSAM3** (HuggingFace Spaces app at `mmrech/NeuroSAM3`) with **CEREBRAL Mobile** to identify integration opportunities and feature gaps.

## NeuroSAM3 API Capabilities (23 MCP Tools)

### Core Segmentation Features
| Feature | NeuroSAM3 | CEREBRAL Mobile | Notes |
|---------|-----------|-----------------|-------|
| Text prompt segmentation | ✅ | ✅ | Both support natural language prompts |
| Point prompt segmentation | ✅ | ✅ | Click-to-segment functionality |
| Box prompt segmentation | ✅ | ✅ | Bounding box selection |
| Multi-mask candidates | ✅ | ❌ | Returns multiple mask options with confidence |
| Automatic Mask Generator (AMG) | ✅ | ❌ | Grid-based automatic segmentation |
| Edge-based segmentation | ✅ | ❌ | Sobel/Canny edge detection |

### Image Processing
| Feature | NeuroSAM3 | CEREBRAL Mobile | Notes |
|---------|-----------|-----------------|-------|
| DICOM support | ✅ | ✅ | Both handle DICOM files |
| NIfTI support | ✅ | ✅ | 3D volume support |
| CT windowing strategies | ✅ | ❌ | Brain, Bone, Lung, Soft Tissue presets |
| CLAHE preprocessing | ✅ | ❌ | Contrast enhancement |
| Brightness/Contrast controls | ✅ | ❌ | Real-time adjustment |
| Colormap selection | ✅ | ❌ | Multiple overlay color options |

### Multi-Slice/3D Features
| Feature | NeuroSAM3 | CEREBRAL Mobile | Notes |
|---------|-----------|-----------------|-------|
| Slice navigation | ✅ | ✅ | Both have slice sliders |
| Multi-slice processing | ✅ | ✅ | Process entire volumes |
| Slice auto-play | ✅ | ❌ | Animated slice playback |
| Subject/Patient detection | ✅ | ❌ | Auto-group files by patient |

### Export & Annotation
| Feature | NeuroSAM3 | CEREBRAL Mobile | Notes |
|---------|-----------|-----------------|-------|
| NIfTI mask export | ✅ | ✅ | Medical format export |
| PNG mask export | ✅ | ✅ | Standard image export |
| Annotation save/load | ✅ | ❌ | Persist and reload annotations |
| Batch ZIP export | ✅ | ❌ | Download multiple results |
| Ground truth comparison | ✅ | ❌ | Compare with reference masks |

### API & Integration
| Feature | NeuroSAM3 | CEREBRAL Mobile | Notes |
|---------|-----------|-----------------|-------|
| MCP Server | ✅ | ❌ | Model Context Protocol support |
| Gradio JavaScript client | ✅ | ❌ | @gradio/client integration |
| REST API | ✅ | ✅ | HTTP endpoints |
| Streamable HTTP | ✅ | ❌ | Real-time streaming |

## Key NeuroSAM3 Endpoints to Integrate

### 1. `/process_with_status` - Main Segmentation
```javascript
const result = await client.predict("/process_with_status", { 
  image_file: file,
  prompt_text: "brain tumor",
  modality: "MRI",  // or "CT"
  window_type: "Brain (Grey Matter)"
});
```

### 2. `/process_with_point_prompt` - Point-Based Segmentation
```javascript
const result = await client.predict("/process_with_point_prompt", { 
  image_file: file,
  point_x: 128,
  point_y: 128,
  modality: "MRI",
  window_type: "Brain (Grey Matter)",
  colormap: "jet",
  transparency: 0.5
});
```

### 3. `/automatic_mask_generator` - AMG
```javascript
const result = await client.predict("/automatic_mask_generator", { 
  image_file: file,
  modality: "MRI",
  window_type: "Brain (Grey Matter)",
  points_per_side: 32,
  min_mask_area: 100,
  colormap: "viridis"
});
```

### 4. `/process_with_ground_truth` - Validation
```javascript
const result = await client.predict("/process_with_ground_truth", { 
  image_file: file,
  gt_mask_file: groundTruthMask,
  prompt_text: "tumor",
  modality: "MRI",
  window_type: "Brain (Grey Matter)"
});
```

## MCP Server Configuration

NeuroSAM3 exposes an MCP server that can be added to MCP-compatible clients:

```json
{
  "mcpServers": {
    "neurosam3": {
      "url": "https://mmrech-neurosam3.hf.space/gradio_api/mcp/"
    }
  }
}
```

## Integration Strategy for CEREBRAL Mobile

### Phase 1: Add NeuroSAM3 as Cloud Backend
1. Install `@gradio/client` package
2. Create `services/neurosam3.ts` client wrapper
3. Add backend selector in Settings (Local ML vs NeuroSAM3 Cloud)
4. Route segmentation requests based on selected backend

### Phase 2: Add Missing Features
1. **CT Windowing**: Add dropdown for windowing presets
2. **Colormap Selection**: Add color picker for overlay colors
3. **AMG Mode**: Add "Auto Segment All" button
4. **Ground Truth Comparison**: Add validation workflow
5. **Annotation Persistence**: Save/load masks to AsyncStorage

### Phase 3: Hybrid Mode
- Use local models for quick inference
- Fall back to NeuroSAM3 for advanced features
- Compare results between local and cloud models

## Recommended Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| High | NeuroSAM3 API integration | Medium | Access to cloud GPU |
| High | CT windowing strategies | Low | Better CT visualization |
| Medium | Colormap selection | Low | UX improvement |
| Medium | AMG mode | Medium | New capability |
| Medium | Ground truth comparison | Medium | Validation workflow |
| Low | Batch ZIP export | Low | Convenience |
| Low | Slice auto-play | Low | Nice-to-have |

## Conclusion

NeuroSAM3 provides several advanced features that would enhance CEREBRAL Mobile:
- **Cloud GPU access** for faster inference on complex cases
- **CT windowing** for proper CT image visualization
- **Automatic Mask Generator** for hands-free segmentation
- **Ground truth validation** for clinical accuracy assessment

The recommended approach is to integrate NeuroSAM3 as an optional cloud backend while keeping local ML models for offline use and quick inference.
