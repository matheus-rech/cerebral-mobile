/**
 * Mask Export Service
 * Exports segmentation masks as PNG or NIfTI files for clinical documentation
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface MaskData {
  mask: number[][];  // 2D array of 0s and 1s
  width: number;
  height: number;
  modelName: string;
  confidence: number;
  timestamp: string;
  originalImageUri?: string;
}

export interface ExportOptions {
  format: 'png' | 'nifti' | 'both';
  includeOverlay: boolean;
  colorScheme: 'red' | 'green' | 'blue' | 'yellow' | 'custom';
  customColor?: { r: number; g: number; b: number };
  opacity: number;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'png',
  includeOverlay: true,
  colorScheme: 'red',
  opacity: 0.5,
};

/**
 * Export mask as PNG file
 */
export async function exportMaskAsPNG(
  maskData: MaskData,
  options: Partial<ExportOptions> = {}
): Promise<string> {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  
  // Create canvas-like data for PNG generation
  const { mask, width, height, modelName, timestamp } = maskData;
  
  // Get color based on scheme
  const color = getColorFromScheme(opts.colorScheme, opts.customColor);
  
  // Create RGBA pixel data
  const pixels: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const maskValue = mask[y]?.[x] ?? 0;
      if (maskValue > 0) {
        // Mask pixel - use selected color with opacity
        pixels.push(color.r, color.g, color.b, Math.round(opts.opacity * 255));
      } else {
        // Background - transparent
        pixels.push(0, 0, 0, 0);
      }
    }
  }
  
  // Convert to base64 PNG using a simple PNG encoder
  const pngBase64 = await createPNGBase64(pixels, width, height);
  
  // Save to file
  const filename = `mask_${modelName}_${timestamp.replace(/[:.]/g, '-')}.png`;
  const filePath = `${FileSystem.documentDirectory}exports/${filename}`;
  
  // Ensure exports directory exists
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}exports`, { intermediates: true }).catch(() => {});
  
  // Write file
  await FileSystem.writeAsStringAsync(filePath, pngBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  return filePath;
}

/**
 * Export mask as NIfTI file (for 3D medical imaging software)
 */
export async function exportMaskAsNIfTI(
  maskData: MaskData,
  options: Partial<ExportOptions> = {}
): Promise<string> {
  const { mask, width, height, modelName, timestamp } = maskData;
  
  // Create NIfTI header (simplified NIfTI-1 format)
  const niftiHeader = createNIfTI1Header(width, height, 1);
  
  // Convert mask to binary data
  const maskBinary = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      maskBinary[y * width + x] = mask[y]?.[x] ?? 0;
    }
  }
  
  // Combine header and data
  const niftiData = new Uint8Array(niftiHeader.length + maskBinary.length);
  niftiData.set(niftiHeader, 0);
  niftiData.set(maskBinary, niftiHeader.length);
  
  // Convert to base64
  const base64 = uint8ArrayToBase64(niftiData);
  
  // Save to file
  const filename = `mask_${modelName}_${timestamp.replace(/[:.]/g, '-')}.nii`;
  const filePath = `${FileSystem.documentDirectory}exports/${filename}`;
  
  // Ensure exports directory exists
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}exports`, { intermediates: true }).catch(() => {});
  
  // Write file
  await FileSystem.writeAsStringAsync(filePath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  return filePath;
}

/**
 * Export mask in both PNG and NIfTI formats
 */
export async function exportMask(
  maskData: MaskData,
  options: Partial<ExportOptions> = {}
): Promise<{ pngPath?: string; niftiPath?: string }> {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  const result: { pngPath?: string; niftiPath?: string } = {};
  
  if (opts.format === 'png' || opts.format === 'both') {
    result.pngPath = await exportMaskAsPNG(maskData, opts);
  }
  
  if (opts.format === 'nifti' || opts.format === 'both') {
    result.niftiPath = await exportMaskAsNIfTI(maskData, opts);
  }
  
  return result;
}

/**
 * Share exported mask file
 */
