# Live music review

Live stream hosts can review released tracks while broadcasting, set a manual
Now Playing item, and optionally publish a StreamBot announcement. The browser
cannot reliably identify arbitrary audio captured by OBS, so Now Playing is
always host-reported.

## Review Studio

1. Open **Dashboard → Live → Streams** and create or select a stream.
2. Use **Review Studio** to search the tracks available to the authenticated
   host: public tracks, owned tracks, accepted collaborations, and purchased
   tracks that the current account can play.
3. Start a local preview, then choose **Set Now Playing**. Clear the selection
   when the reviewed track changes or the review ends.
4. Enable **StreamBot** only when announcements should be posted to the linked
   live-room chat entity.

The review catalog never returns an unguarded media URL. Playback continues to
use the existing entitlement and rights checks.

## OBS Browser Source

The host can create an overlay token from Review Studio. Add this URL as an OBS
Browser Source:

```text
https://mysoundkit.com/live/streams/overlay/<experience-id>?token=<overlay-token>
```

Recommended Browser Source settings:

- Width: `640`
- Height: `120`
- Enable transparency
- Do not expose the token in a public scene collection

The overlay is read-only. It displays the current manually selected track and
cannot access stream keys, private media, chat controls, or host actions. The
token is replaceable; creating a new token invalidates the previous one. The
overlay WebSocket uses a restricted identity and does not count as a viewer.

## API surface

- `GET /v1/live/experiences/:experienceId/review-catalog`
- `POST /v1/live/experiences/:experienceId/overlay-token`
- `POST /v1/live/rooms/:roomId/stream/bot`
- `POST /v1/live/rooms/:roomId/stream/now-playing`
- `GET /v1/live/rooms/:roomId/overlay`
- `GET /v1/live/rooms/:roomId/ws?token=<overlay-token>`

Review Studio endpoints require the authenticated host. Overlay state and the
WebSocket require a valid overlay token. The token is stored hashed in the
LiveRoom Durable Object and is never returned by the overlay state endpoint.

## Verification

The repository includes a SQLite-enabled Durable Object integration test for
token replacement, StreamBot state, manual Now Playing, and overlay identity:

```bash
bun run test:worker
```

The production build uses the static CI Wrangler configuration:

```bash
SOUNDKIT_CI_STATIC_CONFIG=true pnpm --filter bio build
```
