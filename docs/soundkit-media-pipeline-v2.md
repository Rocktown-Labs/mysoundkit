# SoundKit Media Pipeline + Cloudflare Workflows Architecture V2

Implement the new SoundKit media lifecycle in the existing:

```text
Rocktown-Labs/mysoundkit
```

repository.

This specification **supersedes all previous media-processing prompts**.

This is NOT a greenfield rewrite.

Inspect the current repository first and adapt this architecture to what actually exists.

---

# 0. Important Existing Work — Do Not Regress It

A recent upload-race fix changed the new-track upload flow.

Before modifying upload behavior, inspect the current implementation from/after PR #70.

The current intended upload lifecycle is:

```text
prepare files
→ Better Upload direct browser → R2
→ verify/register master asset
→ settle track
→ success
```

SoundKit uses:

```text
@better-upload/client
@better-upload/server
Cloudflare R2
```

Better Upload remains the upload engine.

DO NOT:

- replace Better Upload
- proxy large masters through Hono
- replace its multipart support
- replace its real progress system
- reintroduce detached upload callbacks
- reintroduce the race where settlement happens before master registration
- reintroduce multiple competing success/error toasts

The current `handleSubmit` orchestration should remain the single owner of track submission.

The new media architecture begins **after the master has safely reached R2 and been registered by SoundKit**.

## PR #75 upload/readiness amendment

The following decisions supersede older examples in this document that describe separate registration and settlement requests, distinct battle audio, or a `-12`/`-10` loudness split:

```text
Better Upload completes direct browser → R2 transfer
→ POST /tracks/{trackId}/finalize-upload
→ one transaction registers all verified objects and saves release intent
→ idempotently ensure MediaProcessingWorkflow
→ return immediately to owner-facing track UI
→ derivatives continue asynchronously
```

- The browser never waits for DSP completion. Owner and accepted-collaborator playback may fall back to the guarded current master until the streaming asset is ready.
- New source keys are scoped as `tracks/{userId}/{trackId}/source/{assetId}-{filename}`. Derivative identity remains immutable and versioned under `tracks/{trackId}/derived/v{pipelineVersion}/{sourceAssetId}/...`.
- Pipeline version 3 generates one canonical AAC streaming derivative targeting `-13 LUFS`, accepts `-14` through `-12 LUFS`, and requires True Peak `<= -1 dBTP`. Version 3 also fixes consumer-download verification and supersedes failed/partial V2 runs.
- Ordinary and battle playback resolve that same streaming derivative. No separate battle render is generated.
- Publication is release intent plus media readiness: immediate releases publish when streaming is ready; scheduled releases require both media readiness and a due date; projects require every included track to have streaming media. Dashboard and API release actions remain blocked until streaming is ready.
- The owner `track_ready` email is emitted only from the media-ready Workflow step, never from upload settlement. Enrichment completion remains a separate event.
- Browser-generated 30-second WAV previews are not part of the V2 final-track path.

---

# 1. Architecture

The architecture should become:

```text
Browser
   │
   │ Better Upload
   ▼
Cloudflare R2
Original Master
   │
   ▼
SoundKit API
verify + register master
   │
   ▼
Track Settlement
   │
   ▼
ensure MediaProcessingWorkflow
   │
   ├────────────── Premium + eligible ─────────────┐
   │                                               │
   ▼                                               ▼
MediaProcessingWorkflow                 TrackEnrichmentWorkflow
   │                                               │
   ▼                                               ▼
R2 Core Derivatives                    R2 Stems + DB Lyrics
```

Projects are independent:

```text
Project/Release
      │
      ▼
ProjectExportWorkflow
      │
      ▼
R2 Release Export
```

Use:

```text
R2
```

for media bytes.

Use:

```text
Postgres
```

for canonical SoundKit application state.

Use:

```text
Cloudflare Workflows
```

for durable orchestration.

Use a media-processing runtime behind an abstraction for actual heavy DSP/transcoding.

---

# 2. Core Mental Model

A SoundKit track is NOT one audio file.

A finalized track consists of:

1. SoundKit canonical metadata
2. immutable original master
3. generated SoundKit media derivatives
4. optional Premium enrichment
5. optional project/release exports

Conceptually:

```text
Track
├── Master
├── Streaming
├── Battle
├── Consumer Download
├── Lossless when applicable
└── Premium Enrichment
    ├── Vocals
    ├── Instrumental
    └── Timed Lyrics
```

---

# 3. SoundKit Metadata Is Canonical

Do NOT import descriptive metadata from the uploaded file as authoritative.

Ignore embedded:

- title
- artist
- album
- album artist
- artwork
- genre
- release name
- track number

SoundKit already knows this data from its database.

We only inspect the uploaded file technically.

Inspect:

- actual container
- codec
- duration
- sample rate
- channels
- bit depth
- bitrate when meaningful
- lossy/lossless
- Integrated LUFS
- True Peak

Generated consumer media receives clean SoundKit metadata later.

---

# 4. Immutable Original Master

The artist-uploaded master is sacred.

Preserve the exact uploaded bytes.

Never:

- normalize the master
- rewrite its tags
- resample it
- transcode it in place
- replace it with a derivative
- modify it after upload

Record enough technical information to identify the source.

Conceptually:

```ts
{
  purpose: "master",
  originalFileName,
  container,
  codec,
  durationMs,
  sampleRateHz,
  bitDepth,
  channels,
  bitrateKbps,
  sizeBytes,
  isLossless,
  sha256
}
```

