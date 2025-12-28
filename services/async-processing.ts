/**
 * Async Processing Service
 * Handles long-running ML tasks with progress tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AsyncJob {
  id: string;
  type: 'synthseg' | 'unet' | 'medsam2' | 'sam3' | 'lesion-3d';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  imageUri: string;
  params?: Record<string, any>;
  result?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number; // seconds
}

const JOBS_STORAGE_KEY = '@cerebral/async_jobs';
const MAX_JOBS = 50; // Keep last 50 jobs

/**
 * Get all async jobs
 */
export async function getAsyncJobs(): Promise<AsyncJob[]> {
  try {
    const jobsJson = await AsyncStorage.getItem(JOBS_STORAGE_KEY);
    if (!jobsJson) return [];
    return JSON.parse(jobsJson);
  } catch (error) {
    console.error('Error loading async jobs:', error);
    return [];
  }
}

/**
 * Get a specific job by ID
 */
export async function getAsyncJob(jobId: string): Promise<AsyncJob | null> {
  const jobs = await getAsyncJobs();
  return jobs.find(job => job.id === jobId) || null;
}

/**
 * Save jobs to storage
 */
async function saveJobs(jobs: AsyncJob[]): Promise<void> {
  try {
    // Keep only last MAX_JOBS
    const recentJobs = jobs.slice(-MAX_JOBS);
    await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(recentJobs));
  } catch (error) {
    console.error('Error saving async jobs:', error);
  }
}

/**
 * Create a new async job
 */
export async function createAsyncJob(
  type: AsyncJob['type'],
  imageUri: string,
  params?: Record<string, any>
): Promise<AsyncJob> {
  const job: AsyncJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    status: 'pending',
    progress: 0,
    imageUri,
    params,
    createdAt: new Date().toISOString(),
  };

  // Set estimated duration based on job type
  switch (type) {
    case 'synthseg':
      job.estimatedDuration = 45; // 45 seconds
      break;
    case 'unet':
      job.estimatedDuration = 2;
      break;
    case 'medsam2':
      job.estimatedDuration = 3;
      break;
    case 'sam3':
      job.estimatedDuration = 3;
      break;
    case 'lesion-3d':
      job.estimatedDuration = 10;
      break;
  }

  const jobs = await getAsyncJobs();
  jobs.push(job);
  await saveJobs(jobs);

  return job;
}

/**
 * Update job status and progress
 */
export async function updateAsyncJob(
  jobId: string,
  updates: Partial<AsyncJob>
): Promise<void> {
  const jobs = await getAsyncJobs();
  const jobIndex = jobs.findIndex(job => job.id === jobId);
  
  if (jobIndex === -1) {
    throw new Error(`Job ${jobId} not found`);
  }

  jobs[jobIndex] = { ...jobs[jobIndex], ...updates };
  
  // Set timestamps
  if (updates.status === 'processing' && !jobs[jobIndex].startedAt) {
    jobs[jobIndex].startedAt = new Date().toISOString();
  }
  if ((updates.status === 'completed' || updates.status === 'failed') && !jobs[jobIndex].completedAt) {
    jobs[jobIndex].completedAt = new Date().toISOString();
  }

  await saveJobs(jobs);
}

/**
 * Cancel a job
 */
export async function cancelAsyncJob(jobId: string): Promise<void> {
  await updateAsyncJob(jobId, {
    status: 'cancelled',
    completedAt: new Date().toISOString(),
  });
}

/**
 * Delete a job
 */
export async function deleteAsyncJob(jobId: string): Promise<void> {
  const jobs = await getAsyncJobs();
  const filteredJobs = jobs.filter(job => job.id !== jobId);
  await saveJobs(filteredJobs);
}

/**
 * Clear all completed/failed jobs
 */
export async function clearCompletedJobs(): Promise<void> {
  const jobs = await getAsyncJobs();
  const activeJobs = jobs.filter(
    job => job.status === 'pending' || job.status === 'processing'
  );
  await saveJobs(activeJobs);
}

/**
 * Get active (pending/processing) jobs
 */
export async function getActiveJobs(): Promise<AsyncJob[]> {
  const jobs = await getAsyncJobs();
  return jobs.filter(
    job => job.status === 'pending' || job.status === 'processing'
  );
}

/**
 * Process a job (call ML service and update progress)
 */
export async function processAsyncJob(
  jobId: string,
  onProgress?: (progress: number) => void
): Promise<any> {
  const job = await getAsyncJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  try {
    // Mark as processing
    await updateAsyncJob(jobId, {
      status: 'processing',
      progress: 0,
    });

    // Simulate progress updates for long-running tasks
    const progressInterval = setInterval(async () => {
      const currentJob = await getAsyncJob(jobId);
      if (!currentJob || currentJob.status !== 'processing') {
        clearInterval(progressInterval);
        return;
      }

      // Increment progress (simulated)
      const newProgress = Math.min(currentJob.progress + 10, 90);
      await updateAsyncJob(jobId, { progress: newProgress });
      onProgress?.(newProgress);
    }, (job.estimatedDuration || 10) * 100); // Update every 10% of estimated duration

    // Call the appropriate ML service
    let result: any;
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    switch (job.type) {
      case 'synthseg':
        const synthsegResponse = await fetch(`${API_URL}/api/ml/synthseg/segment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUri: job.imageUri, ...job.params }),
        });
        if (!synthsegResponse.ok) throw new Error('SynthSeg segmentation failed');
        result = await synthsegResponse.json();
        break;

      case 'unet':
        const unetResponse = await fetch(`${API_URL}/api/ml/unet/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUri: job.imageUri, ...job.params }),
        });
        if (!unetResponse.ok) throw new Error('UNet detection failed');
        result = await unetResponse.json();
        break;

      case 'medsam2':
        const medsam2Response = await fetch(`${API_URL}/api/ml/medsam2/segment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUri: job.imageUri, ...job.params }),
        });
        if (!medsam2Response.ok) throw new Error('MedSAM2 segmentation failed');
        result = await medsam2Response.json();
        break;

      case 'sam3':
        const sam3Response = await fetch(`${API_URL}/api/ml/sam3/segment-point`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUri: job.imageUri, ...job.params }),
        });
        if (!sam3Response.ok) throw new Error('SAM3 segmentation failed');
        result = await sam3Response.json();
        break;

      case 'lesion-3d':
        const lesion3dResponse = await fetch(`${API_URL}/api/ml/lesion-3d/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volumeUri: job.imageUri, ...job.params }),
        });
        if (!lesion3dResponse.ok) throw new Error('3D lesion tracking failed');
        result = await lesion3dResponse.json();
        break;

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // Clear progress interval
    clearInterval(progressInterval);

    // Mark as completed
    await updateAsyncJob(jobId, {
      status: 'completed',
      progress: 100,
      result,
    });

    onProgress?.(100);
    return result;

  } catch (error) {
    // Mark as failed
    await updateAsyncJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
