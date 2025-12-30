/**
 * ML Backend Proxy Routes
 * Forwards requests to Python ML backend services
 */

import { Router } from 'express';

const router = Router();

// ML Backend service URLs - All services use unified mock backend on port 5003
const ML_BACKEND_URL = process.env.ML_BACKEND_URL || 'http://localhost:5003';
const SYNTHSEG_URL = process.env.SYNTHSEG_URL || ML_BACKEND_URL;
const MONAI_URL = process.env.MONAI_URL || ML_BACKEND_URL;
const UNET_URL = process.env.UNET_URL || ML_BACKEND_URL;
const LESION_3D_URL = process.env.LESION_3D_URL || ML_BACKEND_URL;
const MEDSAM2_URL = process.env.MEDSAM2_URL || ML_BACKEND_URL;
const SAM3_URL = process.env.SAM3_URL || ML_BACKEND_URL;

/**
 * Helper function to convert image URI to base64
 */
async function imageUriToBase64(imageUri: string): Promise<string> {
  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    // Fetch image from URL
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } else if (imageUri.startsWith('data:')) {
    // Extract base64 data from data URI
    const matches = imageUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid data URI format');
    }
    return matches[2];
  } else {
    throw new Error('Unsupported image URI format');
  }
}

/**
 * POST /api/ml/synthseg/segment
 * Brain structure segmentation using SynthSeg
 */
router.post('/ml/synthseg/segment', async (req, res) => {
  try {
    const { imageUri } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${SYNTHSEG_URL}/synthseg/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData }),
    });

    if (!response.ok) {
      throw new Error(`SynthSeg error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('SynthSeg proxy error:', error);
    res.status(500).json({
      error: 'SynthSeg segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ml/unet/detect
 * Lesion detection using pretrained UNet
 */
router.post('/ml/unet/detect', async (req, res) => {
  try {
    const { imageUri } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${UNET_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData }),
    });

    if (!response.ok) {
      throw new Error(`UNet error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('UNet proxy error:', error);
    res.status(500).json({
      error: 'UNet lesion detection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ml/medsam2/segment
 * Interactive segmentation using MedSAM2
 */
router.post('/ml/medsam2/segment', async (req, res) => {
  try {
    const { imageUri, prompts } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${MEDSAM2_URL}/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, prompts }),
    });

    if (!response.ok) {
      throw new Error(`MedSAM2 error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('MedSAM2 proxy error:', error);
    res.status(500).json({
      error: 'MedSAM2 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ml/sam3/segment-point
 * Point-based segmentation using SAM3
 */
router.post('/ml/sam3/segment-point', async (req, res) => {
  try {
    const { imageUri, point } = req.body;
    if (!imageUri || !point) {
      return res.status(400).json({ error: 'Image URI and point are required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${SAM3_URL}/segment-point`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, point }),
    });

    if (!response.ok) {
      throw new Error(`SAM3 error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('SAM3 proxy error:', error);
    res.status(500).json({
      error: 'SAM3 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ml/sam3/segment-box
 * Box-based segmentation using SAM3
 */
router.post('/ml/sam3/segment-box', async (req, res) => {
  try {
    const { imageUri, box } = req.body;
    if (!imageUri || !box) {
      return res.status(400).json({ error: 'Image URI and box are required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${SAM3_URL}/segment-box`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, box }),
    });

    if (!response.ok) {
      throw new Error(`SAM3 error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('SAM3 proxy error:', error);
    res.status(500).json({
      error: 'SAM3 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ml/sam3/segment-text
 * Text-based segmentation using SAM3
 */
router.post('/ml/sam3/segment-text', async (req, res) => {
  try {
    const { imageUri, text } = req.body;
    if (!imageUri || !text) {
      return res.status(400).json({ error: 'Image URI and text are required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${SAM3_URL}/segment-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, text }),
    });

    if (!response.ok) {
      throw new Error(`SAM3 error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('SAM3 proxy error:', error);
    res.status(500).json({
      error: 'SAM3 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ml/lesion-3d/track
 * 3D lesion tracking across slices
 */
router.post('/ml/lesion-3d/track', async (req, res) => {
  try {
    const { volumeUri, patientId } = req.body;
    if (!volumeUri) {
      return res.status(400).json({ error: 'Volume URI is required' });
    }

    const response = await fetch(`${LESION_3D_URL}/track-volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume_path: volumeUri, patient_id: patientId }),
    });

    if (!response.ok) {
      throw new Error(`3D Tracker error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('3D Tracker proxy error:', error);
    res.status(500).json({
      error: '3D lesion tracking failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ml/health
 * Check health of all ML backend services
 */
router.get('/ml/health', async (req, res) => {
  const services = [
    { name: 'SynthSeg', url: `${SYNTHSEG_URL}/health` },
    { name: 'MONAI', url: `${MONAI_URL}/health` },
    { name: 'UNet', url: `${UNET_URL}/health` },
    { name: 'Lesion3D', url: `${LESION_3D_URL}/health` },
    { name: 'MedSAM2', url: `${MEDSAM2_URL}/health` },
    { name: 'SAM3', url: `${SAM3_URL}/health` },
  ];

  const results = await Promise.allSettled(
    services.map(async (service) => {
      try {
        const response = await fetch(service.url, { signal: AbortSignal.timeout(2000) });
        const data = await response.json();
        return { name: service.name, status: 'healthy', ...data };
      } catch (error) {
        return {
          name: service.name,
          status: 'unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  const health = results.map((result, index) => ({
    service: services[index].name,
    ...(result.status === 'fulfilled' ? result.value : { status: 'error', error: result.reason }),
  }));

  const allHealthy = health.every((h) => h.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    overall: allHealthy ? 'healthy' : 'degraded',
    services: health,
    timestamp: new Date().toISOString(),
  });
});

export default router;