Artist "Download Master" must return the exact source bytes.

Masters must remain private.

---

# 5. R2 Is the Media Store

Large media should remain in R2.

Do NOT pass giant audio buffers through Workflow params/state unless absolutely necessary.

Workflow parameters should contain references:

```ts
{
  trackId,
  sourceAssetId,
  objectKey,
  pipelineVersion
}
```

not:

```ts
{
  audioBuffer: /* 700 MB WAV */
}
```

Conceptually:

```text
Workflow State
= IDs + pointers + analysis + results

R2
= actual media bytes

Postgres
= application truth + processing history
```

---

# 6. Do Not Use R2 Events as the Primary Upload Trigger

R2 event notifications may be useful later for:

- reconciliation
- auditing
- orphan detection
- external uploads
- cleanup
- unexpected object changes

But normal SoundKit track processing should be explicitly started by SoundKit.

SoundKit already knows:

```text
trackId
sourceAssetId
objectKey
ownerUserId
pipelineVersion
```

when the master is finalized.

Therefore:

```text
Better Upload completes
→ SoundKit verifies R2
→ master asset finalized
→ track settles
→ SoundKit starts Workflow
```

Do not add an unnecessary:

```text
R2 event
→ Queue
→ Worker
→ guess which track the object belongs to
```

into the normal happy path.

---

# 7. No Arbitrary Sleeps After Upload

R2 is strongly consistent after a completed multipart upload.

Once Better Upload reports successful multipart completion and the SoundKit server verifies:

```ts
await bucket.head(objectKey)
```

the object is available.

Do NOT add:

```ts
await sleep(2000);
```

or similar timing hacks before processing.

The recent upload race was an application orchestration problem, not R2 eventual consistency.

---

# 8. Workflow Bindings

Introduce/reuse explicit Workflow bindings such as:

```text
MEDIA_PROCESSING_WORKFLOW
TRACK_ENRICHMENT_WORKFLOW
PROJECT_EXPORT_WORKFLOW
```

Update:

- wrangler configuration
- Worker Env types
- tests
- local development configuration
- deployment configuration
- preview environment configuration

Verify bindings work in both preview and production.

---

# 9. Rename Existing TrackProcessingWorkflow

The existing:

```text
TrackProcessingWorkflow
```

is primarily StemSplit/transcription enrichment.

Rename/evolve it into:

```text
TrackEnrichmentWorkflow
```

Update:

- class
- file name where appropriate
- bindings
- types
- imports
- tests
- logs
- documentation

Do this safely.

Its responsibility remains optional enrichment.

Do NOT turn it into universal media processing.

---

# 10. Workflow Rules

Follow Cloudflare Workflow semantics correctly.

Every Workflow must use granular deterministic steps.

Good:

```text
verify master
inspect source
analyze loudness
generate streaming
register streaming
generate battle
register battle
generate download
register download
finalize media state
```

Bad:

```text
step.do("process entire song", async () => {
  // everything
});
```

Each meaningful external side effect should be inside `step.do()`.

Steps should be:

- granular
- individually retryable
- idempotent
- deterministically named

Do not use:

```text
Date.now()
Math.random()
UUID()
```

in step names.

Do not depend on mutable in-memory state surviving Workflow hibernation/restarts.

Persist important state through:

- step return values
- Postgres
- R2

---

# 11. Workflow Idempotency

Workflow retries must not create duplicate media.

Identity should conceptually include:

```text
sourceAssetId
+
purpose
+
pipelineVersion
+
release context where applicable
```

Example:

```text
Master ABC
Pipeline V1

streaming → ABC/V1
battle → ABC/V1
download → ABC/V1
```

Retrying the Workflow should reuse these outputs if already successfully generated.

---

# 12. Deterministic Workflow Instance IDs

Use deterministic Workflow IDs tied to SoundKit state.

Example:

```text
media_{trackId}_{sourceAssetId}_v1
```

and:

```text
enrich_{trackId}_{sourceAssetId}_v1
```

and:

```text
project_{projectId}_{exportVersion}
```

Ensure they satisfy Cloudflare ID requirements and remain under the current ID length limit.

Do not generate a random new Workflow instance every time an HTTP request retries.

Implement something conceptually equivalent to:

```ts
ensureMediaProcessingWorkflow(...)
```

If the deterministic instance already exists:

```text
get/reuse existing instance
```

instead of creating another media job.

---

# 13. Backfill Workflow Creation

For catalog backfills, use controlled batches.

Inspect current Cloudflare Workflow APIs and limits.

Where appropriate, use batch instance creation rather than individually creating an uncontrolled number of jobs.

Backfills must be:

- idempotent
- bounded
- resumable
- rate-aware

---

# 14. SoundKit Processing Job State

Do NOT rely on Cloudflare Workflow instance state as the permanent application record.

Persist processing state in Postgres.

Reuse an existing processing/jobs table if one cleanly fits.

Otherwise introduce a focused model such as:

```text
mediaProcessingJobs
```

Conceptually:

```ts
{
  id,
  trackId,
  sourceAssetId,
  workflowType,
  workflowInstanceId,
  mode,
  pipelineVersion,

  status:
    | "queued"
    | "running"
    | "ready"
    | "partial"
    | "failed",

  currentStage,
  errorCode,
  errorMessage,

  startedAt,
  completedAt,
  updatedAt
}
```

Do not duplicate status already cleanly represented by `trackAssets`; job status is orchestration status while asset status is artifact status.

---

# 15. SoundKit Processing Status API

Expose processing state through SoundKit.

