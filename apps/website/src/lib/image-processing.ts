/**
 * Re-encodes a cover image on the client so the stored file is small enough
 * for fast app loads and social previews (og:image < ~1MB). Downscales to a
 * sane maximum and re-encodes as JPEG (or WebP for PNG/WebP sources). Returns
 * the original file untouched when re-encoding would not shrink it.
 */
export const optimizeCoverImageFile = async (
  file: File,
  { maxDimension = 1600 }: { maxDimension?: number } = {}
): Promise<File> => {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { height, width } = bitmap;
    const shouldDownscale = width > maxDimension || height > maxDimension;
    const outputWidth = shouldDownscale
      ? Math.round(
          width > height ? maxDimension : maxDimension * (width / height)
        )
      : width;
    const outputHeight = shouldDownscale
      ? Math.round(
          height > width ? maxDimension : maxDimension * (height / width)
        )
      : height;

    // Only re-encode when it can actually shrink the payload.
    if (!shouldDownscale && file.size <= 1_000_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    context.fillStyle = "#000000";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(bitmap, 0, 0, outputWidth, outputHeight);
    bitmap.close();

    const hasTransparency =
      file.type === "image/png" || file.type === "image/webp";
    const outputType = hasTransparency ? "image/webp" : "image/jpeg";
    const extension = hasTransparency ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/u, "");
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, 0.85)
    );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
  } catch {
    return file;
  }
};
