import type { MediaProcessorContainer } from "@/containers/media-processor";
import type { LiveRoomDurableObject } from "@/durable-objects/live-room";
import type { PresenceDurableObject } from "@/durable-objects/presence";
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import type { LiveNotificationQueueMessage } from "@/lib/live-notifications";
import type { DurationBackfillQueueMessage } from "@/lib/media-metadata";
import type {
  MediaProcessingWorkflowPayload,
  MediaRetentionWorkflowPayload,
  ProjectExportWorkflowPayload,
  TrackEnrichmentWorkflowPayload,
} from "@/lib/media-pipeline";
import type { NotificationQueueMessage } from "@/lib/notifications";

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
    BATTLE_ADMISSION_BATCH_SIZE?: string;
    BATTLE_BOT_SECRET?: string;
    DO_METRICS?: AnalyticsEngineDataset;
    LIVE_NOTIFICATION_QUEUE?: Queue<LiveNotificationQueueMessage>;
    NOTIFICATION_QUEUE?: Queue<NotificationQueueMessage>;
    LIVE_RECORDING_WORKFLOW?: Workflow;
    LIVE_ROOMS?: DurableObjectNamespace<LiveRoomDurableObject>;
    PRESENCE?: DurableObjectNamespace<PresenceDurableObject>;
    PROJECT_EXPORT_WORKFLOW?: Workflow<ProjectExportWorkflowPayload>;
    PAYOUT_RUN_WORKFLOW?: Workflow<{ periodId: string }>;
    PURCHASE_FULFILLMENT_WORKFLOW?: Workflow<{ orderId: string }>;
    MEDIA_BUCKET?: R2Bucket;
    MEDIA_PROCESSING_WORKFLOW?: Workflow<MediaProcessingWorkflowPayload>;
    MEDIA_RETENTION_WORKFLOW?: Workflow<MediaRetentionWorkflowPayload>;
    MEDIA_PROCESSOR?: DurableObjectNamespace<MediaProcessorContainer>;
    RECORDINGS_ACCESS_KEY_ID?: string;
    RECORDINGS_BUCKET?: R2Bucket;
    RECORDINGS_BUCKET_NAME?: string;
    RECORDINGS_SECRET_ACCESS_KEY?: string;
    SENTRY_DSN?: string;
    SENTRY_ENVIRONMENT?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
    CLOUDFLARE_REALTIMEKIT_APP_ID?: string;
    CLOUDFLARE_STREAM_API_TOKEN?: string;
    CLOUDFLARE_STREAM_CUSTOMER_CODE?: string;
    CLOUDFLARE_STREAM_WEBHOOK_SECRET?: string;
    EMAIL_DELIVERY_QUEUE?: Queue<EmailDeliveryQueueMessage>;
    TRACK_DURATION_BACKFILL_QUEUE?: Queue<DurationBackfillQueueMessage>;
    TRACK_ENRICHMENT_WORKFLOW?: Workflow<TrackEnrichmentWorkflowPayload>;
    REALTIMEKIT_WEBHOOK_PUBLIC_KEY_URL?: string;
    TURNSTILE_HOSTNAMES?: string;
    TURNSTILE_SECRET?: string;
    SOUNDKIT_ALLOW_MOCK_REALTIME?: string;
  };
  Variables: AppVariables;
}
