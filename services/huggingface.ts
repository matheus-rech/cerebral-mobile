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

// Get the API base URL for serving local NIfTI files
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // For Manus proxy URLs, replace 8081 with 3000 in the subdomain
    const hostname = window.location.hostname;
    if (hostname.includes('8081-')) {
      // Replace 8081 with 3000 in the subdomain for Manus proxy
      const apiHostname = hostname.replace('8081-', '3000-');
      return `${window.location.protocol}//${apiHostname}`;
    }
    // For local development, use port 3000
    if (window.location.port === '8081') {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

// Public DICOM/NIfTI samples for direct testing
// Using local server to serve files with proper CORS headers
export const PUBLIC_SAMPLES = [
  {
    id: 'mni152',
    name: 'MNI152 Brain Template',
    description: 'Standard brain atlas template',
    url: '/public/samples/mni152.nii.gz', // Served from local API server
    type: 'nifti' as const,
  },
  {
    id: 'flair',
    name: 'FLAIR Brain MRI',
    description: 'Fluid-attenuated inversion recovery scan',
    url: '/public/samples/flair.nii.gz',
    type: 'nifti' as const,
  },
  {
    id: 'lesion',
    name: 'Brain Lesion Case',
    description: 'MRI with visible brain lesion',
    url: '/public/samples/brain_lesion.nii.gz',
    type: 'nifti' as const,
  },
];

// Helper to get full URL for a sample
export const getSampleUrl = (relativePath: string): string => {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${relativePath}`;

};

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
