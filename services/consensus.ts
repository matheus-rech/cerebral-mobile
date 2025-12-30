/**
 * Multi-Model Consensus Service
 * Combines predictions from multiple ML models to generate ensemble reports
 * and confidence heatmaps
 */

export interface ModelPrediction {
  modelName: string;
  mask: number[][];  // 2D binary mask (0 or 1)
  confidence: number;
  inferenceTime: number;  // milliseconds
}

export interface ConsensusResult {
  // Consensus mask (majority voting)
  consensusMask: number[][];
  
  // Confidence heatmap (0-1 values based on model agreement)
  confidenceHeatmap: number[][];
  
  // Per-pixel agreement statistics
  agreementStats: {
    fullAgreement: number;      // % of pixels where all models agree
    majorityAgreement: number;  // % of pixels where majority agrees
    noAgreement: number;        // % of pixels with no consensus
  };
  
  // Model-specific statistics
  modelStats: {
    modelName: string;
    maskArea: number;           // pixels
    diceWithConsensus: number;  // Dice coefficient with consensus
    iouWithConsensus: number;   // IoU with consensus
  }[];
  
  // Ensemble confidence (weighted average)
  ensembleConfidence: number;
  
  // Pairwise model agreement (Dice coefficients)
  pairwiseAgreement: {
    model1: string;
    model2: string;
    dice: number;
    iou: number;
  }[];
}

export interface EnsembleReport {
  title: string;
  timestamp: string;
  imageUri: string;
  
  // Summary
  summary: {
    totalModels: number;
    overallAgreement: number;
    ensembleConfidence: number;
    recommendation: string;
  };
  
  // Detailed results
  consensus: ConsensusResult;
  predictions: ModelPrediction[];
  
  // Clinical interpretation
  interpretation: {
    agreementLevel: 'high' | 'moderate' | 'low';
    reliabilityScore: number;
    suggestedAction: string;
  };
}

/**
 * Calculate consensus from multiple model predictions using majority voting
 */
export function calculateConsensus(predictions: ModelPrediction[]): ConsensusResult {
  if (predictions.length === 0) {
    throw new Error('No predictions provided');
  }
  
  const height = predictions[0].mask.length;
  const width = predictions[0].mask[0]?.length || 0;
  const numModels = predictions.length;
  const threshold = Math.ceil(numModels / 2);  // Majority threshold
  
  // Initialize output arrays
  const consensusMask: number[][] = Array(height).fill(null).map(() => Array(width).fill(0));
  const confidenceHeatmap: number[][] = Array(height).fill(null).map(() => Array(width).fill(0));
  
  // Agreement counters
  let fullAgreementPixels = 0;
  let majorityAgreementPixels = 0;
  let noAgreementPixels = 0;
  let totalPixels = 0;
  
  // Calculate per-pixel consensus
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      totalPixels++;
      
      // Count how many models predict this pixel as positive
      let positiveVotes = 0;
      for (const pred of predictions) {
        if (pred.mask[y]?.[x] > 0) {
          positiveVotes++;
        }
      }
      
      // Majority voting
      if (positiveVotes >= threshold) {
        consensusMask[y][x] = 1;
      }
      
      // Confidence heatmap (agreement ratio)
      const agreementRatio = positiveVotes / numModels;
      confidenceHeatmap[y][x] = Math.max(agreementRatio, 1 - agreementRatio);
      
      // Agreement statistics
      if (positiveVotes === numModels || positiveVotes === 0) {
        fullAgreementPixels++;
      } else if (positiveVotes >= threshold || positiveVotes <= numModels - threshold) {
        majorityAgreementPixels++;
      } else {
        noAgreementPixels++;
      }
    }
  }
  
  // Calculate model-specific statistics
  const modelStats = predictions.map(pred => {
    const maskArea = countPositivePixels(pred.mask);
    const diceWithConsensus = calculateDice(pred.mask, consensusMask);
    const iouWithConsensus = calculateIoU(pred.mask, consensusMask);
    
    return {
      modelName: pred.modelName,
      maskArea,
      diceWithConsensus,
      iouWithConsensus,
    };
  });
  
  // Calculate pairwise agreement
  const pairwiseAgreement: ConsensusResult['pairwiseAgreement'] = [];
  for (let i = 0; i < predictions.length; i++) {
    for (let j = i + 1; j < predictions.length; j++) {
      pairwiseAgreement.push({
        model1: predictions[i].modelName,
        model2: predictions[j].modelName,
        dice: calculateDice(predictions[i].mask, predictions[j].mask),
        iou: calculateIoU(predictions[i].mask, predictions[j].mask),
      });
    }
  }
  
  // Calculate ensemble confidence (weighted by individual model confidence)
  const totalConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0);
  const ensembleConfidence = totalConfidence / predictions.length;
  
  return {
    consensusMask,
    confidenceHeatmap,
    agreementStats: {
      fullAgreement: (fullAgreementPixels / totalPixels) * 100,
      majorityAgreement: (majorityAgreementPixels / totalPixels) * 100,
      noAgreement: (noAgreementPixels / totalPixels) * 100,
    },
    modelStats,
    ensembleConfidence,
    pairwiseAgreement,
  };
}

