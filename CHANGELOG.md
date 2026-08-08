# Changelog

## Unreleased

### Added

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

- Replaced the artist floating chat mock with real API-backed conversations and messages, restricted the widget to artist accounts, and added fan-accessible sign-out from Account Settings.
- Made battle challenge issuance persist challenge records and notify the challenged artist, with consistent Premium Artist gating across challenge entry points.
- Reworked the dashboard video upload flow to use resumable UpChunk chunked uploads to Mux, client-side file validation, live progress bars, and real project/track linkage instead of mock history.
- Redesigned the admin payments tab around payment health, a compact subscription catalog, clearer Stripe actions, and improved coupons/grants management.
- Updated RealtimeKit REST client response handling to match Cloudflare's standard payload shape (`data`) and documented meeting fields.
- Removed fake working rooms, demo catalog fallback audio, and placeholder Stripe prices/coupons across RealtimeKit, tracks, admin finance, and billing APIs.
- Formatted repository codebase with oxfmt.
- Updated all track and video list links across explore, shop, and dashboard surfaces to use canonical region-slug URLs when available, falling back to legacy id routes.
- Converted track and video detail pages from route components into shared prop-driven `TrackDetailPage`/`VideoDetailPage` components reused by both canonical and legacy routes.

### Fixed

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