Conceptually:

```text
GET /api/v1/tracks/:trackId/processing
```

or the repository's existing API/RPC convention.

Return stable SoundKit concepts such as:

```json
{
  "status": "running",
  "mediaReady": true,
  "currentStage": "battle",
  "workflowStatus": "running",
  "assets": {
    "master": "ready",
    "streaming": "ready",
    "battle": "processing",
    "download": "waiting",
    "lossless": "not_applicable"
  }
}
```

The frontend should poll SoundKit.

Do NOT have the browser directly call the Cloudflare Workflow API.

---

# 16. Upload UX → Workflow UX Handoff

The new-track page should have two separate real progress domains.

## Browser-owned transfer

Better Upload owns:

```text
Preparing files
Uploading master
Finalizing uploaded audio
Finishing track setup
```

Use its actual per-file progress.

DO NOT fake upload percentages.

## SoundKit-owned media processing

Once:

```text
master finalized
+
track settled
+
MediaProcessingWorkflow confirmed queued/running
```

the UI transitions to:

```text
Analyzing audio
Preparing SoundKit stream
Preparing battle audio
Preparing download
Finishing media
```

These stages should be driven by real Workflow/job/asset state.

If the actual transcoder exposes percentage progress, surface it.

If it does NOT expose percentage progress:

show honest stage-level state/spinners.

DO NOT fabricate:

```text
43%
67%
81%
```

just because a progress bar looks nice.

---

# 17. Continue in Background

Once:

```text
master is safely in R2
master asset is registered
track is settled
workflow instance exists
```

the browser no longer owns the critical work.

At that point:

```text
Continue in background
```

may safely allow the user to navigate away.

Default blocking behavior can remain.

The Workflow must continue independently.

---

# 18. Workflow Launch Failure

If:

```text
master upload ✓
master registration ✓
track settlement ✓
workflow creation ✗
```

do NOT re-upload the WAV.

Do NOT delete the master.

Persist:

```text
processing start failed
```

and allow:

```text
Retry Processing
```

from the dashboard.

`ensureMediaProcessingWorkflow` must be idempotent.

---

# 19. MediaProcessingWorkflow Modes

Use one core Workflow with explicit processing modes rather than inventing many nearly-identical media workflows.

Conceptually:

```ts
type MediaProcessingMode =
  | "final_track"
  | "open_verse_base"
  | "legacy_backfill";
```

Params conceptually:

```ts
{
  trackId,
  sourceAssetId,
  objectKey,
  pipelineVersion,
  mode,

  openVerse?: {
    listingId,
    slotStartsAtMs,
    slotEndsAtMs
  }
}
```

Validate Workflow params at runtime.

Do not trust TypeScript types alone.

---

# 20. Final Track MediaProcessingWorkflow

For:

```text
mode = final_track
```

the Workflow should conceptually execute:

```text
verify source
      ↓
inspect source technically
      ↓
analyze loudness
      ↓
generate streaming
      ↓
verify/register streaming
      ↓
MEDIA READY
      ↓
generate battle
      ↓
verify/register battle
      ↓
generate consumer download
      ↓
verify/register download
      ↓
generate lossless if applicable
      ↓
verify/register lossless
      ↓
processing complete
```

Streaming should be prioritized because it determines basic playback readiness.

Battle/download/lossless can continue after `mediaReady`.

---

# 21. MediaReady vs ProcessingComplete

These are different.

Define:

```text
mediaReady =
master valid
+
analysis complete
+
streaming asset ready
```

At that point normal SoundKit playback works.

Processing may still be:

```text
battle: processing
download: waiting
lossless: waiting
```

Define separate:

```text
processingComplete
```

when all applicable core derivative purposes reach a terminal state:

```text
ready
failed
not_applicable
```

The UI may continue showing the remaining work even after `mediaReady=true`.

---

# 22. Public Playback Before MediaReady

Do not fall back to the raw master for new uploads.

For newly processed tracks:

```text
master ready
streaming processing
```

normal public playback should return:

```text
playbackUrl = null
mediaStatus = processing
```

until the streaming derivative exists.

Temporary master fallback is ONLY for legacy migration.

Do not make new V2 uploads depend on it.

---

# 23. Technical Media Inspection

Inspect:

- actual container
- codec
- duration
- sample rate
- channels
- bit depth
- bitrate
- lossy/lossless
- Integrated LUFS
- True Peak

Use Mediabunny where appropriate for:

- container inspection
- metadata/container work
- generated tags/artwork

Do not use browser Web Audio measurements as authoritative server data.

---

# 24. Authoritative Loudness

Use:

```text
Integrated LUFS
True Peak
```

from an ITU-R BS.1770 / EBU-compatible implementation.

Conceptually:

```ts
interface LoudnessAnalysis {
  integratedLufs: number;
  truePeakDbtp: number;
}
```

Store the original source measurements.

---

# 25. Actual DSP / Media Processor

Cloudflare Workflow is the orchestrator.

It does NOT mean all DSP has to run directly inside Worker JavaScript.

Create an abstraction such as:

```ts
interface MediaProcessor {
  inspectSource(...): Promise<...>;

  analyzeLoudness(...): Promise<...>;

  createStreamingDerivative(...): Promise<...>;

  createBattleDerivative(...): Promise<...>;

  createDownloadDerivative(...): Promise<...>;

  createLosslessDerivative(...): Promise<...>;

  createOpenVerseSnippet(...): Promise<...>;
}
```

Then implement a REAL production media processor.

