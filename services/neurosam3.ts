/**
 * NeuroSAM3 HuggingFace Spaces Client
 * Integrates with mmrech/NeuroSAM3 for cloud-based medical image segmentation
 * 
 * NOTE: Uses fetch API instead of @gradio/client to avoid Node.js-specific dependencies
 * that break React Native builds (fs/promises, etc.)
 */

import { Platform } from 'react-native';

// NeuroSAM3 HuggingFace Space URL
const NEUROSAM3_SPACE = 'mmrech/NeuroSAM3';
const NEUROSAM3_API_URL = 'https://mmrech-neurosam3.hf.space/api/predict';
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

/**
 * Convert a local file URI to base64 for upload
 */
async function uriToBase64(uri: string): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix if present
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URI to base64:', error);
    throw error;
  }
}

/**
 * Make a prediction request to the Gradio API
 */
async function predict(endpoint: string, data: Record<string, unknown>): Promise<unknown[]> {
  try {
    const response = await fetch(`https://mmrech-neurosam3.hf.space/api/predict/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: Object.values(data) }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Gradio API error:', error);
    throw error;
  }
}

/**
 * Load the demo DICOM file from NeuroSAM3
 */
export async function loadDemoFile(): Promise<{ fileUrl: string; status: string }> {
  const result = await predict('load_demo_file', {});
  
  return {
    fileUrl: result[0] as string,
    status: result[1] as string,
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
    const imageBase64 = await uriToBase64(imageUri);
    
    const result = await predict('process_with_status', {
      image_file: `data:image/png;base64,${imageBase64}`,
      prompt_text: promptText,
      modality: modality,
      window_type: windowType,
    });
    
    return {
      imageUrl: result[0] as string,
      status: result[1] as string,
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
    const imageBase64 = await uriToBase64(imageUri);
    
    const result = await predict('process_with_point_prompt', {
      image_file: `data:image/png;base64,${imageBase64}`,
      point_x: Math.round(pointX),
      point_y: Math.round(pointY),
      modality: modality,
      window_type: windowType,
      colormap: colormap,
      transparency: transparency,
    });
    
    return {
      imageUrl: result[0] as string,
      status: result[1] as string,
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
    const imageBase64 = await uriToBase64(imageUri);
    
    const result = await predict('process_with_box_prompt', {
      image_file: `data:image/png;base64,${imageBase64}`,
      x1: Math.round(x1),
      y1: Math.round(y1),
      x2: Math.round(x2),
      y2: Math.round(y2),
      modality: modality,
      window_type: windowType,
      colormap: colormap,
      transparency: transparency,
    });
    
    return {
      imageUrl: result[0] as string,
      status: result[1] as string,
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
    const imageBase64 = await uriToBase64(imageUri);
    
    const result = await predict('automatic_mask_generator', {
      image_file: `data:image/png;base64,${imageBase64}`,
      modality: modality,
      window_type: windowType,
      points_per_side: pointsPerSide,
      min_mask_area: minMaskArea,
      colormap: colormap,
    });
    
    return {
      imageUrl: result[0] as string,
      status: result[1] as string,
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
    const imageBase64 = await uriToBase64(imageUri);
    
    const result = await predict('edge_based_segmentation', {
      image_file: `data:image/png;base64,${imageBase64}`,
      modality: modality,
      window_type: windowType,
      edge_threshold: edgeThreshold,
      dilation_size: dilationSize,
      colormap: colormap,
      transparency: transparency,
    });
    
    return {
      imageUrl: result[0] as string,
      status: result[1] as string,
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
    const imageBase64 = await uriToBase64(imageUri);
    
    const result = await predict('process_with_advanced_transforms', {
      image_file: `data:image/png;base64,${imageBase64}`,
      prompt_text: promptText,
      modality: modality,
      window_type: windowType,
      target_size: targetSize,
      apply_clahe: applyClahe,
      clahe_clip: claheClip,
      colormap: colormap,
      transparency: transparency,
    });
    
    return {
      imageUrl: result[0] as string,
      status: result[1] as string,
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
    const imageBase64 = await uriToBase64(imageUri);
    const gtBase64 = await uriToBase64(groundTruthUri);
    
    const result = await predict('process_with_ground_truth', {
      image_file: `data:image/png;base64,${imageBase64}`,
      gt_mask_file: `data:image/png;base64,${gtBase64}`,
      prompt_text: promptText,
      modality: modality,
      window_type: windowType,
    });
    
    return {
      comparisonImageUrl: result[0] as string,
      diceScore: result[1] as number,
      iouScore: result[2] as number,
      status: result[3] as string,
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
 * Generate multiple masks with different confidence levels
 */
export async function generateMultipleMasks(
  imageUri: string,
  promptText: string = 'brain',
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)',
  numMasks: number = 3
): Promise<MultiMaskResult> {
  try {
    const imageBase64 = await uriToBase64(imageUri);
    
    const result = await predict('generate_multiple_masks', {
      image_file: `data:image/png;base64,${imageBase64}`,
      prompt_text: promptText,
      modality: modality,
      window_type: windowType,
      num_masks: numMasks,
    });
    
    const masks = [];
    for (let i = 0; i < numMasks; i++) {
      masks.push({
        imageUrl: result[i * 2] as string,
        confidence: result[i * 2 + 1] as number,
      });
    }
    
    return {
      masks,
      status: result[numMasks * 2] as string,
    };
  } catch (error) {
    console.error('NeuroSAM3 multiple masks error:', error);
    return {
      masks: [],
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Slice viewer for 3D volumes
 */
export async function viewSlice(
  volumeUri: string,
  sliceIndex: number,
  axis: 'axial' | 'coronal' | 'sagittal' = 'axial',
  modality: Modality = 'MRI',
  windowType: WindowType = 'Brain (Grey Matter)'
): Promise<SliceViewerResult> {
  try {
    const volumeBase64 = await uriToBase64(volumeUri);
    
    const result = await predict('view_slice', {
      volume_file: `data:application/octet-stream;base64,${volumeBase64}`,
      slice_index: sliceIndex,
      axis: axis,
      modality: modality,
      window_type: windowType,
    });
    
    return {
      imageUrl: result[0] as string,
      sliceNumber: result[1] as number,
      status: result[2] as string,
      currentSlice: result[3] as string,
      subjectInfo: result[4] as string,
    };
  } catch (error) {
    console.error('NeuroSAM3 slice viewer error:', error);
    return {
      imageUrl: '',
      sliceNumber: 0,
      status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      currentSlice: '',
      subjectInfo: '',
    };
  }
}

/**
 * Check if NeuroSAM3 service is available
 */
export async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch('https://mmrech-neurosam3.hf.space/api/queue/status', {
      method: 'GET',
    });
    return response.ok;
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
