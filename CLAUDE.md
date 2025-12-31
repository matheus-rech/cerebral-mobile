# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CEREBRAL Mobile is a React Native/Expo application for brain MRI analysis, featuring 4 ML segmentation models (UNet, MedSAM2, SAM3, SynthSeg), 3D NiiVue viewer, DICOM support, and HuggingFace dataset integration. Built for radiologists and neurology clinicians.

## Commands

```bash
# Development - starts both Node.js server and Expo Metro
pnpm dev

# Run only the Expo app (web)
pnpm dev:metro

# Run only the Node.js backend server
pnpm dev:server

# Type checking
pnpm check

# Run all tests
pnpm test

# Run a single test file
npx vitest run tests/specific-test.test.ts

# Run tests in watch mode
npx vitest

# Linting
pnpm lint

# Format code
pnpm format

# Build server for production
pnpm build

# Database migrations (Drizzle)
pnpm db:push
```

### ML Backend (Python)

```bash
cd ml-backend
pip install -r requirements.txt
python3 test_monai.py  # Verify installation

# Download SAM pretrained weights (~358 MB) - required for MedSAM2 and SAM3
python3 download_weights.py

# Start individual services (each on different ports)
python3 synthseg_service.py     # Port 5002 (SynthSeg - 32 brain structures)
python3 unet_lesion_detector.py # Port 5003 (UNet - lesion detection)
python3 lesion_tracker_3d.py    # Port 5004 (3D tracking)
python3 medsam2_service.py      # Port 5005 (MedSAM2)
python3 sam3_service.py         # Port 5006 (SAM3)
```

**Legacy files (deprecated):** `cerebral_system.py`, `cerebral_synthseg.py`, `monai_segmentation.py`

## Architecture

### Three-Tier Stack

```
Mobile/Web App (Expo) → Node.js Server (port 3000) → Python ML Services (ports 5001-5006)
```

### Key Directories

- `app/` - Expo Router screens (file-based routing)
  - `(tabs)/` - Tab navigation screens (Home, Datasets, History, Settings)
  - `analysis.tsx`, `segmentation.tsx`, `viewer-3d.tsx` - Analysis screens
- `components/` - Reusable React components
  - `niivue-viewer.tsx` - 3D brain volume viewer (NiiVue integration)
  - `mri-comparison-view.tsx` - Side-by-side result comparison
  - `dicom-file-picker.tsx` - DICOM file handling
- `server/` - Node.js Express + tRPC backend
  - `routes/ml-proxy.ts` - Proxies requests to Python ML services
  - `_core/` - Framework utilities (auth, cookies, trpc, oauth)
  - `routers.ts` - tRPC router definitions
- `services/` - Client-side service layer
  - `segmentation.ts` - ML model API calls
  - `async-processing.ts` - Background job handling with progress tracking
  - `huggingface.ts` - HuggingFace dataset integration
  - `dicom-parser.ts` - DICOM file parsing and metadata extraction
  - `agreement-heatmap.ts` - Model comparison heatmaps
- `ml-backend/` - Python Flask services for ML inference
- `types/` - TypeScript type definitions
  - `model-config.ts` - ML model configuration types
  - `mri.ts` - MRI analysis result types
- `drizzle/` - Database schema (MySQL with Drizzle ORM)
  - `schema.ts` - Tables: users, studies, analyses, segmentations
  - `relations.ts` - Drizzle ORM relations between tables

### ML Models

| Model | Port | Use Case | Parameters |
|-------|------|----------|------------|
| UNet | 5003 | Lesion detection, tumors | 7.7M |
| MedSAM2 | 5005 | Interactive segmentation with prompts | 89M |
| SAM3 | 5006 | Text/point/box-based segmentation | 636M |
| SynthSeg | 5002 | 32-structure brain parcellation | 18M |

### Data Flow

1. Client calls `services/segmentation.ts` functions
2. Node.js proxy (`server/routes/ml-proxy.ts`) forwards to Python
3. Python service processes with PyTorch/MONAI, returns JSON with base64 overlays
4. Results displayed in React Native components

### Path Aliases

- `@/*` - Root directory
- `@shared/*` - Shared code between client/server

### Testing

Tests use Vitest with mocked React Native modules. Test setup in `tests/setup.ts` mocks AsyncStorage, expo-haptics, expo-image, and expo-router.

- Unit tests: `tests/` and `__tests__/`
- Current coverage: 378 tests

### Environment Variables

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000  # Node.js server
SYNTHSEG_URL=http://localhost:5002
MONAI_URL=http://localhost:5001
UNET_URL=http://localhost:5003
MEDSAM2_URL=http://localhost:5005
SAM3_URL=http://localhost:5006
```

### Database Schema

```text
users (id, openId, name, email, role, timestamps)
  └── studies (id, userId, name, modality, imageUri, dicomMetadata, status, deletedAt)
        └── analyses (id, studyId, modelType, resultJson, confidence, inferenceTimeMs, status, deletedAt)
              └── segmentations (id, analysisId, maskUri, maskType, areaPixels, volumeMm3, deletedAt)

audit_logs (id, tableName, recordId, action, userId, oldValues, newValues, ipAddress, userAgent)
```

Soft deletes: `studies`, `analyses`, and `segmentations` support soft delete via `deletedAt`.

### Key Patterns

- **tRPC + React Query**: Type-safe API layer (`lib/trpc.ts`, `server/_core/trpc.ts`)
- **NativeWind**: TailwindCSS for React Native styling
- **Gesture Handler**: For touch interactions in viewers
- **Base64 image exchange**: ML services receive/return base64-encoded images
- **API proxy for ML**: Frontend calls `/api/ml/*` → Node.js proxy → Python services
- **HIPAA audit logging**: All data changes tracked in `audit_logs` table

### Debugging ML Services

To test individual ML services without the full stack:
```bash
# Terminal 1: Start a specific ML service
cd ml-backend && python3 unet_lesion_detector.py

# Terminal 2: Test with curl
curl -X POST -F "file=@test_brain.nii.gz" http://localhost:5003/detect
curl http://localhost:5003/health
```
