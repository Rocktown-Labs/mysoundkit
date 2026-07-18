# Changelog

## Unreleased

### Added

- Added deferred upload support for projects and tracks, delaying R2 bucket asset uploads until form submission.
- Added an "Open Verse" configuration switch to the track wizard, enabling inline publishing of open verse slots on submission.
- Added real-time creator battle statistics to the dashboard live metrics, replacing placeholder mock stats.
- Added a detailed track battle history page displaying matchup vote counts, viewer stats, and round results.
- Integrated Cloudflare Stream live broadcasts in the dashboard, enabling stream initialization, RTMPS/SRT configuration panels, and live video previews.
- Added admin Stripe subscription catalog controls for viewing payment health, syncing missing Stripe products and prices, and importing existing Stripe price IDs.
- Added project agent workflow guidance covering skill discovery, GitHub issue tracking, PR flow, quality gates, and changelog expectations.

### Fixed

- Fixed file picker dialog double-triggering by stopping click propagation inside the file dropzone container.
- Standardized genre options by converting input text boxes into Select dropdowns supporting all standard genres across dashboard wizards (projects, tracks, and videos).
- Fixed battles router precedence bug where wildcard `/{battleId}` route captured requests intended for `/stats` route.
- Fixed missing authentication checks on Cloudflare Stream live broadcast routes and verified authentication boundaries via integration tests.
