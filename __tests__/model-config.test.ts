/**
 * Model Configuration Tests
 * Tests for model configuration storage and management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveModelConfig,
  loadModelConfig,
  resetModelConfig,
  getEnabledModels,
  getEnabledModelCount,
  hasEnabledModels,
  applyPreset,
} from '../services/model-config-storage';
import {
  type ModelConfiguration,
  DEFAULT_MODEL_CONFIG,
  MODEL_PRESETS,
} from '../types/model-config';

describe('Model Configuration Storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('saveModelConfig', () => {
    it('should save model configuration to AsyncStorage', async () => {
      const config: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, enabled: false },
      };

      await saveModelConfig(config);
      const saved = await AsyncStorage.getItem('@cerebral_model_config');
      expect(saved).toBeTruthy();
      
      const parsed = JSON.parse(saved!);
      expect(parsed.unet.enabled).toBe(false);
    });

    it('should overwrite existing configuration', async () => {
      await saveModelConfig(DEFAULT_MODEL_CONFIG);
      
      const newConfig: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        medsam2: { ...DEFAULT_MODEL_CONFIG.medsam2, confidenceThreshold: 0.9 },
      };
      
      await saveModelConfig(newConfig);
      const saved = await AsyncStorage.getItem('@cerebral_model_config');
      const parsed = JSON.parse(saved!);
      expect(parsed.medsam2.confidenceThreshold).toBe(0.9);
    });
  });

  describe('loadModelConfig', () => {
    it('should load saved configuration', async () => {
      const config: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        sam3: { ...DEFAULT_MODEL_CONFIG.sam3, promptMode: 'text' },
      };

      await saveModelConfig(config);
      const loaded = await loadModelConfig();
      
      expect(loaded.sam3.promptMode).toBe('text');
    });

    it('should return default config when nothing is saved', async () => {
      const loaded = await loadModelConfig();
      expect(loaded).toEqual(DEFAULT_MODEL_CONFIG);
    });

    it('should handle corrupted storage gracefully', async () => {
      await AsyncStorage.setItem('@cerebral_model_config', 'invalid json');
      const loaded = await loadModelConfig();
      expect(loaded).toEqual(DEFAULT_MODEL_CONFIG);
    });
  });

  describe('resetModelConfig', () => {
    it('should reset configuration to defaults', async () => {
      const customConfig: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, enabled: false },
      };

      await saveModelConfig(customConfig);
      const reset = await resetModelConfig();
      
      expect(reset).toEqual(DEFAULT_MODEL_CONFIG);
      expect(reset.unet.enabled).toBe(true);
    });
  });

  describe('getEnabledModels', () => {
    it('should return list of enabled model names', () => {
      const config: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, enabled: true },
        medsam2: { ...DEFAULT_MODEL_CONFIG.medsam2, enabled: false },
        sam3: { ...DEFAULT_MODEL_CONFIG.sam3, enabled: true },
        synthseg: { ...DEFAULT_MODEL_CONFIG.synthseg, enabled: false },
      };

      const enabled = getEnabledModels(config);
      expect(enabled).toEqual(['UNet', 'SAM3']);
    });

    it('should return empty array when no models enabled', () => {
      const config: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, enabled: false },
        medsam2: { ...DEFAULT_MODEL_CONFIG.medsam2, enabled: false },
        sam3: { ...DEFAULT_MODEL_CONFIG.sam3, enabled: false },
        synthseg: { ...DEFAULT_MODEL_CONFIG.synthseg, enabled: false },
      };

      const enabled = getEnabledModels(config);
      expect(enabled).toEqual([]);
    });

    it('should return all models when all enabled', () => {
      const enabled = getEnabledModels(DEFAULT_MODEL_CONFIG);
      expect(enabled).toEqual(['UNet', 'MedSAM2', 'SAM3', 'SynthSeg']);
    });
  });

  describe('getEnabledModelCount', () => {
    it('should count enabled models correctly', () => {
      const config: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, enabled: true },
        medsam2: { ...DEFAULT_MODEL_CONFIG.medsam2, enabled: true },
        sam3: { ...DEFAULT_MODEL_CONFIG.sam3, enabled: false },
        synthseg: { ...DEFAULT_MODEL_CONFIG.synthseg, enabled: false },
      };

      const count = getEnabledModelCount(config);
      expect(count).toBe(2);
    });

    it('should return 0 when no models enabled', () => {
      const config: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, enabled: false },
        medsam2: { ...DEFAULT_MODEL_CONFIG.medsam2, enabled: false },
        sam3: { ...DEFAULT_MODEL_CONFIG.sam3, enabled: false },
        synthseg: { ...DEFAULT_MODEL_CONFIG.synthseg, enabled: false },
      };

      const count = getEnabledModelCount(config);
      expect(count).toBe(0);
    });
  });

  describe('hasEnabledModels', () => {
    it('should return true when at least one model is enabled', () => {
      const config: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, enabled: false },
        medsam2: { ...DEFAULT_MODEL_CONFIG.medsam2, enabled: false },
        sam3: { ...DEFAULT_MODEL_CONFIG.sam3, enabled: true },
        synthseg: { ...DEFAULT_MODEL_CONFIG.synthseg, enabled: false },
      };

      expect(hasEnabledModels(config)).toBe(true);
    });

    it('should return false when no models are enabled', () => {
      const config: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, enabled: false },
        medsam2: { ...DEFAULT_MODEL_CONFIG.medsam2, enabled: false },
        sam3: { ...DEFAULT_MODEL_CONFIG.sam3, enabled: false },
        synthseg: { ...DEFAULT_MODEL_CONFIG.synthseg, enabled: false },
      };

      expect(hasEnabledModels(config)).toBe(false);
    });
  });

  describe('applyPreset', () => {
    it('should apply "All Models" preset correctly', async () => {
      const preset = MODEL_PRESETS[0]; // All Models
      const config = await applyPreset(preset);

      expect(config.unet.enabled).toBe(true);
      expect(config.medsam2.enabled).toBe(true);
      expect(config.sam3.enabled).toBe(true);
      expect(config.synthseg.enabled).toBe(true);
    });

    it('should apply "Lesion Detection Only" preset correctly', async () => {
      const preset = MODEL_PRESETS[1]; // Lesion Detection Only
      const config = await applyPreset(preset);

      expect(config.unet.enabled).toBe(true);
      expect(config.medsam2.enabled).toBe(false);
      expect(config.sam3.enabled).toBe(true);
      expect(config.synthseg.enabled).toBe(false);
    });

    it('should apply "Brain Structures Only" preset correctly', async () => {
      const preset = MODEL_PRESETS[2]; // Brain Structures Only
      const config = await applyPreset(preset);

      expect(config.unet.enabled).toBe(false);
      expect(config.medsam2.enabled).toBe(false);
      expect(config.sam3.enabled).toBe(false);
      expect(config.synthseg.enabled).toBe(true);
    });

    it('should apply "Interactive Segmentation" preset correctly', async () => {
      const preset = MODEL_PRESETS[3]; // Interactive Segmentation
      const config = await applyPreset(preset);

      expect(config.unet.enabled).toBe(false);
      expect(config.medsam2.enabled).toBe(true);
      expect(config.medsam2.promptType).toBe('point');
      expect(config.sam3.enabled).toBe(true);
      expect(config.sam3.promptMode).toBe('box');
      expect(config.synthseg.enabled).toBe(false);
    });

    it('should preserve unmodified parameters when applying preset', async () => {
      const customConfig: ModelConfiguration = {
        ...DEFAULT_MODEL_CONFIG,
        unet: { ...DEFAULT_MODEL_CONFIG.unet, minLesionSize: 50 },
      };
      await saveModelConfig(customConfig);

      const preset = MODEL_PRESETS[0];
      const config = await applyPreset(preset);

      // minLesionSize should be preserved if preset doesn't override it
      expect(config.unet.minLesionSize).toBe(50);
    });
  });

  describe('Model Configuration Types', () => {
    it('should have valid UNet configuration', () => {
      const config = DEFAULT_MODEL_CONFIG.unet;
      expect(config.enabled).toBeDefined();
      expect(config.confidenceThreshold).toBeGreaterThanOrEqual(0);
      expect(config.confidenceThreshold).toBeLessThanOrEqual(1);
      expect(config.minLesionSize).toBeGreaterThan(0);
      expect(config.maxLesionSize).toBeGreaterThan(config.minLesionSize);
    });

    it('should have valid MedSAM2 configuration', () => {
      const config = DEFAULT_MODEL_CONFIG.medsam2;
      expect(config.enabled).toBeDefined();
      expect(['point', 'box', 'auto']).toContain(config.promptType);
      expect(config.refinementIterations).toBeGreaterThanOrEqual(1);
      expect(config.refinementIterations).toBeLessThanOrEqual(5);
      expect(config.confidenceThreshold).toBeGreaterThanOrEqual(0);
      expect(config.confidenceThreshold).toBeLessThanOrEqual(1);
    });

    it('should have valid SAM3 configuration', () => {
      const config = DEFAULT_MODEL_CONFIG.sam3;
      expect(config.enabled).toBeDefined();
      expect(['point', 'box', 'text']).toContain(config.promptMode);
      expect(config.confidenceThreshold).toBeGreaterThanOrEqual(0);
      expect(config.confidenceThreshold).toBeLessThanOrEqual(1);
      expect(config.enableZeroShot).toBeDefined();
    });

    it('should have valid SynthSeg configuration', () => {
      const config = DEFAULT_MODEL_CONFIG.synthseg;
      expect(config.enabled).toBeDefined();
      expect(config.structures).toBeDefined();
      expect(Array.isArray(config.structures)).toBe(true);
      expect(['mm3', 'ml']).toContain(config.volumetricUnits);
      expect(config.includeSubcortical).toBeDefined();
      expect(config.includeCortical).toBeDefined();
    });
  });

  describe('Model Info', () => {
    it('should have complete model information for all models', async () => {
      const modelTypes: Array<'unet' | 'medsam2' | 'sam3' | 'synthseg'> = [
        'unet',
        'medsam2',
        'sam3',
        'synthseg',
      ];

      const { MODEL_INFO } = await import('../types/model-config');

      modelTypes.forEach((type) => {
        const info = MODEL_INFO[type];
        expect(info.name).toBeTruthy();
        expect(info.type).toBe(type);
        expect(info.description).toBeTruthy();
        expect(info.useCase).toBeTruthy();
        expect(info.color).toBeTruthy();
        expect(info.icon).toBeTruthy();
        expect(info.parameters).toBeGreaterThan(0);
        expect(info.inferenceTime).toBeTruthy();
      });
    });
  });
});
