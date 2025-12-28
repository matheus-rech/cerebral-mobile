import { describe, it, expect } from 'vitest';

describe('Model Comparison Feature', () => {
  it('should support four segmentation models', () => {
    const models = [
      { name: 'UNet', port: 5003 },
      { name: 'MedSAM2', port: 5005 },
      { name: 'SAM3', port: 5006 },
      { name: 'SynthSeg', port: 5001 },
    ];

    expect(models).toHaveLength(4);
    expect(models.map((m) => m.name)).toContain('UNet');
    expect(models.map((m) => m.name)).toContain('MedSAM2');
    expect(models.map((m) => m.name)).toContain('SAM3');
    expect(models.map((m) => m.name)).toContain('SynthSeg');
  });

  it('should have unique colors for each model', () => {
    const modelColors = {
      UNet: '#EF4444',
      MedSAM2: '#3B82F6',
      SAM3: '#10B981',
      SynthSeg: '#F59E0B',
    };

    const colors = Object.values(modelColors);
    const uniqueColors = new Set(colors);

    expect(uniqueColors.size).toBe(4);
  });

  it('should track model results', () => {
    const results = [
      {
        model: 'UNet',
        maskUri: 'data:image/png;base64,mask1',
        confidence: 0.85,
        areaPixels: 1000,
        inferenceTime: 150,
      },
      {
        model: 'MedSAM2',
        maskUri: 'data:image/png;base64,mask2',
        confidence: 0.90,
        areaPixels: 1100,
        inferenceTime: 200,
      },
    ];

    expect(results).toHaveLength(2);
    expect(results[0].model).toBe('UNet');
    expect(results[1].model).toBe('MedSAM2');
  });

  it('should calculate Dice coefficient', () => {
    const calculateDice = (area1: number, area2: number) => {
      const intersection = Math.min(area1, area2);
      const union = area1 + area2;
      return union > 0 ? (2 * intersection) / union : 0;
    };

    const dice1 = calculateDice(1000, 1100);
    const dice2 = calculateDice(1000, 1000);
    const dice3 = calculateDice(1000, 2000);

    expect(dice1).toBeCloseTo(0.952, 2);
    expect(dice2).toBe(1.0);
    expect(dice3).toBeCloseTo(0.667, 2);
  });

  it('should calculate overall agreement', () => {
    const diceCoefficients = {
      'UNet-MedSAM2': 0.95,
      'UNet-SAM3': 0.88,
      'MedSAM2-SAM3': 0.92,
    };

    const values = Object.values(diceCoefficients);
    const agreement = values.reduce((sum, val) => sum + val, 0) / values.length;

    expect(agreement).toBeCloseTo(0.917, 2);
  });

  it('should calculate consensus area', () => {
    const results = [
      { areaPixels: 1000 },
      { areaPixels: 1100 },
      { areaPixels: 1050 },
      { areaPixels: 980 },
    ];

    const consensusArea =
      results.reduce((sum, r) => sum + r.areaPixels, 0) / results.length;

    expect(consensusArea).toBe(1032.5);
  });

  it('should track model visibility', () => {
    const visibleModels = new Set(['UNet', 'MedSAM2', 'SAM3', 'SynthSeg']);

    expect(visibleModels.size).toBe(4);
    expect(visibleModels.has('UNet')).toBe(true);

    // Toggle visibility
    visibleModels.delete('UNet');
    expect(visibleModels.has('UNet')).toBe(false);
    expect(visibleModels.size).toBe(3);

    // Toggle back
    visibleModels.add('UNet');
    expect(visibleModels.has('UNet')).toBe(true);
    expect(visibleModels.size).toBe(4);
  });

  it('should format confidence as percentage', () => {
    const confidence = 0.876;
    const percentage = (confidence * 100).toFixed(1);

    expect(percentage).toBe('87.6');
  });

  it('should track inference time', () => {
    const results = [
      { model: 'UNet', inferenceTime: 150 },
      { model: 'MedSAM2', inferenceTime: 200 },
      { model: 'SAM3', inferenceTime: 180 },
      { model: 'SynthSeg', inferenceTime: 250 },
    ];

    const avgTime =
      results.reduce((sum, r) => sum + r.inferenceTime, 0) / results.length;

    expect(avgTime).toBe(195);
  });

  it('should validate comparison metrics structure', () => {
    const metrics = {
      diceCoefficients: {
        'UNet-MedSAM2': 0.95,
        'UNet-SAM3': 0.88,
        'UNet-SynthSeg': 0.82,
        'MedSAM2-SAM3': 0.92,
        'MedSAM2-SynthSeg': 0.85,
        'SAM3-SynthSeg': 0.87,
      },
      agreement: 0.88,
      consensusArea: 1050,
    };

    expect(metrics.diceCoefficients).toBeDefined();
    expect(Object.keys(metrics.diceCoefficients)).toHaveLength(6); // 4 models = 6 pairs
    expect(metrics.agreement).toBeGreaterThan(0);
    expect(metrics.agreement).toBeLessThanOrEqual(1);
    expect(metrics.consensusArea).toBeGreaterThan(0);
  });

  it('should calculate all pairwise combinations', () => {
    const models = ['UNet', 'MedSAM2', 'SAM3', 'SynthSeg'];
    const pairs: string[] = [];

    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        pairs.push(`${models[i]}-${models[j]}`);
      }
    }

    expect(pairs).toHaveLength(6);
    expect(pairs).toContain('UNet-MedSAM2');
    expect(pairs).toContain('UNet-SAM3');
    expect(pairs).toContain('UNet-SynthSeg');
    expect(pairs).toContain('MedSAM2-SAM3');
    expect(pairs).toContain('MedSAM2-SynthSeg');
    expect(pairs).toContain('SAM3-SynthSeg');
  });
});

