import { describe, it, expect } from 'vitest';
import {
  calculateDiceCoefficient,
  calculateIoU,
  calculatePrecision,
  calculateRecall,
  compareMasks,
  calculateSegmentationMetrics,
  getAccuracyGrade,
  formatMetricAsPercentage,
} from '../utils/segmentation-metrics';

describe('Segmentation Metrics', () => {
  describe('Dice Coefficient', () => {
    it('should calculate perfect overlap (Dice = 1.0)', () => {
      const dice = calculateDiceCoefficient(100, 0, 0);
      expect(dice).toBe(1.0);
    });

    it('should calculate no overlap (Dice = 0.0)', () => {
      const dice = calculateDiceCoefficient(0, 100, 100);
      expect(dice).toBe(0.0);
    });

    it('should calculate partial overlap', () => {
      const dice = calculateDiceCoefficient(50, 25, 25);
      expect(dice).toBeCloseTo(0.667, 2);
    });

    it('should handle zero denominator', () => {
      const dice = calculateDiceCoefficient(0, 0, 0);
      expect(dice).toBe(0.0);
    });
  });

  describe('IoU (Intersection over Union)', () => {
    it('should calculate perfect overlap (IoU = 1.0)', () => {
      const iou = calculateIoU(100, 0, 0);
      expect(iou).toBe(1.0);
    });

    it('should calculate no overlap (IoU = 0.0)', () => {
      const iou = calculateIoU(0, 100, 100);
      expect(iou).toBe(0.0);
    });

    it('should calculate partial overlap', () => {
      const iou = calculateIoU(50, 25, 25);
      expect(iou).toBe(0.5);
    });

    it('should handle zero denominator', () => {
      const iou = calculateIoU(0, 0, 0);
      expect(iou).toBe(0.0);
    });
  });

  describe('Precision', () => {
    it('should calculate perfect precision', () => {
      const precision = calculatePrecision(100, 0);
      expect(precision).toBe(1.0);
    });

    it('should calculate zero precision', () => {
      const precision = calculatePrecision(0, 100);
      expect(precision).toBe(0.0);
    });

    it('should calculate partial precision', () => {
      const precision = calculatePrecision(75, 25);
      expect(precision).toBe(0.75);
    });

    it('should handle zero denominator', () => {
      const precision = calculatePrecision(0, 0);
      expect(precision).toBe(0.0);
    });
  });

  describe('Recall', () => {
    it('should calculate perfect recall', () => {
      const recall = calculateRecall(100, 0);
      expect(recall).toBe(1.0);
    });

    it('should calculate zero recall', () => {
      const recall = calculateRecall(0, 100);
      expect(recall).toBe(0.0);
    });

    it('should calculate partial recall', () => {
      const recall = calculateRecall(80, 20);
      expect(recall).toBe(0.8);
    });

    it('should handle zero denominator', () => {
      const recall = calculateRecall(0, 0);
      expect(recall).toBe(0.0);
    });
  });

  describe('Mask Comparison', () => {
    it('should compare identical masks', () => {
      const mask1 = new Uint8Array([255, 255, 0, 0]);
      const mask2 = new Uint8Array([255, 255, 0, 0]);
      
      const result = compareMasks(mask1, mask2);
      
      expect(result.truePositives).toBe(2);
      expect(result.falsePositives).toBe(0);
      expect(result.falseNegatives).toBe(0);
      expect(result.trueNegatives).toBe(2);
    });

    it('should compare completely different masks', () => {
      const mask1 = new Uint8Array([255, 255, 0, 0]);
      const mask2 = new Uint8Array([0, 0, 255, 255]);
      
      const result = compareMasks(mask1, mask2);
      
      expect(result.truePositives).toBe(0);
      expect(result.falsePositives).toBe(2);
      expect(result.falseNegatives).toBe(2);
      expect(result.trueNegatives).toBe(0);
    });

    it('should compare partially overlapping masks', () => {
      const mask1 = new Uint8Array([255, 255, 0, 0]);
      const mask2 = new Uint8Array([255, 0, 255, 0]);
      
      const result = compareMasks(mask1, mask2);
      
      expect(result.truePositives).toBe(1);
      expect(result.falsePositives).toBe(1);
      expect(result.falseNegatives).toBe(1);
      expect(result.trueNegatives).toBe(1);
    });

    it('should throw error for mismatched dimensions', () => {
      const mask1 = new Uint8Array([255, 255]);
      const mask2 = new Uint8Array([255, 255, 0, 0]);
      
      expect(() => compareMasks(mask1, mask2)).toThrow('Masks must have the same dimensions');
    });
  });

  describe('Complete Metrics Calculation', () => {
    it('should calculate all metrics for perfect segmentation', () => {
      const groundTruth = new Uint8Array([255, 255, 0, 0]);
      const prediction = new Uint8Array([255, 255, 0, 0]);
      
      const metrics = calculateSegmentationMetrics(groundTruth, prediction);
      
      expect(metrics.dice).toBe(1.0);
      expect(metrics.iou).toBe(1.0);
      expect(metrics.precision).toBe(1.0);
      expect(metrics.recall).toBe(1.0);
    });

    it('should calculate all metrics for poor segmentation', () => {
      const groundTruth = new Uint8Array([255, 255, 0, 0]);
      const prediction = new Uint8Array([0, 0, 255, 255]);
      
      const metrics = calculateSegmentationMetrics(groundTruth, prediction);
      
      expect(metrics.dice).toBe(0.0);
      expect(metrics.iou).toBe(0.0);
      expect(metrics.precision).toBe(0.0);
      expect(metrics.recall).toBe(0.0);
    });

    it('should calculate all metrics for partial segmentation', () => {
      const groundTruth = new Uint8Array([255, 255, 0, 0]);
      const prediction = new Uint8Array([255, 0, 255, 0]);
      
      const metrics = calculateSegmentationMetrics(groundTruth, prediction);
      
      expect(metrics.dice).toBeCloseTo(0.5, 2);
      expect(metrics.iou).toBeCloseTo(0.333, 2);
      expect(metrics.precision).toBe(0.5);
      expect(metrics.recall).toBe(0.5);
    });
  });

  describe('Accuracy Grading', () => {
    it('should grade excellent segmentation (>= 0.9)', () => {
      const grade = getAccuracyGrade(0.95);
      expect(grade.grade).toBe('Excellent');
      expect(grade.color).toBe('#22C55E');
    });

    it('should grade good segmentation (0.8-0.9)', () => {
      const grade = getAccuracyGrade(0.85);
      expect(grade.grade).toBe('Good');
      expect(grade.color).toBe('#10B981');
    });

    it('should grade fair segmentation (0.7-0.8)', () => {
      const grade = getAccuracyGrade(0.75);
      expect(grade.grade).toBe('Fair');
      expect(grade.color).toBe('#F59E0B');
    });

    it('should grade poor segmentation (0.5-0.7)', () => {
      const grade = getAccuracyGrade(0.6);
      expect(grade.grade).toBe('Poor');
      expect(grade.color).toBe('#F97316');
    });

    it('should grade very poor segmentation (< 0.5)', () => {
      const grade = getAccuracyGrade(0.3);
      expect(grade.grade).toBe('Very Poor');
      expect(grade.color).toBe('#EF4444');
    });
  });

  describe('Metric Formatting', () => {
    it('should format as percentage with 1 decimal', () => {
      const formatted = formatMetricAsPercentage(0.8567);
      expect(formatted).toBe('85.7%');
    });

    it('should format as percentage with 2 decimals', () => {
      const formatted = formatMetricAsPercentage(0.8567, 2);
      expect(formatted).toBe('85.67%');
    });

    it('should format perfect score', () => {
      const formatted = formatMetricAsPercentage(1.0);
      expect(formatted).toBe('100.0%');
    });

    it('should format zero score', () => {
      const formatted = formatMetricAsPercentage(0.0);
      expect(formatted).toBe('0.0%');
    });
  });
});
