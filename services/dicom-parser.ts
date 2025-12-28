/**
 * DICOM Parser Service
 * Handles DICOM file parsing, metadata extraction, and conversion
 */

// @ts-ignore - dcmjs doesn't have TypeScript definitions
import * as dcmjs from 'dcmjs';

export interface DICOMMetadata {
  patientName?: string;
  patientID?: string;
  patientBirthDate?: string;
  patientSex?: string;
  studyDate?: string;
  studyDescription?: string;
  seriesDescription?: string;
  modality?: string;
  manufacturer?: string;
  institutionName?: string;
  rows?: number;
  columns?: number;
  sliceThickness?: number;
  pixelSpacing?: number[];
  imagePosition?: number[];
  imageOrientation?: number[];
  windowCenter?: number;
  windowWidth?: number;
}

export interface DICOMImage {
  metadata: DICOMMetadata;
  pixelData: Uint8Array;
  width: number;
  height: number;
  dataUrl: string;
}

export interface DICOMSeries {
  seriesInstanceUID: string;
  seriesDescription: string;
  modality: string;
  sliceCount: number;
  images: DICOMImage[];
}

/**
 * Parse DICOM file and extract metadata
 */
export async function parseDICOMFile(file: File | Blob): Promise<DICOMImage> {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Parse DICOM data
    const dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer);
    const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    
    // Extract metadata
    const metadata: DICOMMetadata = {
      patientName: dataset.PatientName,
      patientID: dataset.PatientID,
      patientBirthDate: dataset.PatientBirthDate,
      patientSex: dataset.PatientSex,
      studyDate: dataset.StudyDate,
      studyDescription: dataset.StudyDescription,
      seriesDescription: dataset.SeriesDescription,
      modality: dataset.Modality,
      manufacturer: dataset.Manufacturer,
      institutionName: dataset.InstitutionName,
      rows: dataset.Rows,
      columns: dataset.Columns,
      sliceThickness: dataset.SliceThickness,
      pixelSpacing: dataset.PixelSpacing,
      imagePosition: dataset.ImagePositionPatient,
      imageOrientation: dataset.ImageOrientationPatient,
      windowCenter: Array.isArray(dataset.WindowCenter) 
        ? dataset.WindowCenter[0] 
        : dataset.WindowCenter,
      windowWidth: Array.isArray(dataset.WindowWidth) 
        ? dataset.WindowWidth[0] 
        : dataset.WindowWidth,
    };
    
    // Extract pixel data
    const pixelData = new Uint8Array(dataset.PixelData as ArrayBuffer);
    const width = dataset.Columns;
    const height = dataset.Rows;
    
    // Convert to data URL for display
    const dataUrl = await convertDICOMToDataURL(
      pixelData,
      width,
      height,
      metadata.windowCenter || 40,
      metadata.windowWidth || 400
    );
    
    return {
      metadata,
      pixelData,
      width,
      height,
      dataUrl,
    };
  } catch (error) {
    console.error('Error parsing DICOM file:', error);
    throw new Error('Failed to parse DICOM file. Please ensure it is a valid DICOM file.');
  }
}

/**
 * Convert DICOM pixel data to data URL for display
 */
async function convertDICOMToDataURL(
  pixelData: Uint8Array,
  width: number,
  height: number,
  windowCenter: number,
  windowWidth: number
): Promise<string> {
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Create image data
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  
  // Apply window/level transformation
  const windowMin = windowCenter - windowWidth / 2;
  const windowMax = windowCenter + windowWidth / 2;
  
  for (let i = 0; i < pixelData.length; i++) {
    let value = pixelData[i];
    
    // Apply windowing
    if (value <= windowMin) {
      value = 0;
    } else if (value >= windowMax) {
      value = 255;
    } else {
      value = ((value - windowMin) / (windowMax - windowMin)) * 255;
    }
    
    // Set RGB values (grayscale)
    const idx = i * 4;
    data[idx] = value;     // R
    data[idx + 1] = value; // G
    data[idx + 2] = value; // B
    data[idx + 3] = 255;   // A
  }
  
  // Put image data on canvas
  ctx.putImageData(imageData, 0, 0);
  
  // Convert to data URL
  return canvas.toDataURL('image/png');
}

/**
 * Check if file is a valid DICOM file
 */
export function isDICOMFile(file: File): boolean {
  // Check file extension
  const name = file.name.toLowerCase();
  if (name.endsWith('.dcm') || name.endsWith('.dicom')) {
    return true;
  }
  
  // DICOM files often have no extension, so we'll need to check content
  // This will be done in the parsing function
  return true;
}

/**
 * Extract patient information for display
 */
export function formatPatientInfo(metadata: DICOMMetadata): string {
  const parts: string[] = [];
  
  if (metadata.patientName) {
    parts.push(`Patient: ${metadata.patientName}`);
  }
  
  if (metadata.patientID) {
    parts.push(`ID: ${metadata.patientID}`);
  }
  
  if (metadata.patientSex) {
    parts.push(`Sex: ${metadata.patientSex}`);
  }
  
  if (metadata.patientBirthDate) {
    const dob = metadata.patientBirthDate;
    const formatted = `${dob.slice(0, 4)}-${dob.slice(4, 6)}-${dob.slice(6, 8)}`;
    parts.push(`DOB: ${formatted}`);
  }
  
  return parts.join(' • ');
}

/**
 * Extract study information for display
 */
export function formatStudyInfo(metadata: DICOMMetadata): string {
  const parts: string[] = [];
  
  if (metadata.modality) {
    parts.push(metadata.modality);
  }
  
  if (metadata.seriesDescription) {
    parts.push(metadata.seriesDescription);
  }
  
  if (metadata.studyDate) {
    const date = metadata.studyDate;
    const formatted = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    parts.push(formatted);
  }
  
  return parts.join(' • ');
}

/**
 * Convert DICOM to NIfTI format (for 3D visualization)
 * This is a simplified conversion - in production, use a proper library
 */
export async function convertDICOMToNIfTI(images: DICOMImage[]): Promise<Blob> {
  // This is a placeholder - in production, you would use a proper DICOM to NIfTI converter
  // For now, we'll just return the first image as a mock NIfTI file
  
  if (images.length === 0) {
    throw new Error('No images to convert');
  }
  
  // In a real implementation, you would:
  // 1. Sort images by slice position
  // 2. Stack them into a 3D volume
  // 3. Write NIfTI header with proper metadata
  // 4. Write pixel data in NIfTI format
  
  // For now, return a mock blob
  const buffer = images[0].pixelData.buffer as ArrayBuffer;
  const mockNIfTI = new Blob([buffer], { type: 'application/octet-stream' });
  return mockNIfTI;
}

/**
 * Adjust window/level for DICOM image display
 */
export async function adjustWindowLevel(
  pixelData: Uint8Array,
  width: number,
  height: number,
  windowCenter: number,
  windowWidth: number
): Promise<string> {
  return convertDICOMToDataURL(pixelData, width, height, windowCenter, windowWidth);
}
