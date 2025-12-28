/**
 * MRI Analysis Types
 * Data structures for neuroimaging analysis
 */

export type FindingStatus = 'normal' | 'abnormal' | 'uncertain';

export type MRIModality = 'T1-weighted' | 'T2-weighted' | 'FLAIR' | 'T1+Gd';

export type MRIView = 'Axial' | 'Coronal' | 'Sagittal';

export interface AnatomicalFinding {
  structure: string;
  observation: string;
  status: FindingStatus;
  confidence: number;
  location?: string;
}

export interface MRIAnalysisReport {
  id: string;
  modality: MRIModality;
  view: MRIView;
  anatomicalFindings: AnatomicalFinding[];
  impression: string;
  differential: string[];
  recommendations: string[];
  qualityScore: number;
  timestamp: string;
  imageUri: string;
}

export interface SegmentationResult {
  imageUri: string;
  overlayUri: string;
  statistics: {
    totalPixels: number;
    segmentedPixels: number;
    segmentedPercentage: number;
    regions: Array<{
      label: string;
      area: number;
      percentage: number;
    }>;
  };
  timestamp: string;
}

export interface HuggingFaceDataset {
  id: string;
  name: string;
  description: string;
  repoId: string;
  sampleCount?: number;
}

export interface MRIImage {
  uri: string;
  source: 'upload' | 'huggingface';
  datasetId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}
