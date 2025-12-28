/**
 * Vision Analyzer Service
 * Uses Claude Vision API for MRI analysis
 */

import type { MRIAnalysisReport, AnatomicalFinding, MRIModality, MRIView } from '@/types/mri';

/**
 * Analyze an MRI image using Claude Vision API
 */
export async function analyzeMRIImage(imageUri: string): Promise<MRIAnalysisReport> {
  try {
    // Convert image to base64 if it's a local file
    let imageData = imageUri;
    
    if (imageUri.startsWith('file://') || imageUri.startsWith('ph://')) {
      // For local files, we need to convert to base64
      // This will be handled by the backend API
      imageData = imageUri;
    }

    // Call backend API for Claude Vision analysis
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/analyze-mri`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUri: imageData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }

    const report: MRIAnalysisReport = await response.json();
    return report;
  } catch (error) {
    console.error('Error analyzing MRI image:', error);
    throw error;
  }
}

/**
 * Generate a mock analysis report for testing
 * This simulates the Claude Vision API response
 */
export function generateMockAnalysis(imageUri: string): MRIAnalysisReport {
  const findings: AnatomicalFinding[] = [
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
    {
      structure: 'Midline Structures',
      observation: 'No significant shift detected',
      status: 'normal',
      confidence: 0.95,
      location: 'Central',
    },
    {
      structure: 'Basal Ganglia',
      observation: 'Symmetric signal intensity',
      status: 'normal',
      confidence: 0.90,
      location: 'Bilateral',
    },
  ];

  // Randomly add an abnormal finding for demonstration
  if (Math.random() > 0.5) {
    findings.push({
      structure: 'White Matter',
      observation: 'Hyperintense foci in periventricular region',
      status: 'abnormal',
      confidence: 0.78,
      location: 'Right hemisphere',
    });
  }

  const abnormalFindings = findings.filter((f) => f.status === 'abnormal');
  const hasAbnormalities = abnormalFindings.length > 0;

  const report: MRIAnalysisReport = {
    id: `analysis-${Date.now()}`,
    severity: hasAbnormalities ? 'abnormal' : 'normal',
    emergencyFindings: [],
    modality: 'T2-weighted' as MRIModality,
    view: 'Axial' as MRIView,
    anatomicalFindings: findings,
    impression: hasAbnormalities
      ? `Abnormal study. ${abnormalFindings.length} finding(s) require attention.`
      : 'No acute abnormality identified on this sequence.',
    differential: hasAbnormalities
      ? [
          'Small vessel ischemic disease',
          'Demyelinating process',
          'Age-related white matter changes',
        ]
      : [],
    recommendations: hasAbnormalities
      ? [
          'Correlation with contrast-enhanced imaging',
          'Clinical correlation recommended',
          'Follow-up imaging in 3-6 months if stable',
        ]
      : ['Routine follow-up as clinically indicated'],
    qualityScore: 0.85 + Math.random() * 0.15,
    timestamp: new Date().toISOString(),
    imageUri,
  };

  return report;
}
