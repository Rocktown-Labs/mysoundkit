/* eslint-disable one-var */

export type RpcOperation =
  `${"DELETE" | "GET" | "PATCH" | "POST" | "PUT"} ${string}`;

/**
 * Registered application routes that are intentionally outside the normal
 * JSON RPC client. Keeping them explicit prevents transport/provider routes
 * from becoming accidental contract gaps.
 */
export const rpcTransportExclusions = {
  "GET /v1/live/rooms/:roomId/overlay": "Read-only OBS overlay state.",
  "GET /v1/projects/:projectId/assets/:assetId/download":
    "Signed binary project download.",
  "GET /v1/tracks/:trackId/assets/:assetId/download":
    "Signed binary track download.",
  "GET /v1/tracks/:trackId/assets/:assetId/source":
    "Binary source-media transport.",
  "POST /v1/webhooks/battle-service": "Battle provider webhook.",
  "POST /v1/webhooks/cloudflare-stream": "Cloudflare Stream webhook.",
  "POST /v1/webhooks/mux": "Mux provider webhook.",
  "POST /v1/webhooks/realtimekit": "RealtimeKit provider webhook.",
  "POST /v1/webhooks/resend": "Resend provider webhook.",
  "POST /v1/webhooks/stemsplit": "StemSplit provider webhook.",
  "POST /v1/webhooks/stripe-commerce": "Stripe provider webhook.",
} as const satisfies Partial<Record<RpcOperation, string>>;

/**
 * Client-facing routes implemented with plain Hono handlers rather than
 * OpenAPI handlers. The parity test adds these to the OpenAPI operation set.
 */
export const additionalClientRpcOperations = [
  "DELETE /v1/admin/finance/payments/coupons/:id",
  "DELETE /v1/live/cloudflare-stream/:streamId",
  "DELETE /v1/live/experiences/:experienceId",
  "GET /v1/admin/embeddings/status",
  "GET /v1/admin/finance/payments/coupons",
  "GET /v1/admin/finance/payments/users",
  "POST /v1/auth/handoff-token",
  "GET /v1/live/cloudflare-stream/:streamId",
  "GET /v1/live/experiences/:experienceId",
  "GET /v1/live/experiences/:experienceId/review-catalog",
  "GET /v1/live/experiences/me",
  "GET /v1/live/experiences/public",
  "GET /v1/live/rooms/:roomId",
  "GET /v1/live/rooms/queue",
  "GET /v1/search/semantic",
  "POST /v1/admin/embeddings/backfill",
  "POST /v1/admin/finance/payments/coupons",
  "POST /v1/admin/finance/payments/grant-premium",
  "POST /v1/live/cloudflare-stream",
  "POST /v1/live/experiences",
  "POST /v1/live/experiences/:experienceId/battlebot",
  "POST /v1/live/experiences/:experienceId/join",
  "POST /v1/live/experiences/:experienceId/overlay-token",
  "POST /v1/live/experiences/:experienceId/session-locks/check",
  "POST /v1/live/rooms/:roomId/battle/kit",
  "POST /v1/live/rooms/:roomId/battle/track",
  "POST /v1/live/rooms/:roomId/chat",
  "POST /v1/live/rooms/:roomId/leave",
  "POST /v1/live/rooms/:roomId/party/playback",
  "POST /v1/live/rooms/:roomId/queue",
  "POST /v1/live/rooms/:roomId/stream/bot",
  "POST /v1/live/rooms/:roomId/stream/now-playing",
  "POST /v1/live/rooms/:roomId/vote",
  "POST /v1/projects/:projectId/pre-save",
  "POST /v1/seller/account-session",
  "POST /v1/videos/:videoId/pre-save",
] as const satisfies readonly RpcOperation[];

/** Protocol routes that are registered outside OpenAPI and intentionally do not
 * use the JSON RPC client. */
export const nonOpenApiTransportRoutes = {
  "GET /media/*": "Guarded binary media delivery.",
  "GET /v1/live/rooms/:roomId/overlay": "Read-only OBS overlay state.",
  "GET /v1/live/rooms/:roomId/ws": "Live-room WebSocket upgrade.",
  "GET /v1/presence/ws": "Presence WebSocket upgrade.",
  "GET /v1/uploads/media": "Better Upload multipart protocol.",
  "GET /v1/uploads/profile-media": "Better Upload multipart protocol.",
  "GET /v1/uploads/project-assets": "Better Upload multipart protocol.",
  "GET /v1/uploads/track-source": "Better Upload multipart protocol.",
  "POST /v1/uploads/media": "Better Upload multipart protocol.",
  "POST /v1/uploads/profile-media": "Better Upload multipart protocol.",
  "POST /v1/uploads/project-assets": "Better Upload multipart protocol.",
  "POST /v1/uploads/track-source": "Better Upload multipart protocol.",
} as const satisfies Partial<Record<RpcOperation, string>>;