Do not leave fake database rows or TODO transcoding.

---

# 26. Worker vs Container Runtime

Inspect the actual processing requirements.

Do not force huge WAV decoding, FFmpeg, or native DSP into the Workflow Worker merely because the Workflow lives on Cloudflare.

If the implementation cannot safely handle realistic SoundKit files within Worker CPU/memory/runtime constraints, use a compatible processing runtime.

Strong preference if native FFmpeg/full Linux is required:

```text
Cloudflare Container
```

because it remains inside the Cloudflare architecture.

A possible architecture is:

```text
Workflow step
    ↓
Media Processor Container
    ↓
read source from R2
    ↓
FFmpeg / loudness processing
    ↓
write derivative to R2
    ↓
return objectKey + measurements
```

Do not embed permanent R2 secrets in a container if Worker bindings/signed requests/current secure architecture can avoid it.

Use the smallest production-safe approach.

---

# 27. FFmpeg / Loudness Implementation

If FFmpeg is used:

use its proper loudness tooling or equivalent authoritative DSP.

Do not simply calculate:

```text
targetLUFS - sourceLUFS
```

and apply raw gain without peak handling.

Use a proper normalization strategy such as validated/two-pass loudness normalization.

Then VERIFY the final encoded output.

This is important because AAC encoding can affect peaks.

The generated derivative should be analyzed after encoding to confirm it meets SoundKit's targets within reasonable tolerance.

---

# 28. Streaming Derivative

Purpose:

```text
streaming
```

Target:

```text
AAC-LC
M4A/MP4
~256 kbps
<= 48 kHz ordinary delivery
stereo when appropriate

Integrated:
-12 LUFS

True Peak:
<= -1 dBTP
```

This becomes normal SoundKit playback.

Use it for:

- public tracks
- artist pages
- discovery
- library
- playlists
- dashboard preview
- listening parties
- ordinary playback

---

# 29. Battle Derivative

Purpose:

```text
battle
```

Target:

```text
AAC-LC / M4A
~256 kbps

Integrated:
-10 LUFS

True Peak:
<= -1 dBTP
```

Transparent limiting may be used when required.

Battle playback must resolve this asset.

Battle readiness is separate from media readiness.

A track with:

```text
streaming ✓
battle ✗
```

can play normally but cannot enter a new battle.

---

# 30. Consumer Download Derivative

Purpose:

```text
download
```

Generate for every finalized normal track regardless of sale/download settings.

Recommended:

```text
M4A / AAC
~256 kbps
```

Preserve artist/master artistic loudness.

DO NOT normalize this file to:

```text
-12
```

or:

```text
-10
```

Example:

```text
source master:      -7.8 LUFS
streaming:          -12 LUFS
battle:             -10 LUFS
consumer download:  approximately source loudness
```

---

# 31. SoundKit Download Metadata

SoundKit writes metadata from its database.

For standalone tracks, use available:

- title
- artist
- genre
- release date
- artwork
- ISRC
- lyrics

Do not import these values from the master.

---

# 32. Lossless

Only mark/generate a lossless option when the original source is genuinely lossless.

Examples:

```text
WAV  → eligible
FLAC → eligible
AIFF → eligible if supported by actual decoder/runtime

MP3  → NOT lossless
AAC  → NOT lossless
```

Never do:

```text
MP3 → FLAC → "lossless"
```

The artist always retains exact-original master access.

---

# 33. Generate Core Final-Track Derivatives Up Front

For finalized tracks, generate:

```text
streaming
battle
download
lossless where applicable
```

regardless of:

```text
isForSale
downloadsAllowed
downloadsRequirePurchase
```

Those are business/access settings.

They do not determine whether media exists.

Keep separate:

```text
MEDIA
what assets exist?

ACCESS
who may use them?

COMMERCE
what must be purchased?

ENTITLEMENT
what does this user/plan permit?
```

---

# 34. Open Verse Is the Exception

The "generate all core derivatives" rule applies to FINALIZED tracks.

An unfinished Open Verse is different because its final master does not exist yet.

Do NOT waste resources generating final:

- battle asset
- consumer download
- final lossless delivery
- Premium stems
- transcription

from an unfinished Open Verse base recording.

---

# 35. Open Verse Lifecycle

The real product flow is:

```text
Artist uploads base master
        ↓
Artist selects open-verse section
        ↓
SoundKit generates snippet
        ↓
Open Verse goes live
        ↓
Artists submit vocal/adlib/etc files
        ↓
Owner accepts submission
        ↓
accepted files/collaborator preserved
        ↓
AWAITING FINAL MASTER
        ↓
owner manually finishes mix/master externally
        ↓
owner uploads NEW FINAL MASTER
        ↓
full final-track pipeline
```

SoundKit does NOT currently mix accepted vocals into the record.

Do not pretend that it does.

---

# 36. Open Verse Base MediaProcessing

When an Open Verse becomes live:

run:

```text
MediaProcessingWorkflow
mode = open_verse_base
```

This should:

```text
verify base master
inspect as necessary
generate open-verse snippet
normalize snippet for SoundKit listening
register snippet
mark Open Verse playable
```

Potentially generate another preview only if the current public UX requires it.

DO NOT generate the full finalized-track asset family yet.

---

# 37. Open Verse Snippet

Use existing:

```text
slotStartsAtMs
slotEndsAtMs
```

or the actual equivalent.

Generate:

```text
purpose = open_verse_snippet
```

Target approximately normal SoundKit listening policy:

```text
-12 LUFS
<= -1 dBTP
```

