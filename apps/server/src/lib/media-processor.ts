/* eslint-disable one-var, sort-vars */
import { getContainer } from "@cloudflare/containers";
import { z } from "zod";

import type { MediaProcessorContainer } from "@/containers/media-processor";
import type { GeneratedMediaPurpose } from "@/lib/media-pipeline";

export type MediaProcessorPurpose = GeneratedMediaPurpose | "project_export";

const technicalMediaSchema = z.object({
    bitDepth: z.number().nonnegative().nullable(),
    bitrateKbps: z.number().int().nonnegative().nullable(),
    channels: z.number().int().positive(),
    codec: z.string().min(1),
    container: z.string().min(1),
    durationMs: z.number().int().positive(),
    isLossless: z.boolean(),
    sampleRateHz: z.number().int().positive(),
  }),
  sourceInspectionSchema = technicalMediaSchema.extend({
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    sizeBytes: z.number().int().positive(),
  }),
  loudnessAnalysisSchema = z.object({
    integratedLufs: z.number().finite(),
    truePeakDbtp: z.number().finite(),
  }),
  generatedMediaSchema = z.object({
    contentType: z.string().min(1),
    integratedLufs: z.number().finite(),
    isLossless: z.boolean(),
    objectKey: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    sizeBytes: z.number().int().positive(),
    technical: technicalMediaSchema,
    truePeakDbtp: z.number().finite(),
  });

export type TechnicalMedia = z.infer<typeof technicalMediaSchema>;
export type SourceInspection = z.infer<typeof sourceInspectionSchema>;
export type LoudnessAnalysis = z.infer<typeof loudnessAnalysisSchema>;
export type GeneratedMedia = z.infer<typeof generatedMediaSchema>;

export interface MediaClip {
  endMs: number;
  startMs: number;
}

export interface CreateDerivativeInput {
  clip?: MediaClip;
  metadata?: Record<string, string>;
  purpose: MediaProcessorPurpose;
  sourceObjectKey: string;
  targetObjectKey: string;
}

export interface MediaProcessor {
  analyzeLoudness: (input: {
    clip?: MediaClip;
    sourceObjectKey: string;
  }) => Promise<LoudnessAnalysis>;
  createDerivative: (input: CreateDerivativeInput) => Promise<GeneratedMedia>;
  inspectSource: (input: {
    sourceObjectKey: string;
  }) => Promise<SourceInspection>;
}

const readProcessorResponse = async <Output>(
  response: Response,
  schema: z.ZodType<Output>
): Promise<Output> => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Media processor failed with status ${response.status}.`;
    throw new Error(message);
  }
  return schema.parse(payload);
};

export class ContainerMediaProcessor implements MediaProcessor {
  private readonly container: DurableObjectStub<MediaProcessorContainer>;

  public constructor({
    binding,
    workflowInstanceId,
  }: {
    binding: DurableObjectNamespace<MediaProcessorContainer>;
    workflowInstanceId: string;
  }) {
    this.container = getContainer(binding, workflowInstanceId);
  }

  public async inspectSource({
    sourceObjectKey,
  }: {
    sourceObjectKey: string;
  }): Promise<SourceInspection> {
    await this.container.configureJob({
      sourceObjectKey,
      targetObjectKeys: [],
    });
    const response = await this.container.fetch(
      new Request("http://media-processor/v1/inspect", {
        body: JSON.stringify({ sourceObjectKey }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );
    return readProcessorResponse(response, sourceInspectionSchema);
  }

  public async analyzeLoudness({
    clip,
    sourceObjectKey,
  }: {
    clip?: MediaClip;
    sourceObjectKey: string;
  }): Promise<LoudnessAnalysis> {
    await this.container.configureJob({
      sourceObjectKey,
      targetObjectKeys: [],
    });
    const response = await this.container.fetch(
      new Request("http://media-processor/v1/analyze", {
        body: JSON.stringify({ clip, sourceObjectKey }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );
    return readProcessorResponse(response, loudnessAnalysisSchema);
  }

  public async createDerivative({
    clip,
    metadata,
    purpose,
    sourceObjectKey,
    targetObjectKey,
  }: CreateDerivativeInput): Promise<GeneratedMedia> {
    await this.container.configureJob({
      sourceObjectKey,
      targetObjectKeys: [targetObjectKey],
    });
    const response = await this.container.fetch(
      new Request("http://media-processor/v1/render", {
        body: JSON.stringify({
          clip,
          metadata,
          purpose,
          sourceObjectKey,
          targetObjectKey,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );
    const generated = await readProcessorResponse(
      response,
      generatedMediaSchema
    );
    if (generated.objectKey !== targetObjectKey) {
      throw new Error("Media processor returned an unexpected object key.");
    }
    return generated;
  }
}
