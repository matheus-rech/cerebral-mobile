/**
 * ML Backend Proxy Route
 * Forwards requests to Python ML backend (SynthSeg)
 */

import { Router } from 'express';

const router = Router();

const ML_BACKEND_URL = process.env.ML_BACKEND_URL || 'http://localhost:5000';

/**
 * POST /api/analyze-mri-ml
 * Analyze MRI using Python ML backend with SynthSeg
 */
router.post('/analyze-mri-ml', async (req, res) => {
  try {
    const { imageUri } = req.body;

    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    // Fetch the image if it's a URL
    let imageData: string;

    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      // Fetch image from URL
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageData = buffer.toString('base64');
    } else if (imageUri.startsWith('data:')) {
      // Extract base64 data from data URI
      const matches = imageUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URI format');
      }
      imageData = matches[2];
    } else {
      throw new Error('Unsupported image URI format');
    }

    // Forward to Python ML backend
    const mlResponse = await fetch(`${ML_BACKEND_URL}/segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageData,
      }),
    });

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();
      throw new Error(`ML backend error: ${errorText}`);
    }

    const result = await mlResponse.json();

    // Add metadata
    const report = {
      id: `ml-analysis-${Date.now()}`,
      timestamp: new Date().toISOString(),
      imageUri,
      ...result,
    };

    res.json(report);
  } catch (error) {
    console.error('Error in ML proxy:', error);
    res.status(500).json({
      error: 'Failed to analyze MRI with ML backend',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ml-health
 * Check ML backend health
 */
router.get('/ml-health', async (req, res) => {
  try {
    const response = await fetch(`${ML_BACKEND_URL}/health`);
    const health = await response.json();
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'ML backend not reachable',
    });
  }
});

export default router;
