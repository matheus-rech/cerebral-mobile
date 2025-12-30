/**
 * OpenNeuro Dataset Service
 * 
 * Provides access to real neuroimaging datasets from OpenNeuro.org
 * Uses the GraphQL API for metadata and S3 for public dataset files
 */

const OPENNEURO_API = 'https://openneuro.org/crn/graphql';
const OPENNEURO_S3_BASE = 'https://s3.amazonaws.com/openneuro.org';

// GraphQL queries for OpenNeuro API - using correct schema
const SEARCH_DATASETS_QUERY = `
  query searchDatasets($first: Int!, $after: String) {
    datasets(first: $first, after: $after) {
      edges {
        node {
          id
          name
          created
          public
          draft {
            description {
              Name
            }
            readme
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_DATASET_QUERY = `
  query getDataset($id: ID!) {
    dataset(id: $id) {
      id
      name
      created
      public
      draft {
        description {
          Name
          Authors
          License
          Acknowledgements
          HowToAcknowledge
          Funding
          ReferencesAndLinks
          DatasetDOI
        }
        readme
        files {
          filename
          size
          directory
        }
      }
      snapshots {
        tag
        created
        size
      }
    }
  }
`;

export interface OpenNeuroDataset {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  modalities?: string[];
  subjectCount: number;
  size: number;
  created: string;
}

export interface DatasetFile {
  filename: string;
  size: number;
  directory: boolean;
}

export interface DatasetDetails extends OpenNeuroDataset {
  readme?: string;
  authors?: string[];
  license?: string;
  doi?: string;
  files: DatasetFile[];
  snapshots: { tag: string; created: string; size: number }[];
}

/**
 * Search OpenNeuro datasets
 */
export async function searchDatasets(
  limit: number = 20,
  cursor?: string
): Promise<{
  datasets: OpenNeuroDataset[];
  hasMore: boolean;
  nextCursor?: string;
}> {
  const response = await fetch(OPENNEURO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: SEARCH_DATASETS_QUERY,
      variables: { first: limit, after: cursor },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenNeuro API error: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`OpenNeuro API error: ${result.errors[0]?.message || 'Unknown error'}`);
  }

  const edges = result.data?.datasets?.edges || [];
  const pageInfo = result.data?.datasets?.pageInfo || {};

  const datasets: OpenNeuroDataset[] = edges.map((edge: any) => {
    const node = edge.node;
    return {
      id: node.id,
      name: node.draft?.description?.Name || node.name || node.id,
      description: node.draft?.readme?.substring(0, 200) || '',
      latestVersion: '1.0.0', // Default version
      modalities: ['MRI'], // Default modality
      subjectCount: 0,
      size: 0,
      created: node.created,
    };
  });

  return {
    datasets,
    hasMore: pageInfo.hasNextPage || false,
    nextCursor: pageInfo.endCursor,
  };
}

/**
 * Get detailed information about a specific dataset
 */
export async function getDatasetDetails(datasetId: string): Promise<DatasetDetails> {
  const response = await fetch(OPENNEURO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: GET_DATASET_QUERY,
      variables: { id: datasetId },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenNeuro API error: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`OpenNeuro API error: ${result.errors[0]?.message || 'Unknown error'}`);
  }

  const dataset = result.data?.dataset;
  if (!dataset) {
    throw new Error(`Dataset ${datasetId} not found`);
  }

  const latestSnapshot = dataset.snapshots?.[0];
  const files = dataset.draft?.files || [];

  return {
    id: dataset.id,
    name: dataset.draft?.description?.Name || dataset.name || dataset.id,
    description: dataset.draft?.readme?.substring(0, 500) || '',
    latestVersion: latestSnapshot?.tag || '1.0.0',
    modalities: ['MRI'],
    subjectCount: 0,
    size: latestSnapshot?.size || 0,
    created: dataset.created,
    readme: dataset.draft?.readme,
    authors: dataset.draft?.description?.Authors || [],
    license: dataset.draft?.description?.License,
    doi: dataset.draft?.description?.DatasetDOI,
    files: files.map((f: any) => ({
      filename: f.filename,
      size: f.size || 0,
      directory: f.directory || false,
    })),
    snapshots: dataset.snapshots || [],
  };
}

/**
 * Get public URL for a dataset file
 * OpenNeuro hosts files on S3 with a specific path structure
 */
export function getPublicFileUrl(
  datasetId: string,
  version: string,
  filePath: string
): string {
  // OpenNeuro S3 URL structure: s3://openneuro.org/{datasetId}/{version}/{filePath}
  // Public HTTPS URL: https://s3.amazonaws.com/openneuro.org/{datasetId}/{version}/{filePath}
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  return `${OPENNEURO_S3_BASE}/${datasetId}/${version}/${cleanPath}`;
}

/**
 * Get direct download URL for a NIfTI file from OpenNeuro
 */
export function getNiftiUrl(datasetId: string, subject: string, session?: string): string {
  // Common BIDS structure for anatomical scans
  const sessionPath = session ? `ses-${session}/` : '';
  return `${OPENNEURO_S3_BASE}/${datasetId}/sub-${subject}/${sessionPath}anat/sub-${subject}_T1w.nii.gz`;
}

/**
 * Popular datasets with known good NIfTI files
 */
export function getPopularDatasets(): { id: string; name: string; description: string }[] {
  return [
    {
      id: 'ds000001',
      name: 'Balloon Analog Risk Task',
      description: 'fMRI study of risk-taking behavior',
    },
    {
      id: 'ds000002',
      name: 'Classification Learning',
      description: 'fMRI classification learning study',
    },
    {
      id: 'ds000003',
      name: 'Rhyme Judgment',
      description: 'Language processing fMRI study',
    },
    {
      id: 'ds000005',
      name: 'Mixed-gambles Task',
      description: 'Decision-making under uncertainty',
    },
    {
      id: 'ds000011',
      name: 'Classification Learning (2)',
      description: 'Extended classification learning study',
    },
    {
      id: 'ds000017',
      name: 'Stop Signal Task',
      description: 'Response inhibition study',
    },
    {
      id: 'ds000030',
      name: 'UCLA Consortium',
      description: 'Large multi-site psychiatric dataset',
    },
    {
      id: 'ds000114',
      name: 'Forrest Gump',
      description: 'Naturalistic movie-watching fMRI',
    },
  ];
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
