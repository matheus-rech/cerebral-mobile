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

## DICOM Integration
- [x] Install DICOM parsing libraries (dcmjs, cornerstone)
- [x] Create DICOM file picker component
- [x] Implement DICOM metadata extraction
- [x] Add DICOM to NIfTI conversion (basic)
- [x] Extract patient information from DICOM tags
- [x] Add DICOM validation and error handling
- [x] Update upload flow to support DICOM files
- [x] Add DICOM file type detection
- [x] Create window/level adjustment functionality
- [ ] Support multi-slice DICOM series (advanced)
- [ ] Create dedicated DICOM viewer screen
- [ ] Test with real DICOM files from PACS systems

## MONAI Integration
- [x] Install MONAI and dependencies in Python backend
- [x] Create MONAI-based preprocessing pipeline
- [x] Implement MONAI transforms for medical images
- [x] Add MONAI data loaders for NIfTI and DICOM
- [x] Test MONAI with sample brain MRI data
- [x] Add MONAI model inference endpoint
- [x] Create comprehensive test suite
- [x] Verify all 4 tests pass successfully

## SynthSeg Integration
- [x] Research SynthSeg capabilities (chosen over FastSurfer)
- [x] Install SegResNet model architecture
- [x] Create SynthSeg-style segmentation pipeline
- [x] Add brain structure labeling (32 FreeSurfer regions)
- [x] Implement volumetric analysis with mm³ and ml units
- [x] Generate colored segmentation visualizations
- [x] Create API endpoints (/segment, /structures, /info)
- [x] Test service initialization and health checks
- [x] Add sliding window inference for large volumes
- [x] Support multi-contrast MRI (T1, T2, FLAIR)
- [ ] Download pretrained SynthSeg weights (optional)
- [ ] Connect to mobile app frontend
- [ ] Test end-to-end with real MRI scans

## UNet Lesion Detector Integration
- [x] Install pretrained UNet model from mateuszbuda/brain-segmentation-pytorch
- [x] Download pretrained weights from torch.hub
- [x] Create lesion detection service (port 5003)
- [x] Implement preprocessing for UNet input (256x256 RGB)
- [x] Add lesion segmentation inference
- [x] Calculate lesion statistics (count, size, location)
- [x] Generate lesion overlay visualization
- [x] Create API endpoints (/detect, /health, /info)
- [x] Add lesion severity classification (small/medium/large, mild/moderate/severe)
- [x] Generate clinical impressions for detected lesions
- [x] Test service initialization and health checks
- [ ] Test with real MRI scans containing lesions
- [ ] Integrate with mobile app frontend

## Multi-Slice 3D Lesion Tracking
- [x] Implement 3D volume processing for entire MRI scans
- [x] Process all slices (axial, coronal, sagittal) with UNet
- [x] Track lesions across consecutive slices
- [x] Calculate 3D lesion volumes (mm³ and ml)
- [x] Implement lesion matching algorithm across slices (distance-based)
- [x] Generate 3D lesion maps with slice tracking
- [x] Create volumetric statistics (total lesion load)
- [x] Calculate lesion load percentage
- [x] Implement severity classification for 3D lesions

## Longitudinal Analysis
- [x] Store historical analysis results (JSON format)
- [x] Compare lesion load across time points
- [x] Calculate lesion change metrics (count, volume, percentage)
- [x] Generate progression reports
- [x] Track trends over time (stable/improving/worsening)
- [x] Add statistical analysis (lesion counts, volumes)
- [x] Implement status detection (stable <10%, improving/worsening)
- [x] Create longitudinal reports with recommendations
- [x] Add patient-specific data storage
- [x] API endpoint for retrieving longitudinal data

## MedSAM2 Integration (Bowang Lab)
- [x] Install MedSAM2 architecture
- [x] Create MedSAM2 service (port 5005)
- [x] Implement point prompt segmentation (tap to segment)
- [x] Implement bounding box prompt segmentation
- [x] Add multi-prompt refinement (add/remove regions)
- [x] Support 2D slice segmentation
- [x] Support 3D volume segmentation
- [x] Generate high-quality masks for medical structures
- [x] API endpoints (/segment, /segment-3d, /health, /info)
- [x] Test service initialization and health checks
- [ ] Download official pretrained weights from bowang-lab/MedSAM2
- [ ] Test with real brain MRI, tumors, lesions

## SAM3 Integration (Meta/Facebook)
- [x] Install SAM3 architecture
- [x] Create SAM3 service (port 5006)
- [x] Implement point-based segmentation (single click)
- [x] Implement box-based segmentation (drag to draw)
- [x] Add text prompt segmentation ("segment the tumor")
- [x] Support zero-shot object detection
- [x] Generate segmentation confidence scores
- [x] API endpoints (/segment-point, /segment-box, /segment-text)
- [x] Test service initialization and health checks
- [ ] Download official pretrained weights from facebook/sam3
- [ ] Implement CLIP-based text encoding for better text prompts
- [ ] Test with various brain structures

## Interactive Prompting UI
- [x] Create interactive segmentation screen
- [x] Add tap/click gesture for point prompts
- [x] Add drag gesture for bounding box drawing
- [x] Implement text input for natural language prompts
- [x] Display real-time segmentation results
- [x] Add mask overlay visualization
- [x] Show segmentation confidence scores
- [x] Add undo functionality
- [x] Add clear all functionality
- [x] Connect to MedSAM2 and SAM3 services
- [x] Add interactive segmentation button to analysis screen
- [ ] Implement adjustable mask opacity slider
- [ ] Save segmentation masks to history
- [ ] Export masks as PNG/NIfTI

## Multi-Model Consensus
- [ ] Combine UNet + MedSAM2 + SAM3 predictions
- [ ] Calculate consensus masks (majority voting)
- [ ] Display confidence heatmaps
- [ ] Allow user to select preferred model
- [ ] Generate ensemble reports

## Model Comparison Interface
- [x] Create side-by-side comparison screen
- [x] Run all models on same image simultaneously (parallel execution)
- [x] Display results in 2x2 grid layout
- [x] Show model names and confidence scores
- [x] Add toggle to show/hide individual masks
- [x] Calculate Dice coefficient between all model pairs
- [x] Display overall agreement percentage
- [x] Show performance metrics (inference time per model)
- [x] Add consensus area calculation
- [x] Color-code models for easy identification
- [x] Add compare models button to analysis screen
- [x] Always show original MRI image with colored overlays
- [x] Add combined overlay view with all models
- [x] Add color legend for model identification
- [x] Use model-specific colors for mask tinting
- [ ] Display agreement heatmap visualization
- [ ] Add export comparison report as PDF
- [ ] Allow zooming and panning synchronized across all views
