import type { DurationBackfillQueueMessage } from "@/lib/media-metadata";
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";

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
    LIVE_ROOMS?: DurableObjectNamespace;
    MEDIA_BUCKET?: R2Bucket;
    RECORDINGS_ACCESS_KEY_ID?: string;
    RECORDINGS_BUCKET?: R2Bucket;
    RECORDINGS_BUCKET_NAME?: string;
    RECORDINGS_SECRET_ACCESS_KEY?: string;
    SENTRY_DSN?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
    CLOUDFLARE_REALTIMEKIT_APP_ID?: string;
    EMAIL_DELIVERY_QUEUE?: Queue<EmailDeliveryQueueMessage>;
    TRACK_DURATION_BACKFILL_QUEUE?: Queue<DurationBackfillQueueMessage>;
    REALTIMEKIT_WEBHOOK_PUBLIC_KEY_URL?: string;
    SOUNDKIT_ALLOW_MOCK_REALTIME?: string;
  };
  Variables: AppVariables;
}
