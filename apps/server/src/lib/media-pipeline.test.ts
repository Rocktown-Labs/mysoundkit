/* eslint-disable sort-vars */
import { describe, expect, it } from "vitest";

import {
  MEDIA_PIPELINE_VERSION,
  derivativeObjectKey,
  mediaProcessingWorkflowInstanceId,
  mediaProcessingWorkflowPayloadSchema,
  projectExportWorkflowInstanceId,
  trackEnrichmentWorkflowInstanceId,
} from "./media-pipeline";

const sourceAssetId = "efb2f77d-33ab-47bc-b492-211d3672c6b9",
  trackId = "0fd8f8d9-97e0-43b8-ae30-9d248698441f";

describe("media pipeline contracts", () => {
  it("uses the remediated media pipeline version", () => {
    expect(MEDIA_PIPELINE_VERSION).toBe(5);
  });

  it("builds deterministic workflow IDs within Cloudflare limits", () => {
    const payload = {
        objectKey: `tracks/user/${sourceAssetId}.wav`,
        pipelineVersion: MEDIA_PIPELINE_VERSION,
        sourceAssetId,
        trackId,
      },
      mediaId = mediaProcessingWorkflowInstanceId(payload),
      enrichmentId = trackEnrichmentWorkflowInstanceId(payload);

    expect(mediaId).toBe(
      `media_${trackId}_${sourceAssetId}_v${MEDIA_PIPELINE_VERSION}`
    );
    expect(enrichmentId).toBe(
      `enrich_${trackId}_${sourceAssetId}_v${MEDIA_PIPELINE_VERSION}`
    );
    expect(mediaId.length).toBeLessThanOrEqual(100);
    expect(enrichmentId.length).toBeLessThanOrEqual(100);
  });

  it("rejects invalid Open Verse time ranges at runtime", () => {
    const result = mediaProcessingWorkflowPayloadSchema.safeParse({
      mode: "open_verse_base",
      objectKey: "tracks/user/base.wav",
      openVerse: {
        listingId: "listing-1",
        slotEndsAtMs: 10_000,
        slotStartsAtMs: 20_000,
      },
      pipelineVersion: MEDIA_PIPELINE_VERSION,
      sourceAssetId,
      trackId,
    });

    expect(result.success).toBe(false);
  });

  it("builds immutable versioned derivative keys", () => {
    expect(
      derivativeObjectKey({
        pipelineVersion: MEDIA_PIPELINE_VERSION,
        purpose: "streaming",
        sourceAssetId,
        trackId,
      })
    ).toBe(
      `tracks/${trackId}/derived/v${MEDIA_PIPELINE_VERSION}/${sourceAssetId}/streaming.m4a`
    );

    expect(
      derivativeObjectKey({
        listingId: "listing-1",
        pipelineVersion: MEDIA_PIPELINE_VERSION,
        purpose: "open_verse_snippet",
        sourceAssetId,
        trackId,
      })
    ).toBe(
      `open-verses/listing-1/derived/v${MEDIA_PIPELINE_VERSION}/${sourceAssetId}/snippet.m4a`
    );
  });

  it("versions project exports deterministically", () => {
    expect(
      projectExportWorkflowInstanceId({
        exportVersion: 17,
        projectId: "4deecbc5-695e-483d-bc8f-25ae0248b15d",
      })
    ).toBe("project_4deecbc5-695e-483d-bc8f-25ae0248b15d_v17");
  });
});
