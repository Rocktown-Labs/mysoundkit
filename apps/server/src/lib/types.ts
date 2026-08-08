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
    SENTRY_DSN?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
    CLOUDFLARE_REALTIMEKIT_APP_ID?: string;
    EMAIL_DELIVERY_QUEUE?: Queue<EmailDeliveryQueueMessage>;
    SOUNDKIT_ALLOW_MOCK_REALTIME?: string;
  };
  Variables: AppVariables;
}
