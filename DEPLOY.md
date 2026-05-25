# CEREBRAL Deployment Guide

Deploy CEREBRAL neuroimaging segmentation app to production.

## Quick Start

```bash
# Build and deploy (requires API tokens)
./scripts/deploy.sh
```

## Deployment Options

### Option 1: Cloudflare Pages (Recommended)

1. **Create Cloudflare account** at https://dash.cloudflare.com/sign-up
2. **Create API token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Create token with "Cloudflare Pages: Edit" permission
3. **Deploy**:
   ```bash
   export CLOUDFLARE_API_TOKEN=your_token
   export CLOUDFLARE_ACCOUNT_ID=your_account_id
   wrangler pages deploy dist --project-name=cerebral
   ```

### Option 2: Netlify

1. **Create Netlify account** at https://app.netlify.com/signup
2. **Get auth token**:
   - Go to User Settings → Applications → New access token
3. **Deploy**:
   ```bash
   export NETLIFY_AUTH_TOKEN=your_token
   netlify deploy --prod --dir=dist
   ```

### Option 3: GitHub Actions (CI/CD)

Add these secrets to your GitHub repository:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Push to `main` branch to trigger automatic deployment.

## ML Backend Deployment

The neuroimaging ML service runs separately. Options:

### Cloud Run / Render / Railway

```bash
# Build Docker image
docker build -t cerebral-ml -f ml-backend/Dockerfile .

# Deploy to your preferred platform
```

### Self-hosted

```bash
# Install dependencies
pip install flask flask-cors opencv-python-headless numpy pillow

# Run service
python3 ml-backend/neuroimaging_service.py
# Listens on port 5010
```

### Configure Frontend

Set the `NEUROIMAGING_URL` environment variable to point to your ML backend:

```bash
# In .env or deployment settings
NEUROIMAGING_URL=https://your-ml-backend.com
```

## Architecture

```
┌──────────────────────────┐     ┌─────────────────────────┐
│    Cloudflare/Netlify    │     │   ML Backend (Flask)    │
│    ┌─────────────────┐   │     │   ┌─────────────────┐   │
│    │  Expo Web App   │───┼─────┼──▶│  Neuroimaging   │   │
│    │  (Static Files) │   │     │   │  Segmentation   │   │
│    └─────────────────┘   │     │   └─────────────────┘   │
└──────────────────────────┘     └─────────────────────────┘
```

## Verified Features

- ✅ 406 tests passing
- ✅ NeuroUSG brain ultrasound segmentation
- ✅ NeuroMRI T1-Gd, T2, FLAIR modalities
- ✅ UNet lesion detection
- ✅ SynthSeg brain volumetrics
- ✅ MedSAM2 interactive segmentation
- ✅ Model comparison view
- ✅ 3D NIfTI viewer
- ✅ HuggingFace/OpenNeuro dataset browser
- ✅ Critical finding detection with severity classification

## Test with Real Images

```bash
# Start services
python3 ml-backend/neuroimaging_service.py &
npx expo start --web

# Run end-to-end tests
node scripts/test-real-images.js
```

All 8 real medical images from Wikimedia Commons tested successfully.
