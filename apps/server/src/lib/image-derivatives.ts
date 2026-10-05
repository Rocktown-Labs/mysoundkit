/* eslint-disable one-var, sort-vars */
import type { MediaProcessorContainer } from "@/containers/media-processor";
import { ContainerMediaProcessor } from "@/lib/media-processor";
import { logWarn } from "@/middleware/structured-logging";

import {
  IMAGE_DERIVATIVE_WIDTHS,
  imageDerivativeObjectKey,
} from "./image-derivative-keys";

export {
  IMAGE_DERIVATIVE_CONTENT_TYPE,
  IMAGE_DERIVATIVE_FORMAT,
  IMAGE_DERIVATIVE_WIDTHS,
  imageDerivativeObjectKey,
  isLikelyImageObjectKey,
  parseImageDerivativeObjectKey,
} from "./image-derivative-keys";

export interface EnsureImageDerivativesInput {
  bucket: R2Bucket;
  objectKey: string;
  /** Process this width first (the one a visitor just requested). */
  priorityWidthPx?: number;
  processorBinding: DurableObjectNamespace<MediaProcessorContainer>;
}

export interface ImageDerivativeGenerationResult {
  existing: number;
  failed: number;
  generated: number;
  objectKey: string;
}

/**
 * The media-processor container scopes its internal R2 proxy access per job
 * (configureJob overwrites the instance's allowed source/targets), so each
 * source object gets its own container instance — concurrent jobs sharing
 * one instance would clobber each other's access state.
 */
const instanceIdForObjectKey = async (objectKey: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`image-derivatives:${objectKey}`)
  );
  const hex = [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `image-derivatives-${hex}`;
};

/**
 * Generates the standard WebP derivative set for an original media object if
 * it does not already exist. Idempotent: existing derivative objects are
 * detected with cheap R2 HEADs and skipped, so callers can invoke it freely
 * from request paths (`waitUntil`) and backfill jobs alike. A single failure
 * (e.g. a missing source object) never blocks the other widths — every
 * derivative just stays absent and the client falls back to the original.
 */
export const ensureImageDerivatives = async ({
  bucket,
  objectKey,
  priorityWidthPx,
  processorBinding,
}: EnsureImageDerivativesInput): Promise<ImageDerivativeGenerationResult> => {
  const processor = new ContainerMediaProcessor({
      binding: processorBinding,
      workflowInstanceId: await instanceIdForObjectKey(objectKey),
    }),
    widths = [...IMAGE_DERIVATIVE_WIDTHS].toSorted(
      (a, b) =>
        (b === priorityWidthPx ? 1 : 0) - (a === priorityWidthPx ? 1 : 0)
    );
  let existing = 0,
    failed = 0,
    generated = 0;

  for (const widthPx of widths) {
    const derivativeKey = imageDerivativeObjectKey(objectKey, widthPx);
    try {
      const head = await bucket.head(derivativeKey);
      if (head) {
        existing += 1;
        continue;
      }
      await processor.createImageDerivative({
        sourceObjectKey: objectKey,
        targetObjectKey: derivativeKey,
        widthPx,
      });
      generated += 1;
    } catch (error) {
      failed += 1;
      logWarn({
        error: error instanceof Error ? error.message : String(error),
        event: "image_derivative_generation_failed",
        objectKey: derivativeKey,
      });
    }
  }

  return { existing, failed, generated, objectKey };
};
