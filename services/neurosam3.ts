/**
 * NeuroSAM3 HuggingFace Spaces Client
 * Integrates with mmrech/NeuroSAM3 for cloud-based medical image segmentation
 */

import { Client } from '@gradio/client';
import { Platform } from 'react-native';

// NeuroSAM3 HuggingFace Space URL
const NEUROSAM3_SPACE = 'mmrech/NeuroSAM3';
const NEUROSAM3_MCP_URL = 'https://mmrech-neurosam3.hf.space/gradio_api/mcp/';

// Modality options
export type Modality = 'MRI' | 'CT';

// CT Windowing strategies
export type WindowType = 
  | 'Brain (Grey Matter)'
  | 'Brain (White Matter)'
  | 'Bone'
  | 'Lung'
  | 'Soft Tissue'
  | 'Liver'
  | 'Stroke';

// Colormap options
export type Colormap = 
  | 'jet'
  | 'viridis'
  | 'plasma'
  | 'inferno'
  | 'magma'
  | 'hot'
  | 'cool'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter';

export interface SegmentationResult {
  imageUrl: string;
  status: string;
  success: boolean;
}

export interface SliceViewerResult {
  imageUrl: string;
  sliceNumber: number;
  status: string;
  currentSlice: string;
  subjectInfo: string;
}

export interface MultiMaskResult {
  masks: Array<{
    imageUrl: string;
    confidence: number;
  }>;
  status: string;
}

export interface GroundTruthResult {
  comparisonImageUrl: string;
  diceScore: number;
  iouScore: number;
  status: string;
}

let clientInstance: Client | null = null;

/**
 * Get or create a Gradio client connection
 */
async function getClient(): Promise<Client> {
  if (!clientInstance) {
    clientInstance = await Client.connect(NEUROSAM3_SPACE);
  }
  return clientInstance;
}

/**
 * Convert a local file URI to a Blob for upload
 */
async function uriToBlob(uri: string): Promise<Blob> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.blob();
  } else {
    // For React Native, we need to handle file:// URIs
    const response = await fetch(uri);
    return response.blob();
  }
}

/**
 * Load the demo DICOM file from NeuroSAM3
 */
export async function loadDemoFile(): Promise<{ fileUrl: string; status: string }> {
  const client = await getClient();
  const result = await client.predict('/load_demo_file', {});
  const data = result.data as unknown[];
  
  return {
    fileUrl: data[0] as string,
    status: data[1] as string,
  };
}

/**
 * Process image with text prompt segmentation
 */
export async function processWithTextPrompt(
  imageUri: string,
  promptText: string = 'brain',
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)'
): Promise<SegmentationResult> {
  try {
    const client = await getClient();
    const imageBlob = await uriToBlob(imageUri);
    
    const result = await client.predict('/process_with_status', {
      image_file: imageBlob,
      prompt_text: promptText,
      modality: modality,
      window_type: windowType,
    });
    const data = result.data as unknown[];
    
    return {
      imageUrl: data[0] as string,
      status: data[1] as string,
      success: true,
    };
  } catch (error) {
    console.error('NeuroSAM3 text prompt error:', error);
    return {
      imageUrl: '',
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
    };
  }
}

/**
 * Process image with point prompt
 */
export async function processWithPointPrompt(
  imageUri: string,
  pointX: number,
  pointY: number,
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)',
  colormap: Colormap = 'jet',
  transparency: number = 0.5
): Promise<SegmentationResult> {
  try {
    const client = await getClient();
    const imageBlob = await uriToBlob(imageUri);
    
    const result = await client.predict('/process_with_point_prompt', {
      image_file: imageBlob,
      point_x: Math.round(pointX),
      point_y: Math.round(pointY),
      modality: modality,
      window_type: windowType,
      colormap: colormap,
      transparency: transparency,
    });
    const data = result.data as unknown[];
    
    return {
      imageUrl: data[0] as string,
      status: data[1] as string,
      success: true,
    };
  } catch (error) {
    console.error('NeuroSAM3 point prompt error:', error);
    return {
      imageUrl: '',
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
    };
  }
}

