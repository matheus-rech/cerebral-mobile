/**
 * ML Backend Proxy Routes
 * Forwards requests to the Unified ML Gateway on port 5000
 *
 * The gateway handles:
 * - Model lifecycle (load/unload)
 * - Retries and timeouts transparently
 * - Health monitoring
 * - Error handling with structured responses
 */

import { Router } from 'express';

const router = Router();

// Unified ML Gateway URL - All ML requests go through this single endpoint
const ML_GATEWAY_URL = process.env.ML_GATEWAY_URL || 'http://localhost:5000';

// Legacy neuroimaging service (not yet migrated to gateway)
const NEUROIMAGING_URL = process.env.NEUROIMAGING_URL || 'http://localhost:5010';

/**
 * Gateway error response format
 */
interface GatewayErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    model?: string;
    retriable: boolean;
    suggestion?: string;
  };
}

/**
 * Check if response is a gateway error
 */
function isGatewayError(data: unknown): data is GatewayErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    data.success === false &&
    'error' in data &&
    typeof (data as GatewayErrorResponse).error === 'object'
  );
}

/**
 * Transform gateway error to client-friendly format
 */
function transformGatewayError(gatewayError: GatewayErrorResponse): {
  error: string;
  message: string;
  code: string;
  retriable: boolean;
  suggestion?: string;
} {
  return {
    error: `${gatewayError.error.model || 'ML'} service error`,
    message: gatewayError.error.message,
    code: gatewayError.error.code,
    retriable: gatewayError.error.retriable,
    suggestion: gatewayError.error.suggestion,
  };
}

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
 * Routes to: ML Gateway /api/ml/synthseg/segment
 */
router.post('/ml/synthseg/segment', async (req, res) => {
  try {
    const { imageUri } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${ML_GATEWAY_URL}/api/ml/synthseg/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData }),
    });

    const result = await response.json();

    // Handle gateway error response format
    if (isGatewayError(result)) {
      const errorResponse = transformGatewayError(result);
      return res.status(response.status >= 400 ? response.status : 500).json(errorResponse);
    }

    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('SynthSeg proxy error:', error);
    res.status(500).json({
      error: 'SynthSeg segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROXY_ERROR',
      retriable: true,
    });
  }
});

/**
 * POST /api/ml/unet/detect
 * Lesion detection using pretrained UNet
 * Routes to: ML Gateway /api/ml/unet/detect
 */
router.post('/ml/unet/detect', async (req, res) => {
  try {
    const { imageUri } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${ML_GATEWAY_URL}/api/ml/unet/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData }),
    });

    const result = await response.json();

    // Handle gateway error response format
    if (isGatewayError(result)) {
      const errorResponse = transformGatewayError(result);
      return res.status(response.status >= 400 ? response.status : 500).json(errorResponse);
    }

    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('UNet proxy error:', error);
    res.status(500).json({
      error: 'UNet lesion detection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROXY_ERROR',
      retriable: true,
    });
  }
});

/**
 * POST /api/ml/medsam2/segment
 * Interactive segmentation using MedSAM2
 * Routes to: ML Gateway /api/ml/medsam2/segment
 */
router.post('/ml/medsam2/segment', async (req, res) => {
  try {
    const { imageUri, prompts } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${ML_GATEWAY_URL}/api/ml/medsam2/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, prompts }),
    });

    const result = await response.json();

    // Handle gateway error response format
    if (isGatewayError(result)) {
      const errorResponse = transformGatewayError(result);
      return res.status(response.status >= 400 ? response.status : 500).json(errorResponse);
    }

    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('MedSAM2 proxy error:', error);
    res.status(500).json({
      error: 'MedSAM2 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROXY_ERROR',
      retriable: true,
    });
  }
});

/**
 * POST /api/ml/sam3/segment-point
 * Point-based segmentation using SAM3
 * Routes to: ML Gateway /api/ml/sam3/segment (with prompt type)
 */
