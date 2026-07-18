# Implementation Plan - UI Issues and Cloudflare Live Streaming

## 1. Issue Context

The user has reported three major functional and UI issues:

1. **File Attachment Issues & Genre Dropdowns / Open Verse track options**:
   - `FileUploadZone` click event double-triggers, preventing file selection.
   - Project cover and track master uploads happen immediately on selection instead of when submitting the form.
   - Genre input fields in create forms are text inputs; they should be dropdowns containing the supported genres (Afrobeats, Electronic, Hip-Hop, Jazz, Latin, Pop, R&B/Soul, Rock, Spoken Word).
   - Track creation does not have the option to set the track as an Open Verse.
2. **Battle Stats dummy data & Track battle history**:
   - The battle stats page uses static dummy data.
   - Track name in the stats table should link to a detailed history page for that track's battles, showing viewers, votes, opponents, etc.
3. **Cloudflare Live Stream integration**:
   - The dashboard "live streams" option goes to the generic video upload page. It should allow creators to start a live stream using Cloudflare Stream (real live inputs) and view streaming credentials / player views.

## 2. Proposed Changes & Affected Files

### Frontend File Upload & Form Flow

- **`apps/website/src/components/dashboard/file-upload-zone.tsx`**:
  - Remove `onClick={handleClick}` on Card and absolute inset styling on the input to avoid double-triggering the file picker. Use `sr-only` style on the input so card click triggers the input exactly once.
- **`apps/website/src/components/dashboard/new-project-form.tsx`**:
  - Change Zod schema to allow optional cover art key initially.
  - Store the `File` object in local state on selection and show in file zone.
  - On submit, upload the selected cover file first, then trigger the project creation with the returned key.
  - Convert track genre fields from Input to Select dropdown.
- **`apps/website/src/components/dashboard/new-track-form.tsx`**:
  - Store selected cover and master files in local state.
  - Convert genre field to Select dropdown.
  - Add "Set as Open Verse" toggle and forms (title, slot starts, slot ends, description).
  - On submit, perform sequential upload of cover art, master audio, draft creation, and open verse listing.
- **`apps/website/src/components/dashboard/videos/add-video-dialog.tsx`**:
  - Populate the genre select list with the complete list of supported genres.

### Backend Battle Stats & History API

- **`apps/server/src/routes/battles.ts`**:
  - Implement `GET /v1/battles/stats` returning the authenticated user's tracks' statistics from the `battle_stats` table joined with `tracks`.
  - Implement `GET /v1/battles/track-history/:trackId` returning detailed round/vote history of a track from `battleRounds` and `battles`.
- **`apps/server/src/rpc-contract.ts`**:
  - Register the new OpenAPI endpoints.

### Frontend Battle Stats UI

- **`apps/website/src/lib/soundkit-api-hooks.ts`**:
  - Add `useBattleStatsQuery` and `useTrackBattleHistoryQuery(trackId)` queries.
- **`apps/website/src/app/dashboard/live/my-stats/index.tsx`**:
  - Use real stats query instead of mock data.
- **`apps/website/src/app/dashboard/live/my-stats/-columns.tsx`**:
  - Update Track Name column to link to `/dashboard/live/my-stats/$trackId`.
- **`apps/website/src/app/dashboard/live/my-stats/$trackId.tsx`** (New File):
  - Track battle history view showing votes, viewers, dates, and opponent tracks.

### Cloudflare Stream Integration

- **`apps/server/src/routes/live.ts`**:
  - Add `POST /cloudflare-stream` creating Cloudflare live input.
  - Add `GET /cloudflare-stream/:streamId` retrieving status of the stream.
- **`apps/website/src/app/dashboard/live/streams.tsx`**:
  - Render live input setup form, connection credentials (RTMPS/SRT), and a live player view using Cloudflare Stream player embed.

## 3. Testing Strategy

- Run unit/worker tests to verify backend schemas: `bun run test` (or `pnpm run test`).
- Verify compilation and linting: `pnpm run check-types` and `bun x ultracite check`.

## 4. Branch Name

- `feat/ui-fixes-and-live-stream-28`
