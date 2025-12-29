/**
 * Segmentation Metrics Utilities
 * Calculate accuracy metrics for segmentation results
 * - Dice Coefficient (F1 Score)
 * - Intersection over Union (IoU / Jaccard Index)
 * - Precision and Recall
 * - Hausdorff Distance (optional)
 */

import { Image } from 'expo-image';

export interface SegmentationMetrics {
  dice: number;
  iou: number;
  precision: number;
  recall: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
}

/**
 * Convert image URI to binary mask array
 * @param uri Image URI (data URI or file path)
 * @param threshold Threshold for binarization (0-255)
 * @returns Binary mask as 1D array
 */
async function imageToBinaryMask(uri: string, threshold: number = 127): Promise<Uint8Array> {
  // This is a placeholder - in production, use canvas or image processing library
  // For now, we'll simulate with a simple approach
  return new Uint8Array(256 * 256); // Placeholder
}

/**
 * Calculate Dice Coefficient (F1 Score)
 * Dice = 2 * |A ∩ B| / (|A| + |B|)
 * Range: 0 (no overlap) to 1 (perfect overlap)
 */
export function calculateDiceCoefficient(
  truePositives: number,
  falsePositives: number,
  falseNegatives: number
): number {
  const numerator = 2 * truePositives;
  const denominator = 2 * truePositives + falsePositives + falseNegatives;
  
  if (denominator === 0) {
    return 0;
  }
  
  return numerator / denominator;
}

/**
 * Calculate Intersection over Union (IoU / Jaccard Index)
 * IoU = |A ∩ B| / |A ∪ B|
 * Range: 0 (no overlap) to 1 (perfect overlap)
 */
export function calculateIoU(
  truePositives: number,
  falsePositives: number,
  falseNegatives: number
): number {
  const intersection = truePositives;
  const union = truePositives + falsePositives + falseNegatives;
  
  if (union === 0) {
    return 0;
  }
  
  return intersection / union;
}

/**
 * Calculate Precision (Positive Predictive Value)
 * Precision = TP / (TP + FP)
 * Range: 0 to 1
 */
export function calculatePrecision(
  truePositives: number,
  falsePositives: number
): number {
  const denominator = truePositives + falsePositives;
  
  if (denominator === 0) {
    return 0;
  }
  
  return truePositives / denominator;
}

/**
 * Calculate Recall (Sensitivity / True Positive Rate)
 * Recall = TP / (TP + FN)
 * Range: 0 to 1
 */
export function calculateRecall(
  truePositives: number,
  falseNegatives: number
): number {
  const denominator = truePositives + falseNegatives;
  
  if (denominator === 0) {
    return 0;
  }
  
  return truePositives / denominator;
}

/**
 * Compare two binary masks pixel-by-pixel
 * @param groundTruth Ground truth mask
 * @param prediction Predicted mask
 * @returns Confusion matrix values
 */
export function compareMasks(
  groundTruth: Uint8Array,
  prediction: Uint8Array
): {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
} {
  if (groundTruth.length !== prediction.length) {
    throw new Error('Masks must have the same dimensions');
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;

  for (let i = 0; i < groundTruth.length; i++) {
    const gt = groundTruth[i] > 0 ? 1 : 0;
    const pred = prediction[i] > 0 ? 1 : 0;

    if (gt === 1 && pred === 1) {
      truePositives++;
    } else if (gt === 0 && pred === 1) {
      falsePositives++;
    } else if (gt === 1 && pred === 0) {
      falseNegatives++;
    } else {
      trueNegatives++;
    }
  }

  return { truePositives, falsePositives, falseNegatives, trueNegatives };
}

/**
 * Calculate all segmentation metrics
 * @param groundTruth Ground truth mask
 * @param prediction Predicted mask
 * @returns Complete metrics object
 */
export function calculateSegmentationMetrics(
  groundTruth: Uint8Array,
  prediction: Uint8Array
): SegmentationMetrics {
  const { truePositives, falsePositives, falseNegatives, trueNegatives } = 
    compareMasks(groundTruth, prediction);

  const dice = calculateDiceCoefficient(truePositives, falsePositives, falseNegatives);
  const iou = calculateIoU(truePositives, falsePositives, falseNegatives);
  const precision = calculatePrecision(truePositives, falsePositives);
  const recall = calculateRecall(truePositives, falseNegatives);

  return {
    dice,
    iou,
    precision,
    recall,
    truePositives,
    falsePositives,
    falseNegatives,
    trueNegatives,
  };
}

/**
 * Get accuracy grade based on Dice coefficient
 * @param dice Dice coefficient (0-1)
 * @returns Grade string and color
 */
export function getAccuracyGrade(dice: number): {
  grade: string;
  color: string;
  description: string;
} {
  if (dice >= 0.9) {
    return {
      grade: 'Excellent',
      color: '#22C55E', // green
      description: 'Outstanding segmentation accuracy',
    };
  } else if (dice >= 0.8) {
    return {
      grade: 'Good',
      color: '#10B981', // green-600
      description: 'High segmentation accuracy',
    };
  } else if (dice >= 0.7) {
    return {
      grade: 'Fair',
      color: '#F59E0B', // yellow
      description: 'Acceptable segmentation accuracy',
    };
  } else if (dice >= 0.5) {
    return {
      grade: 'Poor',
      color: '#F97316', // orange
      description: 'Low segmentation accuracy',
    };
  } else {
    return {
      grade: 'Very Poor',
      color: '#EF4444', // red
      description: 'Very low segmentation accuracy',
    };
  }
}

/**
 * Format metric as percentage string
 * @param value Metric value (0-1)
 * @param decimals Number of decimal places
 * @returns Formatted percentage string
 */
export function formatMetricAsPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
