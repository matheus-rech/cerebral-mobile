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


