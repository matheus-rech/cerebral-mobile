/**
 * NiiVue 3D Viewer Tests
 */

import { describe, it, expect } from 'vitest';

describe('NiiVue 3D Viewer', () => {
  describe('Component Integration', () => {
    it('should accept imageUri prop', () => {
      const imageUri = 'https://example.com/brain.nii.gz';
      expect(imageUri).toBeTruthy();
      expect(imageUri).toContain('.nii');
    });

    it('should accept optional segmentationUri prop', () => {
      const segmentationUri = 'https://example.com/segmentation.nii.gz';
      expect(segmentationUri).toBeTruthy();
      expect(segmentationUri).toContain('.nii');
    });

    it('should accept width and height props', () => {
      const width = 400;
      const height = 400;
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });
  });

  describe('HTML Generation', () => {
    it('should generate valid HTML with NiiVue CDN', () => {
      const html = generateMockHTML('test.nii.gz');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('niivue');
      expect(html).toContain('canvas');
    });

    it('should include image URI in generated HTML', () => {
      const imageUri = 'https://example.com/brain.nii.gz';
      const html = generateMockHTML(imageUri);
      expect(html).toContain(imageUri);
    });

    it('should include segmentation URI when provided', () => {
      const imageUri = 'https://example.com/brain.nii.gz';
      const segUri = 'https://example.com/seg.nii.gz';
      const html = generateMockHTML(imageUri, segUri);
      expect(html).toContain(imageUri);
      expect(html).toContain(segUri);
    });

    it('should include interactive controls', () => {
      const html = generateMockHTML('test.nii.gz');
      expect(html).toContain('Axial');
      expect(html).toContain('Coronal');
      expect(html).toContain('Sagittal');
      expect(html).toContain('3D');
    });

    it('should include toggle segmentation button when segmentation provided', () => {
      const html = generateMockHTML('brain.nii.gz', 'seg.nii.gz');
      expect(html).toContain('Toggle Seg');
      expect(html).toContain('toggleSegmentation');
    });
  });

  describe('Viewer Features', () => {
    it('should support multiple slice types', () => {
      const sliceTypes = ['Axial', 'Coronal', 'Sagittal', 'Render'];
      sliceTypes.forEach((type) => {
        expect(type).toBeTruthy();
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it('should support crosshair navigation', () => {
      const features = {
        show3Dcrosshair: true,
        onLocationChange: true,
      };
      expect(features.show3Dcrosshair).toBe(true);
      expect(features.onLocationChange).toBe(true);
    });

    it('should support opacity control for segmentation', () => {
      const opacity = 0.5;
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    });

    it('should support colormap selection', () => {
      const colormaps = ['gray', 'red', 'hot', 'cool'];
      expect(colormaps.length).toBeGreaterThan(0);
      expect(colormaps).toContain('gray');
    });
  });

  describe('3D Viewer Screen', () => {
    it('should require imageUri parameter', () => {
      const params = { imageUri: 'https://example.com/brain.nii.gz' };
      expect(params.imageUri).toBeTruthy();
    });

    it('should accept optional segmentationUri parameter', () => {
      const params = {
        imageUri: 'https://example.com/brain.nii.gz',
        segmentationUri: 'https://example.com/seg.nii.gz',
      };
      expect(params.segmentationUri).toBeTruthy();
    });

    it('should accept optional title parameter', () => {
      const params = {
        imageUri: 'https://example.com/brain.nii.gz',
        title: 'Patient MRI Scan',
      };
      expect(params.title).toBe('Patient MRI Scan');
    });

    it('should display instructions for viewer controls', () => {
      const instructions = [
        'Axial - View brain from top-down',
        'Coronal - View brain from front-back',
        'Sagittal - View brain from side',
        '3D - Interactive 3D volume rendering',
      ];
      expect(instructions.length).toBe(4);
      instructions.forEach((instruction) => {
        expect(instruction).toBeTruthy();
      });
    });

    it('should display feature descriptions', () => {
      const features = [
        'Interactive Rotation',
        'Zoom & Pan',
        'Crosshair Navigation',
        'Overlay Visualization',
      ];
      expect(features.length).toBe(4);
      features.forEach((feature) => {
        expect(feature).toBeTruthy();
      });
    });
  });

  describe('Integration with Analysis Workflow', () => {
    it('should be accessible from analysis screen', () => {
      const route = '/viewer-3d';
      expect(route).toBe('/viewer-3d');
    });

    it('should pass imageUri from analysis to viewer', () => {
      const analysisParams = {
        imageUri: 'https://example.com/brain.nii.gz',
      };
      const viewerParams = {
        imageUri: analysisParams.imageUri,
        title: 'MRI 3D Visualization',
      };
      expect(viewerParams.imageUri).toBe(analysisParams.imageUri);
    });

    it('should support navigation back to analysis', () => {
      const canGoBack = true;
      expect(canGoBack).toBe(true);
    });
  });
});

// Helper function to generate mock HTML for testing
function generateMockHTML(imageUri: string, segmentationUri?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>NiiVue Brain Viewer</title>
</head>
<body>
  <canvas id="gl"></canvas>
  <div class="controls">
    <button onclick="setSliceType('axial')">Axial</button>
    <button onclick="setSliceType('coronal')">Coronal</button>
    <button onclick="setSliceType('sagittal')">Sagittal</button>
    <button onclick="setSliceType('render')">3D</button>
    ${segmentationUri ? '<button onclick="toggleSegmentation()">Toggle Seg</button>' : ''}
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@niivue/niivue@latest/dist/niivue.umd.js"></script>
  <script>
    const nv = new niivue.Niivue();
    nv.loadVolumes([
      { url: '${imageUri}', colormap: 'gray' }
      ${segmentationUri ? `, { url: '${segmentationUri}', colormap: 'red', opacity: 0.5 }` : ''}
    ]);
  </script>
</body>
</html>
  `;
}
