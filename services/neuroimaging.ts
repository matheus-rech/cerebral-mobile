/**
 * Neuroimaging Segmentation Service
 * Client-side API for brain USG and MRI segmentation with critical finding detection
 *
 * Production-ready implementation with:
 * - Request timeout handling
 * - Retry logic with exponential backoff
 * - Structured error responses
 */

import { getApiBaseUrl } from '@/constants/oauth';

// Configuration for production reliability
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Delay helper for retry logic
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort (timeout) or if we've exhausted retries
      if (lastError.name === 'AbortError' || attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s
      await delay(RETRY_DELAY_MS * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

// Types for the neuroimaging service
export type Modality = 'USG' | 'T1_GD' | 'T2' | 'FLAIR';

export type Severity = 'critical' | 'urgent' | 'significant' | 'routine';

export interface CriticalFinding {
  structure: string;
  finding: string;
  severity: Severity;
  description: string;
  area_pixels: number;
  area_percentage: number;
  recommendation: string;
}

export interface SegmentationMetadata {
  image_shape: number[];
  thresholds_used: Record<string, number[]>;
  total_roi_area: number;
  timestamp: string;
}

export interface SegmentationResult {
  success: boolean;
  modality: Modality;
  overlay: string;  // base64 encoded image
  comparison: string;  // base64 encoded side-by-side comparison
  masks: Record<string, string>;  // structure name -> base64 mask
  structures_found: string[];
  findings: CriticalFinding[];
  critical_count: number;
  metadata: SegmentationMetadata;
  imageUri?: string;
  timestamp?: string;
  error?: string;
}

export interface ColorPalette {
  colors: Record<string, {
    rgb: number[];
    hex: string;
  }>;
}

export interface ThresholdConfig {
  thresholds: Record<string, Record<string, number[]>>;
}

export interface ServiceHealth {
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
  timestamp?: string;
}

// Severity colors for UI display
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#EF4444',  // Red
  urgent: '#F97316',    // Orange
  significant: '#EAB308', // Yellow
  routine: '#22C55E',   // Green
};

// Severity labels for UI display
export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'CRITICAL',
  urgent: 'URGENT',
  significant: 'SIGNIFICANT',
  routine: 'ROUTINE',
};

// Structure colors (matching Python backend)
export const STRUCTURE_COLORS: Record<string, string> = {
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

/**
 * Get the API base URL
 */
function getBaseUrl(): string {
  return getApiBaseUrl();
}

/**
 * Segment brain ultrasound (neuroUSG) image
 */
export async function segmentNeuroUSG(
  imageUri: string,
  structures?: string[]
): Promise<SegmentationResult> {
  const response = await fetchWithRetry(
    `${getBaseUrl()}/api/ml/neuroimaging/segment-usg`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUri,
        structures: structures || ['tumor', 'csf', 'parenchyma']
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'NeuroUSG segmentation failed');
  }

  return response.json();
}

/**
 * Segment MRI image (T1-Gd, T2, or FLAIR)
 */
export async function segmentMRI(
  imageUri: string,
  modality: Modality = 'T1_GD',
  structures?: string[]
): Promise<SegmentationResult> {
  const response = await fetchWithRetry(
    `${getBaseUrl()}/api/ml/neuroimaging/segment-mri`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUri, modality, structures }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'MRI segmentation failed');
  }

  return response.json();
}

/**
 * Auto-detect modality and segment
 */
export async function segmentAuto(
  imageUri: string,
  hint?: Modality
): Promise<SegmentationResult> {
  const response = await fetchWithRetry(
    `${getBaseUrl()}/api/ml/neuroimaging/segment-auto`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUri, hint }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Auto segmentation failed');
  }

  return response.json();
}

/**
 * Get color palette for segmentation visualization
 */
export async function getColors(): Promise<ColorPalette> {
  const response = await fetch(`${getBaseUrl()}/api/ml/neuroimaging/colors`);
  
  if (!response.ok) {
    throw new Error('Failed to get colors');
  }

  return response.json();
}

/**
 * Get default thresholds for each modality
 */
export async function getThresholds(): Promise<ThresholdConfig> {
  const response = await fetch(`${getBaseUrl()}/api/ml/neuroimaging/thresholds`);
  
  if (!response.ok) {
    throw new Error('Failed to get thresholds');
  }

  return response.json();
}

/**
 * Check neuroimaging service health
 */
export async function checkHealth(): Promise<ServiceHealth> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/ml/health`);
    const data = await response.json();
    
    // Find neuroimaging service in the health check results
    const neuroimaging = data.services?.find(
      (s: any) => s.service === 'Neuroimaging' || s.name === 'Neuroimaging'
    );
    
    if (neuroimaging) {
      return {
        status: neuroimaging.status,
        service: 'Neuroimaging',
        ...neuroimaging,
      };
    }
    
    return {
      status: 'unavailable',
      service: 'Neuroimaging',
    };
  } catch (error) {
    return {
      status: 'error',
      service: 'Neuroimaging',
    };
  }
}

/**
 * Convert base64 image to data URI for display
 */
export function base64ToDataUri(base64: string, mimeType: string = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Get severity badge color class for Tailwind
 */
export function getSeverityColorClass(severity: Severity): string {
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

/**
 * Get severity text color class for Tailwind
 */
export function getSeverityTextClass(severity: Severity): string {
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

/**
 * Sort findings by severity (critical first)
 */
export function sortFindingsBySeverity(findings: CriticalFinding[]): CriticalFinding[] {
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

/**
 * Filter findings by minimum severity
 */
export function filterFindingsBySeverity(
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

/**
 * Check if any findings are critical or urgent
 */
export function hasCriticalFindings(findings: CriticalFinding[]): boolean {
  return findings.some(f => f.severity === 'critical' || f.severity === 'urgent');
}

/**
 * Get summary text for findings
 */
export function getFindingsSummary(findings: CriticalFinding[]): string {
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
