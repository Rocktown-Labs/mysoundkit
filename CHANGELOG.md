# Changelog

## Unreleased

### Added

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

### Fixed

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
