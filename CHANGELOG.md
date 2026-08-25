# Changelog

## Unreleased

### Added

- Added an Admin Open Verse catalog with raw legacy/media health, owner and track context, request/submission counts, and confirmed cleanup that preserves underlying tracks.
- Added scoped Explore map geographies: continental views now render only their own countries, while North America retains detailed US states with clickable Canada and Mexico outlines.
- Added global onboarding location autocomplete with Google Places (New), normalized city/region/country persistence, accessible custom suggestions, and a no-key manual fallback for local/test environments.
- Added separate Explore map scopes for USA, Canada, and Mexico, with legacy North America state migrated to USA and tighter Europe framing for northern-country visibility.
- Added production-ready regional discovery across tracks, videos, projects, artists, battles, creator streams, and listening parties, with real country/continent/US-state server filters, URL-backed Live destinations, Canada/Mexico map coverage, selected-area map zoom, and locally bundled geography assets.
- Added Admin genre and regional catalog operations: every canonical/custom genre now shows track, video, project, battle, party, and Open Verse usage; admins can add genres such as Battle Rap; and regional coverage reports surface member/upload inventory plus missing location data.
- Added short-lived Cloudflare Cache API caching for an explicit allowlist of invariant public catalog GETs, with canonical keys, CORS-safe storage, credential/private/live exclusions, and observable HIT/MISS/BYPASS headers.
- Added an expand-first upload-intent lifecycle that reserves R2 object ownership at signing, protects registration from cross-user/entity reuse, marks track/project/profile/message/ad media complete, deletes expired incomplete uploads, and reconciles every R2 listing cursor plus legacy registrations.
- Added admin moderation powers: administrators can delete an Open Verse listing (with its access requests and submissions) from the listing detail page, and delete user accounts from the admin Users panel via the better-auth admin plugin.
- Added public artist portfolio media with Feed, Tracks, Projects, Videos, and Credits tabs, including accepted performing collaborations in Also Featured On sections and accepted songwriting, production, and engineering credits.
- Added grouped credit displays: profile Credits tabs show Performance, Songwriting, and Production sections using visual media cards, and track detail pages list credits as role-labeled rows (Artist, Vocals, Written by, Produced by, Engineering) under the same groups.
- Added Open Verse closing automation: a cron sweep closes listings at their `closesAt` deadline, notifies owners and submitters, and sends a 24-hour closing-soon reminder to the owner.
- Added durable `PurchaseFulfillmentWorkflow`: Stripe webhook marks orders paid, then purchases grants, delivery emails, and in-app notifications run as idempotent retry-safe workflow steps.
- Added idempotent checkout: stable client idempotency keys (persisted per checkout intent) resolve retries to the original order and live Stripe session; Stripe session creation carries an `Idempotency-Key`.
- Added direct download links to buyer receipt emails: 72-hour HMAC-signed asset URLs (configurable TTL on the media signer) so buyers can grab files without logging in.
- Added creator rewards settlement engine: active premium subscriptions are allocated into `subscription_reward_allocations`, the pool is distributed across artists by qualified reward units into `creatorEarnings`, with first-earning and halfway-to-payout milestone emails (including a Stripe Connect reminder when payouts aren't ready).
- Added `PayoutRunWorkflow`: reserved earnings age past the 30-day window into payable, sellers above the $25 minimum receive Stripe transfers, failures email the artist and retry on the next run.
- Added artist weekly digest emails: plays, unique listeners, battles fought, and sales.
- Added track editing UX overhaul: released-track edits save without touching locked fields via a persistent "Save changes" button, an inline credits editor lives in the Collaborators tab (also used by the upload form), quick actions (cover art swap, main file swap, credits editing, monetize toggle) run from cards and detail page without opening the full editor, and new tracks default to self-credited artist + songwriter rows.
- Added orphaned-upload cleanup to the cron scheduler: uploaded R2 objects never registered as assets are deleted after a 7-day grace period, plus stale abandoned checkouts reconcile after 24 hours.

- Added fast-fail handling for media processing when the source master is missing from R2: master verification now uses a tight retry/timeout budget, terminal failures record a distinct `MASTER_OBJECT_MISSING` error code on the processing job instead of retrying a permanently missing object through Cloudflare's default exponential backoff.
- Added explicit deadlines to Media Processor Container RPC calls (inspect, loudness analysis, and render) so a container that fails to boot or a wedged FFmpeg job surfaces as a descriptive timeout error instead of hanging the workflow until the runtime cancels it.
- Added in-step terminal handling for permanently missing/stale masters in `MediaProcessingWorkflow` and `TrackEnrichmentWorkflow`: both workflows record the job failure and complete normally instead of throwing into engine-level retries, and enrichment never reaches paid StemSplit/transcription API calls without a verified master.
- Added a Credits section to the public track page below "More From This Artist" with grouped **Artists** (stage names, linked profiles), **Writers** (legal names, with split % when set), and **Producers** rows; featured artists now appear in the title byline ("with …") and in the player's artist display.
- Added artist credits and simple writer splits: `track_collaborators.credit_split_bps` migration, `artist`/`splitBps`/`alsoCreditAsWriter` support in collaborator inputs (a songwriter row is auto-created when a featured artist is also credited as a writer), an **Artist** role option with "also credit as writer" toggle and per-credit split inputs in the new track form.
- Added a Premium opt-out "Generate lyrics & stems" switch under Monetize Track in the new track distribution step; settlement only starts paid enrichment when enabled. The dashboard track lyrics tab button is now labeled "Generate lyrics with AI".
- Added media processing status badges (Ready / Processing… / Failed / Partially ready) to dashboard track cards using pipeline-aware `mediaStatus`.
- Moved the project form rights confirmation ("I own or control the rights…") from the distribution step into the Credits & Collaboration step, matching the track flow.
- Coupled purchase-gated downloads to monetization in the new track form: enabling "Require purchase" now turns on Monetize Track, and disabling Monetize clears the purchase requirement.

### Fixed

- Fixed missing R2 media references by clearing confirmed-deleted profile, track, and project asset keys after a 404, and made shared images recover when asynchronous source URLs change.
- Fixed minor AAC true-peak overshoots blocking streaming derivatives: normalization still attempts the strict -1 dBTP target, but verified encoded copies up to +0.5 dBTP are now accepted while the original master remains unchanged.
- Fixed track edit submission being blocked by the in-flight submission guard and stale status/genre validation; edit mode now preserves existing release metadata and allows draft status updates.
- Fixed Explore map React hydration failures by mounting the interactive geography map after client hydration.
- Removed the redundant Status dropdown from public Parties and Streams so Battles, Parties, and Streams each expose North America, Global, Genre, and Sort while rail-driven Live/Upcoming filtering remains URL-backed.
- Improved the Global Explore map’s flat overview sizing and centering for desktop and mobile layouts.
- Fixed Admin Genres reporting zero for persisted canonical genres by sharing persisted genre UUID resolution with discovery, and added indexes for genre-backed catalog filters.
- Fixed Arkansas profiles displaying an unknown country and disappearing from US/North America discovery by inferring United States from recognized US state names and abbreviations when country is blank.
- Fixed Explore rails stretching or bleeding the page, blank global “in” labels, contradictory Global-map callbacks, decorative continent filters, unsupported Live region links, and inconsistent Battles/Parties/Streams content spacing; global rails now read “On SoundKit” and rails snap-scroll internally.
- Fixed public profile images retaining destroyed preview URLs by deriving canonical media URLs from durable avatar/header object keys.
- Replaced multi-megabyte PNG sample covers with compact WebP assets and replaced the 805 KB avatar collage fallback with the existing 1.6 KB user placeholder.
- Fixed video comments silently failing: posting errors now surface a destructive toast with the API message, comment listings tolerate commenters without profile rows, and the video chat panel clears the fixed mobile bottom navigation so the comment input is reachable on small screens.
- Fixed legacy cover art failing to load on public track cards: the guarded media worker now serves cover art from both v2-pipeline rows (purpose "artwork") and legacy rows (assetKind "cover_art"), and the public track detail API returns canonical media-host URLs instead of stale upload-time hosts.
- Fixed track quick actions and released-track editing: main-file swaps now pass the required per-track upload metadata (previously rejected as "Invalid metadata."), cover-art swaps demote legacy NULL-purpose current rows so only one cover stays current, swapped-in masters relaunch the media processing workflow so derivatives regenerate, cover uploads send the real file MIME type, and the released-track editor picks its schema resolver at validation time so disabled Status/Genre fields no longer block saving.
- Fixed the explore home page stretching horizontally on large screens when card rails overflow; rails now scroll in place while the map keeps its full width.
- Fixed V3 True Peak correction attenuating the entire mix and pushing valid streaming derivatives below the accepted loudness range; pipeline V4 always guards AAC transient overshoot and adaptively lowers the limiter ceiling independently from loudness gain.
- Fixed media pipeline V2 consumer downloads returning a null loudness result after successful encoding, which caused four repeated renders and `Cannot read properties of null (reading 'integratedLufs')`; pipeline V3 now assigns and validates the measurement before registration.
- Raised preview media-container concurrency from 5 to 20, shortened idle sleep, preserved non-JSON Container diagnostics, and added processor stack logging so concurrent test uploads no longer surface opaque random 500s.
- Replaced vague upload/detail copy and “Variant Audio” cards with truthful upload/processing states and purpose-specific names, and blocked release actions in both UI and API until streaming media is playable.

- Replaced the browser-owned register/settle upload chain with one idempotent server finalization boundary that verifies R2 objects, records assets, saves release intent, and starts durable processing without waiting up to 15 minutes in the upload form.
- Fixed project track uploads using the project-asset namespace and detached callback timeouts; project audio now uses awaited Better Upload transfers through authenticated per-track source keys and the same atomic finalization path as individual tracks.
- Fixed premature publication and “track ready” emails: owners receive the ready notification only after playable streaming media is registered, while immediate and scheduled public releases are gated on media readiness.
- Fixed deterministic loudness failures repeatedly rendering the same derivative by preserving validation failures as Workflow step output, and disabled FFmpeg limiter auto-leveling.

- Fixed the artist profile page queueing every playable track when playing a single song; dashboard/private surfaces now always queue only the selected track.
- Fixed preview-environment media URLs pointing at a nonexistent `media-pr-<n>` host: local and PR preview stages now build asset URLs from the API origin's guarded `/media` route, while production keeps serving through the dedicated media domain.

- Added a centralized web notification dispatcher with deterministic in-app/email idempotency, preference policy, self-notification prevention, event metadata for future aggregation, and a delayed Cloudflare Queue for presence-aware missed-message email evaluation.
- Added real conversation read state and unread counts, notification-feed cursor pagination, mark-one-read support, follower live emails, video comment alerts, collaborator track-live alerts, and missing friend/collaboration/battle/Open Verse response emails.
- Comprehensively updated repository `README.md` with full technical architecture diagram, deep-dive breakdowns of all applications (`apps/server`, `apps/website`, `apps/native`, `apps/docs`) and shared packages (`@soundkit/*`), client-side MediaBunny audio engine details, Durable Object / Workflow background workers, local development guide, database operations, and quality verification gates.
- Added go-live CTA for queued battle viewers: queued users now receive an in-app notification and global toast when their battle opens, with a chooser dialog that navigates straight into the arena (auto-transition is used when watching a single queued battle from its own page).
- Raised battle admission capacity so thousands of fans can queue per live activity: the admission batch size is now configurable via the `BATTLE_ADMISSION_BATCH_SIZE` env var (default 1000) instead of a hardcoded 50.
- Added battle queue experience with persistent Postgres queue interest (`battleQueueEntries`), scheduled-phase waiting room, audio-visual battle stage countdown, batch admission between rounds, per-user queue/admission status in live room state, and Join Queue / Leave actions with navigation guard on the real battle route.
- Fixed non-voter removal boot so required-voter eligibility survives past voting close and batch admission does not run mid-round.
- Hardened Live around per-room Durable Object state, alarm-driven battle phases, authenticated role-scoped controls, synchronized party playback, Stream ingest lifecycle states, async live notification fanout, durable replay workflow scheduling, real-route premium enforcement, and shared preview/fullscreen UI contracts.
- Added battle lineup snapshot persistence, live experience lifecycle fields, compressed battle state-machine tests, and gated real live-route browser smoke coverage.

### Fixed

- Canonicalized R2-backed asset URLs against the active guarded media route so production catalogs never retain pull-request preview artwork links or omit the required `/media` path.
- Corrected the V5 AAC inter-sample peak retries so narrowly excessive True Peak encodes use available loudness headroom instead of repeatedly lowering an inactive limiter ceiling.
- Prevented pull-request previews from force-synchronizing branch-local Drizzle schemas against the shared production database, and separated preview Sentry environments from production alerts.
- Fixed autonomous battle timelines after tied rounds: completed scheduled rounds now enter sudden death or resolve the leading artist instead of advancing past the configured format, tied tiebreakers match persisted winner rules, and battle results now progress to the ended phase.
- Fixed explore search results rendering behind homepage map controls and replaced generic result icons with artist avatars, track covers, and project artwork.
- Added automatic thumbnails for linked YouTube videos and redesigned video, live-stream, and battle discovery cards around consistent horizontal 16:9 media layouts.
- Fixed mobile signup smoke navigation by using reliable document navigation for artist and fan credential links, with explicit route assertions for both paths.
- Fixed the notification badge/feed mismatch that could show unread activity while rendering an empty dropdown; unread totals now query all persisted notifications rather than only the first page.
- Resolved track upload race condition and conflicting state transitions in `NewTrackForm` and track settlement pipeline:
  - Made `@better-upload/client` and `@better-upload/server` the authoritative async upload layer using `uploadMasterAsync`, `uploadComponentsAsync`, and `uploadCoverAsync` with deterministic file matching instead of arbitrary index lookups.
  - Eliminated parallel upload progress simulation, wiring the upload modal and `FileUploadZone` directly to Better Upload's `masterProgresses` and real percentage state.
  - Centralized single-orchestrator completion in `handleSubmit`, removing premature track-level success toasts and navigation from upload callbacks.
  - Enforced backend R2 asset verification with `bucket.head` for authoritative object existence and size validation before asset recording.
  - Added user-scoped route namespace validation ensuring master audio keys conform to `tracks/${userId}/*` and cover keys conform to `uploads/${userId}/*`.
  - Hardened track settlement with typed `MASTER_UPLOAD_PENDING` response code and defensive recovery for transient upload latency.
- Stabilized Playwright E2E browser test suite (`pnpm run test:e2e`) across Chromium and Mobile Chrome runners:
  - Gracefully skipped preview smoke tests when remote API URL (`PLAYWRIGHT_API_URL` / `SOUNDKIT_E2E_API_URL`) is not configured.
  - Aligned live stream detail route assertions with the `LiveRoomAccessGuard` ("SoundKit Premium Required") overlay for unauthenticated visitors, while testing chat collapse/expand on public video detail routes (`/videos/video-1`).
  - Increased browser test timeouts to prevent parallel Vite compilation timeouts on discovery and live surfaces.
  - Stabilized Playwright `mobile-chrome` smoke tests on main application and signup surfaces by using responsive-safe locators and ensuring signup cards are scrolled into view before interaction.
  - Eliminated SSR React hydration mismatches in `TracksPage` by replacing direct render-time `localStorage` lookups with deterministic defaults.
  - Fixed TanStack Query undefined data warnings in `BattleQueueCta` by safely falling back to an empty array.

### Changed

- Unified ordinary and battle playback on one `-13 LUFS` streaming derivative, accepted from `-14` through `-12 LUFS` with True Peak at or below `-1 dBTP`; pipeline V2 also caches each source inside the processor container and removes redundant browser-generated WAV previews.
- Organized new source uploads under immutable per-user/per-track R2 keys (`tracks/{userId}/{trackId}/source/{assetId}-{filename}`).
- Changed download filenames to derive from the track title instead of the raw uploaded file: masters keep their source extension (`blunt-22.wav`), generated derivatives use `.m4a`/`.flac`, and cover art downloads as `blunt-22-cover.jpg`.
- Changed preview environments to share the single production `soundkit-media` R2 bucket instead of per-stage buckets, matching how stages share the application database: uploads from previews land in the same catalog storage, Destroy Preview removes the bucket binding from Alchemy state without deleting the bucket (`delete` is production-only), and bucket CORS uses a stable wildcard rule so stage deploys no longer rewrite each other's configuration.
- Relaxed derivative loudness verification tolerance from ±0.6 to ±1.0 LU (EBU/Apple-style delivery tolerance) so healthy two-pass loudnorm + AAC encodes are not rejected; True Peak must still be ≤ -1 dBTP.
- Clarified broad email notification preferences with new Messages and Live controls, and hid nonfunctional web push settings until a real push delivery channel exists.
- Updated repository `README.md` footer attribution to Rocktown Labs.
- Reworked `/dashboard/messages` into a mobile-app-style experience: on mobile the conversation list is the landing view, tapping a conversation opens that chat full-screen with a back button, and the list returns after back instead of forcing the first conversation open.
- Closing the floating chat bar by expanding into the full messages page now resets its state, so navigating back returns to the collapsed bar instead of an open chat.
- Reordered the dashboard mobile bottom nav to Home, Music, Create, Career, Live.

- Hardened realtime architecture with authenticated per-user presence Durable Objects, targeted presence reads, coalesced presence persistence, durable live-room chat rate limits, delta WebSocket chat events, Cloudflare observability metrics, and reactive message scrolling/TanStack DB collections.

- Reframed Friends & Collaborators as Network with distinct friends, followers, following, and requests views; separated fan and artist follower classification from music collaborators and workspace membership; replaced simulated workspace members, seat counts, and invites with persisted organization data and active-workspace authorization.

- Overhauled Artist Analytics (`/dashboard/career/analytics`) and Creator Payments (`/dashboard/career/payments`) to use 100% real, database-persisted telemetry and the existing Creator Rewards monetization architecture:
  - Retired all synthetic/manufactured analytics calculations (removed fake 72% qualified plays, fake 48h release curves, fake retention %, fake geographic distributions, fake loyalty segments, fake download multipliers, and arbitrary revenue per stream).
  - Implemented 30-Second Verified Play Rule (sessions with ≥ 30s playback, or ≥ 95% completion for tracks shorter than 30s) distinct from stricter Qualified Stream monetization events.
  - Built Listening Over Time real timeseries endpoints with metric toggle (Plays, Qualified Streams, Unique Listeners) across 7D, 28D, 90D, and 12M ranges with zero-filled inactive dates.
  - Added Track Performance table with per-track Plays, Qualified Streams, Unique Listeners, Qualification Rate, Avg Listen %, Completion Rate, and Estimated Rewards.
  - Added Audience & Loyalty analytics (New vs Returning Listeners, Returning Listener Rate, Catalog Depth, and Premium Supporters count).
  - Added Discovery Sources distribution across real playback source types and Live Impact analytics for Battles and Listening Parties.
  - Implemented privacy-safe Audience Geography (`MIN_LOCATION_LISTENERS = 3`) that buckets cohorts with < 3 listeners into "Other" and displays "Not enough location data yet" when total audience is insufficient.
  - Transformed Artist Payments page into a SoundKit Creator Earnings dashboard with real month-to-date estimated earnings, 30-day settlement reserve tracking, $25 minimum payout progress bar, monthly statements history, and embedded Stripe Connect payout rail.
- Fixed `masterUpload is not defined` runtime ReferenceError in `new-track-form.tsx` by correctly binding `selectedMasterFile` and uploaded track assets to `VisualWaveformSlotTrimmer`.
- Integrated client-side MediaBunny audio slicer (`apps/website/src/lib/media-bunny-slicer.ts`) to extract lightweight Hook & Open Verse slot snippet stubs (`.wav`) directly in the browser during track creation, uploading them as `open_verse_clip` assets to R2 and protecting full unreleased master tracks from leaks.
- Implemented Anti-Leech Guard (0-Uploads Rule) on Open Verse submissions (`/dashboard/open-verses/:genre/:id`), preventing empty accounts from submitting takes and guiding them to upload their first track or project.
- Added 3-part structured take submission uploaders (Mixed Audition Take, Raw Dry Vocal Take, and Stems/Project Archive) and direct Hook & Open Slot snippet downloader.
- Added canonical local and CI verification script `pnpm run verify` (`check-types`, `check:react-hooks`, unit/worker test suites, and production build) and aligned GitHub Actions CI pipeline.

- Fixed Dashboard career analytics computation (`/dashboard/career/analytics`) by querying both active workspace organization ID and personal user ownership (`tracks.organizationId` OR `tracks.ownerUserId`), and wiring `useAnalyticsOverviewQuery` so real stream counts, trends, and listener loyalty never show 0.
- Preserved exact user input casing on artist stage and display names across backend ranking endpoints and frontend leaderboard cards (e.g., "CG Stewart", "MF DOOM"), removing destructive title-case normalization.
- Fixed Artist leaderboard ordering: "Top Artists" ranks by overall momentum and total plays + follower count, "Rising Stars" ranks by live 7-day streams, and "New Artists" orders strictly by account join date (`authUser.createdAt DESC`).
- Formatted Recent Plays timestamps in `/library/recent` into clean, human-readable relative times ("Just now", "5m ago", "2h ago", "Yesterday", "Aug 18, 2026") replacing raw ISO timestamp strings.
- Upgraded Open Verse workflow (`/dashboard/open-verses` and `/dashboard/open-verses/:genre/:id`) with proper genre badge capitalization, audio take file picker & uploader dropzone, and stem auditioning.
- Added `VisualWaveformSlotTrimmer` component with interactive amplitude waveform bars, draggable hook start & open slot end trim markers, live playhead line, selection duration stats, zoom, and playback preview.
- Reordered Step 1 of New Track creation (`/dashboard/tracks/new`) so Cover Artwork is positioned at the top before metadata fields, and enforced cover art requirements for public releases with automatic SoundKit placeholder fallbacks for drafts and open verses.
- Updated Listening Party interactive preview (`/live/preview`) with fan-mode quick-save (`+` / Save to Library) controls on the synchronized player and tracklist rows while reserving replay actions for host perspective.
- Fixed track duration backfill scanner and duration resolution in `mapTrackSummary` to evaluate all audio asset kinds and fall back to existing audio durations on track cards.
- Cleaned up new track upload form (`/dashboard/tracks/new`) to keep dropzones clean and streamlined.

- Implemented "Auto-Play to Unlock" UX flow on track detail downloads: when a download is attempted on a track requiring first play, playback starts automatically in the music player accompanied by a guidance toast so fans can unlock and download files immediately.
- Added individual track saving (`+` / Save to Library) and stream actions across Project / Album tracklists (`/projects/:id`), enabling fans to bookmark specific album tracks to their library.
- Enhanced Listening Party fan controls (`/live/parties/:id`) by replacing host replay buttons with instant `+` / Save to Library buttons in both the synchronized player bar and tracklist.
- Upgraded Explore, Projects, Tracks, and Videos collection grids to a responsive 2-column base layout (`grid-cols-2` on mobile) eliminating single-column full-width stretching and excessive empty space on mobile browsers.
- Implemented smooth infinite scrolling across Artist leaderboards (`/artist/rising-stars`, `/artist/new`, `/artist/top`), Tracks (`/tracks`), Videos (`/videos`), and New Releases (`/new-releases`) using TanStack Infinite Queries and reusable `InfiniteScrollSentinel` with `IntersectionObserver`.
- Added dynamic 7-day live weekly play aggregation and sorting for rising artists on `GET /v1/artists` and `GET /v1/artists/:username`, with fallback to total play counts.
- Connected real stream playback counts into dashboard track listings and `/v1/analytics/overview` so creator dashboard analytics and career statistics accurately display all-time streams, retention, and listener loyalty.
- Enhanced public track and release ordering to prioritize releases published within a 30-day window while seamlessly falling back to catalog tracks.
- Integrated client-side `mediabunny` and `@mediabunny/aac-encoder` audio studio engine for instant in-browser audio metadata reading, waveform peak generation, and WebCodecs/WASM AAC preview optimization.
- Added browser-based `BrowserStudioRecorder` (Beta) component with live VU meter visualizer, device selector, real-time waveform inspection, and one-click take attachment to track uploads.
- Added dedicated unit tests in `track-settlement.test.ts` for non-complete public track visibility, soft-archiving deletion protection when purchases exist, and Whisper payload slicing.
- Implemented "Settle First, Enrich Later" pipeline for tracks and projects: newly uploaded public tracks are immediately discoverable and playable across Explore, Map, and Search without waiting for external AI workflows, and public query productionStatus restrictions have been removed.
- Made OpenAI Whisper lyric transcription resilient to large uncompressed WAV vocal files (> 25MB) by slicing audio payloads within Whisper size limits and isolating transcription errors so tracks always remain published, playable, and healthy.
- Preserved lifetime buyer library access when creators delete tracks by archiving/unpublishing rather than cascading deletion of purchased media assets.
- Optimized database query performance and eliminated Cloudflare Worker hanging on `GET /v1/messages/friends` (replacing unindexed dynamic CASE WHEN join with separate indexed lookups) and added query bounds to `GET /v1/battles`.
- Synced dual-channel alerts across billing, battles, payouts, and collaborations: added in-app notifications for failed subscription invoices (`/dashboard/billing`), in-app battle starting soon and results recap alerts (`/live/battles/:id`), Stripe Connect payout requirement alerts (`/dashboard/settings/payouts`), and companion transactional emails for accepted collaboration proposals.
- Fixed collaboration invites and notifications to ensure emails and in-app alerts are delivered exclusively to recipient collaborators and never to the creator/owner when adding credits, sending chat `/collab` proposals, or scheduling live events.
- Added full collaborator workspace access and editing permissions across track and project details (`GET`, `PATCH`, `assets`, `lyrics`) so invited collaborators can immediately view, edit, and contribute to shared workspaces.
- Fixed floating chat and messages page `/collab` command handling to automatically parse proposal titles, deliver email notifications to target chat participants, and notify the owner upon collaborator acceptance/rejection.
- Fixed floating chat and messages page `/share` command to preserve user's typed message alongside attached music and send both body text and track attachment seamlessly.
- Fixed direct message conversation deduplication and title resolution so multiple threads between the same users are merged into a single thread and displayed with the artist/friend's real name instead of "Untitled conversation".
- Implemented zero-RAM fast audio duration header parser supporting WAV (RIFF `fmt`/`data` chunks), MP3 (ID3v2 tags and Xing/VBRI/CBR frames), and FLAC (`STREAMINFO` block) in `< 1ms` via R2 byte-range requests (`bytes=0-131071`) to eliminate Cloudflare Worker 128MB OOM crashes during media uploads and duration backfills.
- Added admin track duration backfill fallback supporting background execution via `executionCtx.waitUntil(...)` when queue bindings are omitted.
- Fixed StemSplit track processing workflow by requesting vocals only (`outputType: "VOCALS"`), removing unnecessary stem storage, making stem asset database writes idempotent via `onConflictDoUpdate`, and automatically publishing tracks upon completion when marked for immediate release.
- Fixed interactive discovery map region syncing across homepage sections, tracks, videos, projects, and artist routes with bidirectional URL search parameter propagation and global/regional filter persistence.
- Fixed live chat `UserProfilePreviewModal` to query dynamic artist profile stats (real avatar, bio, follower count, track count) and styled role badges for high contrast.
- Fixed audio playback on shared music attachments by routing track payloads through `useAudioPlayer` context methods (`setCurrentTrack`, `setQueue`, `setIsPlaying`).
- Fixed sender perspective in floating chat collaboration proposal cards to correctly display Cancel / Open actions instead of Accept / Decline.
- Enabled invited and accepted collaborators to sequence project tracklists and update project metadata in `/v1/projects/:projectId`.
- Cleaned up draft project workspaces on collaboration decline and cancellation so unused drafts do not clutter the dashboard.
- Fixed floating chat music picker reference error by scoping uploaded/saved tracks queries and resolving valid playable track URLs.
- Fixed attachment schema validation failure when sending library tracks in messages by ensuring playback and download URLs are always populated.
- Fixed HTTP 500 / CORS error on `GET /v1/messages/friends` and conversations by safely serializing timestamps across all database date formats.
- Made draft collaboration workspaces real accessible projects in `/dashboard/projects` for both owners and invited collaborators with `POST /v1/projects/:projectId/tracks` file upload integration.
- Fixed project activity status entry text to prevent duplicate "draft Draft" labels.
- Remediated E2E test credential environment variable references in git history to comply with security secret scanning gates.

### Added

- Redesigned Listening Party stage with Apple Music-inspired layout: prominent album artwork on the left, synchronized audio player status header directly above the tracklist on the right, and full scrollable tracklist with quick Like, Save, and Buy actions.
- Added inline `/share` tabbed music library and platform explore picker directly above the chat composer in both `FloatingChatBar` and `MessagesPage`.
- Added inline `/collab` proposal creation popover allowing instantaneous collaboration invitations without dialog redirects.
- Upgraded Live Battle Arena preview with realistic 3-minute performance turns, switchover transitions, 2-minute audience voting windows, Kit vs Kit showcases, and artist next-track selection.

- Rebuilt floating chat widget into an Instagram-style direct messaging drawer: single unified search & inbox list, real-time presence indicators, click into conversation detail with back arrow, enlarge button to `/dashboard/messages`, and floating music player clearance.
- Added Collaboration Proposal Cards in chat with 24-hour expiration countdown, recipient Accept / Decline actions, proposer Cancel action, and workspace unlocking.
- Rebuilt Listening Party media stage into an integrated audio player centerpiece with Synced Lyrics & Tracklist tab switcher, fan save/purchase controls, host replay controls, and full-album purchase action.
- Upgraded Battle Arena with Best-of-3 round progression, lobby waiting state, fresh per-round fan vote resets, and celebratory match victory banner.
- Integrated real authenticated user profile resolution in chat `UserProfilePreviewModal` and applied default SoundKit branding banners across live stream and video fallback views.
- Added slash command support (`/collab [title]`, `/share`, `/help`) and file/music attachments across `FloatingChatBar` and `MessagesPage`, enabling instant creation of shared draft project workspaces with invite notifications and owner-only delete permissions.
- Added in-page `UserProfilePreviewModal` for previewing artist bio, followers, role, and follow actions directly from live battle contender cards and live stream chat without leaving the room.
- Restructured `/live/battles/$id` to position match metadata directly under the video, side-by-side 2-column voting buttons on mobile and desktop, and removed the single-artist creator panel.
- Reordered and expanded the homepage discover feed with 8 curated sections following the interactive map: Top Songs, New Releases, Live Battles, Top Artists, Featured Videos, Live Streams, Featured Projects, and Upcoming Listening Parties.
- Added safe bottom clearance (`max-lg:pb-24`) to `LiveChatPanel` message input bars to prevent obstruction by the fixed mobile bottom navigation bar (`ExploreMobileNav`).
- Added default sleek pitch-black header banner (`/soundkit-default-banner.svg`, 1500x500 standard dimension, 3:1 ratio) with centered SoundKit logo across profile shells and public artist pages.
- Added global `FloatingChatBar` provider for authenticated artists with dynamic clearance above the mobile audio player (`bottom-28 sm:bottom-6`), quick Friends/Chats tab switcher, and 1-click conversation starter.
- Added audio output device selector in `MusicPlayer` with real-time Bluetooth, headphones, and speaker enumeration (`navigator.mediaDevices.enumerateDevices` + `devicechange` events) and active output indicator.
- Added desktop accessibility tooltips across all music player controls (mini-player & full player).
- Added chat file and saved/purchased music attachments, attachment persistence, and one-click shared track/project workspaces with accepted collaborator permissions and notifications.
- Replaced Admin Ads prompt-only controls with real zero-budget house campaign creation, creative uploads/previews, and active/paused controls; repaired artist campaign payloads, media uploads, wallet display, real creative library, and uploaded-track promotion selection.
- Added onboarding and account-setting media layout preferences, with card/compact-list rendering across artist track, project, video, dashboard, and public profile collections.
- Added deduplicated in-app and transactional-email fan-out to pre-savers, artist followers, and profile followers when tracks, projects, and videos release or listening parties are scheduled.
- Simplified listening parties to scheduled, non-empty album/project or fan-playlist rooms; scheduled Premium artist projects now create release parties automatically, while Premium fan sources and artist video/chat presence remain explicit.
- Added public fan profiles, fan-to-fan follows, follower notifications, and account-aware My SoundKit profile/dashboard navigation.
- Added Premium-only battle opponent search by artist name/handle, native date/time challenge scheduling, acceptance-created public battle schedules, challenge status notifications, and profile challenge compatibility.
- Added Cloudflare Stream live-input status synchronization so OBS connection/disconnection drives public Live/Ended state and scheduled stream pages show the actual player only when broadcasting.
- Unified `/live`, battles, streams, and listening parties around real Featured, Live Now, Upcoming, filterable view-all, and genre collection rails; added live-experience genre persistence and removed dummy mobile live overview data.
- Added draft track/project quick-release actions and project track sequencing controls directly to dashboard detail pages.
- Added persistent Recently Played history to the web player, consumed completed queue entries, reliable single-track restart behavior, next-track metadata preloading, and a compact mobile player layout.
- Added Accounts v2 Stripe Connect onboarding for Premium artists, a Career Payments workspace with embedded payment and payout management, post-Premium routing, destination Checkout readiness checks, and artist payment setup prompts.
- Reworked admin Premium management around the two equal-price Fan and Artist Premium plans, including searchable multi-user grants, subscription visibility, welcome notifications and email, plus live Stripe promotion-code creation and redemption reporting.
- Added real Cloudflare Stream playback to public creator stream rooms, persisted live-input IDs, live status polling, and host-controlled input shutdown.

- Added automated Stripe product and recurring price creation upon catalog sync in Admin Payments (`POST /v1/admin/finance/payments/sync-plans`), auto-matching existing products/prices and provisioning sandbox catalog IDs in development mode.
- Added a RealtimeKit presets setup script (`packages/infra/realtimekit-presets.ts`) that creates or updates the eight SoundKit presets (battle lobby/artist/voter, party host/listener, stream host/viewer) via the Cloudflare API using Alchemy credentials, with `--dry-run` and `--delete` modes, strict app selection, and checked mutation responses.

### Added

- Redesigned creator stream and live hub cards to Twitch-style 16:9 poster cards with live pulse rings, viewer pills, source tags, genre badges, and streamer avatars.
- Connected live rooms and creator streams to real database snapshots (`liveExperiences`, `listeningParties`, `projectTracks`, and creator profiles) in `/v1/live/rooms/:roomId` and `/v1/live/experiences/:experienceId`, removing dummy fallback tracks and lyric mocks.
- Positioned Settings as strictly the final menu item in the "My SoundKit" explore sidebar navigation.
- Added Twitch-density 5–6 column responsive grids across live shelves and rails (`ExploreCollectionSection`, `ExploreCollectionGrid`, `BattleRail`).
- Redesigned Listening Party cards to high-fidelity album cover art posters with synchronized playback status, host badges, listener counters, and hover play triggers.
- Added artist "Active & Scheduled Streams" workspace in `/dashboard/live/streams` with real-time stream state, direct live room navigation, and typed `"CANCEL"` confirmation dialogs.
- Added typed `"CANCEL"` and `"FORFEIT"` confirmation modals across Dashboard Live Streams, Listening Parties (`/dashboard/live/parties`), and Battle matchups (`/dashboard/live`).
- Added sticky collapsible Twitch-style chat sidebar and creator panels (`LiveTwitchShell`, `LiveCreatorPanel`) across live streams, listening parties, live battles, and video detail pages (`/live/streams/$id`, `/live/parties/$id`, `/live/battles/$id`, `/videos/$id`).
- Added interactive Live Preview testing hub (`/live/preview`) with view switchers (Battle, Stream, Party, Video, Challenge), perspective toggles (Artist vs Fan), live chat testing, and stage simulators.
- Added automated in-app notification fanout to artist followers on stream creation and upon OBS encoder connection (`syncCloudflareStreamStatus`).
- Added sliding-window message rate limiting (max 5 messages per 5 seconds) in `LiveRoomDurableObject` chat room coordination.

### Fixed

- Filtered stale scheduled live streams (>3 hours past start time without active broadcast) from the public `/v1/live/experiences/public` endpoint.
- Fixed genre rail filtering across live hub, creator streams, and listening parties with normalized genre slug matching (`normalizeGenreValue`).
- Fluidly scaled live battle and listening party card widths to fit multi-column responsive breakpoints without container overflow.

### Fixed

- Fixed temporal dead zone `ReferenceError: Cannot access 'a' before initialization` in `apps/website/src/app/dashboard/admin.tsx` when accessing Payment Plans by declaring `monthlyCheckoutReady` prior to `checkoutReady`.

- Fixed global toast notifications across all admin and dashboard actions (including Premium user grants and Stripe catalog sync) by bridging `use-toast` callers directly into the active Sonner toast provider.
- Fixed `/dashboard/messages` Friends Online bar by defining `onlineFriends` and `isUserOnline` in `MessagesPage` and removing unused lucide imports.
- Fixed the `use-toast` adapters at `@/hooks/use-toast` and `@/components/ui/use-toast` to share a single ID generator and Sonner store, so notifications from either import path no longer replace or dismiss each other.
- Wired synced catalog Stripe IDs into the Better Auth checkout plan source, so checkout works from the catalog immediately after a catalog sync without deploying environment price IDs; deployed env price IDs still take precedence, and dev-sandbox `price_dev_*` placeholders never satisfy checkout.
- Fixed Stripe catalog sync so dev-sandbox `price_dev_*` placeholders never overwrite genuine Stripe IDs and are auto-discarded once a live `STRIPE_SECRET_KEY` is present, reused recurring prices must be USD, and the admin catalog reflects real checkout readiness (env-provided or synced catalog IDs).
- Fixed Stripe catalog sync results to report plans whose Stripe IDs were unchanged as `matched` (checked & up to date) instead of claiming every plan was newly created.

- Fixed floating artist chat bar by redesigning it as a compact circular docked trigger button at the bottom-right corner when closed, docking cleanly above the audio player when music is active to prevent obstruction of playback controls, and adding generous tab/chat button padding.
- Enhanced audio player device selector with Bluetooth/AirPods name permission unlocking (`getUserMedia` label resolution), AirPlay/HomePods network casting triggers (`webkitShowPlaybackTargetPicker` / `selectAudioOutput`), and added output device selection to the mobile player control bar.
- Fixed explore route navigation headers across Top Songs, Projects, Music Videos, New Releases, and Live Battles by removing redundant `< Back` buttons and standardizing on clean icon-and-title headers.
- Fixed floating artist chat bar to hide automatically when navigating to `/dashboard/messages`, and removed boilerplate `"Hey! Let's connect on SoundKit."` automated greeting when starting direct chats.
- Fixed Career Analytics Top Cities and Listener Loyalty Segments to show clean empty states when no catalog plays exist, dynamically calculating real loyalty distribution percentages and local city metrics once streams are tracked.
- Fixed database user search and friend relationship awareness in `/dashboard/messages` New Chat modal, enabling multi-participant group chats, relationship badges, and server-side profile search.
- Replaced mock dummy trend data in `/dashboard/career/analytics` with dynamic stream trends, source distributions, 48h release curves, and granular duration retention calculated from the user's real track plays and catalog.
- Overhauled the Admin Payments dashboard tab with a fully responsive layout: consolidated Payments Health and Stripe actions into a unified header card, replaced overflowing HTML tables in the Subscription Catalog with responsive plan cards, resolved overlapping price ID input labels, and added copy-to-clipboard helpers for environment variable keys.
- Fixed friend request acceptance and decline handling (`PATCH /v1/messages/friend-requests/:requestId`) to gracefully handle existing states, prevent 404s on pending requests, and ensure proper notification dispatch.
- Added URL-synchronized tabs (`?tab=all|collaborators|friends|requests|following`) to `/dashboard/collaborators` with separate views and counters for Track Collaborators, Mutual Artist Friends, Incoming/Sent Requests, and Followers.
- Fixed friends data parsing in `/dashboard/messages` New Chat modal and added active online presence bar with 1-click direct messaging from the collaborators workspace (`?friendId=...`).
- Kept unfunded artist ad campaigns out of serving, enabled global house-ad matching, stopped non-repeat queues at the final track, made failed release-email queueing retryable, used local party scheduling minimums, and rejected duplicate project reorder IDs.
- Fixed the listening-party dashboard SSR crash, refreshed live-surface E2E expectations, and restored admin user fixtures for static browser tests.
- Fixed Tracks Featured View All navigation so Back returns to the originating Tracks sections instead of a previously visited Projects route.
- Stopped restoring abandoned track/project creation attempts from local storage; confirmed navigation now discards temporary track records while explicit Draft publication remains private and editable.
- Fixed preview-deployment downloads for media stored in the canonical production bucket while preserving authenticated first-play and purchase access rules.
- Standardized newly created track download defaults across standalone and project-created tracks: authenticated users must play once before downloading, while free tracks are not purchase-gated.
- Fixed RealtimeKit preset provisioning by sending the complete required config, permissions, and UI payloads.
- Fixed webhook registration to auto-discover the SoundKit RealtimeKit app when the optional app ID variable is not configured.
- Added a manual GitHub Action for registering or removing the RealtimeKit webhook, and corrected webhook updates to use the RealtimeKit PATCH API.
- Added production and suffixed-preview queue routing for duration backfills, plus focused coverage for queue-name classification.
- Added track and project listening-access fields for the monetization model: free/public listening or Premium/purchased-only listening with optional exclusivity expiration.
- Added deterministic first-30-second WAV preview generation for track and project uploads, protected master URL gating, and VOD playback qualification sessions tied to source tracks.
- Added preview URLs to public track summaries so protected tracks remain previewable without exposing masters.
- Added a public SoundKit recording watermark asset and corrected RealtimeKit watermark configuration for bottom-right placement.
- Added a dedicated Cloudflare Stream API token binding and improved admin/Stripe/backfill diagnostics.
- Persisted live experiences (`live_experiences`) with RealtimeKit meeting ids, viewer/peak viewer tracking, recording and chat download links, plus a verified RealtimeKit webhook endpoint (`/v1/webhooks/realtimekit`) that marks meetings live/ended, publishes uploaded recordings as free public videos (battle replays included), and fans out go-live notifications to artist followers and premium watchers.
- Wired live experience creation and join flows to persisted meetings, gated listening party hosting behind a premium subscription (artists exempt), and upgraded BattleBot to a real round state machine with waiting-room admissions, non-voter boots, and winner resolution.
- Updated artist battle records (wins/losses) after a battle ends when peak concurrent viewers reach 10.
- Enhanced Project Creation with non-closing multi-select checkboxes for library tracks, aligned credits step with 1-click self-crediting, and fixed "Save Draft" button to store drafts with `status: "draft"` instead of publishing.
- Created public `/projects` explore route and public album detail route (`/projects/$id`) with album/EP/mixtape type chips, search, genre filtering, and full tracklist stream controls.
- Added Projects section under Songs on the home page (`/`) and added Projects link to public navigation sidebars.
- Unified Calendar and Release & Promo Kanban into `/dashboard/career/calendar` with 1-click "Battle Challenge" action buttons on Kanban cards.
- Filtered out current user (`me.user.id`) and unaccepted friend requests from `/dashboard/collaborators` and `/dashboard/team` lists, ensuring collaborators reflect credited track contributors.
- Updated `/v1/analytics/overview` endpoint to calculate real dynamic stream counts, followers, downloads, and revenue from database rows.
- Re-housed Ads manager to `/dashboard/ads` with Active Campaigns management & campaign detail inspector, 3-step Accordion Campaign Builder flow, direct file uploads with media player preview, macro region continent selection (All North America, All Europe, All Africa, Global), and Stripe-wired wallet top ups.
- Added Admin House Ad creation (zero budget required) and campaign run status toggling in `/dashboard/admin`.
- Added Recharts interactive stream area chart, discovery sources stacked area chart, geographic reach horizontal bar chart, and listener loyalty breakdown (Super Listeners vs Casual vs Lapsed) to `/dashboard/career/analytics`.
- Added workspace rename endpoint (`PATCH /v1/me/workspace`) and upgraded `/dashboard/team` with workspace name editing, 5 subscription plan seats management, and separation of track collaborators.
- Fixed Account settings email input password manager autofill with readOnly & autoComplete off attributes, added URL search param tab syncing (`?tab=profile|account|notifications|privacy`), and persisted profile photo/header image previews with instant query invalidation.
- Added persistent track saving endpoint (`POST /v1/library/saved/:trackId`) and interactive heart save controls in `TrackCard` and track detail views.
- Added full playlist management backend (`POST /v1/library/playlists`, `POST /v1/library/playlists/:id/tracks`) and updated `/library/playlists/$id` with tabs for DB search, Saved Tracks, Recently Played, and Recently Watched.
- Redesigned `/shop` page with `forSale` purchasability filtering, clean genre pill filters, Grid/List view mode toggle, and 20-item pagination.
- Fixed play count calculations on artist profiles to calculate the true sum of all track plays.
- Removed outdated location filter text from public `/tracks` header.
- Added transactional email templates suite (battle challenge, reminder, results, billing issue, collaborator invite, verification, friend requests, followers, open verse, org invite, password reset, receipts, sale notifications, welcome emails) and an asynchronous email delivery outbox service with retry/event tracking (`email_delivery_outbox` table).
- Added artist friend requests system with collaborator management endpoints and dashboard workspace.
- Expanded AI Studio with prompt assistant, stem generator, AI voice models, master track enhancement, and credit usage tracking.
- Added purchase detail view (`/library/purchased/$purchaseId`) for audio license downloads and item details.
- Added Resend-backed track lifecycle emails with React Email templates, a local transactional email preview package, notification preference controls, and a verified Resend webhook endpoint.
- Added a dashboard lyrics workspace for artist-entered sectioned lyrics, draft sync points, manual timestamp editing, pending revision saves, and synced lyrics approval.
- Added OpenAI timestamped vocal transcription after StemSplit processing, storing word-derived timed lyric lines for track playback and live overlays.
- Added persistent AI credit grants and real admin finance actions for Stripe coupon syncing, premium grants, and credit grants.
- Added React hook import smoke protection to CI to catch missing hook imports before browser smoke tests crash.
- Added POST /v1/admin/finance/payments/grant-premium endpoint enabling admins to grant active premium subscription rows to users.
- Added "Grant Premium Access" action and real coupon view to the admin finance dashboard UI.
- Added Open Verse Submissions Review Desk to `/dashboard/open-verses/$genre/$id`, enabling creators to audition contender vocal takes and accept them directly into official track credits and splits.
- Added Open Verse toggle sync (`isOpenVerse`) to `PATCH /v1/tracks/:trackId` for enabling or closing open verse listings on existing tracks post-creation.
- Added secret unlisted link sharing mechanism for private tracks so non-members can stream full-quality audio via direct link without logging in or appearing in public explore feeds.
- Added global Keyboard Shortcuts System (`KeyboardShortcutsProvider`) featuring `Cmd+K` command search palette, `?` shortcuts cheat sheet, and input-protected media hotkeys (`Space`, `M`, `Shift+Left`, `Shift+Right`).
- Added Mini Player floating pill widget and interactive reorderable/clearable queue drawer with persistent local storage.
- Added pre-commit `lefthook.yml` quality gates (`oxfmt`, `oxlint`, `check-types`) and gated `package.json` build script.
- Added `GlobalErrorFallback` component to root TanStack router configuration to gracefully capture unexpected client exceptions.
- Added deferred upload support for projects and tracks, delaying R2 bucket asset uploads until form submission.
- Added an "Open Verse" configuration switch to the track wizard, enabling inline publishing of open verse slots on submission.
- Added real-time creator battle statistics to the dashboard live metrics, replacing placeholder mock stats.
- Added a detailed track battle history page displaying matchup vote counts, viewer stats, and round results.
- Integrated Cloudflare Stream live broadcasts in the dashboard, enabling stream initialization, RTMPS/SRT configuration panels, and live video previews.
- Added admin Stripe subscription catalog controls for viewing payment health, syncing missing Stripe products and prices, and importing existing Stripe price IDs.
- Added playback qualification foundations for 70% Premium stream rewards, annual Premium pricing defaults, artist-only uploads, and pending-review ad campaign defaults.
- Added demo WAV playback fixtures and persistent media player routing so track preview flows can be reviewed before live uploads are tested.
- Added project agent workflow guidance covering skill discovery, GitHub issue tracking, PR flow, quality gates, and changelog expectations.
- Added local draft persistence and an unsaved-changes navigation guard to the track and project creation wizards, blocking accidental exits while forms are dirty and restoring drafts on return.
- Added a `db:seed:demo` script that seeds the demo WAV fixtures as public, playable tracks owned by a chosen artist profile for playback and stream qualification testing.
- Added a "Back to App Home" link and home-bound brand link to the dashboard sidebar for escaping the dashboard route.
- Added a "Reset Draft" button to the track and project creation wizards when a draft is restored from `localStorage`.
- Added Release Schedule controls (Immediate vs Scheduled Release Date) to the track creation wizard, displaying expected release dates on the track completion screen.
- Added an Upload & Processing progress overlay modal during track submission, ensuring real asset registration and automatic navigation to the track details page with instant playback.
- Added real user notifications engine with `userNotifications` and `trackPreSaves` database tables, OpenAPI routes (`GET /v1/notifications`, `POST /v1/notifications/read-all`, `POST /v1/tracks/:id/pre-save`), and live header bell dropdown.
- Added track confirmation page share link copy functionality and AI time-synced lyrics transcription & battle transcript generator.
- Added mobile-responsive compact track page layout with direct "Buy Now" checkout and "Add to Cart" actions.
- Added URL search parameter synchronization across all Explore list routes (`/tracks`, `/artist`, `/videos`, `/shop`, `/live/battles`, `/live/parties`, `/live/streams`), preserving region, genre, and sort filters across page reloads and link sharing.
- Added live debounced search to `ExploreHeader` with categorized dropdown results for Artists, Songs, Projects, and Battles.
- Added 1-Hour daily guest playback meter for unauthenticated listeners, pausing playback and displaying a sign-up modal when the free daily limit is reached.
- Added automatic login redirects for unauthenticated users navigating to "My SoundKit" library routes while preserving free browsing of all explore routes.
- Added an admin-controlled Explore default setting so `/` can start the existing map home with app-wide totals by default, with Arkansas/local discovery still available as the fallback mode.
- Added a Live Studio setup flow for battles, parties, and streams with stream details, audience feature toggles, encoder credentials, chat preview, and stream health panels.
- Added app-wide genre rails across tracks, videos, artists, shop, and live discovery routes so every supported genre has a horizontal section and filtered view-all link.
- Added dynamic Better Auth base URL and Cloudflare preview origin allowlists so PR previews and worker subdomains can authenticate against the API.
- Added separate RealtimeKit-oriented live dashboards and room scaffolds for battles, listening parties, and streams, including BattleBot lobby/voting rules, party playlist/lyrics cues, stream analytics panels, and artist-only profile challenge actions.
- Added authenticated live experience APIs for RealtimeKit meeting creation, participant preset tokens, BattleBot voter snapshots, notification fanout payloads, and single-session conflict checks.
- Added region-slug canonical URLs for track and video detail pages (`/tracks/$regionSlug/$slug`, `/videos/$regionSlug/$slug`), with id-or-slug server resolution and legacy `/$id` routes retained as wrappers.
- Added a video comments system with a `video_comments` database table, authenticated `GET/POST /v1/videos/:videoId/comments` endpoints, and a comments section on the video detail page.
- Added genre and visibility controls to the video upload form and a unique `videos.slug` column for canonical video URLs.
- Added a queue drawer with reorder, clear, and remove controls, a native share sheet with clipboard fallback on track pages, and ready-cover-first download actions in the track download manager.

### Changed

- Reworked the public home and live discovery surfaces to use real API-backed tracks, projects, videos, artists, battles, and listening parties with empty states instead of placeholder cards.
- Replaced the artist floating chat mock with real API-backed conversations and messages, restricted the widget to artist accounts, and added fan-accessible sign-out from Account Settings.
- Made battle challenge issuance persist challenge records and notify the challenged artist, with consistent Premium Artist gating across challenge entry points.
- Reworked the dashboard video upload flow to use resumable UpChunk chunked uploads to Mux, client-side file validation, live progress bars, and real project/track linkage instead of mock history.
- Redesigned the admin payments tab around payment health, a compact subscription catalog, clearer Stripe actions, and improved coupons/grants management.
- Updated RealtimeKit REST client response handling to match Cloudflare's standard payload shape (`data`) and documented meeting fields.
- Removed fake working rooms, demo catalog fallback audio, and placeholder Stripe prices/coupons across RealtimeKit, tracks, admin finance, and billing APIs.
- Formatted repository codebase with oxfmt.
- Updated all track and video list links across explore, shop, and dashboard surfaces to use canonical region-slug URLs when available, falling back to legacy id routes.
- Converted track and video detail pages from route components into shared prop-driven `TrackDetailPage`/`VideoDetailPage` components reused by both canonical and legacy routes.
- Reworked the missing track duration backfill into an asynchronous queue job (`track-duration-backfill` + DLQ) with per-asset `workflow_jobs` rows, retries, and a live admin status endpoint (`GET /v1/admin/tracks/backfill-durations/status`) that the dashboard polls until the background run completes.
- Added a `soundkit-recordings` R2 bucket with a scoped upload token and wired `RECORDINGS_*` bindings onto the server for live recording storage.
- Delayed live-experience recording publication so uploaded RealtimeKit recordings become public videos one hour after upload: the webhook schedules a `live_recording_publish` `workflow_jobs` row, a cron sweep copies the file into the persistent public media bucket, and only then creates the video (battle replays included), retrying failed copies.
- Added client-side cover image recompression (`optimizeCoverImageFile`) that downscales and re-encodes track cover art to JPEG/WebP below ~1MB before upload, so stored covers and social previews are fast and lightweight.
- Enriched track social share metadata with music-specific Open Graph/Twitter tags: `og:image:secure_url`, `music:duration`, `music:musician`, `og:audio`, `og:locale`, `twitter:site`, and `twitter:image:alt`, plus a track duration in JSON-LD `MusicRecording` and a richer social description.

### Fixed

- Fixed the mobile music player spacing so expanded and minimized playback controls give the current track title and artist more room, and expanded mobile public/dashboard navigation coverage.
- Fixed live experience creation (`POST /v1/live/experiences`) returning `503` on preview workers by binding `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_REALTIMEKIT_APP_ID` to the server Worker, enabling mock RealtimeKit fallback on preview stages, and falling back to a mock Stream live input for OBS streams when Cloudflare Stream is unavailable.
- Improved public item share metadata for tracks, projects, and videos so social cards use the real title, creator, cover artwork, canonical URL, and structured data.
- Fixed track save hearts with optimistic visual feedback, toast confirmation, and click-locking while saves are in flight, and simplified saved-library dates.
- Fixed the project creation release plan with explicit listed/unlisted visibility, calendar scheduling at midnight, and clearer submit validation feedback.
- Fixed project creation track selection spacing, track-style collaborator invites, and project collaborator persistence.
- Fixed the new project page crash when restoring a saved draft by stabilizing project form defaults, reusing artwork preview object URLs safely, and disabling placeholder PostHog initialization that spammed `/ingest` 404s without capturing useful diagnostics.
- Fixed the `/dashboard/videos/new` infinite-loop crash (React error #185) caused by the new-video draft guard restoring an inline `defaultValues` object identity into `form.reset()` on every render; the guard now restores from a stable ref.
- Fixed social share card quality for tracks by generating Facebook/Google-friendly descriptions (80–150 chars), emitting image dimension hints only for the known 1200×630 fallback card, and compressing uploaded cover art so `og:image` is no longer a multi-megabyte square file.
- Fixed audio settlement follow-up behavior so free artists publish once audio and cover art settle, premium artists continue into StemSplit/transcription, artists receive in-app live/processing notifications, and admins can backfill missing track durations.
- Fixed audio upload publication so tracks and project tracks are first saved as private intake records, get master/cover assets attached with Media Bunny duration metadata, then settle into the processing workflow before becoming live.
- Fixed new track pages crashing when restored drafts omitted `status`, and made track/project artwork selectors consistently square, centered, and image-first.
- Fixed new track submissions retaining stale local draft/media metadata and failing to attach uploaded cover artwork to the persisted track asset record.
- Fixed cover artwork upload cards rendering as wide clipped previews by using a square image-first layout with visible artwork controls.
- Fixed browser multipart uploads crashing on R2's part-upload response (`TypeError: null is not an object (evaluating 'getResponseHeader("ETag").replace')`) by exposing the `ETag` response header through the media bucket CORS rule so `@better-upload` can read it when building the complete-multipart request.
- Fixed uploads failing before R2 storage by validating JSON request bodies against a cloned stream so the original body remains readable by the signed-URL upload handler instead of returning `400 Invalid JSON body`.
- Fixed Mux webhook retries dead-locking by only short-circuiting already-processed or ignored events and marking failed event rows so Mux's retry queue resumes, and by persisting a derived thumbnail URL when `video.asset.ready` fires.
- Added a `DELETE /v1/videos/:videoId` endpoint with ownership checks and Mux asset/upload cleanup, plus a dashboard delete confirmation dialog wired to it.
- Fixed the genre selector collapsing to a single option by merging persisted genre rows with the full fallback catalog so the dropdown always shows every supported genre.
- Fixed track and project wizard uploads hanging for up to two minutes when a file upload to object storage fails by wiring `onUploadFail` handlers that surface the error and resume submission immediately.
- Added signed-URL upload trace logging (`upload_signed_url_requested`/`_issued`/`_rejected`) so Cloudflare invocation logs show upload request outcomes per route.
- Fixed track and project creation so server drafts are created before large R2 uploads, staged files upload on Complete, saved drafts appear in dashboard lists, and failed uploads leave recoverable draft records.
- Fixed track and project delete actions with title-confirmation dialogs, visible deleting state, and list revalidation.
- Fixed track and project upload persistence so submitted cover art and audio/project assets create durable asset rows instead of disappearing after form submission.
- Fixed the dashboard track transcription button so it queues the real processing workflow instead of rendering fake lyrics.
- Fixed route string drift in the dashboard live track stats route.
- Fixed Sentry issue `SOUNDKIT-WEB-A` (`ReferenceError: Can't find variable: toast`) on track detail page.
- Fixed missing `challengeSearch` and `challengeSchedule` state declarations in `LivePreviewShowcase`.
- Fixed cart provider allowing multiple duplicate digital download purchases of tracks and projects.
- Fixed the Explore tracks filter JSX so the region type handler is declared once.
- Fixed the Explore videos route crash caused by stale filter setter references after URL search parameter syncing.
- Replaced the expanded and collapsed Explore sidebar brand images with styled text marks.
- Fixed public `/v1/tracks` filtering so only `ready` tracks populate the main public songs feed, while `open_verse` tracks route to the Open Verses hub and `draft` tracks remain private in creator dashboards.
- Fixed artist stage name and genre capitalization across leaderboards and profile headers.
- Fixed dummy `#12` rank display on artist profiles with no tracks or stats, showing a clean "Unranked" state.
- Fixed the new track form crashing on the Distribution step with `Can't find variable: FormDescription` due to a missing import.
- Fixed preview deployments failing on Cloudflare's 25 MB per-asset upload limit by excluding the local demo WAV fixtures from uploaded assets via `.assetsignore`.

- Fixed file picker dialog double-triggering by stopping click propagation inside the file dropzone container.
- Standardized genre options by converting input text boxes into Select dropdowns supporting all standard genres across dashboard wizards (projects, tracks, and videos).
- Fixed battles router precedence bug where wildcard `/{battleId}` route captured requests intended for `/stats` route.
- Fixed missing authentication checks on Cloudflare Stream live broadcast routes and verified authentication boundaries via integration tests.
- Fixed the music player route matching for region-slug track URLs so playback highlights and queue sync still resolve under the new canonical URLs.
- Fixed track drafts restored in edit mode overwriting save values by adding persist/restore-on-mount options to the form draft guard.
- Fixed duplicate tracks entering the playback queue by deduping queue additions by track id.
- Fixed track downloads attaching the wrong asset by exposing ready covers first in the track asset mapping and cleaning up prior `cover_art`/`master` assets on re-upload.