Store lineage:

```text
sourceAssetId = base master
```

---

# 38. Open Verse Premium Behavior

Premium does NOT enrich unfinished Open Verses.

While open:

```text
Free owner
→ Open Verse base processing only

Premium owner
→ SAME
```

No:

- StemSplit
- transcription
- timed lyrics

yet.

---

# 39. Open Verse Acceptance

When an artist accepts a submission:

SoundKit should:

- close/fulfill the listing
- preserve accepted submission files
- preserve collaborator relationship
- preserve relevant metadata
- notify parties
- transition conceptually to:

```text
Awaiting Final Master
```

Acceptance does NOT start the finalized media pipeline.

---

# 40. Open Verse Final Master

The artist manually finishes the song outside SoundKit and uploads a NEW final master.

This becomes the new authoritative track master.

The base Open Verse master becomes historical/source collaboration material.

Do not resolve base Open Verse assets as the completed song.

---

# 41. Open Verse Final Processing

Final master uploaded:

## Free

```text
MediaProcessingWorkflow
mode = final_track
```

## Premium

```text
MediaProcessingWorkflow
mode = final_track

+

TrackEnrichmentWorkflow
```

The Premium enrichment must operate on the finished final master.

---

# 42. Asset Lineage

Every derivative must identify its source.

Conceptually:

```text
sourceAssetId
```

If:

```text
Master ABC
```

generated:

```text
streaming → ABC
battle → ABC
download → ABC
vocals → ABC
instrumental → ABC
machine transcription → ABC
```

and new master becomes:

```text
XYZ
```

ABC derivatives must never accidentally resolve as current assets.

---

# 43. Asset Model

Evolve the existing `trackAssets`.

Do not create a parallel media asset system.

Introduce/evolve a first-class semantic purpose such as:

```ts
purpose:
  | "master"
  | "streaming"
  | "battle"
  | "download"
  | "lossless_download"
  | "open_verse_snippet"
  | "preview"
  | "stem"
  | "artwork"
  | "other";
```

Evaluate first-class operational fields:

```text
sourceAssetId
processingVersion
integratedLufs
truePeakDbtp
normalizationTargetLufs
```

Technical metadata can include:

```ts
{
  codec,
  container,
  bitrateKbps,
  sampleRateHz,
  bitDepth,
  channels,
  isLossless,
  sourceSha256,
  originalFileName,
  generatedBy: "soundkit"
}
```

Use additive migrations.

Do not immediately delete legacy asset kinds.

---

# 44. Pipeline Version

Introduce:

```ts
MEDIA_PIPELINE_VERSION = 1;
```

Generated assets record their pipeline version.

Future changes should allow SoundKit to regenerate from the untouched original master.

Consider:

```ts
ENRICHMENT_PIPELINE_VERSION
```

as well.

---

# 45. R2 Object Keys

Use deterministic/versioned immutable object keys.

Adapt this to the ACTUAL current upload/storage helpers created/reused by the repository.

Conceptually:

```text
tracks/{trackId}/source/{sourceAssetId}/original.wav

tracks/{trackId}/derived/v1/{sourceAssetId}/streaming.m4a

tracks/{trackId}/derived/v1/{sourceAssetId}/battle.m4a

tracks/{trackId}/derived/v1/{sourceAssetId}/download.m4a
```

Open Verse conceptually:

```text
open-verses/{listingId}/derived/v1/{sourceAssetId}/snippet.m4a
```

Do NOT blindly introduce these prefixes if PR #70/current R2 ownership helpers use another safe convention.

Reuse the current authoritative object-key ownership logic.

---

# 46. Avoid Mutable Media URLs

Prefer versioned immutable derivative keys rather than overwriting:

```text
streaming.m4a
```

for every master version forever.

This prevents:

- stale CDN content
- race conditions
- old/new master ambiguity

If legacy public cached objects are deleted/overwritten, handle cache invalidation correctly.

---

# 47. Central Asset Resolver

Create a central backend resolver.

Conceptually:

```ts
resolveTrackAsset({
  trackId,
  purpose
});
```

or:

```ts
resolvePlaybackAsset({
  trackId,
  context
});
```

Expected mapping:

```text
ordinary playback
→ streaming

dashboard preview
→ streaming

listening party
→ streaming

battle
→ battle

artist master download
→ master

consumer standalone download
→ download

lossless/master purchase
→ genuine lossless/master if entitled
```

Do not scatter:

```ts
assetKind === "master"
```

logic throughout React/server routes.

---

# 48. Dashboard Queue Behavior

Preserve/fix the previously discussed rule:

```text
Dashboard/private management playback
→ selected track ONLY
```

Do:

```ts
setQueue([track]);
setCurrentTrack(track);
```

or centralized equivalent.

Do not queue the entire artist catalog from `/dashboard/tracks`.

---

# 49. Public Queue Behavior

Public listening context may intentionally build queues.

Examples:

```text
artist page
→ artist public tracks

project page
→ project order

playlist
→ playlist order
```

Search/discovery should not automatically queue everything without an intentional context.

---

# 50. TrackEnrichmentWorkflow

Premium-only.

Responsible for:

```text
StemSplit
├── vocals
└── instrumental

transcription
└── timed lyrics
```

Do not make enrichment a dependency of:

- track creation
- media readiness
- streaming
- battle
- downloads

---

# 51. Enrichment Workflow Steps

Refactor the existing StemSplit flow into durable granular Workflow steps.

Conceptually:

