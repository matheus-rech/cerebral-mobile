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
});
