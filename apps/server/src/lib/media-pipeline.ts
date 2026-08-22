/* eslint-disable one-var, sort-vars */
import { z } from "zod";

export const MEDIA_PIPELINE_VERSION = 2;
export const ENRICHMENT_PIPELINE_VERSION = 1;
export const PROJECT_EXPORT_PIPELINE_VERSION = 1;
export const WORKFLOW_INSTANCE_ID_MAX_LENGTH = 100;

export const mediaAssetPurposeSchema = z.enum([
  "master",
  "streaming",
  "battle",
  "download",
  "lossless_download",
  "open_verse_snippet",
  "preview",
  "stem",
  "artwork",
  "other",
]);

export const mediaProcessingStageSchema = z.enum([
  "queued",
  "verifying_master",
  "inspecting_source",
  "analyzing_loudness",
  "generating_open_verse_snippet",
  "generating_streaming",
  "registering_streaming",
  "media_ready",
  "generating_battle",
  "registering_battle",
  "generating_download",
  "registering_download",
  "generating_lossless",
  "registering_lossless",
  "complete",
  "failed",
]);

const workflowIdSegmentSchema = z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/u),
  objectKeySchema = z.string().min(1).max(1024),
  pipelineVersionSchema = z.number().int().positive(),
  trackSourceSchema = z.object({
    objectKey: objectKeySchema,
    pipelineVersion: pipelineVersionSchema,
    sourceAssetId: workflowIdSegmentSchema,
    trackId: workflowIdSegmentSchema,
  }),
  finalTrackProcessingSchema = trackSourceSchema.extend({
    mode: z.literal("final_track"),
  }),
  legacyBackfillProcessingSchema = trackSourceSchema.extend({
    mode: z.literal("legacy_backfill"),
  }),
  openVerseBaseProcessingSchema = trackSourceSchema.extend({
    mode: z.literal("open_verse_base"),
    openVerse: z.object({
      listingId: workflowIdSegmentSchema,
      slotEndsAtMs: z.number().int().positive(),
      slotStartsAtMs: z.number().int().nonnegative(),
    }),
  });

export const mediaProcessingWorkflowPayloadSchema = z
  .discriminatedUnion("mode", [
    finalTrackProcessingSchema,
    legacyBackfillProcessingSchema,
    openVerseBaseProcessingSchema,
  ])
  .superRefine((payload, context) => {
    if (
      payload.mode === "open_verse_base" &&
      payload.openVerse.slotEndsAtMs <= payload.openVerse.slotStartsAtMs
    ) {
      context.addIssue({
        code: "custom",
        message: "Open Verse end time must be after its start time.",
        path: ["openVerse", "slotEndsAtMs"],
      });
    }
  });

export const trackEnrichmentWorkflowPayloadSchema = trackSourceSchema;

export const projectExportWorkflowPayloadSchema = z.object({
  exportVersion: pipelineVersionSchema,
  pipelineVersion: pipelineVersionSchema,
  projectId: workflowIdSegmentSchema,
});

export const mediaRetentionWorkflowPayloadSchema = z.object({
  deletedAt: z.string().datetime(),
  purgeAfter: z.string().datetime(),
  trackId: workflowIdSegmentSchema,
});

export type MediaAssetPurpose = z.infer<typeof mediaAssetPurposeSchema>;
export type MediaProcessingStage = z.infer<typeof mediaProcessingStageSchema>;
export type MediaProcessingWorkflowPayload = z.infer<
  typeof mediaProcessingWorkflowPayloadSchema
>;
export type TrackEnrichmentWorkflowPayload = z.infer<
  typeof trackEnrichmentWorkflowPayloadSchema
>;
export type ProjectExportWorkflowPayload = z.infer<
  typeof projectExportWorkflowPayloadSchema
>;
export type MediaRetentionWorkflowPayload = z.infer<
  typeof mediaRetentionWorkflowPayloadSchema
>;

const assertWorkflowInstanceId = (instanceId: string): string => {
  if (instanceId.length > WORKFLOW_INSTANCE_ID_MAX_LENGTH) {
    throw new Error(
      `Workflow instance ID exceeds ${WORKFLOW_INSTANCE_ID_MAX_LENGTH} characters.`
    );
  }

  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/u.test(instanceId)) {
    throw new Error("Workflow instance ID contains unsupported characters.");
  }

  return instanceId;
};

export const mediaProcessingWorkflowInstanceId = ({
  pipelineVersion,
  sourceAssetId,
  trackId,
}: Pick<
  MediaProcessingWorkflowPayload,
  "pipelineVersion" | "sourceAssetId" | "trackId"
>): string =>
  assertWorkflowInstanceId(
    `media_${trackId}_${sourceAssetId}_v${pipelineVersion}`
  );

export const trackEnrichmentWorkflowInstanceId = ({
  pipelineVersion,
  sourceAssetId,
  trackId,
}: TrackEnrichmentWorkflowPayload): string =>
  assertWorkflowInstanceId(
    `enrich_${trackId}_${sourceAssetId}_v${pipelineVersion}`
  );

export const projectExportWorkflowInstanceId = ({
  exportVersion,
  projectId,
}: Pick<ProjectExportWorkflowPayload, "exportVersion" | "projectId">): string =>
  assertWorkflowInstanceId(`project_${projectId}_v${exportVersion}`);

export const mediaRetentionWorkflowInstanceId = ({
  deletedAt,
  trackId,
}: Pick<MediaRetentionWorkflowPayload, "deletedAt" | "trackId">): string =>
  assertWorkflowInstanceId(
    `retention_${trackId}_${deletedAt.replaceAll(/[^0-9]/gu, "")}`
  );

const derivativeFileNameByPurpose = {
  battle: "battle.m4a",
  download: "download.m4a",
  lossless_download: "download.flac",
  open_verse_snippet: "snippet.m4a",
  streaming: "streaming.m4a",
} as const satisfies Partial<Record<MediaAssetPurpose, string>>;

export type GeneratedMediaPurpose = keyof typeof derivativeFileNameByPurpose;

export const derivativeObjectKey = ({
  listingId,
  pipelineVersion,
  purpose,
  sourceAssetId,
  trackId,
}: {
  listingId?: string;
  pipelineVersion: number;
  purpose: GeneratedMediaPurpose;
  sourceAssetId: string;
  trackId: string;
}): string => {
  const fileName = derivativeFileNameByPurpose[purpose];

  if (purpose === "open_verse_snippet") {
    if (!listingId) {
      throw new Error("Open Verse snippets require a listing ID.");
    }

    return `open-verses/${listingId}/derived/v${pipelineVersion}/${sourceAssetId}/${fileName}`;
  }

  return `tracks/${trackId}/derived/v${pipelineVersion}/${sourceAssetId}/${fileName}`;
};
