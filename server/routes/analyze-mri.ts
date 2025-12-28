/**
 * MRI Analysis API Route
 * Uses Claude Vision API to analyze brain MRI scans
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// Initialize Anthropic client with API key from environment
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnatomicalFinding {
  structure: string;
  observation: string;
  status: 'normal' | 'abnormal' | 'uncertain';
  confidence: number;
  location?: string;
}

interface EmergencyFinding {
  finding: string;
  description: string;
  measurement?: string;
  urgency: 'immediate' | 'urgent' | 'routine';
}

interface MRIAnalysisReport {
  id: string;
  severity: 'normal' | 'abnormal' | 'CRITICAL';
  emergencyFindings: EmergencyFinding[];
  modality: string;
  view: string;
  anatomicalFindings: AnatomicalFinding[];
  impression: string;
  differential: string[];
  recommendations: string[];
  qualityScore: number;
  timestamp: string;
  imageUri: string;
}

/**
 * POST /api/analyze-mri
 * Analyzes an MRI image using Claude Vision API
 */
router.post('/analyze-mri', async (req, res) => {
  try {
    const { imageUri } = req.body;

    if (!imageUri) {
      return res.status(400).json({ error: 'Image URI is required' });
    }

    // Fetch the image if it's a URL
    let imageData: string;
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';

    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      // Fetch image from URL
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageData = buffer.toString('base64');

      // Determine media type from content-type header
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('png')) {
        mediaType = 'image/png';
      } else if (contentType?.includes('gif')) {
        mediaType = 'image/gif';
      } else if (contentType?.includes('webp')) {
        mediaType = 'image/webp';
      }
    } else if (imageUri.startsWith('data:')) {
      // Extract base64 data from data URI
      const matches = imageUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URI format');
      }
      imageData = matches[2];
      mediaType = matches[1] as any;
    } else {
      throw new Error('Unsupported image URI format');
    }

    // Call Claude Vision API
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: `You are an expert neuroradiologist analyzing a brain MRI scan. **CRITICAL: Check for EMERGENCY FINDINGS first before anything else.**

**EMERGENCY FINDINGS CHECKLIST (check EVERY item):**
1. **Midline Shift**: Measure any deviation of midline structures (septum pellucidum, 3rd ventricle) from center. Report in millimeters. >5mm is significant, >10mm is critical.
2. **Mass Effect**: Look for compression of ventricles, sulci, or displacement of brain structures
3. **Herniation**: Check for uncal herniation, subfalcine herniation, tonsillar herniation
4. **Acute Hemorrhage**: Look for hyperdense areas (bright on T1, dark on T2)
5. **Hydrocephalus**: Check for enlarged ventricles
6. **Large Vessel Occlusion**: Look for absent flow voids in major arteries
7. **Edema**: Look for abnormal hyperintensity suggesting vasogenic or cytotoxic edema

Provide a detailed structured analysis including:

1. **Severity Assessment**: Classify as "normal", "abnormal", or "CRITICAL"
2. **Emergency Findings**: List any life-threatening findings requiring immediate attention
3. **Modality Detection**: Identify the MRI sequence type (T1-weighted, T2-weighted, FLAIR, or T1+Gd)
4. **View/Plane**: Identify the imaging plane (Axial, Coronal, or Sagittal)
5. **Anatomical Findings**: For each major brain structure
6. **Overall Impression**: A summary of the findings
7. **Differential Diagnosis**: If abnormalities are present, list possible diagnoses
8. **Recommendations**: Clinical recommendations based on findings
9. **Quality Score**: Image quality assessment (0-1)

Please respond in JSON format with the following structure:
{
  "severity": "normal|abnormal|CRITICAL",
  "emergencyFindings": [
    {
      "finding": "finding name",
      "description": "detailed description",
      "measurement": "quantitative measurement if applicable (e.g., 8mm midline shift)",
      "urgency": "immediate|urgent|routine"
    }
  ],
  "modality": "T1-weighted|T2-weighted|FLAIR|T1+Gd",
  "view": "Axial|Coronal|Sagittal",
  "anatomicalFindings": [
    {
      "structure": "structure name",
      "observation": "detailed observation",
      "status": "normal|abnormal|uncertain",
      "confidence": 0.0-1.0,
      "location": "anatomical location"
    }
  ],
  "impression": "overall impression",
  "differential": ["diagnosis 1", "diagnosis 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "qualityScore": 0.0-1.0
}`,
            },
          ],
        },
      ],
    });

    // Extract JSON from Claude's response
    const textContent = message.content.find((block: any) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    // Parse JSON from response (handle markdown code blocks)
    let analysisData: any;
    const jsonMatch = textContent.text.match(/```json\n([\s\S]+?)\n```/);
    if (jsonMatch) {
      analysisData = JSON.parse(jsonMatch[1]);
    } else {
      // Try parsing the entire response as JSON
      analysisData = JSON.parse(textContent.text);
    }

    // Construct the analysis report
    const report: MRIAnalysisReport = {
      id: `analysis-${Date.now()}`,
      severity: analysisData.severity || 'normal',
      emergencyFindings: analysisData.emergencyFindings || [],
      modality: analysisData.modality || 'T2-weighted',
      view: analysisData.view || 'Axial',
      anatomicalFindings: analysisData.anatomicalFindings || [],
      impression: analysisData.impression || 'Analysis completed',
      differential: analysisData.differential || [],
      recommendations: analysisData.recommendations || [],
      qualityScore: analysisData.qualityScore || 0.85,
      timestamp: new Date().toISOString(),
      imageUri,
    };

    res.json(report);
  } catch (error) {
    console.error('Error analyzing MRI:', error);
    res.status(500).json({
      error: 'Failed to analyze MRI image',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
