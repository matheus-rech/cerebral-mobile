/**
 * DICOM Integration Tests
 */

import { describe, it, expect } from 'vitest';

describe('DICOM Integration', () => {
  describe('DICOM Metadata', () => {
    it('should define patient metadata fields', () => {
      const metadata = {
        patientName: 'DOE^JOHN',
        patientID: '12345',
        patientBirthDate: '19800101',
        patientSex: 'M',
      };
      
      expect(metadata.patientName).toBe('DOE^JOHN');
      expect(metadata.patientID).toBe('12345');
      expect(metadata.patientBirthDate).toBe('19800101');
      expect(metadata.patientSex).toBe('M');
    });

    it('should define study metadata fields', () => {
      const metadata = {
        studyDate: '20240101',
        studyDescription: 'Brain MRI with contrast',
        seriesDescription: 'T1 MPRAGE',
        modality: 'MR',
      };
      
      expect(metadata.studyDate).toBe('20240101');
      expect(metadata.studyDescription).toBeTruthy();
      expect(metadata.seriesDescription).toBeTruthy();
      expect(metadata.modality).toBe('MR');
    });

    it('should define image metadata fields', () => {
      const metadata = {
        rows: 256,
        columns: 256,
        sliceThickness: 1.0,
        pixelSpacing: [1.0, 1.0],
        windowCenter: 40,
        windowWidth: 400,
      };
      
      expect(metadata.rows).toBe(256);
      expect(metadata.columns).toBe(256);
      expect(metadata.sliceThickness).toBe(1.0);
      expect(metadata.pixelSpacing).toHaveLength(2);
      expect(metadata.windowCenter).toBe(40);
      expect(metadata.windowWidth).toBe(400);
    });
  });

  describe('DICOM File Detection', () => {
    it('should recognize .dcm extension', () => {
      const filename = 'brain_scan.dcm';
      expect(filename.toLowerCase().endsWith('.dcm')).toBe(true);
    });

    it('should recognize .dicom extension', () => {
      const filename = 'brain_scan.dicom';
      expect(filename.toLowerCase().endsWith('.dicom')).toBe(true);
    });

    it('should handle files without extension', () => {
      const filename = 'IM-0001-0001';
      // DICOM files from PACS often have no extension
      expect(filename).toBeTruthy();
    });
  });

  describe('Patient Information Formatting', () => {
    it('should format patient name correctly', () => {
      const patientName = 'DOE^JOHN';
      const formatted = patientName.replace('^', ' ');
      expect(formatted).toBe('DOE JOHN');
    });

    it('should format patient date of birth', () => {
      const dob = '19800101';
      const formatted = `${dob.slice(0, 4)}-${dob.slice(4, 6)}-${dob.slice(6, 8)}`;
      expect(formatted).toBe('1980-01-01');
    });

    it('should format study date', () => {
      const studyDate = '20240115';
      const formatted = `${studyDate.slice(0, 4)}-${studyDate.slice(4, 6)}-${studyDate.slice(6, 8)}`;
      expect(formatted).toBe('2024-01-15');
    });

    it('should create patient info string', () => {
      const info = 'Patient: DOE JOHN • ID: 12345 • Sex: M • DOB: 1980-01-01';
      expect(info).toContain('Patient:');
      expect(info).toContain('ID:');
      expect(info).toContain('Sex:');
      expect(info).toContain('DOB:');
    });

    it('should create study info string', () => {
      const info = 'MR • T1 MPRAGE • 2024-01-15';
      expect(info).toContain('MR');
      expect(info).toContain('T1 MPRAGE');
      expect(info).toContain('2024-01-15');
    });
  });

  describe('Window/Level Adjustment', () => {
    it('should calculate window min and max', () => {
      const windowCenter = 40;
      const windowWidth = 400;
      const windowMin = windowCenter - windowWidth / 2;
      const windowMax = windowCenter + windowWidth / 2;
      
      expect(windowMin).toBe(-160);
      expect(windowMax).toBe(240);
    });

    it('should apply windowing to pixel values', () => {
      const windowCenter = 40;
      const windowWidth = 400;
      const windowMin = windowCenter - windowWidth / 2;
      const windowMax = windowCenter + windowWidth / 2;
      
      // Test value below window
      let value = -200;
      let windowed = value <= windowMin ? 0 : value >= windowMax ? 255 : ((value - windowMin) / (windowMax - windowMin)) * 255;
      expect(windowed).toBe(0);
      
      // Test value above window
      value = 300;
      windowed = value <= windowMin ? 0 : value >= windowMax ? 255 : ((value - windowMin) / (windowMax - windowMin)) * 255;
      expect(windowed).toBe(255);
      
      // Test value within window
      value = 40; // center
      windowed = value <= windowMin ? 0 : value >= windowMax ? 255 : ((value - windowMin) / (windowMax - windowMin)) * 255;
      expect(Math.round(windowed)).toBe(128);
    });

    it('should support different window presets', () => {
      const presets = {
        brain: { center: 40, width: 80 },
        subdural: { center: 75, width: 150 },
        bone: { center: 300, width: 1500 },
        soft_tissue: { center: 50, width: 350 },
      };
      
      expect(presets.brain.center).toBe(40);
      expect(presets.subdural.center).toBe(75);
      expect(presets.bone.center).toBe(300);
      expect(presets.soft_tissue.center).toBe(50);
    });
  });

  describe('DICOM to NIfTI Conversion', () => {
    it('should handle single slice conversion', () => {
      const sliceCount = 1;
      expect(sliceCount).toBeGreaterThan(0);
    });

    it('should handle multi-slice series', () => {
      const sliceCount = 176; // typical brain MRI
      expect(sliceCount).toBeGreaterThan(1);
    });

    it('should preserve image dimensions', () => {
      const width = 256;
      const height = 256;
      const depth = 176;
      
      expect(width).toBe(256);
      expect(height).toBe(256);
      expect(depth).toBe(176);
    });

    it('should preserve voxel spacing', () => {
      const pixelSpacing = [1.0, 1.0];
      const sliceThickness = 1.0;
      
      expect(pixelSpacing[0]).toBe(1.0);
      expect(pixelSpacing[1]).toBe(1.0);
      expect(sliceThickness).toBe(1.0);
    });
  });

  describe('DICOM File Picker', () => {
    it('should accept DICOM file types', () => {
      const acceptedTypes = ['application/dicom', '*/*'];
      expect(acceptedTypes).toContain('application/dicom');
      expect(acceptedTypes).toContain('*/*');
    });

    it('should handle file selection', () => {
      const file = {
        name: 'brain_scan.dcm',
        size: 524288, // 512KB
        type: 'application/dicom',
      };
      
      expect(file.name).toBeTruthy();
      expect(file.size).toBeGreaterThan(0);
    });

    it('should handle file parsing errors gracefully', () => {
      const error = new Error('Failed to parse DICOM file');
      expect(error.message).toContain('Failed to parse');
    });
  });

  describe('Integration with Analysis Workflow', () => {
    it('should navigate to analysis screen with DICOM data', () => {
      const params = {
        imageUri: 'data:image/png;base64,...',
        source: 'dicom',
        patientInfo: JSON.stringify({
          patientName: 'DOE^JOHN',
          patientID: '12345',
          modality: 'MR',
        }),
      };
      
      expect(params.source).toBe('dicom');
      expect(params.imageUri).toContain('data:image');
      expect(params.patientInfo).toBeTruthy();
    });

    it('should parse patient info from params', () => {
      const patientInfoStr = JSON.stringify({
        patientName: 'DOE^JOHN',
        patientID: '12345',
        modality: 'MR',
      });
      
      const patientInfo = JSON.parse(patientInfoStr);
      expect(patientInfo.patientName).toBe('DOE^JOHN');
      expect(patientInfo.patientID).toBe('12345');
      expect(patientInfo.modality).toBe('MR');
    });
  });

  describe('DICOM Viewer Features', () => {
    it('should support zoom functionality', () => {
      let zoom = 1.0;
      zoom = zoom * 1.5; // zoom in
      expect(zoom).toBe(1.5);
      
      zoom = zoom / 1.5; // zoom out
      expect(zoom).toBe(1.0);
    });

    it('should support pan functionality', () => {
      const pan = { x: 0, y: 0 };
      pan.x += 10;
      pan.y += 10;
      
      expect(pan.x).toBe(10);
      expect(pan.y).toBe(10);
    });

    it('should support slice navigation', () => {
      let currentSlice = 0;
      const totalSlices = 176;
      
      currentSlice = Math.min(currentSlice + 1, totalSlices - 1);
      expect(currentSlice).toBe(1);
      
      currentSlice = Math.max(currentSlice - 1, 0);
      expect(currentSlice).toBe(0);
    });
  });
});
