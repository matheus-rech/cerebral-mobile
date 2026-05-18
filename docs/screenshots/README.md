# CEREBRAL UI Screenshots

Visual documentation of the CEREBRAL neuroimaging segmentation app.
Captured at 2x device pixel ratio for retina-quality docs.

| Viewport | Width × Height |
|----------|----------------|
| Mobile (iPhone 14 Pro) | 390 × 844 |
| Desktop | 1440 × 900 |

> **What changed in v2:** Fixed image path (`/samples/...` not `/public/samples/...`) and added wait-for-hydration logic so client-side routes render before screenshots. All UI screens now show real loaded images from Wikimedia Commons.

## 🖼️ Application Screens

### 1. Home Screen
The landing page with quick access to import, 3D viewer, model comparison, and test samples.

| Mobile | Desktop |
|--------|---------|
| ![Home mobile](./01-home-mobile.png) | ![Home desktop](./01-home-desktop.png) |

### 2. Datasets
Browse and load MRI samples from HuggingFace datasets.

| Mobile | Desktop |
|--------|---------|
| ![Datasets mobile](./02-datasets-mobile.png) | ![Datasets desktop](./02-datasets-desktop.png) |

### 3. History
View previously saved analyses.

| Mobile | Desktop |
|--------|---------|
| ![History mobile](./03-history-mobile.png) | ![History desktop](./03-history-desktop.png) |

### 4. ML Settings ✅ (Now Rendering)
Configure ML backend (Local Models vs NeuroSAM3 Cloud), image modality, overlay colormap, transparency, and edge detection.

| Mobile | Desktop |
|--------|---------|
| ![ML Settings mobile](./04-ml-settings-mobile.png) | ![ML Settings desktop](./04-ml-settings-desktop.png) |

### 5. Analysis — NeuroUSG (Brain Ultrasound) 🩻
Using real **Germinal Matrix Hemorrhage** cranial ultrasound from Wikimedia Commons.

| Mobile | Desktop |
|--------|---------|
| ![NeuroUSG mobile](./05-analysis-neurousg-mobile.png) | ![NeuroUSG desktop](./05-analysis-neurousg-desktop.png) |

### 6. Analysis — NeuroMRI (T1-Gd) 🧠
Using real **Pediatric Glioblastoma T1-Gd MRI** (15yo patient) from Wikimedia Commons.

| Mobile | Desktop |
|--------|---------|
| ![NeuroMRI mobile](./06-analysis-neuromri-mobile.png) | ![NeuroMRI desktop](./06-analysis-neuromri-desktop.png) |

### 7. Analysis — UNet (Lesion Detection)
Hyperintense lesion detection with severity classification.

| Mobile | Desktop |
|--------|---------|
| ![UNet mobile](./07-analysis-unet-mobile.png) | ![UNet desktop](./07-analysis-unet-desktop.png) |

### 8. Analysis — SynthSeg (Brain Volumetrics)
32-structure FreeSurfer-compatible brain volume analysis.

| Mobile | Desktop |
|--------|---------|
| ![SynthSeg mobile](./08-analysis-synthseg-mobile.png) | ![SynthSeg desktop](./08-analysis-synthseg-desktop.png) |

### 9. Interactive Segmentation — MedSAM2
Point/box-prompted segmentation for precise region selection.

| Mobile | Desktop |
|--------|---------|
| ![MedSAM2 mobile](./09-interactive-medsam2-mobile.png) | ![MedSAM2 desktop](./09-interactive-medsam2-desktop.png) |

### 10. Model Comparison
Side-by-side comparison of all ML model outputs on the same image.

| Mobile | Desktop |
|--------|---------|
| ![Comparison mobile](./10-model-comparison-mobile.png) | ![Comparison desktop](./10-model-comparison-desktop.png) |

---

## 🧠 Neuroimaging Segmentation Output (Sample Test Image)

### A. NeuroUSG — Brain Ultrasound Segmentation
![NeuroUSG report](./A3-neurousg-report.png)

### B. MRI T1-Gd Segmentation
![MRI T1-Gd report](./B3-mri-t1gd-report.png)

### C. MRI FLAIR Segmentation
![MRI FLAIR report](./C1-mri-flair-report.png)

---

## 🔬 Real-Image Test Gallery

For tests against 8 real public-domain medical images from Wikimedia Commons,
see [docs/real-image-tests/README.md](../real-image-tests/README.md).

**Quick stats:** 8/8 succeeded, 9 total critical findings detected, ~88ms avg inference.

---

## 🔬 Severity Color Reference

| Color | Severity | Clinical Meaning |
|-------|----------|------------------|
| 🔴 Red `#EF4444` | **CRITICAL** | Life-threatening, urgent action required |
| 🟠 Orange `#F97316` | **URGENT** | Prompt attention within 24–48 hours |
| 🟡 Yellow `#EAB308` | **SIGNIFICANT** | Follow-up imaging recommended |
| 🟢 Green `#22C55E` | **ROUTINE** | Normal finding, routine monitoring |

## 🔄 Regenerating Screenshots

```bash
# Prerequisites: Expo (8081) and neuroimaging service (5010) running
npm run dev:metro                            # Expo Web on :8081
python3 ml-backend/neuroimaging_service.py   # Flask API on :5010

# Capture all assets:
node scripts/capture-screenshots.js          # UI screens (20 images)
node scripts/capture-segmentation-output.js  # Sample reports (8 images)
node scripts/test-real-images.js             # Real-image gallery
```
