/**
 * Replicate API Proxy Routes
 * Proxies requests to Replicate's SAM 2 API to avoid exposing API keys on client
 */

import { Router } from 'express';

const router = Router();

// Replicate API configuration
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
const SAM2_MODEL_VERSION = 'meta/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83';

// Get API key from environment
const getReplicateApiKey = () => process.env.REPLICATE_API_TOKEN || '';

/**
 * Helper to poll for prediction completion
 */
async function pollPrediction(predictionUrl: string, apiKey: string, maxAttempts = 30): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(predictionUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    const prediction = await response.json();
    
    if (prediction.status === 'succeeded') {
      return prediction.output;
    } else if (prediction.status === 'failed') {
      throw new Error(prediction.error || 'Prediction failed');
    }
    
    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Prediction timeout');
}

/**
 * GET /api/replicate/health
 * Check if Replicate API is configured and available
 */
router.get('/replicate/health', async (req, res) => {
  const apiKey = getReplicateApiKey();
  
  if (!apiKey) {
    return res.status(503).json({
      status: 'unavailable',
      message: 'REPLICATE_API_TOKEN not configured',
    });
  }
  
  try {
    // Simple health check - just verify the API key works
    const response = await fetch('https://api.replicate.com/v1/models/meta/sam-2', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      res.json({
        status: 'healthy',
        service: 'replicate-sam2',
        model: 'meta/sam-2',
      });
    } else {
      res.status(503).json({
        status: 'unavailable',
        message: 'Replicate API returned error',
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unavailable',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/replicate/sam2/segment
 * Run SAM 2 segmentation with prompts
 */
router.post('/replicate/sam2/segment', async (req, res) => {
  const apiKey = getReplicateApiKey();
  
  if (!apiKey) {
    return res.status(503).json({
      error: 'Replicate API not configured',
      message: 'REPLICATE_API_TOKEN environment variable is not set',
    });
  }
  
  try {
    const { image, point_coords, point_labels, box, multimask_output } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }
    
    // Build input for SAM 2
    const input: any = { image };
    
    if (point_coords && point_coords.length > 0) {
      input.point_coords = point_coords;
      input.point_labels = point_labels || point_coords.map(() => 1);
    }
    
    if (box) {
      input.box = box;
    }
    
    if (multimask_output !== undefined) {
      input.multimask_output = multimask_output;
    }
    
    // Create prediction
    const startTime = Date.now();
    const createResponse = await fetch(REPLICATE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: SAM2_MODEL_VERSION.split(':')[1],
        input,
      }),
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create prediction: ${error}`);
    }
    
    const prediction = await createResponse.json();
    
    // Poll for completion
    const output = await pollPrediction(prediction.urls.get, apiKey);
    const inferenceTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    res.json({
      success: true,
      model: 'SAM2-Replicate',
      combined_mask: output.combined_mask,
      individual_masks: output.individual_masks,
      mask_url: output.combined_mask,
      inference_time: `${inferenceTime}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Replicate SAM2 error:', error);
    res.status(500).json({
      error: 'SAM 2 segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/replicate/sam2/auto
 * Run SAM 2 auto-segmentation (no prompts)
 */
router.post('/replicate/sam2/auto', async (req, res) => {
  const apiKey = getReplicateApiKey();
  
  if (!apiKey) {
    return res.status(503).json({
      error: 'Replicate API not configured',
      message: 'REPLICATE_API_TOKEN environment variable is not set',
    });
  }
  
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }
    
    // Create prediction for auto-segmentation
    const startTime = Date.now();
    const createResponse = await fetch(REPLICATE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: SAM2_MODEL_VERSION.split(':')[1],
        input: {
          image,
          multimask_output: true,
        },
      }),
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create prediction: ${error}`);
    }
    
    const prediction = await createResponse.json();
    
    // Poll for completion
    const output = await pollPrediction(prediction.urls.get, apiKey);
    const inferenceTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    res.json({
      success: true,
      model: 'SAM2-Replicate',
      combined_mask: output.combined_mask,
      individual_masks: output.individual_masks,
      mask_url: output.combined_mask,
      inference_time: `${inferenceTime}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Replicate SAM2 auto error:', error);
    res.status(500).json({
      error: 'SAM 2 auto-segmentation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
