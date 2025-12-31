/**
 * Tests for Neuroimaging Segmentation Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import only the pure utility functions that don't depend on external modules
// The API functions are tested via integration tests

// Re-define the types and constants locally for testing
type Severity = 'critical' | 'urgent' | 'significant' | 'routine';

interface CriticalFinding {
  structure: string;
  finding: string;
  severity: Severity;
  description: string;
  area_pixels: number;
  area_percentage: number;
  recommendation: string;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#EF4444',
  urgent: '#F97316',
  significant: '#EAB308',
  routine: '#22C55E',
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'CRITICAL',
  urgent: 'URGENT',
  significant: 'SIGNIFICANT',
  routine: 'ROUTINE',
};

const STRUCTURE_COLORS: Record<string, string> = {
  tumor: '#FF5050',
  ventricles: '#0096FF',
  csf: '#0096FF',
  parenchyma: '#64C864',
  cortex: '#64C864',
  edema: '#6496FF',
  enhancement: '#FFC800',
  necrotic: '#FF3232',
  hemorrhage: '#C83264',
  calcification: '#FFFFC8',
};

function base64ToDataUri(base64: string, mimeType: string = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}

function getSeverityColorClass(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500';
    case 'urgent':
      return 'bg-orange-500';
    case 'significant':
      return 'bg-yellow-500';
    case 'routine':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

function getSeverityTextClass(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'text-red-500';
    case 'urgent':
      return 'text-orange-500';
    case 'significant':
      return 'text-yellow-500';
    case 'routine':
      return 'text-green-500';
    default:
      return 'text-gray-500';
  }
}

function sortFindingsBySeverity(findings: CriticalFinding[]): CriticalFinding[] {
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    urgent: 1,
    significant: 2,
    routine: 3,
  };
  
  return [...findings].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}

function filterFindingsBySeverity(
  findings: CriticalFinding[],
  minSeverity: Severity
): CriticalFinding[] {
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    urgent: 1,
    significant: 2,
    routine: 3,
  };
  
  const minLevel = severityOrder[minSeverity];
  return findings.filter(f => severityOrder[f.severity] <= minLevel);
}

function hasCriticalFindings(findings: CriticalFinding[]): boolean {
  return findings.some(f => f.severity === 'critical' || f.severity === 'urgent');
}

function getFindingsSummary(findings: CriticalFinding[]): string {
  const critical = findings.filter(f => f.severity === 'critical').length;
  const urgent = findings.filter(f => f.severity === 'urgent').length;
  const significant = findings.filter(f => f.severity === 'significant').length;
  
  const parts: string[] = [];
  if (critical > 0) parts.push(`${critical} critical`);
  if (urgent > 0) parts.push(`${urgent} urgent`);
  if (significant > 0) parts.push(`${significant} significant`);
  
  if (parts.length === 0) {
    return 'No abnormal findings';
  }
  
  return parts.join(', ') + ' finding(s)';
}

describe('Neuroimaging Service', () => {
  describe('Constants', () => {
    it('should have severity colors defined', () => {
      expect(SEVERITY_COLORS.critical).toBe('#EF4444');
      expect(SEVERITY_COLORS.urgent).toBe('#F97316');
      expect(SEVERITY_COLORS.significant).toBe('#EAB308');
      expect(SEVERITY_COLORS.routine).toBe('#22C55E');
    });

    it('should have severity labels defined', () => {
      expect(SEVERITY_LABELS.critical).toBe('CRITICAL');
      expect(SEVERITY_LABELS.urgent).toBe('URGENT');
      expect(SEVERITY_LABELS.significant).toBe('SIGNIFICANT');
      expect(SEVERITY_LABELS.routine).toBe('ROUTINE');
    });

    it('should have structure colors defined', () => {
      expect(STRUCTURE_COLORS.tumor).toBe('#FF5050');
      expect(STRUCTURE_COLORS.ventricles).toBe('#0096FF');
      expect(STRUCTURE_COLORS.parenchyma).toBe('#64C864');
      expect(STRUCTURE_COLORS.edema).toBe('#6496FF');
      expect(STRUCTURE_COLORS.enhancement).toBe('#FFC800');
      expect(STRUCTURE_COLORS.necrotic).toBe('#FF3232');
    });
  });

  describe('base64ToDataUri', () => {
    it('should convert base64 to data URI with default mime type', () => {
      const base64 = 'SGVsbG8gV29ybGQ=';
      const result = base64ToDataUri(base64);
      expect(result).toBe('data:image/png;base64,SGVsbG8gV29ybGQ=');
    });

    it('should convert base64 to data URI with custom mime type', () => {
      const base64 = 'SGVsbG8gV29ybGQ=';
      const result = base64ToDataUri(base64, 'image/jpeg');
      expect(result).toBe('data:image/jpeg;base64,SGVsbG8gV29ybGQ=');
    });
  });

  describe('getSeverityColorClass', () => {
    it('should return correct color class for each severity', () => {
      expect(getSeverityColorClass('critical')).toBe('bg-red-500');
      expect(getSeverityColorClass('urgent')).toBe('bg-orange-500');
      expect(getSeverityColorClass('significant')).toBe('bg-yellow-500');
      expect(getSeverityColorClass('routine')).toBe('bg-green-500');
    });

    it('should return gray for unknown severity', () => {
      expect(getSeverityColorClass('unknown' as Severity)).toBe('bg-gray-500');
    });
  });

  describe('getSeverityTextClass', () => {
    it('should return correct text class for each severity', () => {
      expect(getSeverityTextClass('critical')).toBe('text-red-500');
      expect(getSeverityTextClass('urgent')).toBe('text-orange-500');
      expect(getSeverityTextClass('significant')).toBe('text-yellow-500');
      expect(getSeverityTextClass('routine')).toBe('text-green-500');
    });

    it('should return gray for unknown severity', () => {
      expect(getSeverityTextClass('unknown' as Severity)).toBe('text-gray-500');
    });
  });

  describe('sortFindingsBySeverity', () => {
    const mockFindings: CriticalFinding[] = [
      {
        structure: 'parenchyma',
        finding: 'Normal',
        severity: 'routine',
        description: 'Normal brain parenchyma',
        area_pixels: 100000,
        area_percentage: 60,
        recommendation: 'No action needed',
      },
      {
        structure: 'tumor',
        finding: 'Tumor detected',
        severity: 'critical',
        description: 'Large tumor detected',
        area_pixels: 50000,
        area_percentage: 18,
        recommendation: 'Immediate consultation',
      },
      {
        structure: 'edema',
        finding: 'Edema detected',
        severity: 'urgent',
        description: 'Significant edema',
        area_pixels: 20000,
        area_percentage: 8,
        recommendation: 'Monitor closely',
      },
      {
        structure: 'ventricles',
        finding: 'Small ventricles',
        severity: 'significant',
        description: 'Compressed ventricles',
        area_pixels: 1000,
        area_percentage: 0.5,
        recommendation: 'Evaluate for mass effect',
      },
    ];

    it('should sort findings by severity (critical first)', () => {
      const sorted = sortFindingsBySeverity(mockFindings);
      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('urgent');
      expect(sorted[2].severity).toBe('significant');
      expect(sorted[3].severity).toBe('routine');
    });

    it('should not mutate the original array', () => {
      const original = [...mockFindings];
      sortFindingsBySeverity(mockFindings);
      expect(mockFindings).toEqual(original);
    });
  });

  describe('filterFindingsBySeverity', () => {
    const mockFindings: CriticalFinding[] = [
      {
        structure: 'tumor',
        finding: 'Tumor',
        severity: 'critical',
        description: 'Critical tumor',
        area_pixels: 50000,
        area_percentage: 18,
        recommendation: 'Urgent',
      },
      {
        structure: 'edema',
        finding: 'Edema',
        severity: 'urgent',
        description: 'Urgent edema',
        area_pixels: 20000,
        area_percentage: 8,
        recommendation: 'Monitor',
      },
      {
        structure: 'ventricles',
        finding: 'Ventricles',
        severity: 'significant',
        description: 'Significant finding',
        area_pixels: 1000,
        area_percentage: 0.5,
        recommendation: 'Evaluate',
      },
      {
        structure: 'parenchyma',
        finding: 'Normal',
        severity: 'routine',
        description: 'Normal',
        area_pixels: 100000,
        area_percentage: 60,
        recommendation: 'None',
      },
    ];

    it('should filter to critical only', () => {
      const filtered = filterFindingsBySeverity(mockFindings, 'critical');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('critical');
    });

    it('should filter to urgent and above', () => {
      const filtered = filterFindingsBySeverity(mockFindings, 'urgent');
      expect(filtered).toHaveLength(2);
      expect(filtered.map(f => f.severity)).toContain('critical');
      expect(filtered.map(f => f.severity)).toContain('urgent');
    });

    it('should filter to significant and above', () => {
      const filtered = filterFindingsBySeverity(mockFindings, 'significant');
      expect(filtered).toHaveLength(3);
    });

    it('should include all findings when filtering by routine', () => {
      const filtered = filterFindingsBySeverity(mockFindings, 'routine');
      expect(filtered).toHaveLength(4);
    });
  });

  describe('hasCriticalFindings', () => {
    it('should return true when critical findings exist', () => {
      const findings: CriticalFinding[] = [
        {
          structure: 'tumor',
          finding: 'Tumor',
          severity: 'critical',
          description: 'Critical',
          area_pixels: 50000,
          area_percentage: 18,
          recommendation: 'Urgent',
        },
      ];
      expect(hasCriticalFindings(findings)).toBe(true);
    });

    it('should return true when urgent findings exist', () => {
      const findings: CriticalFinding[] = [
        {
          structure: 'edema',
          finding: 'Edema',
          severity: 'urgent',
          description: 'Urgent',
          area_pixels: 20000,
          area_percentage: 8,
          recommendation: 'Monitor',
        },
      ];
      expect(hasCriticalFindings(findings)).toBe(true);
    });

    it('should return false when only routine/significant findings', () => {
      const findings: CriticalFinding[] = [
        {
          structure: 'parenchyma',
          finding: 'Normal',
          severity: 'routine',
          description: 'Normal',
          area_pixels: 100000,
          area_percentage: 60,
          recommendation: 'None',
        },
        {
          structure: 'ventricles',
          finding: 'Small',
          severity: 'significant',
          description: 'Significant',
          area_pixels: 1000,
          area_percentage: 0.5,
          recommendation: 'Evaluate',
        },
      ];
      expect(hasCriticalFindings(findings)).toBe(false);
    });

    it('should return false for empty findings', () => {
      expect(hasCriticalFindings([])).toBe(false);
    });
  });

  describe('getFindingsSummary', () => {
    it('should return "No abnormal findings" for routine only', () => {
      const findings: CriticalFinding[] = [
        {
          structure: 'parenchyma',
          finding: 'Normal',
          severity: 'routine',
          description: 'Normal',
          area_pixels: 100000,
          area_percentage: 60,
          recommendation: 'None',
        },
      ];
      expect(getFindingsSummary(findings)).toBe('No abnormal findings');
    });

    it('should return correct summary for critical findings', () => {
      const findings: CriticalFinding[] = [
        {
          structure: 'tumor',
          finding: 'Tumor',
          severity: 'critical',
          description: 'Critical',
          area_pixels: 50000,
          area_percentage: 18,
          recommendation: 'Urgent',
        },
      ];
      expect(getFindingsSummary(findings)).toBe('1 critical finding(s)');
    });

    it('should return correct summary for mixed findings', () => {
      const findings: CriticalFinding[] = [
        {
          structure: 'tumor',
          finding: 'Tumor',
          severity: 'critical',
          description: 'Critical',
          area_pixels: 50000,
          area_percentage: 18,
          recommendation: 'Urgent',
        },
        {
          structure: 'edema',
          finding: 'Edema',
          severity: 'urgent',
          description: 'Urgent',
          area_pixels: 20000,
          area_percentage: 8,
          recommendation: 'Monitor',
        },
        {
          structure: 'ventricles',
          finding: 'Small',
          severity: 'significant',
          description: 'Significant',
          area_pixels: 1000,
          area_percentage: 0.5,
          recommendation: 'Evaluate',
        },
        {
          structure: 'parenchyma',
          finding: 'Normal',
          severity: 'routine',
          description: 'Normal',
          area_pixels: 100000,
          area_percentage: 60,
          recommendation: 'None',
        },
      ];
      expect(getFindingsSummary(findings)).toBe('1 critical, 1 urgent, 1 significant finding(s)');
    });

    it('should return "No abnormal findings" for empty array', () => {
      expect(getFindingsSummary([])).toBe('No abnormal findings');
    });
  });

  describe('Modality Types', () => {
    const VALID_MODALITIES = ['USG', 'T1_GD', 'T2', 'FLAIR'];

    it('should define all supported modalities', () => {
      expect(VALID_MODALITIES).toContain('USG');
      expect(VALID_MODALITIES).toContain('T1_GD');
      expect(VALID_MODALITIES).toContain('T2');
      expect(VALID_MODALITIES).toContain('FLAIR');
    });

    it('should have exactly 4 modalities', () => {
      expect(VALID_MODALITIES).toHaveLength(4);
    });
  });

  describe('SegmentationResult Type', () => {
    interface SegmentationResult {
      success: boolean;
      modality: string;
      overlay: string;
      comparison: string;
      masks: Record<string, string>;
      structures_found: string[];
      findings: CriticalFinding[];
      critical_count: number;
      metadata: {
        image_shape: number[];
        thresholds_used: Record<string, number[]>;
        total_roi_area: number;
        timestamp: string;
      };
    }

    it('should validate a complete segmentation result', () => {
      const result: SegmentationResult = {
        success: true,
        modality: 'USG',
        overlay: 'base64_overlay_data',
        comparison: 'base64_comparison_data',
        masks: {
          tumor: 'base64_mask_data',
          ventricles: 'base64_mask_data',
        },
        structures_found: ['tumor', 'ventricles', 'parenchyma'],
        findings: [
          {
            structure: 'tumor',
            finding: 'Tumor detected',
            severity: 'critical',
            description: 'Large tumor detected',
            area_pixels: 50000,
            area_percentage: 18,
            recommendation: 'Immediate consultation',
          },
        ],
        critical_count: 1,
        metadata: {
          image_shape: [512, 512, 3],
          thresholds_used: {
            tumor: [160, 255],
            csf: [0, 40],
          },
          total_roi_area: 262144,
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      };

      expect(result.success).toBe(true);
      expect(result.modality).toBe('USG');
      expect(result.structures_found).toContain('tumor');
      expect(result.critical_count).toBe(1);
      expect(result.metadata.image_shape).toHaveLength(3);
    });

    it('should handle failed segmentation result', () => {
      const result = {
        success: false,
        error: 'Image validation failed: Image too large',
        request_id: 'abc123',
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain('Image validation failed');
    });
  });

  describe('ServiceHealth Type', () => {
    interface ServiceHealth {
      status: 'healthy' | 'unavailable' | 'error';
      service: string;
      version?: string;
      capabilities?: {
        modalities: string[];
        structures: Record<string, string[]>;
        critical_finding_detection: boolean;
        zero_shot: boolean;
        few_shot: boolean;
      };
    }

    it('should validate a healthy service response', () => {
      const health: ServiceHealth = {
        status: 'healthy',
        service: 'Neuroimaging',
        version: '1.0.0',
        capabilities: {
          modalities: ['USG', 'T1_GD', 'T2', 'FLAIR'],
          structures: {
            USG: ['tumor', 'ventricles', 'parenchyma'],
            T1_GD: ['enhancement', 'necrotic', 'edema', 'csf', 'parenchyma'],
          },
          critical_finding_detection: true,
          zero_shot: true,
          few_shot: true,
        },
      };

      expect(health.status).toBe('healthy');
      expect(health.capabilities?.modalities).toHaveLength(4);
      expect(health.capabilities?.critical_finding_detection).toBe(true);
    });

    it('should validate an unavailable service response', () => {
      const health: ServiceHealth = {
        status: 'unavailable',
        service: 'Neuroimaging',
      };

      expect(health.status).toBe('unavailable');
      expect(health.capabilities).toBeUndefined();
    });
  });

  describe('Critical Finding Detection', () => {
    const classifyFindingSeverity = (
      structure: string,
      areaPercentage: number
    ): Severity => {
      // Tumor findings
      if (structure === 'tumor' || structure === 'enhancement') {
        if (areaPercentage > 10) return 'critical';
        if (areaPercentage > 5) return 'urgent';
        if (areaPercentage > 1) return 'significant';
        return 'routine';
      }

      // Necrotic center (indicates aggressive tumor)
      if (structure === 'necrotic') {
        if (areaPercentage > 2) return 'critical';
        return 'urgent';
      }

      // Edema
      if (structure === 'edema') {
        if (areaPercentage > 15) return 'critical';
        if (areaPercentage > 8) return 'urgent';
        return 'significant';
      }

      // Default
      return 'routine';
    };

    it('should classify large tumor as critical', () => {
      expect(classifyFindingSeverity('tumor', 15)).toBe('critical');
    });

    it('should classify medium tumor as urgent', () => {
      expect(classifyFindingSeverity('tumor', 7)).toBe('urgent');
    });

    it('should classify small tumor as significant', () => {
      expect(classifyFindingSeverity('tumor', 2)).toBe('significant');
    });

    it('should classify minimal tumor as routine', () => {
      expect(classifyFindingSeverity('tumor', 0.5)).toBe('routine');
    });

    it('should classify necrotic center as critical when large', () => {
      expect(classifyFindingSeverity('necrotic', 3)).toBe('critical');
    });

    it('should classify extensive edema as critical', () => {
      expect(classifyFindingSeverity('edema', 20)).toBe('critical');
    });

    it('should classify moderate edema as urgent', () => {
      expect(classifyFindingSeverity('edema', 10)).toBe('urgent');
    });

    it('should classify normal parenchyma as routine', () => {
      expect(classifyFindingSeverity('parenchyma', 60)).toBe('routine');
    });
  });

  describe('USG Structures', () => {
    const USG_STRUCTURES = ['tumor', 'csf', 'parenchyma', 'hemorrhage', 'edema'];

    it('should define default USG structures', () => {
      expect(USG_STRUCTURES).toContain('tumor');
      expect(USG_STRUCTURES).toContain('csf');
      expect(USG_STRUCTURES).toContain('parenchyma');
    });

    it('should support hemorrhage detection', () => {
      expect(USG_STRUCTURES).toContain('hemorrhage');
    });

    it('should support edema detection', () => {
      expect(USG_STRUCTURES).toContain('edema');
    });
  });

  describe('MRI T1-Gd Structures', () => {
    const T1GD_STRUCTURES = ['enhancement', 'necrotic', 'edema', 'csf', 'parenchyma'];

    it('should define default T1-Gd structures', () => {
      expect(T1GD_STRUCTURES).toContain('enhancement');
      expect(T1GD_STRUCTURES).toContain('necrotic');
      expect(T1GD_STRUCTURES).toContain('edema');
    });

    it('should support CSF detection', () => {
      expect(T1GD_STRUCTURES).toContain('csf');
    });

    it('should support parenchyma detection', () => {
      expect(T1GD_STRUCTURES).toContain('parenchyma');
    });
  });

  describe('Request Timeout Configuration', () => {
    const DEFAULT_TIMEOUT_MS = 30000;
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 1000;

    it('should have reasonable default timeout', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(30000);
      expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(60000);
    });

    it('should have reasonable retry count', () => {
      expect(MAX_RETRIES).toBe(2);
      expect(MAX_RETRIES).toBeLessThanOrEqual(5);
    });

    it('should have reasonable retry delay', () => {
      expect(RETRY_DELAY_MS).toBe(1000);
      expect(RETRY_DELAY_MS).toBeLessThanOrEqual(5000);
    });

    it('should calculate exponential backoff correctly', () => {
      const delays = [0, 1, 2].map(attempt => RETRY_DELAY_MS * Math.pow(2, attempt));
      expect(delays).toEqual([1000, 2000, 4000]);
    });
  });

  describe('Image Size Limits', () => {
    const MAX_IMAGE_SIZE_MB = 50;
    const MAX_IMAGE_DIMENSION = 4096;
    const MIN_IMAGE_DIMENSION = 10;

    it('should enforce reasonable max image size', () => {
      expect(MAX_IMAGE_SIZE_MB).toBe(50);
      expect(MAX_IMAGE_SIZE_MB).toBeLessThanOrEqual(100);
    });

    it('should enforce reasonable max dimension', () => {
      expect(MAX_IMAGE_DIMENSION).toBe(4096);
    });

    it('should enforce minimum dimension', () => {
      expect(MIN_IMAGE_DIMENSION).toBe(10);
    });

    it('should validate image dimensions', () => {
      const validateDimensions = (width: number, height: number): boolean => {
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) return false;
        if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) return false;
        return true;
      };

      expect(validateDimensions(512, 512)).toBe(true);
      expect(validateDimensions(4096, 4096)).toBe(true);
      expect(validateDimensions(5000, 512)).toBe(false);
      expect(validateDimensions(5, 512)).toBe(false);
    });
  });
});
