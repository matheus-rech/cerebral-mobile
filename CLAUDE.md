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

# Create and activate virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download SAM pretrained weights (~358 MB) - required for MedSAM2 and SAM3
python3 download_weights.py

# Start the Unified ML Gateway (recommended - single command)
python3 start_gateway.py              # Default port 5000
python3 start_gateway.py --port 5010  # Custom port (if 5000 is in use)
```

**Gateway features:**
- Single FastAPI service replacing 5 legacy Flask services
- Health monitoring: `curl http://localhost:5000/health`
- Auto-retry on timeout/crash with configurable timeouts
- Hybrid loading: UNet + SynthSeg eager-loaded at startup, MedSAM2 + SAM3 lazy-loaded on first request
- Self-contained model wrappers with automatic weight downloads via torch.hub
- MCP tools for AI agent integration

**Model wrappers (`ml-backend/gateway/models/`):**
- Each model is self-contained with its own inference logic
- Weights downloaded automatically from torch.hub or HuggingFace
- No external service dependencies

**Legacy services (deprecated):** The following individual service files have been replaced by the gateway and should be deleted:
- `synthseg_service.py`, `unet_lesion_detector.py`, `lesion_tracker_3d.py`
- `medsam2_service.py`, `sam3_service.py`, `cerebral_synthseg.py`, `medsam2_official.py`

## Architecture

### Three-Tier Stack

```
Mobile/Web App (Expo) → Node.js Server (port 3000) → Unified ML Gateway (port 5000)
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
- `ml-backend/` - Unified ML Gateway (FastAPI)
  - `gateway/` - Gateway application code
  - `gateway/models/` - Model wrappers (unet, synthseg, medsam2, sam3)
  - `start_gateway.py` - Single entry point
- `types/` - TypeScript type definitions
  - `model-config.ts` - ML model configuration types
  - `mri.ts` - MRI analysis result types
- `drizzle/` - Database schema (MySQL with Drizzle ORM)
  - `schema.ts` - Tables: users, studies, analyses, segmentations
  - `relations.ts` - Drizzle ORM relations between tables

### ML Models (via Gateway port 5000)

| Model | Endpoint | Use Case | Loading | Parameters |
|-------|----------|----------|---------|------------|
| UNet | `/api/ml/unet/detect` | Lesion detection, tumors | Eager | 7.7M |
| SynthSeg | `/api/ml/synthseg/segment` | 32-structure brain parcellation | Eager | 18M |
| MedSAM2 | `/api/ml/medsam2/segment` | Interactive segmentation with prompts | Lazy | 89M |
| SAM3 | `/api/ml/sam3/segment` | Text/point/box-based segmentation | Lazy | 636M |

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
- Current coverage: **407 tests** (as of 2025-12-31)

```bash
# Run all tests
pnpm test

# Run tests with coverage
npx vitest run --coverage

# Test ML Gateway directly
curl -X POST -F "file=@ml-backend/test_data/sample_brain.nii.gz" http://localhost:5000/api/ml/unet/detect
```

### Environment Variables

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000  # Node.js server
ML_GATEWAY_URL=http://localhost:5000       # Unified ML Gateway
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

### Debugging ML Gateway

```bash
# Start the gateway
cd ml-backend && python3 start_gateway.py

# Check health and model status
curl http://localhost:5000/health

# Test lesion detection
curl -X POST -F "file=@test_brain.nii.gz" http://localhost:5000/api/ml/unet/detect

# Test brain segmentation
curl -X POST -F "file=@test_brain.nii.gz" http://localhost:5000/api/ml/synthseg/segment

# Pre-load a model (optional warm-up)
curl -X POST http://localhost:5000/models/sam3/load
```

### MCP Tools (for AI agents)

The gateway exposes MCP tools for agent integration:
- `ml_detect_lesions` - UNet lesion detection
- `ml_segment_brain` - SynthSeg parcellation
- `ml_segment_interactive` - MedSAM2 with prompts
- `ml_segment_text` - SAM3 with text prompt
- `ml_health_check` - Gateway status

### Troubleshooting

**Port 5000 in use (macOS):**
```bash
# AirPlay Receiver uses port 5000 on macOS - use alternative port
python3 start_gateway.py --port 5010
# Update ML_GATEWAY_URL accordingly
```

**Missing Python dependencies:**
```bash
cd ml-backend
pip install torch torchvision nibabel scipy monai fastapi uvicorn python-multipart
```

**Gateway not responding:**
```bash
# Check health endpoint
curl http://localhost:5000/health

# Check if process is running
lsof -i :5000

# View gateway logs
python3 start_gateway.py  # Logs appear in terminal
```

**Expo bundler stuck at 0%:**
```bash
# Clear cache and restart
rm -rf .expo
npx expo start --clear
```
