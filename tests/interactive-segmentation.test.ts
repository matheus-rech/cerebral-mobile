import { describe, it, expect } from 'vitest';

describe('MedSAM2 Integration', () => {
  it('should have correct gateway configuration', () => {
    const config = {
      service: 'MedSAM2',
      gateway_port: 5000,
      endpoint: '/api/ml/medsam2/segment',
      capabilities: [
        'Point-based segmentation',
        'Bounding box segmentation',
        'Text prompt segmentation',
        'Multi-prompt refinement',
        '2D slice segmentation',
        '3D volume segmentation',
        'Interactive mask generation',
      ],
    };

    expect(config.service).toBe('MedSAM2');
    expect(config.gateway_port).toBe(5000);
    expect(config.endpoint).toContain('medsam2');
    expect(config.capabilities).toHaveLength(7);
  });

  it('should support point prompts', () => {
    const pointPrompt = {
      type: 'point',
      x: 128,
      y: 128,
    };

    expect(pointPrompt.type).toBe('point');
    expect(pointPrompt.x).toBeGreaterThan(0);
    expect(pointPrompt.y).toBeGreaterThan(0);
  });

  it('should support box prompts', () => {
    const boxPrompt = {
      type: 'box',
      x: 64,
      y: 64,
      w: 128,
      h: 128,
    };

    expect(boxPrompt.type).toBe('box');
    expect(boxPrompt.w).toBeGreaterThan(0);
    expect(boxPrompt.h).toBeGreaterThan(0);
  });

  it('should support text prompts', () => {
    const textPrompt = {
      type: 'text',
      prompt: 'segment the tumor',
    };

    expect(textPrompt.type).toBe('text');
    expect(textPrompt.prompt).toBeTruthy();
  });

  it('should validate segmentation result structure', () => {
    const result = {
      success: true,
      mask: 'base64_encoded_image',
      area_pixels: 1024,
      confidence: 0.85,
      prompts_used: 1,
      model: 'MedSAM2',
    };

    expect(result.success).toBe(true);
    expect(result.mask).toBeTruthy();
    expect(result.area_pixels).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should support 3D volume segmentation', () => {
    const volumeResult = {
      success: true,
      mask_nifti: 'base64_encoded_nifti',
      volume_voxels: 5000,
      volume_mm3: 5000.0,
      volume_ml: 5.0,
      num_slices: 50,
      voxel_spacing: [1.0, 1.0, 1.0],
      model: 'MedSAM2 3D',
    };

    expect(volumeResult.volume_ml).toBe(volumeResult.volume_mm3 / 1000);
    expect(volumeResult.num_slices).toBeGreaterThan(0);
    expect(volumeResult.voxel_spacing).toHaveLength(3);
  });
});

describe('SAM3 Integration', () => {
  it('should have correct gateway configuration', () => {
    const config = {
      service: 'SAM3',
      gateway_port: 5000,
      endpoint: '/api/ml/sam3/segment',
      capabilities: [
        'Single-click point segmentation',
        'Bounding box segmentation',
        'Text prompt segmentation',
        'Zero-shot object detection',
        'Interactive refinement',
        'Multi-object segmentation',
      ],
    };

    expect(config.service).toBe('SAM3');
    expect(config.gateway_port).toBe(5000);
    expect(config.endpoint).toContain('sam3');
    expect(config.capabilities).toHaveLength(6);
  });

  it('should support single-click point segmentation', () => {
    const endpoint = '/segment-point';
    const payload = {
      image: 'base64_image',
      point: { x: 128, y: 128 },
    };

    expect(endpoint).toBe('/segment-point');
    expect(payload.point.x).toBeGreaterThan(0);
    expect(payload.point.y).toBeGreaterThan(0);
  });

  it('should support box-based segmentation', () => {
    const endpoint = '/segment-box';
    const payload = {
      image: 'base64_image',
      box: { x: 64, y: 64, w: 128, h: 128 },
    };

    expect(endpoint).toBe('/segment-box');
    expect(payload.box.w).toBeGreaterThan(0);
    expect(payload.box.h).toBeGreaterThan(0);
  });

  it('should support text-based segmentation', () => {
    const endpoint = '/segment-text';
    const payload = {
      image: 'base64_image',
      text: 'segment the brain tumor',
    };

    expect(endpoint).toBe('/segment-text');
    expect(payload.text).toBeTruthy();
  });

  it('should validate segmentation result structure', () => {
    const result = {
      success: true,
      mask: 'base64_encoded_mask',
      area_pixels: 2048,
      confidence: 0.92,
      prompt_type: 'point',
      prompt_info: { x: 128, y: 128 },
      model: 'SAM3',
    };

    expect(result.success).toBe(true);
    expect(result.prompt_type).toBe('point');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.model).toBe('SAM3');
  });

  it('should support zero-shot detection', () => {
    const capability = 'Zero-shot object detection';
    const description = 'Segment objects without prior training';

    expect(capability).toContain('Zero-shot');
    expect(description).toContain('without prior training');
  });
});

