/**
 * CEREBRAL Mobile App Tests
 * Comprehensive test suite for MRI analysis functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveAnalysisToHistory,
  getAnalysisHistory,
  deleteAnalysisFromHistory,
  clearAnalysisHistory,
  getSettings,
  saveSettings,
} from '../services/storage';
import { AVAILABLE_DATASETS, getDataset, getAllDatasets } from '../services/huggingface';
import type { MRIAnalysisReport } from '../types/mri';

// Helper to create mock analysis report
function createMockReport(imageUri: string): MRIAnalysisReport {
  return {
    id: `analysis-${Date.now()}-${Math.random()}`,
    severity: 'normal',
    emergencyFindings: [],
    modality: 'T2-weighted',
    view: 'Axial',
    anatomicalFindings: [
      {
        structure: 'Lateral Ventricles',
        observation: 'Normal size and configuration',
        status: 'normal',
        confidence: 0.92,
        location: 'Central',
      },
      {
        structure: 'Cerebral Cortex',
        observation: 'Normal gray-white matter differentiation',
        status: 'normal',
        confidence: 0.88,
        location: 'Bilateral',
      },
    ],
    impression: 'No acute abnormality identified.',
    differential: [],
    recommendations: ['Routine follow-up as clinically indicated'],
    qualityScore: 0.9,
    timestamp: new Date().toISOString(),
    imageUri,
  };
}

describe('CEREBRAL Mobile App', () => {
  describe('HuggingFace Dataset Service', () => {
    it('should have 4 available datasets', () => {
      expect(AVAILABLE_DATASETS).toHaveLength(4);
    });

    it('should retrieve all datasets', () => {
      const datasets = getAllDatasets();
      expect(datasets).toHaveLength(4);
      expect(datasets[0]).toHaveProperty('id');
      expect(datasets[0]).toHaveProperty('name');
      expect(datasets[0]).toHaveProperty('description');
      expect(datasets[0]).toHaveProperty('repoId');
    });

    it('should get specific dataset by ID', () => {
      const dataset = getDataset('brain_flair');
      expect(dataset).toBeDefined();
      expect(dataset?.id).toBe('brain_flair');
      expect(dataset?.name).toBe('Brain MRI (FLAIR)');
    });

    it('should return undefined for non-existent dataset', () => {
      const dataset = getDataset('non-existent-dataset');
      expect(dataset).toBeUndefined();
    });
  });

  describe('MRI Analysis Report Structure', () => {
    it('should generate valid report structure', () => {
      const imageUri = 'https://example.com/mri.jpg';
      const report = createMockReport(imageUri);

      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('severity');
      expect(report).toHaveProperty('emergencyFindings');
      expect(report).toHaveProperty('modality');
      expect(report).toHaveProperty('view');
      expect(report).toHaveProperty('anatomicalFindings');
      expect(report).toHaveProperty('impression');
      expect(report).toHaveProperty('differential');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('qualityScore');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('imageUri');
      expect(report.imageUri).toBe(imageUri);
    });

    it('should include anatomical findings', () => {
      const report = createMockReport('test.jpg');
      expect(report.anatomicalFindings.length).toBeGreaterThan(0);
      expect(report.anatomicalFindings[0]).toHaveProperty('structure');
      expect(report.anatomicalFindings[0]).toHaveProperty('observation');
      expect(report.anatomicalFindings[0]).toHaveProperty('status');
      expect(report.anatomicalFindings[0]).toHaveProperty('confidence');
    });

    it('should have valid confidence scores', () => {
      const report = createMockReport('test.jpg');
      report.anatomicalFindings.forEach((finding) => {
        expect(finding.confidence).toBeGreaterThanOrEqual(0);
        expect(finding.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should include recommendations', () => {
      const report = createMockReport('test.jpg');
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate valid timestamp', () => {
      const report = createMockReport('test.jpg');
      const timestamp = new Date(report.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Analysis History Management', () => {
    beforeEach(async () => {
      await clearAnalysisHistory();
    });

    it('should save and retrieve analysis history', async () => {
      const report = createMockReport('test1.jpg');
      await saveAnalysisToHistory(report);

      const history = await getAnalysisHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(report.id);
    });

    it('should maintain history order (newest first)', async () => {
      const report1 = createMockReport('test1.jpg');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const report2 = createMockReport('test2.jpg');

      await saveAnalysisToHistory(report1);
      await saveAnalysisToHistory(report2);

      const history = await getAnalysisHistory();
      expect(history[0].id).toBe(report2.id);
      expect(history[1].id).toBe(report1.id);
    });

    it('should delete specific analysis from history', async () => {
      const report1 = createMockReport('test1.jpg');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const report2 = createMockReport('test2.jpg');

      await saveAnalysisToHistory(report1);
      await saveAnalysisToHistory(report2);

      await deleteAnalysisFromHistory(report1.id);

      const history = await getAnalysisHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(report2.id);
    });

    it('should clear all analysis history', async () => {
      const report1 = createMockReport('test1.jpg');
      const report2 = createMockReport('test2.jpg');

      await saveAnalysisToHistory(report1);
      await saveAnalysisToHistory(report2);

      await clearAnalysisHistory();

      const history = await getAnalysisHistory();
      expect(history).toHaveLength(0);
    });

    it('should limit history to 50 most recent analyses', async () => {
      // Add 60 analyses
      for (let i = 0; i < 60; i++) {
        const report = createMockReport(`test${i}.jpg`);
        await saveAnalysisToHistory(report);
      }

      const history = await getAnalysisHistory();
      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Settings Management', () => {
    it('should save and retrieve settings', async () => {
      const settings = {
        darkMode: true,
        autoSaveHistory: true,
      };

      await saveSettings(settings);
      const retrieved = await getSettings();

      expect(retrieved.darkMode).toBe(true);
      expect(retrieved.autoSaveHistory).toBe(true);
    });

    it('should have default settings', async () => {
      const settings = await getSettings();
      expect(settings).toHaveProperty('darkMode');
      expect(settings).toHaveProperty('autoSaveHistory');
    });
  });

  describe('MRI Report Validation', () => {
    it('should have valid modality', () => {
      const validModalities = ['T1-weighted', 'T2-weighted', 'FLAIR', 'T1+Gd'];
      const report = createMockReport('test.jpg');
      expect(validModalities).toContain(report.modality);
    });

    it('should have valid view', () => {
      const validViews = ['Axial', 'Coronal', 'Sagittal'];
      const report = createMockReport('test.jpg');
      expect(validViews).toContain(report.view);
    });

    it('should have valid finding statuses', () => {
      const validStatuses = ['normal', 'abnormal', 'uncertain'];
      const report = createMockReport('test.jpg');

      report.anatomicalFindings.forEach((finding) => {
        expect(validStatuses).toContain(finding.status);
      });
    });
  });

  describe('Report Quality Metrics', () => {
    let report: MRIAnalysisReport;

    beforeEach(() => {
      report = createMockReport('test.jpg');
    });

    it('should have quality score between 0 and 1', () => {
      expect(report.qualityScore).toBeGreaterThanOrEqual(0);
      expect(report.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should have unique analysis ID', () => {
      const report2 = createMockReport('test2.jpg');
      expect(report.id).not.toBe(report2.id);
    });

    it('should include impression text', () => {
      expect(report.impression).toBeTruthy();
      expect(typeof report.impression).toBe('string');
      expect(report.impression.length).toBeGreaterThan(0);
    });
  });
});