/**
 * Process image with bounding box prompt
 */
export async function processWithBoxPrompt(
  imageUri: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)',
  colormap: Colormap = 'jet',
  transparency: number = 0.5
): Promise<SegmentationResult> {
  try {
    const client = await getClient();
    const imageBlob = await uriToBlob(imageUri);
    
    const result = await client.predict('/process_with_box_prompt', {
      image_file: imageBlob,
      x1: Math.round(x1),
      y1: Math.round(y1),
      x2: Math.round(x2),
      y2: Math.round(y2),
      modality: modality,
      window_type: windowType,
      colormap: colormap,
      transparency: transparency,
    });
    const data = result.data as unknown[];
    
    return {
      imageUrl: data[0] as string,
      status: data[1] as string,
      success: true,
    };
  } catch (error) {
    console.error('NeuroSAM3 box prompt error:', error);
    return {
      imageUrl: '',
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
    };
  }
}

/**
 * Automatic Mask Generator (AMG) - segment without prompts
 */
export async function automaticMaskGenerator(
  imageUri: string,
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)',
  pointsPerSide: number = 32,
  minMaskArea: number = 100,
  colormap: Colormap = 'viridis'
): Promise<SegmentationResult> {
  try {
    const client = await getClient();
    const imageBlob = await uriToBlob(imageUri);
    
    const result = await client.predict('/automatic_mask_generator', {
      image_file: imageBlob,
      modality: modality,
      window_type: windowType,
      points_per_side: pointsPerSide,
      min_mask_area: minMaskArea,
      colormap: colormap,
    });
    const data = result.data as unknown[];
    
    return {
      imageUrl: data[0] as string,
      status: data[1] as string,
      success: true,
    };
  } catch (error) {
    console.error('NeuroSAM3 AMG error:', error);
    return {
      imageUrl: '',
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
    };
  }
}

/**
 * Edge-based segmentation using Sobel/Canny detection
 */
export async function edgeBasedSegmentation(
  imageUri: string,
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)',
  edgeThreshold: number = 50,
  dilationSize: number = 2,
  colormap: Colormap = 'jet',
  transparency: number = 0.5
): Promise<SegmentationResult> {
  try {
    const client = await getClient();
    const imageBlob = await uriToBlob(imageUri);
    
    const result = await client.predict('/edge_based_segmentation', {
      image_file: imageBlob,
      modality: modality,
      window_type: windowType,
      edge_threshold: edgeThreshold,
      dilation_size: dilationSize,
      colormap: colormap,
      transparency: transparency,
    });
    const data = result.data as unknown[];
    
    return {
      imageUrl: data[0] as string,
      status: data[1] as string,
      success: true,
    };
  } catch (error) {
    console.error('NeuroSAM3 edge segmentation error:', error);
    return {
      imageUrl: '',
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
    };
  }
}

/**
 * Process with advanced transforms (CLAHE, resize)
 */
export async function processWithAdvancedTransforms(
  imageUri: string,
  promptText: string = 'brain',
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)',
  targetSize: number = 1024,
  applyClahe: boolean = true,
  claheClip: number = 2.0,
  colormap: Colormap = 'jet',
  transparency: number = 0.5
): Promise<SegmentationResult> {
  try {
    const client = await getClient();
    const imageBlob = await uriToBlob(imageUri);
    
    const result = await client.predict('/process_with_advanced_transforms', {
      image_file: imageBlob,
      prompt_text: promptText,
      modality: modality,
      window_type: windowType,
      target_size: targetSize,
      apply_clahe: applyClahe,
      clahe_clip: claheClip,
      colormap: colormap,
      transparency: transparency,
    });
    const data = result.data as unknown[];
    
    return {
      imageUrl: data[0] as string,
      status: data[1] as string,
      success: true,
    };
  } catch (error) {
    console.error('NeuroSAM3 advanced transforms error:', error);
    return {
      imageUrl: '',
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
    };
  }
}

/**
 * Process with ground truth comparison
 */
