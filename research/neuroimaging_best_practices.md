# Neuroimaging Segmentation Best Practices Research

## 1. BIDS Apps (Brain Imaging Data Structure)

**Source:** https://github.com/fliem/bids_apps_intro

Key takeaways:
- BIDS Apps are portable neuroimaging pipelines that understand BIDS datasets
- They facilitate executing standard pipelines like FreeSurfer, fmriprep, cpac, mriqc
- Run on all major operating systems with minimal setup
- Docker containerization for reproducibility

**Best practices to adopt:**
- Standardized input/output formats
- Containerized services for portability
- Quality control metrics (MRIQC)

## 2. Brain MRI Classification with Deep Learning

**Source:** https://github.com/strikersps/Brain-MRI-Image-Classification-Using-Deep-Learning

Key takeaways:
- CNN models for brain tumor classification
- Data augmentation pipelines for robustness
- Region CNN (R-CNN) for tumor localization and labeling
- Binary map generation for tumor visualization

**Best practices to adopt:**
- Preprocessing pipeline for .mat files
- Binary map generation for segmentation visualization
- Data augmentation for model robustness

## 3. Real-Time Radiology AI with MCP Server

**Source:** https://landing.ai/developers/building-a-real-time-radiology-ai-system-with-pathway-and-landingai

Key takeaways:
- MCP (Model Context Protocol) server for AI integration
- Structured schema extraction from radiology reports
- Real-time document processing pipeline
- Critical findings detection and alerting

**Extraction Schema Structure:**
```python
extraction_schema = {
    "type": "object",
    "properties": {
        "patient_id": {"type": "string", "description": "Patient ID"},
        "study_type": {"type": "string", "description": "CT, MRI, X-ray, etc."},
        "findings": {"type": "string", "description": "Key radiological findings"},
        "impression": {"type": "string", "description": "Clinical interpretation"},
        "critical_findings": {"type": "string", "description": "Urgent findings"}
    }
}
```

**MCP Server Configuration:**
```yaml
mcp_server:
  name: "CriticalAlert AI MCP Server"
  transport: "streamable-http"
  host: "localhost"
  port: 8123
```

## 4. Implementation Plan for CEREBRAL

### Service Architecture
1. **Python ML Service** (port 5010) - Neuroimaging segmentation
   - NeuroUSG segmentation (tumor, ventricles, parenchyma)
   - MRI T1-Gd segmentation (enhancement, necrotic, edema)
   - MRI T2/FLAIR segmentation
   
2. **Node.js Proxy** - Route requests to ML service
   - /api/ml/neuroimaging/segment-usg
   - /api/ml/neuroimaging/segment-mri
   - /api/ml/neuroimaging/health

3. **Mobile App Frontend**
   - Real-time overlay visualization
   - Structure-specific color coding
   - Confidence scores display

### Color Coding Standard (from skill)
| Structure | RGB Color | Hex |
|-----------|-----------|-----|
| Tumor | (255, 80, 80) | #FF5050 |
| Ventricles/CSF | (0, 150, 255) | #0096FF |
| Parenchyma/Cortex | (100, 200, 100) | #64C864 |
| Edema | (100, 150, 255) | #6496FF |
| Enhancement (Gd) | (255, 200, 0) | #FFC800 |
| Necrotic center | (255, 50, 50) | #FF3232 |

### Threshold Ranges by Modality

**NeuroUSG:**
- Tumor (Hyperechoic): 160-255
- CSF/Ventricles (Anechoic): 0-40
- Parenchyma (Isoechoic): 50-150

**MRI T1-Gd:**
- Enhancement: 170-255
- Necrotic: 0-45
- Edema: 45-85
- CSF: 0-35
- Parenchyma: 85-165


## 5. RadiologyAI - Critical Finding Detection

**Source:** https://github.com/ishan121028/RadiologyAI

Key features:
- Real-time radiology document processing
- Critical finding detection with severity levels:
  - **RED**: Life-threatening (PE, hemorrhage, pneumothorax)
  - **ORANGE**: Urgent findings requiring prompt attention
  - **YELLOW**: Significant findings needing follow-up
  - **GREEN**: Routine findings
- MCP server integration for external access
- Structured medical data extraction

**MCP Tools exposed:**
- retrieve_query: Document retrieval
- statistics_query: System statistics
- inputs_query: Document listing
- search_patient_by_id: Patient search
- query_patient_extraction: Patient data extraction

## 6. PituitarySegmentationFullPipeline

**Source:** https://github.com/kvttt/PituitarySegmentationFullPipeline

Pipeline steps:
1. **Skull stripping** using FreeSurfer's mri_watershed
2. **N4 bias correction** using ANTs' N4BiasFieldCorrection
3. **Registration** of atlases to input image using antsRegistration
4. **Mask combination** with threshold for binary mask generation

**Best practices to adopt:**
- Preprocessing pipeline (skull stripping, bias correction)
- Multi-atlas registration approach
- Threshold-based mask generation
- Configurable parameters (threads, transform type)

## 7. Brain Tumor Segmentation and Classification

**Source:** https://github.com/connected-devices-lab/brain-tumor-segmentation

- Image processing algorithm for brain tumor segmentation
- Classification into Glioma, Meningioma, Pituitary tumor
- SLIC (Simple Linear Iterative Clustering) superpixel approach
- MATLAB implementation

## Implementation Summary

### Key Patterns to Implement:

1. **Preprocessing Pipeline**
   - Gaussian blur for noise reduction
   - ROI mask creation to exclude background
   - N4 bias correction (optional)

2. **Segmentation Approach**
   - Intensity-based thresholding (zero-shot)
   - Morphological cleanup (close, open operations)
   - Area filtering for noise removal
   - Structure-specific color coding

3. **Critical Finding Detection**
   - Severity classification (RED/ORANGE/YELLOW/GREEN)
   - Automatic alerting for urgent findings
   - Structured output format

4. **API Design**
   - RESTful endpoints for each modality
   - Health check endpoint
   - Structured JSON response with masks, overlay, metadata
   - Base64 encoded images for transport
