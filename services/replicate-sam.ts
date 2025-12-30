/**
 * Replicate SAM 2 Cloud Service
 * Uses Replicate's hosted SAM 2 model for production-quality segmentation
 * without requiring local GPU resources.
 * 
 * API Documentation: https://replicate.com/meta/sam-2/api
 */

import { Platform } from 'react-native';

// Replicate API configuration
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
const SAM2_MODEL_VERSION = 'meta/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83';

// For demo purposes, we'll use a proxy through our server to avoid exposing API keys
const getApiBaseUrl = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000';
  }
  return 'http://localhost:3000';
};

export interface ReplicateSAMInput {
  image: string; // URL or base64
  point_coords?: number[][]; // [[x, y], ...]
  point_labels?: number[]; // 1 for foreground, 0 for background
  box?: number[]; // [x1, y1, x2, y2]
  mask_input?: string; // Previous mask for refinement
  multimask_output?: boolean;
  return_logits?: boolean;
  normalize_coords?: boolean;
  use_m2m?: boolean; // Use mask-to-mask refinement
}

export interface ReplicateSAMOutput {
  combined_mask: string; // URL to combined mask image
  individual_masks: string[]; // URLs to individual mask images
  low_res_masks?: string[]; // Low resolution mask logits
}

export interface SegmentationResult {
  success: boolean;
  model: string;
  mask_url?: string;
  mask_base64?: string;
  confidence?: number;
  area_pixels?: number;
  inference_time?: string;
  error?: string;
}

/**
 * Check if Replicate API is available
 */
export async function checkReplicateAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/replicate/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Segment image using Replicate SAM 2 with point prompts
 */
export async function segmentWithPoints(
  imageUri: string,
  points: Array<{ x: number; y: number; label?: number }>
): Promise<SegmentationResult> {
  try {
    const point_coords = points.map(p => [p.x, p.y]);
    const point_labels = points.map(p => p.label ?? 1); // Default to foreground

    const response = await fetch(`${getApiBaseUrl()}/api/replicate/sam2/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageUri,
        point_coords,
        point_labels,
        multimask_output: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      model: 'SAM2-Replicate',
      mask_url: result.combined_mask || result.mask_url,
      confidence: result.confidence || 0.85,
      area_pixels: result.area_pixels,
      inference_time: result.inference_time || '~2s',
    };
  } catch (error) {
    return {
      success: false,
      model: 'SAM2-Replicate',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Segment image using Replicate SAM 2 with bounding box
 */
export async function segmentWithBox(
  imageUri: string,
  box: { x1: number; y1: number; x2: number; y2: number }
): Promise<SegmentationResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/replicate/sam2/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageUri,
        box: [box.x1, box.y1, box.x2, box.y2],
        multimask_output: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      model: 'SAM2-Replicate',
      mask_url: result.combined_mask || result.mask_url,
      confidence: result.confidence || 0.88,
      area_pixels: result.area_pixels,
      inference_time: result.inference_time || '~2s',
    };
  } catch (error) {
    return {
      success: false,
      model: 'SAM2-Replicate',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Auto-segment entire image (no prompts)
 */
export async function autoSegment(imageUri: string): Promise<SegmentationResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/replicate/sam2/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageUri,
        multimask_output: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      model: 'SAM2-Replicate',
      mask_url: result.combined_mask || result.mask_url,
      confidence: result.confidence || 0.82,
      area_pixels: result.area_pixels,
      inference_time: result.inference_time || '~3s',
    };
  } catch (error) {
    return {
      success: false,
      model: 'SAM2-Replicate',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available cloud backends for segmentation
 */
export function getAvailableCloudBackends() {
  return [
    {
      id: 'replicate-sam2',
      name: 'Replicate SAM 2',
      description: 'Meta\'s SAM 2 hosted on Replicate (GPU-accelerated)',
      speed: '~2s',
      features: ['Point prompts', 'Box prompts', 'Auto-segment'],
      requiresApiKey: true,
    },
    {
      id: 'neurosam3',
      name: 'NeuroSAM3 Cloud',
      description: 'Custom medical imaging model on HuggingFace Spaces',
      speed: '~1-3s',
      features: ['Point prompts', 'Box prompts', 'Text prompts', 'CLAHE', 'CT windowing'],
      requiresApiKey: false,
    },
    {
      id: 'local',
      name: 'Local Mock Service',
      description: 'Lightweight mock service for development/demo',
      speed: '~0.2s',
      features: ['Point prompts', 'Box prompts', 'Text prompts'],
      requiresApiKey: false,
    },
  ];
}
