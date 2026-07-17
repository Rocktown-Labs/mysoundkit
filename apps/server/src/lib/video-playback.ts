import type { playbackSessions } from "@soundkit/db/schema/app";

export const videoPlaybackSourceType =
  "vod" satisfies typeof playbackSessions.$inferSelect.sourceType;
