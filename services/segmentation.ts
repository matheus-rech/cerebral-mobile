/**
 * Segmentation Service
 * Handles MRI image segmentation requests to ML backends
 */

import type { SegmentationResult, MRIModality } from '@/types/mri';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Segment an MRI image using UNet lesion detector
 */
export async function segmentMRIImage(
  imageUri: string,
  modality: MRIModality
): Promise<SegmentationResult> {
  try {
    const response = await fetch(`${API_URL}/api/ml/unet/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUri,
        modality,
      }),
    });

    if (!response.ok) {
      throw new Error(`Segmentation failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Transform UNet result to SegmentationResult format
    return {
      imageUri,
      overlayUri: result.overlay_image || imageUri,
      statistics: {
        totalPixels: result.total_pixels || 0,
        segmentedPixels: result.lesion_pixels || 0,
        segmentedPercentage: result.lesion_percentage || 0,
        regions: result.lesions?.map((lesion: any, index: number) => ({
          label: `Lesion ${index + 1} (${lesion.severity})`,
          area: lesion.area,
          percentage: (lesion.area / (result.total_pixels || 1)) * 100,
        })) || [],
      },
      timestamp: result.timestamp || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error segmenting MRI image:', error);
    throw error;
  }
}

/**
 * Segment brain structures using SynthSeg
 */
export async function segmentWithSynthSeg(imageUri: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/ml/synthseg/segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUri }),
    });

    if (!response.ok) {
      throw new Error(`SynthSeg segmentation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error with SynthSeg segmentation:', error);
    throw error;
  }
}

/**
 * Interactive segmentation using MedSAM2
 */
export async function segmentWithMedSAM2(
  imageUri: string,
  prompts: { points?: number[][]; boxes?: number[][] }
): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/ml/medsam2/segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUri, prompts }),
    });

    if (!response.ok) {
      throw new Error(`MedSAM2 segmentation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error with MedSAM2 segmentation:', error);
    throw error;
  }
}

/**
 * Point-based segmentation using SAM3
 */
export async function segmentWithSAM3Point(
  imageUri: string,
  point: { x: number; y: number }
): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/ml/sam3/segment-point`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUri, point }),
    });

    if (!response.ok) {
      throw new Error(`SAM3 segmentation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error with SAM3 point segmentation:', error);
    throw error;
  }
}

/**
 * Box-based segmentation using SAM3
 */
export async function segmentWithSAM3Box(
  imageUri: string,
  box: { x1: number; y1: number; x2: number; y2: number }
): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/ml/sam3/segment-box`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUri, box }),
    });

    if (!response.ok) {
      throw new Error(`SAM3 segmentation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error with SAM3 box segmentation:', error);
    throw error;
  }
}

/**
 * Text-based segmentation using SAM3
 */
export async function segmentWithSAM3Text(
  imageUri: string,
  text: string
): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/ml/sam3/segment-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUri, text }),
    });

    if (!response.ok) {
      throw new Error(`SAM3 segmentation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error with SAM3 text segmentation:', error);
    throw error;
  }
}

/**
 * 3D lesion tracking across volume
 */
export async function track3DLesions(
  volumeUri: string,
  patientId?: string
): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/ml/lesion-3d/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ volumeUri, patientId }),
    });

    if (!response.ok) {
      throw new Error(`3D lesion tracking failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error with 3D lesion tracking:', error);
    throw error;
  }
}

/**
 * Check ML backend health
 */
export async function checkMLHealth(): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/ml/health`);
    return await response.json();
  } catch (error) {
    console.error('Error checking ML health:', error);
    return {
      overall: 'unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