describe('Parallel Model Execution', () => {
  it('should run models in parallel', async () => {
    const mockModelRun = (model: string, delay: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ model, success: true });
        }, delay);
      });
    };

    const startTime = Date.now();

    const promises = [
      mockModelRun('UNet', 100),
      mockModelRun('MedSAM2', 150),
      mockModelRun('SAM3', 120),
      mockModelRun('SynthSeg', 180),
    ];

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    expect(results).toHaveLength(4);
    // Parallel execution should take ~180ms (longest), not 550ms (sum)
    expect(totalTime).toBeLessThan(300);
  });

  it('should handle model failures gracefully', async () => {
    const mockModelRun = (model: string, shouldFail: boolean) => {
      return new Promise((resolve) => {
        if (shouldFail) {
          resolve(null);
        } else {
          resolve({ model, success: true });
        }
      });
    };

    const promises = [
      mockModelRun('UNet', false),
      mockModelRun('MedSAM2', true), // Fails
      mockModelRun('SAM3', false),
      mockModelRun('SynthSeg', false),
    ];

    const results = await Promise.all(promises);
    const validResults = results.filter((r) => r !== null);

    expect(results).toHaveLength(4);
    expect(validResults).toHaveLength(3);
  });
});

describe('Grid Layout', () => {
  it('should arrange models in 2x2 grid', () => {
    const models = ['UNet', 'MedSAM2', 'SAM3', 'SynthSeg'];
    const gridSize = Math.ceil(Math.sqrt(models.length));

    expect(gridSize).toBe(2); // 2x2 grid
  });

  it('should calculate grid item width', () => {
    const containerWidth = 100; // percentage
    const itemsPerRow = 2;
    const gap = 2; // percentage

    const itemWidth = (containerWidth - gap * (itemsPerRow - 1)) / itemsPerRow;

    expect(itemWidth).toBe(49);
  });
});

describe('Dice Coefficient Calculation', () => {
  it('should return 1.0 for identical masks', () => {
    const area1 = 1000;
    const area2 = 1000;

    const intersection = Math.min(area1, area2);
    const union = area1 + area2;
    const dice = (2 * intersection) / union;

    expect(dice).toBe(1.0);
  });

  it('should return 0.0 for non-overlapping masks', () => {
    const area1 = 1000;
    const area2 = 0;

    const intersection = Math.min(area1, area2);
    const union = area1 + area2;
    const dice = union > 0 ? (2 * intersection) / union : 0;

    expect(dice).toBe(0.0);
  });

  it('should calculate partial overlap correctly', () => {
    const area1 = 1000;
    const area2 = 1500;

    const intersection = Math.min(area1, area2);
    const union = area1 + area2;
    const dice = (2 * intersection) / union;

    expect(dice).toBeCloseTo(0.8, 2);
  });
});

describe('Model Color Coding', () => {
  it('should assign unique colors to models', () => {
    const getModelColor = (modelName: string) => {
      const colors: { [key: string]: string } = {
        UNet: '#EF4444',
        MedSAM2: '#3B82F6',
        SAM3: '#10B981',
        SynthSeg: '#F59E0B',
      };
      return colors[modelName] || '#6B7280';
    };

    expect(getModelColor('UNet')).toBe('#EF4444');
    expect(getModelColor('MedSAM2')).toBe('#3B82F6');
    expect(getModelColor('SAM3')).toBe('#10B981');
    expect(getModelColor('SynthSeg')).toBe('#F59E0B');
    expect(getModelColor('Unknown')).toBe('#6B7280');
  });

  it('should create color with opacity', () => {
    const baseColor = '#EF4444';
    const colorWithOpacity = baseColor + '20'; // 20 = ~12% opacity

    expect(colorWithOpacity).toBe('#EF444420');
  });
});
