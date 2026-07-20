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

### Fixed

- Fixed the new track form crashing on the Distribution step with `Can't find variable: FormDescription` due to a missing import.
- Fixed preview deployments failing on Cloudflare's 25 MB per-asset upload limit by excluding the local demo WAV fixtures from uploaded assets via `.assetsignore`.

- Fixed file picker dialog double-triggering by stopping click propagation inside the file dropzone container.
- Standardized genre options by converting input text boxes into Select dropdowns supporting all standard genres across dashboard wizards (projects, tracks, and videos).
- Fixed battles router precedence bug where wildcard `/{battleId}` route captured requests intended for `/stats` route.
- Fixed missing authentication checks on Cloudflare Stream live broadcast routes and verified authentication boundaries via integration tests.
