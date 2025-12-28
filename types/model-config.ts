/**
 * Model Configuration Types
 * Defines settings and parameters for each AI model
 */

export type ModelType = 'unet' | 'medsam2' | 'sam3' | 'synthseg';

export interface UNetConfig {
  enabled: boolean;
  confidenceThreshold: number; // 0-1
  minLesionSize: number; // pixels
  maxLesionSize: number; // pixels
}

export interface MedSAM2Config {
  enabled: boolean;
  promptType: 'point' | 'box' | 'auto';
  refinementIterations: number; // 1-5
  confidenceThreshold: number; // 0-1
}

export interface SAM3Config {
  enabled: boolean;
  promptMode: 'point' | 'box' | 'text';
  textPrompt?: string;
  confidenceThreshold: number; // 0-1
  enableZeroShot: boolean;
}

export interface SynthSegConfig {
  enabled: boolean;
  structures: string[]; // Selected brain structures
  volumetricUnits: 'mm3' | 'ml';
  includeSubcortical: boolean;
  includeCortical: boolean;
}

export interface ModelConfiguration {
  unet: UNetConfig;
  medsam2: MedSAM2Config;
  sam3: SAM3Config;
  synthseg: SynthSegConfig;
}

export const DEFAULT_MODEL_CONFIG: ModelConfiguration = {
  unet: {
    enabled: true,
    confidenceThreshold: 0.5,
    minLesionSize: 10,
    maxLesionSize: 10000,
  },
  medsam2: {
    enabled: true,
    promptType: 'auto',
    refinementIterations: 2,
    confidenceThreshold: 0.7,
  },
  sam3: {
    enabled: true,
    promptMode: 'point',
    confidenceThreshold: 0.6,
    enableZeroShot: true,
  },
  synthseg: {
    enabled: true,
    structures: ['all'],
    volumetricUnits: 'ml',
    includeSubcortical: true,
    includeCortical: true,
  },
};

export interface ModelInfo {
  name: string;
  type: ModelType;
  description: string;
  useCase: string;
  color: string;
  icon: string;
  parameters: number; // Model size in millions
  inferenceTime: string; // Typical time
}

export const MODEL_INFO: Record<ModelType, ModelInfo> = {
  unet: {
    name: 'UNet Lesion Detector',
    type: 'unet',
    description: 'Pretrained model for detecting hyperintense lesions, MS plaques, and tumors',
    useCase: 'Best for: Lesion detection, tumor identification, abnormality screening',
    color: '#EF4444',
    icon: '🔴',
    parameters: 7.7,
    inferenceTime: '~200ms',
  },
  medsam2: {
    name: 'MedSAM2',
    type: 'medsam2',
    description: 'Medical image segmentation with interactive prompting for precise boundaries',
    useCase: 'Best for: Tumor boundary delineation, organ segmentation, interactive refinement',
    color: '#3B82F6',
    icon: '🔵',
    parameters: 89.0,
    inferenceTime: '~500ms',
  },
  sam3: {
    name: 'SAM3',
    type: 'sam3',
    description: 'Next-gen Segment Anything model with text prompts and zero-shot detection',
    useCase: 'Best for: General object detection, text-based segmentation, small lesions',
    color: '#10B981',
    icon: '🟢',
    parameters: 636.0,
    inferenceTime: '~800ms',
  },
  synthseg: {
    name: 'SynthSeg',
    type: 'synthseg',
    description: 'FreeSurfer-based brain structure segmentation with 32+ anatomical regions',
    useCase: 'Best for: Brain parcellation, volumetric analysis, anatomical mapping',
    color: '#F59E0B',
    icon: '🟠',
    parameters: 18.8,
    inferenceTime: '~1000ms',
  },
};

export interface ModelPreset {
  name: string;
  description: string;
  config: {
    unet?: Partial<UNetConfig>;
    medsam2?: Partial<MedSAM2Config>;
    sam3?: Partial<SAM3Config>;
    synthseg?: Partial<SynthSegConfig>;
  };
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    name: 'All Models',
    description: 'Run all available models for comprehensive analysis',
    config: {
      unet: { enabled: true },
      medsam2: { enabled: true },
      sam3: { enabled: true },
      synthseg: { enabled: true },
    },
  },
  {
    name: 'Lesion Detection Only',
    description: 'Focus on detecting lesions and abnormalities',
    config: {
      unet: { enabled: true },
      medsam2: { enabled: false },
      sam3: { enabled: true, promptMode: 'text', textPrompt: 'lesion' },
      synthseg: { enabled: false },
    },
  },
  {
    name: 'Brain Structures Only',
    description: 'Segment and analyze brain anatomical structures',
    config: {
      unet: { enabled: false },
      medsam2: { enabled: false },
      sam3: { enabled: false },
      synthseg: { enabled: true },
    },
  },
  {
    name: 'Interactive Segmentation',
    description: 'Use prompt-based models for manual refinement',
    config: {
      unet: { enabled: false },
      medsam2: { enabled: true, promptType: 'point' },
      sam3: { enabled: true, promptMode: 'box' },
      synthseg: { enabled: false },
    },
  },
];