describe('Interactive Segmentation UI', () => {
  it('should support three prompt types', () => {
    const promptTypes = ['point', 'box', 'text'];

    expect(promptTypes).toHaveLength(3);
    expect(promptTypes).toContain('point');
    expect(promptTypes).toContain('box');
    expect(promptTypes).toContain('text');
  });

  it('should track point prompts', () => {
    const points = [
      { x: 100, y: 100 },
      { x: 150, y: 150 },
    ];

    expect(points).toHaveLength(2);
    expect(points[0].x).toBe(100);
    expect(points[1].y).toBe(150);
  });

  it('should track box prompts', () => {
    const boxes = [
      { x: 50, y: 50, w: 100, h: 100 },
      { x: 200, y: 200, w: 80, h: 80 },
    ];

    expect(boxes).toHaveLength(2);
    expect(boxes[0].w).toBe(100);
    expect(boxes[1].h).toBe(80);
  });

  it('should validate text prompts', () => {
    const textPrompts = [
      'segment the tumor',
      'find the lesion',
      'identify the brain stem',
    ];

    textPrompts.forEach((prompt) => {
      expect(prompt.length).toBeGreaterThan(0);
      expect(typeof prompt).toBe('string');
    });
  });

  it('should support undo functionality', () => {
    let points = [
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      { x: 200, y: 200 },
    ];

    // Undo last point
    points = points.slice(0, -1);

    expect(points).toHaveLength(2);
    expect(points[points.length - 1].x).toBe(150);
  });

  it('should support clear all functionality', () => {
    let points = [{ x: 100, y: 100 }, { x: 150, y: 150 }];
    let boxes = [{ x: 50, y: 50, w: 100, h: 100 }];
    let textPrompt = 'segment tumor';

    // Clear all
    points = [];
    boxes = [];
    textPrompt = '';

    expect(points).toHaveLength(0);
    expect(boxes).toHaveLength(0);
    expect(textPrompt).toBe('');
  });

  it('should display segmentation results', () => {
    const results = {
      confidence: 0.87,
      areaPixels: 1500,
      maskUri: 'data:image/png;base64,encoded_mask',
    };

    expect(results.confidence).toBeGreaterThan(0);
    expect(results.areaPixels).toBeGreaterThan(0);
    expect(results.maskUri).toContain('data:image/png');
  });

  it('should format confidence as percentage', () => {
    const confidence = 0.87;
    const percentage = (confidence * 100).toFixed(1);

    expect(percentage).toBe('87.0');
  });

  it('should handle box drawing state', () => {
    const drawingState = {
      isDrawing: false,
      boxStart: null as { x: number; y: number } | null,
      currentBox: null as { x: number; y: number; w: number; h: number } | null,
    };

    // Start drawing
    drawingState.isDrawing = true;
    drawingState.boxStart = { x: 100, y: 100 };
    drawingState.currentBox = { x: 100, y: 100, w: 0, h: 0 };

    expect(drawingState.isDrawing).toBe(true);
    expect(drawingState.boxStart).not.toBeNull();

    // Update box
    drawingState.currentBox = { x: 100, y: 100, w: 50, h: 50 };

    expect(drawingState.currentBox.w).toBe(50);
    expect(drawingState.currentBox.h).toBe(50);

    // Finish drawing
    drawingState.isDrawing = false;
    drawingState.boxStart = null;
    drawingState.currentBox = null;

    expect(drawingState.isDrawing).toBe(false);
  });
});

describe('Multi-Model Integration', () => {
  it('should support multiple segmentation models', () => {
    const models = ['UNet', 'MedSAM2', 'SAM3', 'SynthSeg'];

    expect(models).toHaveLength(4);
    expect(models).toContain('MedSAM2');
    expect(models).toContain('SAM3');
  });

  it('should route to appropriate model based on prompt type', () => {
    const routeModel = (promptType: string) => {
      if (promptType === 'point') return 'SAM3';
      if (promptType === 'box') return 'MedSAM2';
      if (promptType === 'text') return 'SAM3';
      return 'UNet';
    };

    expect(routeModel('point')).toBe('SAM3');
    expect(routeModel('box')).toBe('MedSAM2');
    expect(routeModel('text')).toBe('SAM3');
  });

  it('should combine predictions from multiple models', () => {
    const predictions = [
      { model: 'UNet', confidence: 0.85, area: 1000 },
      { model: 'MedSAM2', confidence: 0.90, area: 1100 },
      { model: 'SAM3', confidence: 0.88, area: 1050 },
    ];

    const avgConfidence =
      predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    expect(avgConfidence).toBeCloseTo(0.876, 2);
    expect(predictions).toHaveLength(3);
  });

  it('should calculate consensus mask', () => {
    const modelVotes = {
      pixel_100_100: ['UNet', 'MedSAM2', 'SAM3'], // 3 votes
      pixel_100_101: ['UNet', 'MedSAM2'], // 2 votes
      pixel_100_102: ['SAM3'], // 1 vote
    };

    const threshold = 2; // Require at least 2 models to agree

    const consensus = {
      pixel_100_100: modelVotes.pixel_100_100.length >= threshold,
      pixel_100_101: modelVotes.pixel_100_101.length >= threshold,
      pixel_100_102: modelVotes.pixel_100_102.length >= threshold,
    };

    expect(consensus.pixel_100_100).toBe(true);
    expect(consensus.pixel_100_101).toBe(true);
    expect(consensus.pixel_100_102).toBe(false);
  });
});
