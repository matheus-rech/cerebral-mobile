# CEREBRAL ML Backend

Python-based deep learning backend for brain MRI analysis using SynthSeg and other pretrained models.

## Features

- **SynthSeg Integration**: FreeSurfer's robust brain segmentation
  - Segments 32+ brain structures
  - Works on any MRI contrast (T1, T2, FLAIR)
  - No training required
  - Volumetric analysis

- **Extensible Architecture**: Ready for additional models
  - UNet lesion detector
  - MONAI BraTS tumor segmentation
  - Custom models

## Installation

### 1. Install Python Dependencies

```bash
cd ml-backend
pip install -r requirements.txt
```

### 2. Install SynthSeg (Optional but Recommended)

**Option A: Install FreeSurfer** (includes SynthSeg)
```bash
# Download FreeSurfer from https://surfer.nmr.mgh.harvard.edu/
# Follow installation instructions for your platform
```

**Option B: Standalone SynthSeg**
```bash
pip install SynthSeg
```

### 3. Start the ML Backend

```bash
python cerebral_synthseg.py
```

The server will start on port 5000 by default.

## API Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "synthseg_available": true,
  "backend": "cerebral-ml"
}
```

### Brain Segmentation
```bash
POST /segment
Content-Type: application/json

{
  "image": "base64_encoded_image_data"
}
```

Response:
```json
{
  "modality": "T1-weighted",
  "view": "3D Volumetric",
  "anatomical_findings": [
    {
      "structure": "Left Hippocampus",
      "observation": "Normal volume (3800 mm³)",
      "status": "normal",
      "confidence": 0.92,
      "volume_mm3": 3800.0
    }
  ],
  "brain_regions": [
    {
      "label": "Left Cerebral Cortex",
      "volume_mm3": 245000.0,
      "percentage": 18.5,
      "status": "normal"
    }
  ],
  "impression": "Normal brain structure volumes...",
  "differential": [],
  "recommendations": ["Routine clinical follow-up..."],
  "quality_score": 0.94,
  "total_brain_volume": 1325000.0
}
```

## Architecture

### SynthSeg Analyzer
- Segments brain into 32+ anatomical regions
- Calculates volumetric measurements
- Detects abnormalities (atrophy, enlargement)
- Generates structured clinical reports

### Fallback Mode
If SynthSeg is not installed, the backend uses realistic mock segmentation data for development and testing.

## Integration with Mobile App

The mobile app connects to this backend via the Node.js server proxy:

```typescript
// Mobile app calls Node.js API
fetch(`${API_URL}/api/analyze-mri-ml`, {
  method: 'POST',
  body: JSON.stringify({ imageUri })
})

// Node.js proxies to Python ML backend
fetch('http://localhost:5000/segment', {
  method: 'POST',
  body: JSON.stringify({ image: base64Data })
})
```

## Future Enhancements

- [ ] Add UNet lesion detector
- [ ] Integrate MONAI BraTS model
- [ ] Implement FastSurfer for faster processing
- [ ] Add SUIT cerebellar atlas
- [ ] GPU acceleration
- [ ] Batch processing
- [ ] Result caching

## References

- [SynthSeg Paper](https://arxiv.org/abs/2107.09559)
- [FreeSurfer](https://surfer.nmr.mgh.harvard.edu/)
- [MONAI](https://monai.io/)
