import { Logger } from '@nestjs/common';

const logger = new Logger('ImageCompress');

/** Longest edge after resize (px). */
export const MEDIA_MAX_EDGE = 1920;
/** WebP quality (~80). */
export const MEDIA_WEBP_QUALITY = 80;

const COMPRESSIBLE =
  /^image\/(jpeg|jpg|pjpeg|png|webp|tiff|tif|avif|bmp|x-ms-bmp)$/i;

export type ProcessedUpload = {
  buffer: Buffer;
  mimeType: string;
  /** File extension including leading dot (e.g. `.webp`). */
  extension: string;
  width: number | null;
  height: number | null;
  compressed: boolean;
};

function extensionForMime(mimeType: string, originalName?: string): string {
  const fromName = originalName ? /\.[a-z0-9]+$/i.exec(originalName)?.[0] : undefined;
  if (fromName) return fromName.toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };
  return map[mimeType.toLowerCase()] ?? '';
}

/**
 * Resize/compress raster images to a WebP master (max edge {@link MEDIA_MAX_EDGE}).
 * Non-images, GIFs, and SVGs are left unchanged. On sharp failure, returns the original buffer.
 */
export async function processUploadBuffer(
  buffer: Buffer,
  mimeType: string,
  originalName?: string,
): Promise<ProcessedUpload> {
  const fallback: ProcessedUpload = {
    buffer,
    mimeType,
    extension: extensionForMime(mimeType, originalName),
    width: null,
    height: null,
    compressed: false,
  };

  if (!COMPRESSIBLE.test(mimeType)) {
    return fallback;
  }

  try {
    const sharp = (await import('sharp')).default;
    const pipeline = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await pipeline.metadata();

    const out = await pipeline
      .resize({
        width: MEDIA_MAX_EDGE,
        height: MEDIA_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: MEDIA_WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: out.data,
      mimeType: 'image/webp',
      extension: '.webp',
      width: out.info.width ?? meta.width ?? null,
      height: out.info.height ?? meta.height ?? null,
      compressed: true,
    };
  } catch (err) {
    logger.warn(
      `Image compression failed; storing original (${mimeType}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return fallback;
  }
}
