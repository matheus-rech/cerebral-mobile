/**
 * CEREBRAL Mobile App Tests
 * Comprehensive test suite for MRI analysis functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveAnalysisToHistory,
  getAnalysisHistory,
  deleteAnalysisFromHistory,
  clearAnalysisHistory,
  getSettings,
  saveSettings,
} from '../services/storage';
import { generateMockAnalysis } from '../services/vision-analyzer';
import { generateMockSegmentation } from '../services/segmentation';
import { AVAILABLE_DATASETS, getDataset, getAllDatasets } from '../services/huggingface';
import type { MRIAnalysisReport } from '../types/mri';

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
      expect(datasets[0]).toHaveProperty('repoId');
    });

    it('should get specific dataset by ID', () => {
      const dataset = getDataset('brain_tumor');
      expect(dataset).toBeDefined();
      expect(dataset?.id).toBe('brain_tumor');
      expect(dataset?.name).toBe('Brain Tumor MRI');
    });

    it('should return undefined for non-existent dataset', () => {
      const dataset = getDataset('non_existent');
      expect(dataset).toBeUndefined();
    });

    it('should have valid repository IDs', () => {
      AVAILABLE_DATASETS.forEach((dataset) => {
        expect(dataset.repoId).toMatch(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/);
      });
    });
  });

  describe('Vision Analyzer Service', () => {
    it('should generate mock analysis report', () => {
      const imageUri = 'https://example.com/mri.jpg';
      const report = generateMockAnalysis(imageUri);

      expect(report).toBeDefined();
      expect(report.id).toMatch(/^analysis-\d+$/);
      expect(report.imageUri).toBe(imageUri);
      expect(report.modality).toBeDefined();
      expect(report.view).toBeDefined();
      expect(report.anatomicalFindings).toBeInstanceOf(Array);
      expect(report.qualityScore).toBeGreaterThan(0);
      expect(report.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should include anatomical findings', () => {
      const report = generateMockAnalysis('test.jpg');
      expect(report.anatomicalFindings.length).toBeGreaterThan(0);

      report.anatomicalFindings.forEach((finding) => {
        expect(finding).toHaveProperty('structure');
        expect(finding).toHaveProperty('observation');
        expect(finding).toHaveProperty('status');
        expect(finding).toHaveProperty('confidence');
        expect(['normal', 'abnormal', 'uncertain']).toContain(finding.status);
        expect(finding.confidence).toBeGreaterThanOrEqual(0);
        expect(finding.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should generate appropriate impression based on findings', () => {
      const report = generateMockAnalysis('test.jpg');
      const hasAbnormalities = report.anatomicalFindings.some((f) => f.status === 'abnormal');

      if (hasAbnormalities) {
        expect(report.impression).toContain('Abnormal');
        expect(report.differential.length).toBeGreaterThan(0);
      } else {
        expect(report.impression).toContain('No acute abnormality');
      }
    });

    it('should include recommendations', () => {
      const report = generateMockAnalysis('test.jpg');
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate valid timestamp', () => {
      const report = generateMockAnalysis('test.jpg');
      const timestamp = new Date(report.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('Segmentation Service', () => {
    it('should generate mock segmentation result', () => {
      const imageUri = 'https://example.com/mri.jpg';
      const result = generateMockSegmentation(imageUri, 'T2-weighted');

      expect(result).toBeDefined();
      expect(result.imageUri).toBe(imageUri);
      expect(result.overlayUri).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    it('should calculate valid segmentation statistics', () => {
      const result = generateMockSegmentation('test.jpg', 'T2-weighted');

      expect(result.statistics.totalPixels).toBeGreaterThan(0);
      expect(result.statistics.segmentedPixels).toBeGreaterThan(0);
      expect(result.statistics.segmentedPixels).toBeLessThanOrEqual(
        result.statistics.totalPixels
      );

      const expectedPercentage =
        (result.statistics.segmentedPixels / result.statistics.totalPixels) * 100;
      expect(result.statistics.segmentedPercentage).toBeCloseTo(expectedPercentage, 2);
    });

    it('should detect multiple regions', () => {
      const result = generateMockSegmentation('test.jpg', 'FLAIR');
      expect(result.statistics.regions.length).toBeGreaterThan(0);

      result.statistics.regions.forEach((region) => {
        expect(region).toHaveProperty('label');
        expect(region).toHaveProperty('area');
        expect(region).toHaveProperty('percentage');
        expect(region.area).toBeGreaterThan(0);
        expect(region.percentage).toBeGreaterThan(0);
      });
    });

    it('should have region percentages sum close to total', () => {
      const result = generateMockSegmentation('test.jpg', 'T1-weighted');
      const totalRegionPercentage = result.statistics.regions.reduce(
        (sum, region) => sum + region.percentage,
        0
      );

      expect(totalRegionPercentage).toBeCloseTo(result.statistics.segmentedPercentage, 1);
    });
  });

  describe('Storage Service', () => {
    beforeEach(async () => {
      // Clear storage before each test
      await clearAnalysisHistory();
    });

    it('should save and retrieve analysis history', async () => {
      const report = generateMockAnalysis('test1.jpg');
      await saveAnalysisToHistory(report);

      const history = await getAnalysisHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(report.id);
    });

    it('should maintain history order (newest first)', async () => {
      const report1 = generateMockAnalysis('test1.jpg');
      const report2 = generateMockAnalysis('test2.jpg');

      await saveAnalysisToHistory(report1);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      await saveAnalysisToHistory(report2);

      const history = await getAnalysisHistory();
      expect(history[0].id).toBe(report2.id);
      expect(history[1].id).toBe(report1.id);
    });

    it('should delete specific analysis from history', async () => {
      const report1 = generateMockAnalysis('test1.jpg');
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different IDs
      const report2 = generateMockAnalysis('test2.jpg');

      await saveAnalysisToHistory(report1);
      await saveAnalysisToHistory(report2);

      let history = await getAnalysisHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);

      await deleteAnalysisFromHistory(report1.id);

      history = await getAnalysisHistory();
      const hasReport1 = history.some((h) => h.id === report1.id);
      const hasReport2 = history.some((h) => h.id === report2.id);
      
      expect(hasReport1).toBe(false);
      expect(hasReport2).toBe(true);
    });

    it('should clear all analysis history', async () => {
      const report1 = generateMockAnalysis('test1.jpg');
      const report2 = generateMockAnalysis('test2.jpg');

      await saveAnalysisToHistory(report1);
      await saveAnalysisToHistory(report2);

      await clearAnalysisHistory();

      const history = await getAnalysisHistory();
      expect(history).toHaveLength(0);
    });

    it('should limit history to 50 items', async () => {
      // Add 60 reports
      for (let i = 0; i < 60; i++) {
        const report = generateMockAnalysis(`test${i}.jpg`);
        await saveAnalysisToHistory(report);
      }

      const history = await getAnalysisHistory();
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should save and retrieve settings', async () => {
      const settings = {
        autoSaveHistory: true,
        darkMode: true,
      };

      await saveSettings(settings);
      const retrieved = await getSettings();

      expect(retrieved.autoSaveHistory).toBe(true);
      expect(retrieved.darkMode).toBe(true);
    });

    it('should return default settings when none exist', async () => {
      const settings = await getSettings();
      expect(settings).toHaveProperty('autoSaveHistory');
      expect(settings).toHaveProperty('darkMode');
    });
  });

  describe('Data Types', () => {
    it('should have valid MRI modality types', () => {
      const validModalities = ['T1-weighted', 'T2-weighted', 'FLAIR', 'T1+Gd'];
      const report = generateMockAnalysis('test.jpg');
      expect(validModalities).toContain(report.modality);
    });

    it('should have valid MRI view types', () => {
      const validViews = ['Axial', 'Coronal', 'Sagittal'];
      const report = generateMockAnalysis('test.jpg');
      expect(validViews).toContain(report.view);
    });

    it('should have valid finding status types', () => {
      const validStatuses = ['normal', 'abnormal', 'uncertain'];
      const report = generateMockAnalysis('test.jpg');

      report.anatomicalFindings.forEach((finding) => {
        expect(validStatuses).toContain(finding.status);
      });
    });
  });

  describe('Analysis Report Structure', () => {
    let report: MRIAnalysisReport;

    beforeEach(() => {
      report = generateMockAnalysis('test.jpg');
    });

    it('should have required report fields', () => {
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('modality');
      expect(report).toHaveProperty('view');
      expect(report).toHaveProperty('anatomicalFindings');
      expect(report).toHaveProperty('impression');
      expect(report).toHaveProperty('differential');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('qualityScore');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('imageUri');
    });

    it('should have valid quality score range', () => {
      expect(report.qualityScore).toBeGreaterThanOrEqual(0);
      expect(report.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should have non-empty impression', () => {
      expect(report.impression).toBeTruthy();
      expect(report.impression.length).toBeGreaterThan(0);
    });

    it('should have valid anatomical findings structure', () => {
      expect(report.anatomicalFindings.length).toBeGreaterThan(0);

      report.anatomicalFindings.forEach((finding) => {
        expect(finding.structure).toBeTruthy();
        expect(finding.observation).toBeTruthy();
        expect(finding.status).toBeTruthy();
        expect(typeof finding.confidence).toBe('number');
      });
    });
  });
});
