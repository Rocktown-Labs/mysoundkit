/* eslint-disable one-var, sort-vars */
import { getContainer } from "@cloudflare/containers";
import { z } from "zod";

import type { StemSeparatorContainer } from "@/containers/stem-separator";

const CONTAINER_BOOT_TIMEOUT_MS = 60_000,
  // Demucs htdemucs on CPU takes ~1.5x track duration; the same request also
  // downloads the master, runs two FFmpeg transcodes, and uploads both
  // stems, so the budget covers the full end-to-end operation.
  SEPARATE_TIMEOUT_MS = 28 * 60_000,
  stemOutputSchema = z.object({
    objectKey: z.string().min(1).max(1024),
    sizeBytes: z.number().int().positive(),
  }),
  separateResponseSchema = z.object({
    instrumental: stemOutputSchema,
    preview: stemOutputSchema.optional(),
    vocals: stemOutputSchema,
  });

export type StemSeparateResult = z.infer<typeof separateResponseSchema>;

export interface SeparateStemsInput {
  sourceObjectKey: string;
  targetInstrumentalKey: string;
  targetPreviewKey?: string;
  targetVocalsKey: string;
  /** Stable per-track name so retries land on the same container. */
  workflowInstanceId: string;
}

const describeTimeout = (timeoutMs: number) =>
  `${Math.round(timeoutMs / 1000)}s`;

export class ContainerStemSeparator {
  private readonly container: DurableObjectStub<StemSeparatorContainer>;

  public constructor({
    binding,
    workflowInstanceId,
  }: {
    binding: DurableObjectNamespace<StemSeparatorContainer>;
    workflowInstanceId: string;
  }) {
    this.container = getContainer(binding, workflowInstanceId);
  }

  public async separate(
    input: Omit<SeparateStemsInput, "workflowInstanceId">
  ): Promise<StemSeparateResult> {
    const targetObjectKeys = [
      input.targetVocalsKey,
      input.targetInstrumentalKey,
      ...(input.targetPreviewKey ? [input.targetPreviewKey] : []),
    ];
    await this.container.configureJob({
      sourceObjectKey: input.sourceObjectKey,
      targetObjectKeys,
    });
    let response: Response;
    try {
      response = await this.container.fetch(
        new Request("http://stem-separator/v1/separate", {
          body: JSON.stringify({
            sourceObjectKey: input.sourceObjectKey,
            targetInstrumentalKey: input.targetInstrumentalKey,
            targetPreviewKey: input.targetPreviewKey,
            targetVocalsKey: input.targetVocalsKey,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        {
          signal: AbortSignal.timeout(
            CONTAINER_BOOT_TIMEOUT_MS + SEPARATE_TIMEOUT_MS
          ),
        }
      );
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `Stem separator did not respond within ${describeTimeout(CONTAINER_BOOT_TIMEOUT_MS + SEPARATE_TIMEOUT_MS)}.`,
          { cause: error }
        );
      }
      throw error;
    }
    const rawPayload = await response.text();
    let payload: unknown = null;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const detail = rawPayload.trim().slice(0, 500);
      throw new Error(
        `Stem separator failed with status ${response.status}${detail ? `: ${detail}` : ""}.`
      );
    }
    const parsed = separateResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Stem separator returned an unexpected payload.");
    }
    if (
      parsed.data.vocals.objectKey !== input.targetVocalsKey ||
      parsed.data.instrumental.objectKey !== input.targetInstrumentalKey ||
      (input.targetPreviewKey &&
        parsed.data.preview?.objectKey !== input.targetPreviewKey)
    ) {
      throw new Error("Stem separator returned unexpected object keys.");
    }
    return parsed.data;
  }
}