export async function processWithGroundTruth(
  imageUri: string,
  groundTruthUri: string,
  promptText: string = 'tumor',
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)'
): Promise<GroundTruthResult> {
  try {
    const client = await getClient();
    const imageBlob = await uriToBlob(imageUri);
    const gtBlob = await uriToBlob(groundTruthUri);
    
    const result = await client.predict('/process_with_ground_truth', {
      image_file: imageBlob,
      gt_mask_file: gtBlob,
      prompt_text: promptText,
      modality: modality,
      window_type: windowType,
    });
    const data = result.data as unknown[];
    
    // Parse metrics from status string
    const status = data[1] as string;
    const diceMatch = status.match(/Dice:\s*([\d.]+)/);
    const iouMatch = status.match(/IoU:\s*([\d.]+)/);
    
    return {
      comparisonImageUrl: data[0] as string,
      diceScore: diceMatch ? parseFloat(diceMatch[1]) : 0,
      iouScore: iouMatch ? parseFloat(iouMatch[1]) : 0,
      status: status,
    };
  } catch (error) {
    console.error('NeuroSAM3 ground truth error:', error);
    return {
      comparisonImageUrl: '',
      diceScore: 0,
      iouScore: 0,
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate multiple mask candidates
 */
export async function processMultiMask(
  imageUri: string,
  promptText: string = 'brain',
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)',
  numMasks: number = 3
): Promise<MultiMaskResult> {
  try {
    const client = await getClient();
    const imageBlob = await uriToBlob(imageUri);
    
    const result = await client.predict('/process_multi_mask', {
      image_file: imageBlob,
      prompt_text: promptText,
      modality: modality,
      window_type: windowType,
      num_masks: numMasks,
    });
    const data = result.data as unknown[];
    
    // Parse gallery results
    const galleryData = data[0] as Array<{ image: string; caption: string }>;
    const masks = galleryData.map((item, index) => {
      const confidenceMatch = item.caption?.match(/(\d+(?:\.\d+)?)/);
      return {
        imageUrl: item.image,
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 : 0.5 + (0.1 * (numMasks - index)),
      };
    });
    
    return {
      masks,
      status: data[1] as string,
    };
  } catch (error) {
    console.error('NeuroSAM3 multi-mask error:', error);
    return {
      masks: [],
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Export mask to NIfTI format
 */
export async function exportMaskToNifti(): Promise<{ fileUrl: string; status: string }> {
  try {
    const client = await getClient();
    const result = await client.predict('/export_last_mask_nifti', {});
    const data = result.data as unknown[];
    
    return {
      fileUrl: data[0] as string,
      status: data[1] as string,
    };
  } catch (error) {
    console.error('NeuroSAM3 NIfTI export error:', error);
    return {
      fileUrl: '',
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Save annotation
 */
export async function saveAnnotation(): Promise<{ fileUrl: string; status: string }> {
  try {
    const client = await getClient();
    const result = await client.predict('/save_last_annotation', {});
    const data = result.data as unknown[];
    
    return {
      fileUrl: data[0] as string,
      status: data[1] as string,
    };
  } catch (error) {
    console.error('NeuroSAM3 save annotation error:', error);
    return {
      fileUrl: '',
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if NeuroSAM3 is available
 */
export async function checkAvailability(): Promise<boolean> {
  try {
    const client = await getClient();
    return client !== null;
  } catch {
    return false;
  }
}

/**
 * Get MCP server URL for external integrations
 */
export function getMcpServerUrl(): string {
  return NEUROSAM3_MCP_URL;
}

// Export types and constants
export const WINDOW_TYPES: WindowType[] = [
  'Brain (Grey Matter)',
  'Brain (White Matter)',
  'Bone',
  'Lung',
  'Soft Tissue',
  'Liver',
  'Stroke',
];

export const COLORMAPS: Colormap[] = [
  'jet',
  'viridis',
  'plasma',
  'inferno',
  'magma',
  'hot',
  'cool',
  'spring',
  'summer',
  'autumn',
  'winter',
];