/**
 * Generate ensemble report from predictions
 */
export function generateEnsembleReport(
  predictions: ModelPrediction[],
  imageUri: string,
  title: string = 'Multi-Model Consensus Report'
): EnsembleReport {
  const consensus = calculateConsensus(predictions);
  
  // Determine agreement level
  let agreementLevel: 'high' | 'moderate' | 'low';
  if (consensus.agreementStats.fullAgreement > 70) {
    agreementLevel = 'high';
  } else if (consensus.agreementStats.fullAgreement > 40) {
    agreementLevel = 'moderate';
  } else {
    agreementLevel = 'low';
  }
  
  // Calculate reliability score
  const avgPairwiseDice = consensus.pairwiseAgreement.reduce((sum, p) => sum + p.dice, 0) / 
    Math.max(consensus.pairwiseAgreement.length, 1);
  const reliabilityScore = (consensus.ensembleConfidence + avgPairwiseDice) / 2;
  
  // Generate recommendation
  let recommendation: string;
  let suggestedAction: string;
  
  if (agreementLevel === 'high' && reliabilityScore > 0.7) {
    recommendation = 'High confidence in segmentation results. Models show strong agreement.';
    suggestedAction = 'Results can be used for clinical decision support.';
  } else if (agreementLevel === 'moderate') {
    recommendation = 'Moderate agreement between models. Some regions show uncertainty.';
    suggestedAction = 'Review highlighted uncertain regions. Consider additional imaging or expert review.';
  } else {
    recommendation = 'Low agreement between models. Results should be interpreted with caution.';
    suggestedAction = 'Manual review recommended. Consider re-running with different parameters or additional models.';
  }
  
  return {
    title,
    timestamp: new Date().toISOString(),
    imageUri,
    summary: {
      totalModels: predictions.length,
      overallAgreement: consensus.agreementStats.fullAgreement,
      ensembleConfidence: consensus.ensembleConfidence,
      recommendation,
    },
    consensus,
    predictions,
    interpretation: {
      agreementLevel,
      reliabilityScore,
      suggestedAction,
    },
  };
}

/**
 * Generate confidence heatmap as RGBA pixel data
 */
export function generateHeatmapPixels(
  heatmap: number[][],
  colorScheme: 'agreement' | 'uncertainty' = 'agreement'
): { r: number; g: number; b: number; a: number }[][] {
  const height = heatmap.length;
  const width = heatmap[0]?.length || 0;
  
  const pixels: { r: number; g: number; b: number; a: number }[][] = [];
  
  for (let y = 0; y < height; y++) {
    pixels[y] = [];
    for (let x = 0; x < width; x++) {
      const value = heatmap[y][x];
      
      if (colorScheme === 'agreement') {
        // Green = high agreement, Yellow = moderate, Red = low
        if (value > 0.8) {
          pixels[y][x] = { r: 34, g: 197, b: 94, a: 180 };  // Green
        } else if (value > 0.6) {
          pixels[y][x] = { r: 250, g: 204, b: 21, a: 180 }; // Yellow
        } else if (value > 0.4) {
          pixels[y][x] = { r: 249, g: 115, b: 22, a: 180 }; // Orange
        } else {
          pixels[y][x] = { r: 239, g: 68, b: 68, a: 180 };  // Red
        }
      } else {
        // Uncertainty: darker = more uncertain
        const intensity = Math.round(value * 255);
        pixels[y][x] = { r: 255 - intensity, g: intensity, b: 128, a: 200 };
      }
    }
  }
  
  return pixels;
}

// Helper functions

function countPositivePixels(mask: number[][]): number {
  let count = 0;
  for (const row of mask) {
    for (const pixel of row) {
      if (pixel > 0) count++;
    }
  }
  return count;
}

function calculateDice(mask1: number[][], mask2: number[][]): number {
  let intersection = 0;
  let sum1 = 0;
  let sum2 = 0;
  
  const height = Math.min(mask1.length, mask2.length);
  const width = Math.min(mask1[0]?.length || 0, mask2[0]?.length || 0);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v1 = mask1[y]?.[x] > 0 ? 1 : 0;
      const v2 = mask2[y]?.[x] > 0 ? 1 : 0;
      
      intersection += v1 * v2;
      sum1 += v1;
      sum2 += v2;
    }
  }
  
  if (sum1 + sum2 === 0) return 1.0;  // Both empty = perfect agreement
  return (2 * intersection) / (sum1 + sum2);
}

function calculateIoU(mask1: number[][], mask2: number[][]): number {
  let intersection = 0;
  let union = 0;
  
  const height = Math.min(mask1.length, mask2.length);
  const width = Math.min(mask1[0]?.length || 0, mask2[0]?.length || 0);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v1 = mask1[y]?.[x] > 0 ? 1 : 0;
      const v2 = mask2[y]?.[x] > 0 ? 1 : 0;
      
      intersection += v1 * v2;
      union += Math.max(v1, v2);
    }
  }
  
  if (union === 0) return 1.0;  // Both empty = perfect agreement
  return intersection / union;
}

export default {
  calculateConsensus,
  generateEnsembleReport,
  generateHeatmapPixels,
};
