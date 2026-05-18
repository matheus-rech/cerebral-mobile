# CEREBRAL UI Screenshots

Visual documentation of the CEREBRAL neuroimaging segmentation app.
Captured at 2x device pixel ratio for retina-quality docs.

| Viewport | Width × Height |
|----------|----------------|
| Mobile (iPhone 14 Pro) | 390 × 844 |
| Desktop | 1440 × 900 |

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

### 4. ML Settings
Configure ML backend service URLs and check service health.

| Mobile | Desktop |
|--------|---------|
| ![ML Settings mobile](./04-ml-settings-mobile.png) | ![ML Settings desktop](./04-ml-settings-desktop.png) |

### 5. Analysis — NeuroUSG (Brain Ultrasound)
Tumor, ventricle, and parenchyma segmentation from brain ultrasound images.

| Mobile | Desktop |
|--------|---------|
| ![NeuroUSG mobile](./05-analysis-neurousg-mobile.png) | ![NeuroUSG desktop](./05-analysis-neurousg-desktop.png) |

### 6. Analysis — NeuroMRI (T1-Gd / T2 / FLAIR)
Enhancement, necrosis, edema, CSF, and parenchyma segmentation.

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

## 🧠 Neuroimaging Segmentation Output

Real results from the production neuroimaging service (port 5010).

### A. NeuroUSG — Brain Ultrasound Segmentation
3 structures detected · 1 critical finding (large tumor 18.5%)

![NeuroUSG report](./A3-neurousg-report.png)

| Annotated Overlay | Side-by-Side Comparison |
|-------------------|-------------------------|
| ![Overlay](./A1-neurousg-overlay.png) | ![Comparison](./A2-neurousg-comparison.png) |

### B. MRI T1-Gd Segmentation
5 structures detected · 3 critical findings (enhancement, edema, mass effect risk)

![MRI T1-Gd report](./B3-mri-t1gd-report.png)

| Annotated Overlay | Side-by-Side Comparison |
|-------------------|-------------------------|
| ![Overlay](./B1-mri-t1gd-overlay.png) | ![Comparison](./B2-mri-t1gd-comparison.png) |

### C. MRI FLAIR Segmentation
Edema and parenchyma analysis — no critical findings on test sample

![MRI FLAIR report](./C1-mri-flair-report.png)

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
# Make sure Expo (8081) and neuroimaging service (5010) are running
npm run dev

# In another terminal:
node scripts/capture-screenshots.js          # UI screens (20 images)
node scripts/capture-segmentation-output.js  # Segmentation reports (8 images)
```
