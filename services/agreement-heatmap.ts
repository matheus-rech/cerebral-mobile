/**
 * Agreement Heatmap Generator
 * Calculates pixel-by-pixel model consensus and generates color-coded heatmap
 */

export type AgreementLevel = 'high' | 'medium' | 'low' | 'none';

export interface HeatmapPixel {
  x: number;
  y: number;
  agreement: number; // 0-1
  level: AgreementLevel;
  modelsAgreed: string[];
}

export interface HeatmapResult {
  heatmapUri: string;
  statistics: {
    highAgreement: number; // percentage
    mediumAgreement: number;
    lowAgreement: number;
    noAgreement: number;
    averageAgreement: number;
  };
  pixels: HeatmapPixel[];
}

/**
 * Generate agreement heatmap from multiple model masks
 */
export async function generateAgreementHeatmap(
  masks: { model: string; maskUri: string }[],
  imageWidth: number = 256,
  imageHeight: number = 256
): Promise<HeatmapResult> {
  // In a real implementation, this would:
  // 1. Decode each mask image to pixel data
  // 2. For each pixel, count how many models detected it
  // 3. Calculate agreement percentage (models_agreed / total_models)
  // 4. Color-code: green (>75%), yellow (50-75%), red (25-50%), black (<25%)
  // 5. Generate heatmap image

  // Mock implementation for demonstration
  const totalPixels = imageWidth * imageHeight;
  const pixels: HeatmapPixel[] = [];

  // Simulate pixel-by-pixel analysis
  for (let y = 0; y < imageHeight; y += 10) {
    // Sample every 10 pixels for performance
    for (let x = 0; x < imageWidth; x += 10) {
      // Simulate agreement calculation
      const agreement = Math.random();
      const modelsAgreed: string[] = [];

      masks.forEach((mask) => {
        if (Math.random() < agreement) {
          modelsAgreed.push(mask.model);
        }
      });

      const level: AgreementLevel =
        agreement > 0.75
          ? 'high'
          : agreement > 0.5
            ? 'medium'
            : agreement > 0.25
              ? 'low'
              : 'none';

      pixels.push({ x, y, agreement, level, modelsAgreed });
    }
  }

  // Calculate statistics
  const highCount = pixels.filter((p) => p.level === 'high').length;
  const mediumCount = pixels.filter((p) => p.level === 'medium').length;
  const lowCount = pixels.filter((p) => p.level === 'low').length;
  const noneCount = pixels.filter((p) => p.level === 'none').length;

  const statistics = {
    highAgreement: (highCount / pixels.length) * 100,
    mediumAgreement: (mediumCount / pixels.length) * 100,
    lowAgreement: (lowCount / pixels.length) * 100,
    noAgreement: (noneCount / pixels.length) * 100,
    averageAgreement:
      pixels.reduce((sum, p) => sum + p.agreement, 0) / pixels.length,
  };

  // Generate heatmap image (mock)
  const heatmapUri = generateHeatmapImage(pixels, imageWidth, imageHeight);

  return {
    heatmapUri,
    statistics,
    pixels,
  };
}

/**
 * Generate heatmap image from pixel data
 */
function generateHeatmapImage(
  pixels: HeatmapPixel[],
  width: number,
  height: number
): string {
  // In a real implementation, this would use Canvas API or similar
  // to draw the heatmap with color-coded pixels

  // Mock: return a data URI
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

/**
 * Get color for agreement level
 */
export function getAgreementColor(level: AgreementLevel): string {
  switch (level) {
    case 'high':
      return '#10B981'; // Green
    case 'medium':
      return '#F59E0B'; // Yellow/Orange
    case 'low':
      return '#EF4444'; // Red
    case 'none':
      return '#1F2937'; // Dark gray
  }
}

/**
 * Get agreement level from percentage
 */
export function getAgreementLevel(agreement: number): AgreementLevel {
  if (agreement > 0.75) return 'high';
  if (agreement > 0.5) return 'medium';
  if (agreement > 0.25) return 'low';
  return 'none';
}

/**
 * Calculate consensus mask from multiple model results
 */
export function calculateConsensusMask(
  masks: { model: string; areaPixels: number }[],
  threshold: number = 0.5
): {
  consensusArea: number;
  confidence: number;
  modelsInConsensus: string[];
} {
  // Calculate median area
  const areas = masks.map((m) => m.areaPixels).sort((a, b) => a - b);
  const medianArea = areas[Math.floor(areas.length / 2)];

  // Find models within threshold of median
  const modelsInConsensus = masks
    .filter((m) => {
      const diff = Math.abs(m.areaPixels - medianArea) / medianArea;
      return diff <= threshold;
    })
    .map((m) => m.model);

  // Calculate confidence based on how many models agree
  const confidence = modelsInConsensus.length / masks.length;

  return {
    consensusArea: medianArea,
    confidence,
    modelsInConsensus,
  };
}
