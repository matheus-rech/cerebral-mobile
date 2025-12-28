import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type ModelConfiguration,
  DEFAULT_MODEL_CONFIG,
  MODEL_PRESETS,
  type ModelPreset,
} from '../types/model-config';

const MODEL_CONFIG_KEY = '@cerebral_model_config';

/**
 * Load model configuration from AsyncStorage
 */
export async function loadModelConfig(): Promise<ModelConfiguration> {
  try {
    const stored = await AsyncStorage.getItem(MODEL_CONFIG_KEY);
    if (stored) {
      const config = JSON.parse(stored) as ModelConfiguration;
      return config;
    }
  } catch (error) {
    console.error('Failed to load model config:', error);
  }
  return DEFAULT_MODEL_CONFIG;
}

/**
 * Save model configuration to AsyncStorage
 */
export async function saveModelConfig(config: ModelConfiguration): Promise<void> {
  try {
    await AsyncStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save model config:', error);
    throw error;
  }
}

/**
 * Apply a preset to the current configuration
 */
export async function applyPreset(preset: ModelPreset): Promise<ModelConfiguration> {
  const current = await loadModelConfig();

  const updated: ModelConfiguration = {
    unet: { ...current.unet, ...preset.config.unet },
    medsam2: { ...current.medsam2, ...preset.config.medsam2 },
    sam3: { ...current.sam3, ...preset.config.sam3 },
    synthseg: { ...current.synthseg, ...preset.config.synthseg },
  };

  await saveModelConfig(updated);
  return updated;
}

/**
 * Reset configuration to defaults
 */
export async function resetModelConfig(): Promise<ModelConfiguration> {
  await saveModelConfig(DEFAULT_MODEL_CONFIG);
  return DEFAULT_MODEL_CONFIG;
}

/**
 * Get list of enabled models
 */
export function getEnabledModels(config: ModelConfiguration): string[] {
  const enabled: string[] = [];
  if (config.unet.enabled) enabled.push('UNet');
  if (config.medsam2.enabled) enabled.push('MedSAM2');
  if (config.sam3.enabled) enabled.push('SAM3');
  if (config.synthseg.enabled) enabled.push('SynthSeg');
  return enabled;
}

/**
 * Get count of enabled models
 */
export function getEnabledModelCount(config: ModelConfiguration): number {
  return getEnabledModels(config).length;
}

/**
 * Check if at least one model is enabled
 */
export function hasEnabledModels(config: ModelConfiguration): boolean {
  return getEnabledModelCount(config) > 0;
}
