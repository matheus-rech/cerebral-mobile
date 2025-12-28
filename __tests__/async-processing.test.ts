/**
 * Unit tests for async processing service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createAsyncJob,
  getAsyncJobs,
  getAsyncJob,
  updateAsyncJob,
  cancelAsyncJob,
  deleteAsyncJob,
  clearCompletedJobs,
  getActiveJobs,
  type AsyncJob,
} from '../services/async-processing';

describe('Async Processing Service', () => {
  beforeEach(async () => {
    // Clear storage before each test
    await AsyncStorage.clear();
  });

  describe('createAsyncJob', () => {
    it('should create a new async job', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      
      expect(job.id).toBeDefined();
      expect(job.type).toBe('unet');
      expect(job.status).toBe('pending');
      expect(job.progress).toBe(0);
      expect(job.imageUri).toBe('test-image-uri');
      expect(job.createdAt).toBeDefined();
    });

    it('should set estimated duration for synthseg', async () => {
      const job = await createAsyncJob('synthseg', 'test-image-uri');
      expect(job.estimatedDuration).toBe(45);
    });

    it('should set estimated duration for unet', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      expect(job.estimatedDuration).toBe(2);
    });

    it('should set estimated duration for medsam2', async () => {
      const job = await createAsyncJob('medsam2', 'test-image-uri');
      expect(job.estimatedDuration).toBe(3);
    });

    it('should set estimated duration for sam3', async () => {
      const job = await createAsyncJob('sam3', 'test-image-uri');
      expect(job.estimatedDuration).toBe(3);
    });

    it('should set estimated duration for lesion-3d', async () => {
      const job = await createAsyncJob('lesion-3d', 'test-image-uri');
      expect(job.estimatedDuration).toBe(10);
    });

    it('should store job parameters', async () => {
      const params = { threshold: 0.5, minSize: 10 };
      const job = await createAsyncJob('unet', 'test-image-uri', params);
      expect(job.params).toEqual(params);
    });
  });

  describe('getAsyncJobs', () => {
    it('should return empty array when no jobs exist', async () => {
      const jobs = await getAsyncJobs();
      expect(jobs).toEqual([]);
    });

    it('should return all jobs', async () => {
      await createAsyncJob('unet', 'test-image-1');
      await createAsyncJob('synthseg', 'test-image-2');
      
      const jobs = await getAsyncJobs();
      expect(jobs).toHaveLength(2);
      expect(jobs[0].type).toBe('unet');
      expect(jobs[1].type).toBe('synthseg');
    });
  });

  describe('getAsyncJob', () => {
    it('should return null when job does not exist', async () => {
      const job = await getAsyncJob('non-existent-id');
      expect(job).toBeNull();
    });

    it('should return specific job by ID', async () => {
      const createdJob = await createAsyncJob('unet', 'test-image-uri');
      const retrievedJob = await getAsyncJob(createdJob.id);
      
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(createdJob.id);
      expect(retrievedJob?.type).toBe('unet');
    });
  });

  describe('updateAsyncJob', () => {
    it('should update job status', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      await updateAsyncJob(job.id, { status: 'processing', progress: 50 });
      
      const updatedJob = await getAsyncJob(job.id);
      expect(updatedJob?.status).toBe('processing');
      expect(updatedJob?.progress).toBe(50);
    });

    it('should set startedAt timestamp when status changes to processing', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      await updateAsyncJob(job.id, { status: 'processing' });
      
      const updatedJob = await getAsyncJob(job.id);
      expect(updatedJob?.startedAt).toBeDefined();
    });

    it('should set completedAt timestamp when status changes to completed', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      await updateAsyncJob(job.id, { status: 'completed', result: { success: true } });
      
      const updatedJob = await getAsyncJob(job.id);
      expect(updatedJob?.completedAt).toBeDefined();
      expect(updatedJob?.result).toEqual({ success: true });
    });

    it('should set completedAt timestamp when status changes to failed', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      await updateAsyncJob(job.id, { status: 'failed', error: 'Test error' });
      
      const updatedJob = await getAsyncJob(job.id);
      expect(updatedJob?.completedAt).toBeDefined();
      expect(updatedJob?.error).toBe('Test error');
    });

    it('should throw error when job does not exist', async () => {
      await expect(
        updateAsyncJob('non-existent-id', { status: 'processing' })
      ).rejects.toThrow('Job non-existent-id not found');
    });
  });

  describe('cancelAsyncJob', () => {
    it('should cancel a job', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      await cancelAsyncJob(job.id);
      
      const cancelledJob = await getAsyncJob(job.id);
      expect(cancelledJob?.status).toBe('cancelled');
      expect(cancelledJob?.completedAt).toBeDefined();
    });
  });

  describe('deleteAsyncJob', () => {
    it('should delete a job', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      await deleteAsyncJob(job.id);
      
      const deletedJob = await getAsyncJob(job.id);
      expect(deletedJob).toBeNull();
    });

    it('should not affect other jobs', async () => {
      const job1 = await createAsyncJob('unet', 'test-image-1');
      const job2 = await createAsyncJob('synthseg', 'test-image-2');
      
      await deleteAsyncJob(job1.id);
      
      const jobs = await getAsyncJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(job2.id);
    });
  });

  describe('clearCompletedJobs', () => {
    it('should clear only completed and failed jobs', async () => {
      const job1 = await createAsyncJob('unet', 'test-image-1');
      const job2 = await createAsyncJob('synthseg', 'test-image-2');
      const job3 = await createAsyncJob('medsam2', 'test-image-3');
      
      await updateAsyncJob(job1.id, { status: 'completed' });
      await updateAsyncJob(job2.id, { status: 'processing' });
      await updateAsyncJob(job3.id, { status: 'failed' });
      
      await clearCompletedJobs();
      
      const jobs = await getAsyncJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(job2.id);
      expect(jobs[0].status).toBe('processing');
    });

    it('should keep pending jobs', async () => {
      const job1 = await createAsyncJob('unet', 'test-image-1');
      const job2 = await createAsyncJob('synthseg', 'test-image-2');
      
      await updateAsyncJob(job1.id, { status: 'completed' });
      // job2 remains pending
      
      await clearCompletedJobs();
      
      const jobs = await getAsyncJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(job2.id);
      expect(jobs[0].status).toBe('pending');
    });
  });

  describe('getActiveJobs', () => {
    it('should return only pending and processing jobs', async () => {
      const job1 = await createAsyncJob('unet', 'test-image-1');
      const job2 = await createAsyncJob('synthseg', 'test-image-2');
      const job3 = await createAsyncJob('medsam2', 'test-image-3');
      const job4 = await createAsyncJob('sam3', 'test-image-4');
      
      await updateAsyncJob(job1.id, { status: 'pending' });
      await updateAsyncJob(job2.id, { status: 'processing' });
      await updateAsyncJob(job3.id, { status: 'completed' });
      await updateAsyncJob(job4.id, { status: 'failed' });
      
      const activeJobs = await getActiveJobs();
      expect(activeJobs).toHaveLength(2);
      expect(activeJobs.map(j => j.id).sort()).toEqual([job1.id, job2.id].sort());
    });

    it('should return empty array when no active jobs', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      await updateAsyncJob(job.id, { status: 'completed' });
      
      const activeJobs = await getActiveJobs();
      expect(activeJobs).toEqual([]);
    });
  });

  describe('Job ID generation', () => {
    it('should generate unique job IDs', async () => {
      const job1 = await createAsyncJob('unet', 'test-image-1');
      const job2 = await createAsyncJob('unet', 'test-image-2');
      
      expect(job1.id).not.toBe(job2.id);
    });

    it('should generate IDs with correct format', async () => {
      const job = await createAsyncJob('unet', 'test-image-uri');
      expect(job.id).toMatch(/^job_\d+_[a-z0-9]+$/);
    });
  });

  describe('Storage limits', () => {
    it('should keep only last 50 jobs', async () => {
      // Create 55 jobs
      for (let i = 0; i < 55; i++) {
        await createAsyncJob('unet', `test-image-${i}`);
      }
      
      const jobs = await getAsyncJobs();
      expect(jobs).toHaveLength(50);
      
      // Should keep the most recent 50
      expect(jobs[0].imageUri).toBe('test-image-5');
      expect(jobs[49].imageUri).toBe('test-image-54');
    });
  });
});
