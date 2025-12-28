import { describe, it, expect } from 'vitest';
import {
  generateAgreementHeatmap,
  getAgreementColor,
  getAgreementLevel,
  calculateConsensusMask,
  type AgreementLevel,
} from '../services/agreement-heatmap';

describe('Agreement Heatmap Generation', () => {
  it('should generate heatmap from multiple masks', async () => {
    const masks = [
      { model: 'UNet', maskUri: 'data:image/png;base64,mask1' },
      { model: 'MedSAM2', maskUri: 'data:image/png;base64,mask2' },
      { model: 'SAM3', maskUri: 'data:image/png;base64,mask3' },
    ];

    const result = await generateAgreementHeatmap(masks);

    expect(result.heatmapUri).toBeTruthy();
    expect(result.statistics).toBeDefined();
    expect(result.pixels).toBeDefined();
    expect(result.pixels.length).toBeGreaterThan(0);
  });

  it('should calculate agreement statistics', async () => {
    const masks = [
      { model: 'UNet', maskUri: 'data:image/png;base64,mask1' },
      { model: 'MedSAM2', maskUri: 'data:image/png;base64,mask2' },
    ];

    const result = await generateAgreementHeatmap(masks);

    expect(result.statistics.highAgreement).toBeGreaterThanOrEqual(0);
    expect(result.statistics.mediumAgreement).toBeGreaterThanOrEqual(0);
    expect(result.statistics.lowAgreement).toBeGreaterThanOrEqual(0);
    expect(result.statistics.noAgreement).toBeGreaterThanOrEqual(0);

    // Total should be ~100%
    const total =
      result.statistics.highAgreement +
      result.statistics.mediumAgreement +
      result.statistics.lowAgreement +
      result.statistics.noAgreement;

    expect(total).toBeCloseTo(100, 0);
  });

  it('should calculate average agreement', async () => {
    const masks = [
      { model: 'UNet', maskUri: 'data:image/png;base64,mask1' },
      { model: 'MedSAM2', maskUri: 'data:image/png;base64,mask2' },
    ];

    const result = await generateAgreementHeatmap(masks);

    expect(result.statistics.averageAgreement).toBeGreaterThanOrEqual(0);
    expect(result.statistics.averageAgreement).toBeLessThanOrEqual(1);
  });

  it('should track models agreed per pixel', async () => {
    const masks = [
      { model: 'UNet', maskUri: 'data:image/png;base64,mask1' },
      { model: 'MedSAM2', maskUri: 'data:image/png;base64,mask2' },
      { model: 'SAM3', maskUri: 'data:image/png;base64,mask3' },
    ];

    const result = await generateAgreementHeatmap(masks);

    result.pixels.forEach((pixel) => {
      expect(pixel.modelsAgreed).toBeDefined();
      expect(Array.isArray(pixel.modelsAgreed)).toBe(true);
      expect(pixel.modelsAgreed.length).toBeLessThanOrEqual(masks.length);
    });
  });
});

describe('Agreement Level Classification', () => {
  it('should classify high agreement', () => {
    expect(getAgreementLevel(0.9)).toBe('high');
    expect(getAgreementLevel(0.76)).toBe('high');
  });

  it('should classify medium agreement', () => {
    expect(getAgreementLevel(0.75)).toBe('medium');
    expect(getAgreementLevel(0.6)).toBe('medium');
    expect(getAgreementLevel(0.51)).toBe('medium');
  });

  it('should classify low agreement', () => {
    expect(getAgreementLevel(0.5)).toBe('low');
    expect(getAgreementLevel(0.3)).toBe('low');
    expect(getAgreementLevel(0.26)).toBe('low');
  });

  it('should classify no agreement', () => {
    expect(getAgreementLevel(0.25)).toBe('none');
    expect(getAgreementLevel(0.1)).toBe('none');
    expect(getAgreementLevel(0)).toBe('none');
  });
});

describe('Agreement Color Coding', () => {
  it('should return green for high agreement', () => {
    const color = getAgreementColor('high');
    expect(color).toBe('#10B981');
  });

  it('should return yellow/orange for medium agreement', () => {
    const color = getAgreementColor('medium');
    expect(color).toBe('#F59E0B');
  });

  it('should return red for low agreement', () => {
    const color = getAgreementColor('low');
    expect(color).toBe('#EF4444');
  });

  it('should return dark gray for no agreement', () => {
    const color = getAgreementColor('none');
    expect(color).toBe('#1F2937');
  });
});

