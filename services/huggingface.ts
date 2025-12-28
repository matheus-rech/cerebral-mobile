/**
 * HuggingFace Dataset Service
 * Retrieves MRI images from HuggingFace datasets
 */

import type { HuggingFaceDataset, MRIImage } from '@/types/mri';

export const AVAILABLE_DATASETS: HuggingFaceDataset[] = [
  {
    id: 'brain_flair',
    name: 'Brain MRI (FLAIR)',
    description: 'FLAIR sequence brain MRI scans',
    repoId: 'yummy456/brain-mri-dataset',
  },
  {
    id: 'brain_tumor',
    name: 'Brain Tumor MRI',
    description: 'MRI scans with brain tumor cases',
    repoId: 'Mahadih534/brain-tumor-MRI-dataset',
  },
  {
    id: 'brain_t1',
    name: 'Brain T1-weighted',
    description: 'T1-weighted brain MRI slices',
    repoId: 'g4m3r/T1w_MRI_Brain_Slices',
  },
  {
    id: 'brain_cancer',
    name: 'Brain Cancer Dataset',
    description: 'Brain cancer MRI dataset',
    repoId: 'UniDataPro/brain-cancer-dataset',
  },
];

/**
 * Load a random sample from a HuggingFace dataset
 */
export async function loadRandomSample(datasetId: string): Promise<MRIImage> {
  const dataset = AVAILABLE_DATASETS.find((d) => d.id === datasetId);
  
  if (!dataset) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  try {
    // Use HuggingFace datasets API to fetch a random sample
    // For streaming datasets, we'll use the parquet viewer API
    const response = await fetch(
      `https://datasets-server.huggingface.co/rows?dataset=${dataset.repoId}&config=default&split=train&offset=${Math.floor(Math.random() * 100)}&length=1`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch dataset: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.rows || data.rows.length === 0) {
      throw new Error('No samples found in dataset');
    }

    const row = data.rows[0].row;
    
    // Extract image URL from the row data
    let imageUrl: string | null = null;
    
    if (row.image && typeof row.image === 'object' && row.image.src) {
      imageUrl = row.image.src;
    } else if (row.image && typeof row.image === 'string') {
      imageUrl = row.image;
    }

    if (!imageUrl) {
      throw new Error('No image found in dataset row');
    }

    const mriImage: MRIImage = {
      uri: imageUrl,
      source: 'huggingface',
      datasetId: dataset.id,
      metadata: row,
      timestamp: new Date().toISOString(),
    };

    return mriImage;
  } catch (error) {
    console.error('Error loading sample from HuggingFace:', error);
    throw error;
  }
}

/**
 * Get dataset information
 */
export function getDataset(datasetId: string): HuggingFaceDataset | undefined {
  return AVAILABLE_DATASETS.find((d) => d.id === datasetId);
}

/**
 * Get all available datasets
 */
export function getAllDatasets(): HuggingFaceDataset[] {
  return AVAILABLE_DATASETS;
}
