# Research: Public Brain MRI Datasets for Testing

## Key Datasets Found

### 1. BraTS (Brain Tumor Segmentation Challenge)
- **URL:** https://www.med.upenn.edu/cbica/brats2020/data.html
- **Kaggle:** https://www.kaggle.com/datasets/awsaf49/brats2020-training-data
- **Description:** Multi-institutional pre-operative MRI scans with ground truth labels by expert neuroradiologists
- **Modalities:** T1, T1c (contrast-enhanced), T2, T2-FLAIR
- **Size:** 484+ subjects (BraTS 2015), 6,970+ scans (various years)
- **Ground Truth:** Manual segmentation by board-certified neuroradiologists
- **Use Case:** Brain tumor and lesion detection validation

### 2. BrainMetShare (Stanford AIMI)
- **URL:** https://aimi.stanford.edu/datasets/brainmetshare
- **Description:** Brain MRI dataset for brain metastases detection and segmentation
- **Size:** 156 whole brain MRI studies
- **Sequences:** Pre- and post-contrast, multi-modal high-resolution
- **Ground Truth:** Expert annotations for metastases
- **Use Case:** Lesion detection and segmentation validation

### 3. OpenNeuro
- **URL:** https://openneuro.org/
- **Description:** Free and open platform for BIDS-compliant neuroimaging data
- **Size:** 67,274 participants, 1,572 public datasets
- **Modalities:** MRI, PET, MEG, EEG, iEEG
- **Use Case:** General brain structure analysis

### 4. fastMRI (NYU)
- **URL:** https://fastmri.med.nyu.edu/
- **Description:** Large-scale brain MRI dataset
- **Size:** 6,970 fully sampled brain MRIs
- **Scanners:** 3T and 1.5T magnets
- **Sequences:** Axial T1, T2, FLAIR
- **Use Case:** General MRI analysis and reconstruction

### 5. UCSF-PDGM (Cancer Imaging Archive)
- **URL:** https://www.cancerimagingarchive.net/collection/ucsf-pdgm/
- **Description:** Diffuse gliomas with histopathological proof
- **Size:** 501 subjects
- **Scanner:** 3 Tesla standardized protocol
- **Ground Truth:** Histopathologically-proven diagnoses
- **Use Case:** Glioma detection and classification

## Recommended Dataset for Testing: BraTS 2020

**Reasons:**
1. ✅ Publicly available on Kaggle (easy download)
2. ✅ Ground truth segmentation by expert radiologists
3. ✅ Multiple MRI modalities (T1, T2, FLAIR)
4. ✅ Well-documented and widely used benchmark
5. ✅ Suitable for all our models (UNet, MedSAM2, SAM3, SynthSeg)

**Download Steps:**
```bash
# Install Kaggle API
pip install kaggle

# Download BraTS 2020 dataset
kaggle datasets download -d awsaf49/brats2020-training-data

# Extract
unzip brats2020-training-data.zip -d /home/ubuntu/test-data/brats2020
```

## Next Steps
1. Download sample from BraTS 2020 dataset
2. Test each ML model with real MRI images
3. Compare segmentation results with ground truth
4. Calculate accuracy metrics (Dice score, IoU)
5. Document performance improvements
