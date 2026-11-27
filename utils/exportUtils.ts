import type { ExportFormat, NamingScheme } from '../types';

export const MAX_EXPORT_DIMENSION = 4096;
export const MAX_EXPORT_AREA = 16_777_216; // 4096 x 4096 (WebKit / iOS Safari safe limit)

/**
 * Generates a sanitized export filename according to the selected naming scheme.
 */
export function generateExportFilename(
  gridTitle: string,
  namingScheme: NamingScheme,
  format: ExportFormat,
  now: Date = new Date()
): string {
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');

  const safeTitle = gridTitle === null || gridTitle === undefined ? '' : String(gridTitle).trim();
  const titleSlug = safeTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'UNTITLED';
  const ts = now.getTime();

  let base = '';
  switch (namingScheme) {
    case 'TIMESTAMP':
      base = `GRID_${ts}`;
      break;
    case 'MINIMAL':
      base = `${titleSlug}_3X3`;
      break;
    case 'CHRONO':
      base = `${YYYY}${MM}${DD}_${titleSlug}`;
      break;
    default:
      base = `RETCON_${YYYY}${MM}_${titleSlug}`;
      break;
  }

  return `${base}.${format}`;
}

/**
 * Calculates a safe export pixelRatio so rendered canvases stay within WebKit/iOS Safari
 * single-dimension (4096px) and total-surface-area (16.7M px) limits.
 */
export function calculateSafePixelRatio(
  elementWidth: number,
  elementHeight: number,
  isMobile: boolean
): number {
  const safeW = Number.isFinite(elementWidth) && elementWidth > 0 ? elementWidth : 800;
  const safeH = Number.isFinite(elementHeight) && elementHeight > 0 ? elementHeight : safeW;

  let targetPixelRatio = isMobile ? 1.5 : 2;

  const maxDimension = Math.max(safeW, safeH);
  if (maxDimension * targetPixelRatio > MAX_EXPORT_DIMENSION) {
    targetPixelRatio = Math.min(targetPixelRatio, MAX_EXPORT_DIMENSION / maxDimension);
  }

  const currentArea = (safeW * targetPixelRatio) * (safeH * targetPixelRatio);
  if (currentArea > MAX_EXPORT_AREA) {
    targetPixelRatio = Math.min(targetPixelRatio, Math.sqrt(MAX_EXPORT_AREA / (safeW * safeH)));
  }

  return Math.max(1, targetPixelRatio);
}

/**
 * Ensures the downloaded file extension matches the actual encoded MIME type
 * (e.g. if a browser silently falls back from image/webp to image/png).
 */
export function resolveExportedFileFormat(
  requestedFormat: ExportFormat,
  dataUrl: string
): ExportFormat {
  if (requestedFormat === 'webp' && dataUrl.startsWith('data:image/png')) {
    return 'png';
  }
  return requestedFormat;
}