router.post('/ml/sam3/segment-point', async (req, res) => {
  try {
    const { imageUri, point } = req.body;
    if (!imageUri || !point) {
      return res.status(400).json({ error: 'Image URI and point are required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${ML_GATEWAY_URL}/api/ml/sam3/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, prompt_type: 'point', point }),
    });

    const result = await response.json();

    // Handle gateway error response format
    if (isGatewayError(result)) {
      const errorResponse = transformGatewayError(result);
      return res.status(response.status >= 400 ? response.status : 500).json(errorResponse);
    }

    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('SAM3 proxy error:', error);
    res.status(500).json({
      error: 'SAM3 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROXY_ERROR',
      retriable: true,
    });
  }
});

/**
 * POST /api/ml/sam3/segment-box
 * Box-based segmentation using SAM3
 * Routes to: ML Gateway /api/ml/sam3/segment (with prompt type)
 */
router.post('/ml/sam3/segment-box', async (req, res) => {
  try {
    const { imageUri, box } = req.body;
    if (!imageUri || !box) {
      return res.status(400).json({ error: 'Image URI and box are required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${ML_GATEWAY_URL}/api/ml/sam3/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, prompt_type: 'box', box }),
    });

    const result = await response.json();

    // Handle gateway error response format
    if (isGatewayError(result)) {
      const errorResponse = transformGatewayError(result);
      return res.status(response.status >= 400 ? response.status : 500).json(errorResponse);
    }

    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('SAM3 proxy error:', error);
    res.status(500).json({
      error: 'SAM3 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROXY_ERROR',
      retriable: true,
    });
  }
});

/**
 * POST /api/ml/sam3/segment-text
 * Text-based segmentation using SAM3
 * Routes to: ML Gateway /api/ml/sam3/segment (with prompt type)
 */
router.post('/ml/sam3/segment-text', async (req, res) => {
  try {
    const { imageUri, text } = req.body;
    if (!imageUri || !text) {
      return res.status(400).json({ error: 'Image URI and text are required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${ML_GATEWAY_URL}/api/ml/sam3/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, prompt_type: 'text', text }),
    });

    const result = await response.json();

    // Handle gateway error response format
    if (isGatewayError(result)) {
      const errorResponse = transformGatewayError(result);
      return res.status(response.status >= 400 ? response.status : 500).json(errorResponse);
    }

    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('SAM3 proxy error:', error);
    res.status(500).json({
      error: 'SAM3 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROXY_ERROR',
      retriable: true,
    });
  }
});

/**
 * POST /api/ml/neuroimaging/segment-usg
 * Brain ultrasound (neuroUSG) segmentation with critical finding detection
 */
router.post('/ml/neuroimaging/segment-usg', async (req, res) => {
  try {
    const { imageUri, structures } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${NEUROIMAGING_URL}/segment/usg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        image: imageData, 
        structures: structures || ['tumor', 'csf', 'parenchyma'] 
      }),
    });

    if (!response.ok) {
      throw new Error(`Neuroimaging error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Neuroimaging USG proxy error:', error);
    res.status(500).json({
      error: 'NeuroUSG segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ml/neuroimaging/segment-mri
 * MRI segmentation (T1-Gd, T2, FLAIR) with critical finding detection
 */
router.post('/ml/neuroimaging/segment-mri', async (req, res) => {
  try {
    const { imageUri, modality, structures } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${NEUROIMAGING_URL}/segment/mri`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        image: imageData, 
        modality: modality || 'T1_GD',
        structures 
      }),
    });

    if (!response.ok) {
      throw new Error(`Neuroimaging error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Neuroimaging MRI proxy error:', error);
    res.status(500).json({
      error: 'MRI segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ml/neuroimaging/segment-auto
 * Auto-detect modality and segment with critical finding detection
 */
router.post('/ml/neuroimaging/segment-auto', async (req, res) => {
  try {
    const { imageUri, hint } = req.body;
    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    const imageData = await imageUriToBase64(imageUri);

    const response = await fetch(`${NEUROIMAGING_URL}/segment/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, hint: hint || 'USG' }),
    });

    if (!response.ok) {
      throw new Error(`Neuroimaging error: ${await response.text()}`);
    }

    const result = await response.json();
    res.json({ ...result, imageUri, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Neuroimaging auto proxy error:', error);
    res.status(500).json({
      error: 'Auto segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ml/neuroimaging/colors
 * Get color palette for segmentation visualization
 */
router.get('/ml/neuroimaging/colors', async (req, res) => {
  try {
    const response = await fetch(`${NEUROIMAGING_URL}/colors`);
    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Neuroimaging colors error:', error);
    res.status(500).json({ error: 'Failed to get colors' });
  }
});

/**
 * GET /api/ml/neuroimaging/thresholds
 * Get default thresholds for each modality
 */
router.get('/ml/neuroimaging/thresholds', async (req, res) => {
  try {
    const response = await fetch(`${NEUROIMAGING_URL}/thresholds`);
    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Neuroimaging thresholds error:', error);
    res.status(500).json({ error: 'Failed to get thresholds' });
  }
});

/**
 * POST /api/ml/lesion-3d/track
 * 3D lesion tracking across slices
 * Routes to: ML Gateway /api/ml/lesion3d/track
 */
router.post('/ml/lesion-3d/track', async (req, res) => {
  try {
    const { volumeUri, patientId } = req.body;
    if (!volumeUri) {
      return res.status(400).json({ error: 'Volume URI is required' });
    }

    const response = await fetch(`${ML_GATEWAY_URL}/api/ml/lesion3d/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume_path: volumeUri, patient_id: patientId }),
    });

    const result = await response.json();

    // Handle gateway error response format
    if (isGatewayError(result)) {
      const errorResponse = transformGatewayError(result);
      return res.status(response.status >= 400 ? response.status : 500).json(errorResponse);
    }

    res.json({ ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('3D Tracker proxy error:', error);
    res.status(500).json({
      error: '3D lesion tracking failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROXY_ERROR',
      retriable: true,
    });
  }
});

/**
 * GET /api/ml/health
 * Check health of ML Gateway and all managed models
 * Routes to: ML Gateway /health
 */
router.get('/ml/health', async (req, res) => {
  try {
    // Check ML Gateway health
    const gatewayResponse = await fetch(`${ML_GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    const gatewayHealth = await gatewayResponse.json();

    // Check legacy Neuroimaging service (not yet migrated)
    let neuroimagingHealth = { status: 'unavailable' as const, error: 'Not checked' };
    try {
      const neuroimagingResponse = await fetch(`${NEUROIMAGING_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (neuroimagingResponse.ok) {
        const data = await neuroimagingResponse.json();
        neuroimagingHealth = { status: 'healthy' as const, ...data };
      }
    } catch {
      neuroimagingHealth = { status: 'unavailable' as const, error: 'Service not responding' };
    }

    // Combine gateway models with legacy services
    const models = gatewayHealth.models || {};
    const allHealthy = gatewayHealth.status === 'healthy';

    res.status(allHealthy ? 200 : 503).json({
      overall: allHealthy ? 'healthy' : 'degraded',
      gateway: {
        status: gatewayHealth.status,
        uptime_seconds: gatewayHealth.uptime_seconds,
        url: ML_GATEWAY_URL,
      },
      models: {
        ...models,
        neuroimaging: neuroimagingHealth,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      overall: 'unavailable',
      gateway: {
        status: 'unavailable',
        url: ML_GATEWAY_URL,
        error: error instanceof Error ? error.message : 'Gateway not responding',
      },
      models: {},
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
