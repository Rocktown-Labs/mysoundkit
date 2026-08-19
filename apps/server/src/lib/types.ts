import type { LiveRoomDurableObject } from "@/durable-objects/live-room";
import type { PresenceDurableObject } from "@/durable-objects/presence";
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import type { DurationBackfillQueueMessage } from "@/lib/media-metadata";

export interface AuthenticatedSession {
  activeOrganizationId?: string | null;
  id: string;
  userId: string;
}

export interface AuthenticatedUser {
  banned?: boolean | null;
  email?: string | null;
  id: string;
  name?: string | null;
  role?: string | null;
}

export interface AppVariables {
  requestId: string;
  session: AuthenticatedSession | null;
  user: AuthenticatedUser | null;
}

export interface AppEnv {
  Bindings: {
    DO_METRICS?: AnalyticsEngineDataset;
    LIVE_ROOMS?: DurableObjectNamespace<LiveRoomDurableObject>;
    PRESENCE?: DurableObjectNamespace<PresenceDurableObject>;
    MEDIA_BUCKET?: R2Bucket;
    RECORDINGS_ACCESS_KEY_ID?: string;
    RECORDINGS_BUCKET?: R2Bucket;
    RECORDINGS_BUCKET_NAME?: string;
    RECORDINGS_SECRET_ACCESS_KEY?: string;
    SENTRY_DSN?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
    CLOUDFLARE_REALTIMEKIT_APP_ID?: string;
    CLOUDFLARE_STREAM_API_TOKEN?: string;
    CLOUDFLARE_STREAM_CUSTOMER_CODE?: string;
    EMAIL_DELIVERY_QUEUE?: Queue<EmailDeliveryQueueMessage>;
    TRACK_DURATION_BACKFILL_QUEUE?: Queue<DurationBackfillQueueMessage>;
    REALTIMEKIT_WEBHOOK_PUBLIC_KEY_URL?: string;
    TURNSTILE_HOSTNAMES?: string;
    TURNSTILE_SECRET?: string;
    SOUNDKIT_ALLOW_MOCK_REALTIME?: string;
  };
  Variables: AppVariables;
}
