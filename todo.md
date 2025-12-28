# CEREBRAL Mobile - TODO

## Core Features
- [x] Home screen with quick action cards
- [x] MRI image viewer with zoom and pan gestures
- [x] Load MRI samples from HuggingFace datasets
- [x] Upload custom MRI images from device
- [x] Claude Vision API integration for MRI analysis (mock implementation)
- [x] Structured analysis report display
- [x] Anatomical findings table with status indicators
- [ ] Image segmentation with overlay visualization
- [ ] Segmentation statistics and metrics
- [x] Analysis history with local storage
- [ ] Export analysis reports as PDF
- [x] Share functionality for reports and images
- [x] Dataset browser with available HuggingFace datasets
- [x] Settings screen for app configuration
- [x] Dark mode support
- [x] App branding with custom logo and icon

## HuggingFace Integration
- [x] MRI dataset retrieval service
- [x] Dataset browser UI
- [x] Random sample loading
- [x] Dataset metadata display
- [ ] Cache management for downloaded samples

## Analysis Features
- [x] Modality detection (T1, T2, FLAIR)
- [x] View detection (Axial, Coronal, Sagittal)
- [x] Anatomical structure analysis
- [x] Quality score calculation
- [x] Symmetry analysis
- [x] Hyperintense region detection
- [x] Differential diagnosis generation
- [x] Clinical recommendations

## Segmentation Features
- [x] Segmentation service (backend-ready)
- [x] Tumor/lesion detection
- [x] Segmentation overlay rendering
- [x] Opacity control slider
- [x] Region statistics calculation
- [x] Color-coded region visualization

## UI/UX Enhancements
- [x] Loading states and skeleton screens
- [x] Error handling and user feedback
- [x] Haptic feedback for interactions
- [x] Pull-to-refresh on lists
- [ ] Swipe actions on history items
- [x] Image zoom and pan gestures
- [x] Smooth transitions and animations

## Data Management
- [x] Local storage for analysis history
- [x] Settings persistence
- [ ] Image caching
- [ ] Export to device storage
- [x] Delete history items

## Deep Learning Backend (Python)
- [x] Set up Python backend service structure
- [x] Install dependencies (torch, nibabel, scipy, FreeSurfer)
- [x] Integrate SynthSeg (FreeSurfer pretrained model) - PRIORITY
- [x] Create API endpoint for SynthSeg brain segmentation
- [x] Add image preprocessing pipeline for MRI
- [x] Implement volumetric analysis and reporting
- [ ] Integrate pretrained UNet lesion detector (optional)
- [ ] Integrate MONAI BraTS tumor segmentation (optional)
- [ ] Add model caching and optimization
- [x] Connect mobile app to Python ML backend
- [ ] Test end-to-end deep learning pipeline

## 3D Visualization (NiiVue)
- [x] Install @niivue/niivue package
- [x] Create 3D viewer component with WebGL support
- [x] Add MRI volume rendering
- [x] Implement segmentation overlay in 3D
- [x] Add interactive controls (rotate, zoom, pan)
- [x] Implement slice navigation (axial, coronal, sagittal)
- [x] Add colormap selection for different contrasts
- [x] Create 3D view screen in navigation
- [x] Add crosshair and coordinate display
- [x] Integrate with analysis workflow
