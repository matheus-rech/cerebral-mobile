/**
 * Segmentation Service
 * Handles MRI image segmentation requests
 */

import type { SegmentationResult, MRIModality } from '@/types/mri';

/**
 * Segment an MRI image
 */
export async function segmentMRIImage(
  imageUri: string,
  modality: MRIModality
): Promise<SegmentationResult> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/segment-mri`, {
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

    const result: SegmentationResult = await response.json();
    return result;
  } catch (error) {
    console.error('Error segmenting MRI image:', error);
    throw error;
  }
}

/**
 * Generate a mock segmentation result for testing
 */
export function generateMockSegmentation(
  imageUri: string,
  modality: MRIModality
): SegmentationResult {
  // Simulate segmentation statistics
  const totalPixels = 512 * 512; // Typical MRI resolution
  const segmentedPixels = Math.floor(totalPixels * (0.05 + Math.random() * 0.15)); // 5-20% segmented
  const segmentedPercentage = (segmentedPixels / totalPixels) * 100;

  const regions = [
    {
      label: 'Hyperintense Region 1',
      area: Math.floor(segmentedPixels * 0.6),
      percentage: segmentedPercentage * 0.6,
    },
    {
      label: 'Hyperintense Region 2',
      area: Math.floor(segmentedPixels * 0.3),
      percentage: segmentedPercentage * 0.3,
    },
    {
      label: 'Hyperintense Region 3',
      area: Math.floor(segmentedPixels * 0.1),
      percentage: segmentedPercentage * 0.1,
    },
  ];

  const result: SegmentationResult = {
    imageUri,
    overlayUri: imageUri, // In a real implementation, this would be a processed image
    statistics: {
      totalPixels,
      segmentedPixels,
      segmentedPercentage,
      regions,
    },
    timestamp: new Date().toISOString(),
  };

  return result;
}
