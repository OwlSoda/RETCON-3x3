/**
 * Image and URL safety utilities for RETCON 3x3
 */

/**
 * Validates that a string is a safe, loadable image URL or Base64 image data URI.
 * Rejects unsafe schemes such as javascript:, file:, data:text/html, etc.
 */
export function isValidImageUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();

  // Allow safe data URLs for images only
  if (trimmed.startsWith('data:')) {
    return /^data:image\/(png|jpe?g|webp|gif|svg\+xml|avif|heic|heif|bmp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed);
  }

  // Must be valid HTTP or HTTPS protocol
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Optimizes an uploaded image file before storing it in state/IndexedDB.
 * Scales down images larger than maxDimension (default 2560px) to prevent
 * iOS Safari canvas crash and excessive memory consumption while keeping
 * pristine export clarity.
 */
export function optimizeImageFile(file: File, maxDimension = 2560): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not an image file, reject early
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    // SVGs can be read directly as Data URLs without rasterization
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read SVG file.'));
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      // If already within comfortable bounds and file is reasonable size (< 2MB), return original data
      if (width <= maxDimension && height <= maxDimension && file.size < 2 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
        return;
      }

      // Calculate scale ratio
      let targetWidth = width;
      let targetHeight = height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          targetWidth = maxDimension;
          targetHeight = Math.round((height * maxDimension) / width);
        } else {
          targetHeight = maxDimension;
          targetWidth = Math.round((width * maxDimension) / height);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        // Fallback to direct read if 2D context is unavailable
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Preserve PNG if transparency is needed, otherwise use JPEG for size efficiency
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = mimeType === 'image/jpeg' ? 0.92 : undefined;

      try {
        const optimizedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(optimizedDataUrl);
      } catch (err) {
        // In case of canvas export error, fallback to raw reader
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not process or load image.'));
    };

    img.src = objectUrl;
  });
}