```text
verify current master
      ↓
verify owner eligibility
      ↓
submit StemSplit
      ↓
wait/poll StemSplit durably
      ↓
register vocal stem
      ↓
register instrumental
      ↓
transcribe
      ↓
write lyrics revision
      ↓
enrichment complete
```

Use Workflow sleep/retry semantics appropriately.

Do not recreate the external StemSplit job on every retry.

Persist/reuse its job ID.

---

# 52. Premium Entitlement

Use SoundKit's existing centralized entitlement resolver.

Do not introduce another premium boolean.

Normal finalized upload:

```text
Free
→ MediaProcessingWorkflow only

Premium
→ MediaProcessingWorkflow
→ TrackEnrichmentWorkflow
```

They are independent.

Enrichment may start once the final master is finalized.

It does NOT have to wait for core media completion.

---

# 53. Lyrics Integration

Write generated transcription into the EXISTING lyrics/revision model.

Do not invent a second lyrics system.

Use existing semantics for:

```text
machine transcription
pending review
timed lines
```

Do not overwrite approved/manual artist lyrics.

Generated transcription should become the appropriate candidate/revision according to existing architecture.

---

# 54. Premium Upgrade Backfill

When an artist upgrades:

do NOT perform catalog enrichment synchronously in the Stripe/subscription HTTP request.

Schedule a controlled backfill.

Eligible:

```text
Premium
+
finalized track
+
current master
+
missing/failed/stale enrichment
```

Exclude unfinished Open Verses.

Use controlled Workflow batch creation/concurrency.

Already-current enrichment should skip.

---

# 55. Premium Downgrade

Do not delete previously generated enrichment.

Avoid paying to regenerate identical stems/transcription after a later resubscription.

Premium may gate generation and/or premium UI access.

It should not automatically destroy derived assets.

---

# 56. ProjectExportWorkflow

Projects are release context, not new recordings.

Creating/editing a project must NOT regenerate:

```text
streaming
battle
```

for its tracks.

Project workflow handles:

- release metadata
- ordering
- project artwork
- tagged release downloads
- packaging
- cached exports

---

# 57. Project Workflow Trigger

When a project is:

- finalized/published
- prepared for release download
- explicitly exported

ensure a `ProjectExportWorkflow` exists for the CURRENT project export/revision version.

Project edits should invalidate the old export version.

They should not mutate an already-running export's release snapshot.

---

# 58. Project Export Snapshot

At Workflow start, snapshot the release context.

Conceptually:

```text
project title
album artist
track ordering
track count
release date
genre
artwork version
track source/download versions
```

The Workflow should produce a deterministic export for that snapshot.

If project metadata changes while export V17 runs:

```text
V17 stays V17
new state becomes V18
```

Do not silently mutate an in-flight export.

---

# 59. Project Download Audio

Project export should resolve existing source-loudness download-quality audio.

Do not re-normalize project purchases to -12/-10.

Avoid unnecessary second-generation lossy encoding.

If project-specific metadata can be rewritten/remuxed without re-encoding AAC audio, prefer that.

Project-specific metadata includes:

- album/project
- album artist
- track n/total
- artwork
- release date
- genre
- lyrics when appropriate

---

# 60. Project Export Output

Conceptually:

```text
Against All Odds/

01 - Long Way.m4a
02 - Mr Krabz.m4a
03 - Derek Fisher.m4a
```

Package into ZIP only if current product behavior requires it.

Do not add packaging merely because it is technically possible.

---

# 61. Storage Security

Audit R2.

Private:

- original masters
- stems
- accepted Open Verse source files
- private/unreleased assets
- purchase-only downloads
- lossless/master downloads

Do not expose these through unrestricted permanent `MEDIA_PUBLIC_URL`.

Use existing:

- guarded Worker routes
- signed URLs
- entitlement checks
- private R2

where appropriate.

---

# 62. Streaming Security

Streaming derivatives may be publicly cacheable only if current SoundKit access policy permits.

Do not accidentally bypass:

```text
premium_or_purchased
```

or other playback entitlements through a raw permanent R2 URL.

Backend authorization remains authoritative.

---

# 63. Unpublish

Unpublish means:

```text
public discovery/playback disabled
master retained
derivatives retained
enrichment retained
republish remains quick
```

Do not destroy media merely because a track was unpublished.

---

# 64. Delete / Recovery

Delete means:

```text
public access immediately disabled
new purchases disabled
30-day recovery
```

After 30 days, eligible source/derived assets may be purged.

Do not use a fragile application timer.

If implementing this in this phase, use a durable Workflow/scheduler pattern that:

```text
waits 30 days
→ re-checks current deletion state
→ re-checks purchase/legal retention requirements
→ purges only if still eligible
```

Do not make a single R2 lifecycle rule blindly delete assets that must remain available to purchasers.

---

# 65. Legacy Media Backfill

Existing finalized tracks need:

- analysis
- streaming
- battle
- download
- lossless applicability

Use MediaProcessingWorkflow in:

```text
legacy_backfill
```

or equivalent mode.

Do not perform a giant synchronous migration.

Use controlled Workflow batches.

---

# 66. Legacy Playback Fallback

During migration only:

```text
streaming derivative
→ temporary master fallback if missing
```

and equivalent documented battle fallback if necessary.

Emit:

```text
media_pipeline_fallback_used
```

New V2 uploads should not depend on this.

---

# 67. Failure Isolation

Do not have one global:

```text
processing failed
```

Represent purpose-specific state.

Example:

