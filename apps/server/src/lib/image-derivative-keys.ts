/* eslint-disable one-var, sort-vars */

export const IMAGE_DERIVATIVE_WIDTHS = [320, 640, 1280] as const,
  IMAGE_DERIVATIVE_FORMAT = "webp",
  IMAGE_DERIVATIVE_CONTENT_TYPE = "image/webp",
  IMAGE_OBJECT_KEY_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)$/iu;

export type ImageDerivativeWidth = (typeof IMAGE_DERIVATIVE_WIDTHS)[number];

export interface ParsedImageDerivativeKey {
  baseObjectKey: string;
  widthPx: number;
}

export const imageDerivativeObjectKey = (
  baseObjectKey: string,
  widthPx: ImageDerivativeWidth
) => `${baseObjectKey}.${widthPx}w.webp`;

/**
 * Inverse of {@link imageDerivativeObjectKey}: `uploads/u/cover.png.640w.webp`
 * parses to `uploads/u/cover.png` + 640. Any key that does not carry the
 * `.NNNw.webp` derivative suffix returns null (the media route then treats it
 * as a regular object key).
 */
export const parseImageDerivativeObjectKey = (
  objectKey: string
): ParsedImageDerivativeKey | null => {
  const match = /^(?<baseObjectKey>.+)\.(?<width>\d+)w\.webp$/u.exec(objectKey);
  if (!match) {
    return null;
  }
  const { baseObjectKey, width } = match.groups ?? {};
  const widthPx = Number(width);
  return baseObjectKey && Number.isInteger(widthPx) && widthPx > 0
    ? { baseObjectKey, widthPx }
    : null;
};

export const isLikelyImageObjectKey = (objectKey: string) =>
  IMAGE_OBJECT_KEY_PATTERN.test(objectKey);
