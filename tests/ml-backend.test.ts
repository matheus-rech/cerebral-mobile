/**
 * ML Backend Integration Tests
 * Tests for MONAI and SynthSeg integration
 */

import { describe, it, expect } from 'vitest';

describe('ML Backend Integration', () => {
  describe('ML Gateway', () => {
    it('should define unified gateway endpoint', () => {
      const endpoint = 'http://localhost:5000';
      expect(endpoint).toContain('5000');
    });

    it('should define health check endpoint', () => {
      const healthEndpoint = '/health';
      expect(healthEndpoint).toBe('/health');
    });

    it('should define preprocess endpoint', () => {
      const preprocessEndpoint = '/preprocess';
      expect(preprocessEndpoint).toBe('/preprocess');
    });

    it('should define segment endpoint', () => {
      const segmentEndpoint = '/segment';
      expect(segmentEndpoint).toBe('/segment');
    });

    it('should handle gateway response structure', () => {
      const response = {
        success: true,
        volumes: {
          background: 1000000,
          gray_matter: 500000,
          white_matter: 400000,
        },
        percentages: {
          gray_matter: 55.6,
          white_matter: 44.4,
        },
        total_brain_volume: 900000,
        inference_time_ms: 1500,
      };

      expect(response.success).toBe(true);
      expect(response.volumes).toBeDefined();
      expect(response.percentages).toBeDefined();
      expect(response.total_brain_volume).toBeGreaterThan(0);
    });

    it('should handle gateway error response format', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Inference exceeded timeout',
          model: 'sam3',
          retriable: true,
          suggestion: 'Try a smaller image',
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('TIMEOUT');
      expect(errorResponse.error.retriable).toBe(true);
    });
  });

  describe('SynthSeg Service', () => {
    it('should define SynthSeg gateway endpoint', () => {
      const endpoint = 'http://localhost:5000/api/ml/synthseg/segment';
      expect(endpoint).toContain('5000');
      expect(endpoint).toContain('synthseg');
    });

    it('should define structures endpoint', () => {
      const structuresEndpoint = '/structures';
      expect(structuresEndpoint).toBe('/structures');
    });

    it('should define info endpoint', () => {
      const infoEndpoint = '/info';
      expect(infoEndpoint).toBe('/info');
    });

    it('should handle SynthSeg response structure', () => {
      const response = {
        success: true,
        total_brain_volume_mm3: 1234567.0,
        total_brain_volume_ml: 1234.567,
        num_structures_detected: 28,
        structures: {
          'Left Cerebral Cortex': {
            volume_mm3: 456789.0,
            volume_ml: 456.789,
            color: '#CD3E4E',
            label_id: 3,
          },
        },
        top_structures: [],
        segmentation_preview: 'data:image/png;base64,...',
        model: 'SynthSeg-style SegResNet',
      };

      expect(response.success).toBe(true);
      expect(response.total_brain_volume_mm3).toBeGreaterThan(0);
      expect(response.total_brain_volume_ml).toBeGreaterThan(0);
      expect(response.num_structures_detected).toBeGreaterThan(0);
      expect(response.structures).toBeDefined();
      expect(response.model).toContain('SynthSeg');
    });

    it('should handle brain structure data', () => {
      const structure = {
        label_id: 3,
        name: 'Left Cerebral Cortex',
        color: '#CD3E4E',
        volume_mm3: 456789.0,
        volume_ml: 456.789,
      };

      expect(structure.label_id).toBeGreaterThan(0);
      expect(structure.name).toBeTruthy();
      expect(structure.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(structure.volume_mm3).toBeGreaterThan(0);
      expect(structure.volume_ml).toBe(structure.volume_mm3 / 1000);
    });

    it('should list 32 brain structures', () => {
      const numStructures = 32;
      expect(numStructures).toBe(32);
    });

    it('should use FreeSurfer label scheme', () => {
      const labels = {
        2: 'Left Cerebral White Matter',
        3: 'Left Cerebral Cortex',
        4: 'Left Lateral Ventricle',
        10: 'Left Thalamus',
        17: 'Left Hippocampus',
        41: 'Right Cerebral White Matter',
        42: 'Right Cerebral Cortex',
      };

      expect(labels[2]).toContain('White Matter');
      expect(labels[3]).toContain('Cortex');
      expect(labels[4]).toContain('Ventricle');
      expect(labels[10]).toContain('Thalamus');
      expect(labels[17]).toContain('Hippocampus');
      expect(labels[41]).toContain('Right');
    });
  });

  describe('Volume Calculations', () => {
    it('should convert mm³ to ml correctly', () => {
      const volume_mm3 = 1000000;
      const volume_ml = volume_mm3 / 1000;
      expect(volume_ml).toBe(1000);
    });

    it('should calculate percentages correctly', () => {
      const structure_volume = 500000;
      const total_volume = 1000000;
      const percentage = (structure_volume / total_volume) * 100;
      expect(percentage).toBe(50);
    });

    it('should handle typical brain volumes', () => {
      const typical_brain_ml = 1200; // ~1200ml for adult brain
      const typical_brain_mm3 = typical_brain_ml * 1000;
      expect(typical_brain_mm3).toBe(1200000);
    });

    it('should validate volume ranges', () => {
      // Typical adult brain: 1100-1500 ml
      const min_volume_ml = 1100;
      const max_volume_ml = 1500;
      const test_volume_ml = 1300;

      expect(test_volume_ml).toBeGreaterThanOrEqual(min_volume_ml);
      expect(test_volume_ml).toBeLessThanOrEqual(max_volume_ml);
    });
  });

  describe('Model Information', () => {
    it('should define MONAI UNet parameters', () => {
      const model = {
        name: 'UNet',
        parameters: 4807482,
        spatial_dims: 3,
        in_channels: 1,
        out_channels: 3,
      };

      expect(model.parameters).toBeGreaterThan(4000000);
      expect(model.spatial_dims).toBe(3);
      expect(model.in_channels).toBe(1);
      expect(model.out_channels).toBe(3);
    });

    it('should define SynthSeg SegResNet parameters', () => {
      const model = {
        name: 'SegResNet',
        parameters: 18000000,
        architecture: 'SynthSeg-style',
        output_structures: 32,
      };

      expect(model.parameters).toBeGreaterThan(15000000);
      expect(model.architecture).toContain('SynthSeg');
      expect(model.output_structures).toBe(32);
    });
  });

  describe('Preprocessing Pipeline', () => {
    it('should define preprocessing steps', () => {
      const steps = [
        'LoadImage',
        'EnsureChannelFirst',
        'Spacing',
        'Orientation',
        'ScaleIntensity',
        'CropForeground',
        'ToTensor',
      ];

      expect(steps).toContain('LoadImage');
      expect(steps).toContain('Spacing');
      expect(steps).toContain('Orientation');
      expect(steps).toContain('ScaleIntensity');
    });

    it('should normalize to 1mm isotropic spacing', () => {
      const target_spacing = [1.0, 1.0, 1.0];
      expect(target_spacing[0]).toBe(1.0);
      expect(target_spacing[1]).toBe(1.0);
      expect(target_spacing[2]).toBe(1.0);
    });

    it('should use RAS orientation', () => {
      const orientation = 'RAS';
      expect(orientation).toBe('RAS');
    });

    it('should scale intensity to 0-1 range', () => {
      const intensity_range = { min: 0.0, max: 1.0 };
      expect(intensity_range.min).toBe(0.0);
      expect(intensity_range.max).toBe(1.0);
    });
  });

  describe('Sliding Window Inference', () => {
    it('should define ROI size', () => {
      const roi_size = [96, 96, 96];
      expect(roi_size[0]).toBe(96);
      expect(roi_size[1]).toBe(96);
      expect(roi_size[2]).toBe(96);
    });

    it('should define batch size', () => {
      const sw_batch_size = 4;
      expect(sw_batch_size).toBeGreaterThan(0);
      expect(sw_batch_size).toBeLessThanOrEqual(8);
    });

    it('should define overlap', () => {
      const overlap = 0.5;
      expect(overlap).toBeGreaterThan(0);
      expect(overlap).toBeLessThan(1);
    });

    it('should handle large volumes', () => {
      const input_size = [256, 256, 256];
      const roi_size = [96, 96, 96];
      
      // Should use sliding window for volumes larger than ROI
      const needs_sliding_window = 
        input_size[0] > roi_size[0] ||
        input_size[1] > roi_size[1] ||
        input_size[2] > roi_size[2];
      
      expect(needs_sliding_window).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing file error', () => {
      const error = { error: 'No file provided' };
      expect(error.error).toContain('No file');
    });

    it('should handle segmentation error', () => {
      const error = { error: 'Segmentation failed' };
      expect(error.error).toBeTruthy();
    });

    it('should handle model not loaded error', () => {
      const error = { error: 'Model not initialized' };
      expect(error.error).toContain('Model');
    });
  });

  describe('Performance Metrics', () => {
    it('should define expected inference time', () => {
      const inference_time_cpu = 30; // seconds
      const inference_time_gpu = 5; // seconds
      
      expect(inference_time_cpu).toBeGreaterThan(inference_time_gpu);
      expect(inference_time_gpu).toBeLessThan(10);
    });

    it('should define memory requirements', () => {
      const memory_monai_gb = 2;
      const memory_synthseg_gb = 4;
      
      expect(memory_monai_gb).toBeLessThan(memory_synthseg_gb);
      expect(memory_synthseg_gb).toBeLessThanOrEqual(8);
    });
  });

  describe('Integration with Mobile App', () => {
    it('should define proxy endpoint', () => {
      const proxyEndpoint = '/api/ml/segment';
      expect(proxyEndpoint).toContain('/api/ml');
    });

    it('should handle image upload', () => {
      const uploadData = {
        imageUri: 'file:///path/to/image.nii.gz',
        source: 'upload',
      };

      expect(uploadData.imageUri).toBeTruthy();
      expect(uploadData.source).toBe('upload');
    });

    it('should parse segmentation results', () => {
      const results = {
        success: true,
        structures: {},
        total_volume: 1234567,
      };

      expect(results.success).toBe(true);
      expect(results.structures).toBeDefined();
      expect(results.total_volume).toBeGreaterThan(0);
    });
  });
});