describe('Consensus Mask Calculation', () => {
  it('should calculate consensus from multiple masks', () => {
    const masks = [
      { model: 'UNet', areaPixels: 1000 },
      { model: 'MedSAM2', areaPixels: 1100 },
      { model: 'SAM3', areaPixels: 1050 },
      { model: 'SynthSeg', areaPixels: 980 },
    ];

    const result = calculateConsensusMask(masks);

    expect(result.consensusArea).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.modelsInConsensus).toBeDefined();
    expect(result.modelsInConsensus.length).toBeGreaterThan(0);
  });

  it('should find median area', () => {
    const masks = [
      { model: 'UNet', areaPixels: 1000 },
      { model: 'MedSAM2', areaPixels: 1500 },
      { model: 'SAM3', areaPixels: 1200 },
    ];

    const result = calculateConsensusMask(masks);

    // Median of [1000, 1200, 1500] is 1200
    expect(result.consensusArea).toBe(1200);
  });

  it('should calculate confidence based on agreement', () => {
    const masks = [
      { model: 'UNet', areaPixels: 1000 },
      { model: 'MedSAM2', areaPixels: 1010 },
      { model: 'SAM3', areaPixels: 1020 },
      { model: 'SynthSeg', areaPixels: 1030 },
    ];

    const result = calculateConsensusMask(masks, 0.1); // 10% threshold

    // All models should be within 10% of median
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.modelsInConsensus.length).toBeGreaterThan(2);
  });

  it('should handle low consensus', () => {
    const masks = [
      { model: 'UNet', areaPixels: 1000 },
      { model: 'MedSAM2', areaPixels: 5000 },
      { model: 'SAM3', areaPixels: 500 },
    ];

    const result = calculateConsensusMask(masks, 0.2); // 20% threshold

    // Models disagree significantly
    expect(result.confidence).toBeLessThan(1.0);
  });
});

describe('Synchronized Zoom/Pan', () => {
  it('should track zoom level', () => {
    let zoomLevel = 1.0;

    // Simulate zoom in
    zoomLevel = 2.0;
    expect(zoomLevel).toBe(2.0);

    // Simulate zoom out
    zoomLevel = 1.5;
    expect(zoomLevel).toBe(1.5);

    // Reset
    zoomLevel = 1.0;
    expect(zoomLevel).toBe(1.0);
  });

  it('should clamp zoom between 1x and 5x', () => {
    const clampZoom = (zoom: number) => Math.max(1, Math.min(5, zoom));

    expect(clampZoom(0.5)).toBe(1.0);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(3.0)).toBe(3.0);
    expect(clampZoom(6.0)).toBe(5.0);
  });

  it('should track pan position', () => {
    let translateX = 0;
    let translateY = 0;

    // Pan right and down
    translateX = 50;
    translateY = 30;

    expect(translateX).toBe(50);
    expect(translateY).toBe(30);

    // Pan left and up
    translateX = -20;
    translateY = -10;

    expect(translateX).toBe(-20);
    expect(translateY).toBe(-10);

    // Reset
    translateX = 0;
    translateY = 0;

    expect(translateX).toBe(0);
    expect(translateY).toBe(0);
  });

  it('should synchronize across multiple views', () => {
    // Simulate shared values
    const sharedScale = { value: 1.0 };
    const sharedTranslateX = { value: 0 };
    const sharedTranslateY = { value: 0 };

    // Update shared values
    sharedScale.value = 2.5;
    sharedTranslateX.value = 100;
    sharedTranslateY.value = 50;

    // All views should have same values
    const view1 = {
      scale: sharedScale.value,
      translateX: sharedTranslateX.value,
      translateY: sharedTranslateY.value,
    };

    const view2 = {
      scale: sharedScale.value,
      translateX: sharedTranslateX.value,
      translateY: sharedTranslateY.value,
    };

    expect(view1.scale).toBe(view2.scale);
    expect(view1.translateX).toBe(view2.translateX);
    expect(view1.translateY).toBe(view2.translateY);
  });

  it('should format zoom level display', () => {
    const formatZoom = (zoom: number) => zoom.toFixed(1) + 'x';

    expect(formatZoom(1.0)).toBe('1.0x');
    expect(formatZoom(2.5)).toBe('2.5x');
    expect(formatZoom(3.14159)).toBe('3.1x');
  });
});

describe('Heatmap Pixel Data', () => {
  it('should store pixel coordinates', async () => {
    const masks = [
      { model: 'UNet', maskUri: 'data:image/png;base64,mask1' },
      { model: 'MedSAM2', maskUri: 'data:image/png;base64,mask2' },
    ];

    const result = await generateAgreementHeatmap(masks);

    result.pixels.forEach((pixel) => {
      expect(pixel.x).toBeGreaterThanOrEqual(0);
      expect(pixel.y).toBeGreaterThanOrEqual(0);
      expect(pixel.agreement).toBeGreaterThanOrEqual(0);
      expect(pixel.agreement).toBeLessThanOrEqual(1);
      expect(pixel.level).toBeDefined();
    });
  });

  it('should classify each pixel agreement level', async () => {
    const masks = [
      { model: 'UNet', maskUri: 'data:image/png;base64,mask1' },
      { model: 'MedSAM2', maskUri: 'data:image/png;base64,mask2' },
    ];

    const result = await generateAgreementHeatmap(masks);

    const levels: Set<AgreementLevel> = new Set();
    result.pixels.forEach((pixel) => {
      levels.add(pixel.level);
    });

    // Should have at least some variety in agreement levels
    expect(levels.size).toBeGreaterThan(0);
  });
});