```text
analysis: ready
streaming: ready
battle: failed
download: ready
lossless: not_applicable

enrichment:
stems: failed
lyrics: unavailable
```

Streaming remains valid.

---

# 68. Observability

Emit structured application events such as:

```text
media_workflow_created
media_processing_started

media_analysis_completed
media_analysis_failed

media_derivative_started
media_derivative_completed
media_derivative_failed
media_derivative_reused

media_ready

track_enrichment_started
track_enrichment_completed
track_enrichment_failed
track_enrichment_skipped_not_premium

premium_enrichment_backfill_started
premium_enrichment_backfill_completed

open_verse_snippet_started
open_verse_snippet_completed
open_verse_awaiting_final_master
open_verse_final_master_uploaded

project_export_started
project_export_completed
project_export_failed

media_pipeline_fallback_used
```

Include where safe:

```text
trackId
projectId
listingId
assetId
sourceAssetId
purpose
pipelineVersion
workflowInstanceId
durationMs
bytes
integratedLufs
truePeakDbtp
codec
```

Never log:

- signed URLs
- API secrets
- R2 credentials

---

# 69. Tests — Upload → Workflow Handoff

Add tests that prove:

```text
settlement does not happen before master registration
```

from the recent race fix.

Then additionally test:

```text
master upload ✓
master registration ✓
settlement ✓
→ workflow creation
```

Workflow launch must not trigger another file upload.

Duplicate HTTP/submission retries must not create duplicate Workflow instances.

If Workflow creation fails:

```text
master remains safe
track remains settled
processing is retryable
```

---

# 70. Tests — Workflow Semantics

Test:

- deterministic instance IDs
- duplicate ensure call reuses existing workflow
- step retry does not duplicate derivatives
- completed step results are reused
- current source master is validated
- stale source cannot become current
- workflow params runtime validation
- currentStage/job DB updates
- terminal failure state

Use Cloudflare's Workflow Vitest support where practical.

---

# 71. Tests — Audio

Test:

- master bytes unchanged
- actual media format validation
- Integrated LUFS measurement
- True Peak measurement
- streaming target ≈ -12 LUFS
- streaming TP <= -1 dBTP
- battle target ≈ -10 LUFS
- battle TP <= -1 dBTP
- post-encode verification
- lossy source cannot become fake lossless
- source-loudness download remains source-like
- pipeline version lineage

Use sensible DSP tolerances.

---

# 72. Tests — Playback

Test:

```text
normal → streaming
dashboard → streaming
listening party → streaming
battle → battle
artist master download → master
consumer download → download
```

Test new track before streaming ready:

```text
playbackUrl = null
mediaStatus = processing
```

Test migration fallback separately.

---

# 73. Tests — Premium

Test:

- free finalized upload does not start enrichment
- Premium finalized upload does
- enrichment failure does not affect media
- upgrade backfill is controlled
- downgrade retains enrichment
- stale source requires re-enrichment
- unfinished Open Verse excluded

---

# 74. Tests — Open Verse

Test:

## Base

- base master retained
- snippet uses selected start/end
- snippet lineage points to base master
- unfinished Open Verse does NOT create final battle/download/lossless assets
- Premium unfinished Open Verse does NOT enrich

## Acceptance

- accepted files preserved
- collaborator state preserved
- listing fulfilled
- state becomes Awaiting Final Master
- final media pipeline does not start

## Final Master

- new master becomes authoritative
- final-track MediaProcessingWorkflow starts
- free user stops there
- Premium also starts enrichment
- old base snippet/master cannot resolve as finished-track playback

---

# 75. Tests — Projects

Test:

- project metadata edit does not regenerate stream
- project metadata edit does not regenerate battle
- project revision invalidates export
- export snapshots track ordering
- correct project metadata is written
- no unnecessary lossy re-encoding
- repeated export request is idempotent

---

# 76. Tests — Security

Test:

- master not publicly reachable
- stems protected
- purchase download requires entitlement
- R2 object ownership validation preserved from upload-race fix
- user cannot register another SoundKit namespace/object as a master
- unpublish removes public playback
- delete disables public access
- retention rules respected

---

# 77. Recommended Implementation Order

## Phase 1 — Inspect Current Repo

1. inspect PR #70/current Better Upload orchestration
2. inspect track creation/settlement
3. inspect `trackAssets`
4. inspect current TrackProcessingWorkflow
5. inspect StemSplit/transcription
6. inspect lyrics revisions
7. inspect battle playback
8. inspect dashboard playback
9. inspect Open Verse
10. inspect projects/downloads
11. inspect R2 security
12. inspect Premium entitlement
13. inspect current Wrangler Workflow bindings

## Phase 2 — Workflow Foundation

14. add processing-job state or adapt existing jobs
15. add deterministic workflow ID helpers
16. add `ensure...Workflow()` helpers
17. add/update Wrangler bindings
18. add processing status API

## Phase 3 — Asset Model

19. additive purpose/source/version migration
20. centralized current-master resolution
21. centralized asset resolver

## Phase 4 — Actual Media Processor

22. determine Worker/WASM vs Container
23. implement technical inspection
24. implement LUFS/True Peak
25. implement actual transcoder
26. implement post-encode verification

Do not proceed with fake assets if processing runtime is unresolved.

## Phase 5 — MediaProcessingWorkflow

27. source verification
28. analysis
29. streaming generation/registration
30. mediaReady handling
31. battle generation/registration
32. download generation/registration
33. lossless applicability/generation
34. final processing status

## Phase 6 — Upload UX Integration