export async function shareMask(filePath: string): Promise<void> {
  if (Platform.OS === 'web') {
    // For web, trigger download
    const content = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const filename = filePath.split('/').pop() || 'mask.png';
    const mimeType = filename.endsWith('.nii') ? 'application/octet-stream' : 'image/png';
    
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${content}`;
    link.download = filename;
    link.click();
  } else {
    // For native, use sharing
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: filePath.endsWith('.nii') ? 'application/octet-stream' : 'image/png',
        dialogTitle: 'Export Segmentation Mask',
      });
    }
  }
}

/**
 * Get list of exported masks
 */
export async function getExportedMasks(): Promise<string[]> {
  const exportsDir = `${FileSystem.documentDirectory}exports`;
  
  try {
    const files = await FileSystem.readDirectoryAsync(exportsDir);
    return files.map(f => `${exportsDir}/${f}`);
  } catch {
    return [];
  }
}

/**
 * Delete exported mask
 */
export async function deleteExportedMask(filePath: string): Promise<void> {
  await FileSystem.deleteAsync(filePath, { idempotent: true });
}

// Helper functions

function getColorFromScheme(
  scheme: ExportOptions['colorScheme'],
  customColor?: { r: number; g: number; b: number }
): { r: number; g: number; b: number } {
  switch (scheme) {
    case 'red':
      return { r: 255, g: 0, b: 0 };
    case 'green':
      return { r: 0, g: 255, b: 0 };
    case 'blue':
      return { r: 0, g: 0, b: 255 };
    case 'yellow':
      return { r: 255, g: 255, b: 0 };
    case 'custom':
      return customColor || { r: 255, g: 0, b: 0 };
    default:
      return { r: 255, g: 0, b: 0 };
  }
}

/**
 * Create a simple PNG from RGBA pixel data
 * Uses a minimal PNG encoder for cross-platform compatibility
 */
async function createPNGBase64(pixels: number[], width: number, height: number): Promise<string> {
  // PNG signature
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  
  // IHDR chunk
  const ihdr = createIHDRChunk(width, height);
  
  // IDAT chunk (image data)
  const idat = await createIDATChunk(pixels, width, height);
  
  // IEND chunk
  const iend = createIENDChunk();
  
  // Combine all chunks
  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  let offset = 0;
  
  png.set(signature, offset);
  offset += signature.length;
  
  png.set(ihdr, offset);
  offset += ihdr.length;
  
  png.set(idat, offset);
  offset += idat.length;
  
  png.set(iend, offset);
  
  return uint8ArrayToBase64(png);
}

function createIHDRChunk(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  data[8] = 8;  // bit depth
  data[9] = 6;  // color type (RGBA)
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  
  return createChunk('IHDR', data);
}

async function createIDATChunk(pixels: number[], width: number, height: number): Promise<Uint8Array> {
  // Create raw image data with filter bytes
  const rawData = new Uint8Array(height * (1 + width * 4));
  let offset = 0;
  
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = (y * width + x) * 4;
      rawData[offset++] = pixels[pixelOffset];     // R
      rawData[offset++] = pixels[pixelOffset + 1]; // G
      rawData[offset++] = pixels[pixelOffset + 2]; // B
      rawData[offset++] = pixels[pixelOffset + 3]; // A
    }
  }
  
  // Compress with deflate (using simple zlib wrapper)
  const compressed = deflateSimple(rawData);
  
  return createChunk('IDAT', compressed);
}

function createIENDChunk(): Uint8Array {
  return createChunk('IEND', new Uint8Array(0));
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);
  
  // Length
  view.setUint32(0, data.length, false);
  
  // Type
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  
  // Data
  chunk.set(data, 8);
  
  // CRC
  const crc = crc32(chunk.slice(4, 8 + data.length));
  view.setUint32(8 + data.length, crc, false);
  
  return chunk;
}

/**
 * Simple deflate compression (uncompressed blocks for simplicity)
 */
function deflateSimple(data: Uint8Array): Uint8Array {
  // Zlib header
  const header = [0x78, 0x01]; // CMF, FLG (no compression)
  
  // Split into blocks of max 65535 bytes
  const blocks: Uint8Array[] = [];
  const maxBlockSize = 65535;
  
  for (let i = 0; i < data.length; i += maxBlockSize) {
    const isLast = i + maxBlockSize >= data.length;
    const blockData = data.slice(i, Math.min(i + maxBlockSize, data.length));
    
    // Block header
    const blockHeader = new Uint8Array(5);
    blockHeader[0] = isLast ? 1 : 0; // BFINAL
    blockHeader[1] = blockData.length & 0xFF;
    blockHeader[2] = (blockData.length >> 8) & 0xFF;
    blockHeader[3] = ~blockData.length & 0xFF;
    blockHeader[4] = (~blockData.length >> 8) & 0xFF;
    
    const block = new Uint8Array(5 + blockData.length);
    block.set(blockHeader, 0);
    block.set(blockData, 5);
    blocks.push(block);
  }
  
  // Calculate total length
  const totalLength = 2 + blocks.reduce((sum, b) => sum + b.length, 0) + 4;
  const result = new Uint8Array(totalLength);
  
  // Write header
  result.set(header, 0);
  
  // Write blocks
  let offset = 2;
  for (const block of blocks) {
    result.set(block, offset);
    offset += block.length;
  }
  
  // Adler-32 checksum
  const adler = adler32(data);
  result[offset] = (adler >> 24) & 0xFF;
  result[offset + 1] = (adler >> 16) & 0xFF;
  result[offset + 2] = (adler >> 8) & 0xFF;
  result[offset + 3] = adler & 0xFF;
  
  return result;
}

/**
 * CRC32 calculation for PNG chunks
 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  
  return crc ^ 0xFFFFFFFF;
}

/**
 * Adler-32 checksum for zlib
 */
function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  
  return (b << 16) | a;
}

/**
 * Create NIfTI-1 header (348 bytes)
 */
function createNIfTI1Header(width: number, height: number, depth: number): Uint8Array {
  const header = new Uint8Array(352); // 348 header + 4 extension
  const view = new DataView(header.buffer);
  
  // sizeof_hdr
  view.setInt32(0, 348, true);
  
  // dim (dimensions)
  view.setInt16(40, 3, true);      // ndim
  view.setInt16(42, width, true);  // dim[1]
  view.setInt16(44, height, true); // dim[2]
  view.setInt16(46, depth, true);  // dim[3]
  
  // datatype (2 = uint8)
  view.setInt16(70, 2, true);
  
  // bitpix
  view.setInt16(72, 8, true);
  
  // pixdim (voxel dimensions)
  view.setFloat32(76, 1.0, true);  // pixdim[0]
  view.setFloat32(80, 1.0, true);  // pixdim[1]
  view.setFloat32(84, 1.0, true);  // pixdim[2]
  view.setFloat32(88, 1.0, true);  // pixdim[3]
  
  // vox_offset
  view.setFloat32(108, 352, true);
  
  // magic
  header[344] = 'n'.charCodeAt(0);
  header[345] = '+'.charCodeAt(0);
  header[346] = '1'.charCodeAt(0);
  header[347] = 0;
  
  return header;
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

export default {
  exportMaskAsPNG,
  exportMaskAsNIfTI,
  exportMask,
  shareMask,
  getExportedMasks,
  deleteExportedMask,
};