35. preserve Better Upload upload progress
36. start Workflow after settlement
37. poll SoundKit processing API
38. show real processing stages
39. success preview uses STREAMING derivative
40. support Continue in background safely

## Phase 7 — Playback

41. normal playback → streaming
42. dashboard preview → streaming
43. battle → battle
44. artist master download → master
45. consumer download → download
46. dashboard single-track queue

## Phase 8 — Enrichment

47. rename TrackProcessingWorkflow
48. make enrichment Premium-only
49. improve durable StemSplit polling
50. write lyrics into existing revision model
51. Premium upgrade backfill

## Phase 9 — Open Verse

52. base-master mode
53. server-generated snippet
54. acceptance → Awaiting Final Master
55. final-master upload
56. final core workflow
57. Premium final enrichment

## Phase 10 — Projects

58. ProjectExportWorkflow
59. release snapshot/version
60. project tagging/export
61. cache/idempotency

## Phase 11 — Migration/Security

62. legacy backfill
63. temporary fallback
64. private/public R2 audit
65. deletion/recovery handling
66. observability

## Phase 12 — Validation

67. typecheck
68. lint
69. unit tests
70. Worker/Workflow tests
71. build
72. E2E
73. preview deployment
74. manual large-WAV upload test

---

# 78. Manual Validation Scenario

Use a realistically large WAV.

Example:

```text
24-bit WAV
several minutes long
100+ MB
```

Expected UX:

```text
Preparing track files...
        ↓
Uploading master audio...
[REAL Better Upload progress]
        ↓
Finalizing uploaded audio...
        ↓
Finishing track setup...
        ↓
Analyzing audio...
        ↓
Preparing SoundKit stream...
        ↓
stream becomes ready
        ↓
preview becomes playable
        ↓
Preparing battle audio...
        ↓
Preparing download...
        ↓
Track processing complete
```

No:

```text
MASTER_UPLOAD_PENDING
```

during normal operation.

No contradictory toasts.

No master re-upload.

No fake progress.

---

# 79. Hard Constraints

DO NOT:

- modify master bytes
- replace Better Upload
- reintroduce upload race conditions
- use R2 event notifications as the primary normal trigger
- add arbitrary sleeps after R2 upload
- pass huge audio buffers as Workflow params
- make Workflow state the permanent application database
- create random duplicate Workflow instances
- put the entire media pipeline in one `step.do`
- perform non-idempotent side effects outside steps
- force huge FFmpeg jobs into Worker CPU if the runtime is unsuitable
- create placeholder derivative rows without actual media
- use browser audio analysis as authoritative LUFS
- use RMS instead of LUFS
- use sample peak instead of True Peak
- modify the original master
- normalize consumer downloads
- fake lossless
- make sale/download toggles control derivative generation
- make Premium required for core media
- enrich unfinished Open Verses
- pretend Open Verse acceptance produces a mixed song
- overwrite approved lyrics
- expose private masters/stems
- queue the entire dashboard catalog
- regenerate streaming/battle because project metadata changed
- perform giant synchronous catalog backfills

---

# 80. Expected Finalized Free Track

```text
MASTER
exact source ✓

ANALYSIS
LUFS ✓
True Peak ✓

STREAMING
AAC/M4A
~256k
-12 LUFS
<= -1 dBTP ✓

BATTLE
AAC/M4A
~256k
-10 LUFS
<= -1 dBTP ✓

DOWNLOAD
AAC/M4A
source artistic loudness
SoundKit tags/art ✓

LOSSLESS
only if source qualifies

PREMIUM ENRICHMENT
skipped
```

---

# 81. Expected Finalized Premium Track

Same core media plus:

```text
VOCALS ✓
INSTRUMENTAL ✓
TIMED LYRICS ✓ / pending artist review
```

StemSplit failure does not break streaming.

---

# 82. Expected Open Verse

```text
BASE MASTER
      ↓
OPEN VERSE SNIPPET
      ↓
submissions
      ↓
winner accepted
      ↓
AWAITING FINAL MASTER
      ↓
artist manually completes song
      ↓
NEW FINAL MASTER
      ↓
MediaProcessingWorkflow
      ↓
Premium?
  ├── NO → done
  └── YES → TrackEnrichmentWorkflow
```

---

# 83. Expected Project

```text
Existing Track Media
      ↓
ProjectExportWorkflow
      ↓
snapshot release context
      ↓
apply project metadata/order/art
      ↓
release download/export
```

No streaming/battle reprocessing.

---

# Final Instruction

Treat this as a durable media lifecycle architecture change.

Before coding, compare this specification against the ACTUAL current repository.

Explicitly identify:

```text
what already exists
what partially exists
what should be renamed
what should be reused
what needs additive migration
what conflicts with this architecture
which runtime will perform real DSP/transcoding
```

Do not blindly implement pseudocode from this prompt.

Use current SoundKit conventions where they are sound.

Use current Cloudflare Workflow APIs and verify the installed Wrangler/Workers types before writing bindings.

Most importantly:

```text
Better Upload owns browser → R2 transfer.

R2 owns the media bytes.

SoundKit/Postgres owns canonical application state.

Cloudflare Workflows own durable orchestration.

The media processor owns actual DSP/transcoding.
```

The implementation is not complete until actual product surfaces use the generated assets:

```text
upload
→ Workflow
→ streaming playback
→ battle playback
→ downloads
→ Premium enrichment
→ Open Verse finalization
→ project export
```

Do not leave the new Workflows or derivatives disconnected from the application.