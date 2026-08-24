import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core/columns/vector_extension/vector";

import { organization, subscription, user } from "./auth";
import { transactions } from "./payments";

export const accountTypeEnum = pgEnum("account_type", ["artist", "fan"]);
export const presenceStatusEnum = pgEnum("presence_status", [
  "online",
  "away",
  "offline",
]);
export const artistRoleEnum = pgEnum("artist_role", ["musician", "producer"]);
export const creatorEligibilityEnum = pgEnum("creator_eligibility", [
  "independent",
  "major_label_affiliated",
]);
export const workspaceTypeEnum = pgEnum("workspace_type", [
  "artist_team",
  "fan_family",
]);
export const invitationStatusEnum = pgEnum("app_invitation_status", [
  "pending",
  "accepted",
  "rejected",
  "revoked",
  "expired",
]);
export const trackProductionStatusEnum = pgEnum("track_production_status", [
  "demo",
  "mixed",
  "mastered",
  "complete",
]);
export const catalogItemTypeEnum = pgEnum("catalog_item_type", [
  "single",
  "beat",
  "instrumental",
]);
export const purchaseModeEnum = pgEnum("purchase_mode", [
  "digital_download",
  "license",
]);
export const releaseStrategyEnum = pgEnum("release_strategy", [
  "private",
  "publish_when_ready",
  "scheduled",
]);
export const listeningAccessEnum = pgEnum("listening_access", [
  "public",
  "premium_or_purchased",
]);
export const assetStorageProviderEnum = pgEnum("asset_storage_provider", [
  "r2",
  "mux",
  "external",
]);
export const assetStatusEnum = pgEnum("asset_status", [
  "pending",
  "uploading",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "deleted",
]);
export const trackVariantTypeEnum = pgEnum("track_variant_type", [
  "original",
  "clean",
  "dirty",
  "acapella",
  "instrumental",
  "radio_edit",
]);
export const trackAssetKindEnum = pgEnum("track_asset_kind", [
  "cover_art",
  "master",
  "vocal_stem",
  "clean",
  "alternate_mix",
  "artwork",
  "booklet",
  "tagged_mp3",
  "untagged_wav",
  "stems",
  "midi",
  "license_pdf",
  "instrumental",
  "verse_vocal",
  "adlib",
  "session_file",
  "reference_audio",
  "variant_audio",
  "open_verse_clip",
]);
export const sellerOnboardingStatusEnum = pgEnum("seller_onboarding_status", [
  "not_started",
  "pending",
  "restricted",
  "enabled",
  "rejected",
]);
export const stemJobStatusEnum = pgEnum("stem_job_status", [
  "queued",
  "submitted",
  "processing",
  "completed",
  "failed",
  "expired",
]);
export const stemOutputTypeEnum = pgEnum("stem_output_type", [
  "VOCALS",
  "INSTRUMENTAL",
  "BOTH",
  "FOUR_STEMS",
  "SIX_STEMS",
]);
export const stemOutputFormatEnum = pgEnum("stem_output_format", [
  "MP3",
  "WAV",
  "FLAC",
]);
export const lyricsStatusEnum = pgEnum("lyrics_status", [
  "missing",
  "generating",
  "pending_review",
  "approved",
  "failed",
]);
export const lyricsSourceTypeEnum = pgEnum("lyrics_source_type", [
  "artist",
  "collaborator",
  "machine_transcription",
  "fan_submission",
  "import",
]);
export const lyricsRevisionStatusEnum = pgEnum("lyrics_revision_status", [
  "pending_review",
  "approved",
  "rejected",
]);
export const searchableEntityTypeEnum = pgEnum("searchable_entity_type", [
  "artist",
  "track",
  "project",
  "video",
  "lyrics",
]);
export const collaboratorRoleEnum = pgEnum("collaborator_role", [
  "artist",
  "producer",
  "vocalist",
  "engineer",
  "songwriter",
  "manager",
  "social_media_manager",
  "marketing",
  "family_member",
]);
export const projectTypeEnum = pgEnum("project_type", [
  "album",
  "ep",
  "mixtape",
  "single",
]);
export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "scheduled",
  "released",
  "archived",
]);
export const projectAssetKindEnum = pgEnum("project_asset_kind", [
  "cover_art",
  "photo",
  "video",
  "attachment",
  "release_export",
]);
export const videoKindEnum = pgEnum("video_kind", [
  "music_video",
  "promo",
  "teaser",
  "battle_replay",
  "battle_clip",
  "live_recording",
]);
export const videoPlaybackPolicyEnum = pgEnum("video_playback_policy", [
  "public",
  "signed",
]);
export const videoSourceProviderEnum = pgEnum("video_source_provider", [
  "mux",
  "external",
]);
export const postKindEnum = pgEnum("post_kind", [
  "track",
  "project",
  "video",
  "battle_replay",
  "media",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "checkout_pending",
  "paid",
  "failed",
  "refunded",
  "canceled",
]);
export const productTypeEnum = pgEnum("product_type", [
  "track",
  "project",
  "video",
]);
export const conversationTypeEnum = pgEnum("conversation_type", [
  "direct",
  "group",
  "battle_live",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "sent",
  "delivered",
  "read",
  "deleted",
]);
export const artistFriendRequestStatusEnum = pgEnum(
  "artist_friend_request_status",
  ["pending", "accepted", "declined", "canceled"]
);
export const battleFormatEnum = pgEnum("battle_format", [
  "best_of_3",
  "best_of_5",
  "best_of_7",
]);
export const battleKitTrackRoleEnum = pgEnum("battle_kit_track_role", [
  "main",
  "tiebreaker",
]);
export const battleChallengeStatusEnum = pgEnum("battle_challenge_status", [
  "pending",
  "accepted",
  "declined",
  "canceled",
  "expired",
]);
export const battleStatusEnum = pgEnum("battle_status", [
  "scheduled",
  "live",
  "completed",
  "archived",
]);
export const battleVisibilityEnum = pgEnum("battle_visibility", [
  "public",
  "premium_only",
]);
export const battleRoundStatusEnum = pgEnum("battle_round_status", [
  "upcoming",
  "active",
  "completed",
]);
export const battleQueueEntryStatusEnum = pgEnum("battle_queue_entry_status", [
  "queued",
  "admitted",
  "left",
  "removed",
  "completed",
  "conflict",
]);
export const analyticsScopeTypeEnum = pgEnum("analytics_scope_type", [
  "user",
  "artist",
  "workspace",
  "track",
  "video",
  "battle",
]);
export const workflowJobStatusEnum = pgEnum("workflow_job_status", [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "canceled",
]);
export const mediaAssetPurposeEnum = pgEnum("media_asset_purpose", [
  "master",
  "streaming",
  "battle",
  "download",
  "lossless_download",
  "open_verse_snippet",
  "preview",
  "stem",
  "artwork",
  "other",
]);
export const mediaWorkflowTypeEnum = pgEnum("media_workflow_type", [
  "media_processing",
  "track_enrichment",
  "project_export",
  "media_retention",
]);
export const mediaProcessingModeEnum = pgEnum("media_processing_mode", [
  "final_track",
  "open_verse_base",
  "legacy_backfill",
]);
export const mediaProcessingJobStatusEnum = pgEnum(
  "media_processing_job_status",
  ["queued", "running", "ready", "partial", "failed"]
);
export const openVerseStatusEnum = pgEnum("open_verse_status", [
  "open",
  "closed",
  "fulfilled",
  "awaiting_final_master",
  "archived",
]);
export const openVerseAccessModeEnum = pgEnum("open_verse_access_mode", [
  "open",
  "approval_required",
]);
export const openVerseSubmissionStatusEnum = pgEnum(
  "open_verse_submission_status",
  ["submitted", "shortlisted", "accepted", "declined", "withdrawn"]
);
export const openVerseAccessRequestStatusEnum = pgEnum(
  "open_verse_access_request_status",
  ["pending", "approved", "declined", "canceled"]
);
export const listeningPartyStatusEnum = pgEnum("listening_party_status", [
  "scheduled",
  "live",
  "ended",
  "canceled",
]);
export const listeningPartyPlaybackModeEnum = pgEnum(
  "listening_party_playback_mode",
  ["artist_hosted", "programmed_release"]
);
export const webhookProviderEnum = pgEnum("webhook_provider", [
  "stripe",
  "mux",
  "stemsplit",
  "battle_service",
  "resend",
  "realtimekit",
  "cloudflare_stream",
]);

export const liveExperienceStatusEnum = pgEnum("live_experience_status", [
  "scheduled",
  "live",
  "ended",
]);

export const liveExperienceKindEnum = pgEnum("live_experience_kind", [
  "battle",
  "party",
  "stream",
]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processed",
  "failed",
  "ignored",
]);
export const emailDeliveryStatusEnum = pgEnum("email_delivery_status", [
  "queued",
  "sending",
  "sent",
  "failed",
  "canceled",
]);
export const rewardConfigurationStatusEnum = pgEnum(
  "reward_configuration_status",
  ["draft", "active", "retired"]
);
export const accountingPeriodStatusEnum = pgEnum("accounting_period_status", [
  "open",
  "calculating",
  "review",
  "finalized",
  "payable",
  "paid",
  "reopened",
  "voided",
]);
export const subscriptionRewardAllocationStatusEnum = pgEnum(
  "subscription_reward_allocation_status",
  [
    "pending",
    "funded",
    "partially_refunded",
    "refunded",
    "disputed",
    "reversed",
    "allocated",
    "closed",
  ]
);
export const playbackEventSourceEnum = pgEnum("playback_event_source", [
  "artist_profile",
  "album",
  "playlist",
  "library",
  "search",
  "semantic_search",
  "recommendation",
  "state_discovery",
  "national_discovery",
  "global_discovery",
  "map",
  "community",
  "listening_party",
  "battle",
  "vod",
  "purchase_library",
  "share",
  "external_deep_link",
]);
export const playbackSessionStatusEnum = pgEnum("playback_session_status", [
  "started",
  "active",
  "ended",
  "expired",
  "rejected",
]);
export const riskStatusEnum = pgEnum("risk_status", [
  "clear",
  "review",
  "held",
  "rejected",
  "released",
]);
export const qualifiedStreamStatusEnum = pgEnum("qualified_stream_status", [
  "qualified",
  "duplicate",
  "held",
  "rejected",
  "reversed",
]);
export const rewardUnitTypeEnum = pgEnum("reward_unit_type", [
  "premium_track_stream",
  "ad_supported_audio_play",
  "ad_supported_video_view",
  "ad_supported_track_stream",
  "live_party_attendance",
  "battle_attendance",
  "battle_round_completion",
  "promotional_bonus",
  "manual_adjustment",
  "purchase_bonus",
  "referral_bonus",
]);
export const rewardUnitStatusEnum = pgEnum("reward_unit_status", [
  "pending",
  "eligible",
  "held",
  "rejected",
  "allocated",
  "reversed",
]);
export const fanValueEventTypeEnum = pgEnum("fan_value_event_type", [
  "qualified_stream",
  "repeat_stream",
  "track_save",
  "playlist_add",
  "artist_follow",
  "battle_vote",
  "live_attendance",
  "listening_party_completion",
  "track_purchase",
  "album_purchase",
  "tip",
  "premium_renewal",
  "share_visit",
  "share_signup",
  "state_discovery",
  "new_artist_discovery",
]);
export const fanValueTierEnum = pgEnum("fan_value_tier", [
  "new",
  "casual",
  "engaged",
  "high_value",
  "superfan",
]);
export const payeeTypeEnum = pgEnum("payee_type", [
  "artist",
  "label",
  "organization",
  "external",
]);
export const rightsholderSplitStatusEnum = pgEnum("rightsholder_split_status", [
  "draft",
  "active",
  "disputed",
  "retired",
]);
export const ledgerAccountTypeEnum = pgEnum("ledger_account_type", [
  "asset",
  "liability",
  "revenue",
  "expense",
  "equity",
]);
export const ledgerEntrySideEnum = pgEnum("ledger_entry_side", [
  "debit",
  "credit",
]);
export const ledgerTransactionStatusEnum = pgEnum("ledger_transaction_status", [
  "pending",
  "posted",
  "voided",
  "reversed",
]);
export const creatorEarningTypeEnum = pgEnum("creator_earning_type", [
  "premium_stream_reward",
  "ad_supported_reward",
  "live_reward",
  "battle_bonus",
  "purchase_revenue",
  "tip",
  "promotion_bonus",
  "manual_adjustment",
  "reversal",
]);
export const creatorEarningStatusEnum = pgEnum("creator_earning_status", [
  "estimated",
  "held",
  "finalized",
  "payable",
  "paid",
  "reversed",
]);
export const adInventoryTypeEnum = pgEnum("ad_inventory_type", [
  "audio_ad",
  "video_overlay",
  "video_bottom_carousel",
  "video_preroll",
  "video_postroll",
  "sponsored_video",
]);
export const adImpressionStatusEnum = pgEnum("ad_impression_status", [
  "requested",
  "served",
  "viewable",
  "completed",
  "invalid",
  "credited",
]);
export const adCampaignStatusEnum = pgEnum("ad_campaign_status", [
  "draft",
  "active",
  "paused",
  "exhausted_for_today",
  "expired",
]);
export const adBillingTypeEnum = pgEnum("ad_billing_type", [
  "upfront_recurring",
  "prepaid_wallet",
]);
export const adTargetTypeEnum = pgEnum("ad_target_type", ["state", "country"]);
export const adCreativeFormatEnum = pgEnum("ad_creative_format", [
  "audio",
  "video",
  "image",
]);
export const adPlacementEnum = pgEnum("ad_placement", [
  "audio_preroll",
  "video_preroll",
  "video_overlay",
]);
export const payoutHoldStatusEnum = pgEnum("payout_hold_status", [
  "active",
  "released",
  "rejected",
  "expired",
]);

export const genres = pgTable(
  "genres",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (table) => [uniqueIndex("genres_slug_idx").on(table.slug)]
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    accountType: accountTypeEnum("account_type").notNull(),
    avatarObjectKey: text("avatar_object_key"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    city: text("city"),
    country: text("country"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    displayName: text("display_name"),
    headerObjectKey: text("header_object_key"),
    headerUrl: text("header_url"),
    mediaLayout: text("media_layout").default("cards").notNull(),
    onboardingCompletedAt: timestamp("onboarding_completed_at"),
    state: text("state"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
  },
  (table) => [uniqueIndex("user_profiles_username_idx").on(table.username)]
);

export const onboardingProgress = pgTable(
  "onboarding_progress",
  {
    completedAt: timestamp("completed_at"),
    creatorEligibility: creatorEligibilityEnum("creator_eligibility"),
    creatorEligibilityDeclaredAt: timestamp("creator_eligibility_declared_at"),
    creatorEligibilityLockedAt: timestamp("creator_eligibility_locked_at"),
    currentStep: integer("current_step").default(1).notNull(),
    exitedAt: timestamp("exited_at"),
    intendedAccountType: accountTypeEnum("intended_account_type").notNull(),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
    marketingOptInAt: timestamp("marketing_opt_in_at"),
    marketingOptInSource: text("marketing_opt_in_source"),
    marketingOptInVersion: text("marketing_opt_in_version"),
    rightsAttestationVersion: text("rights_attestation_version"),
    rightsAttestedAt: timestamp("rights_attested_at"),
    selectedPlanCode: text("selected_plan_code"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("onboarding_progress_last_activity_idx").on(table.lastActivityAt),
  ]
);

export const onboardingEmailReminders = pgTable(
  "onboarding_email_reminders",
  {
    id: text("id").primaryKey(),
    reminderType: text("reminder_type").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("onboarding_email_reminders_user_type_idx").on(
      table.userId,
      table.reminderType
    ),
  ]
);

export const userPresence = pgTable(
  "user_presence",
  {
    lastSeen: timestamp("last_seen").notNull(),
    status: presenceStatusEnum("status").notNull().default("offline"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("user_presence_last_seen_idx").on(table.lastSeen)]
);

export const artistProfiles = pgTable(
  "artist_profiles",
  {
    allowDirectMessages: boolean("allow_direct_messages")
      .default(true)
      .notNull(),
    battleCount: integer("battle_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    followerCount: integer("follower_count").default(0).notNull(),
    hometown: text("hometown"),
    isVerified: boolean("is_verified").default(false).notNull(),
    primaryGenreId: text("primary_genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    primaryOrganizationId: text("primary_organization_id").references(
      () => organization.id,
      { onDelete: "set null" }
    ),
    proAffiliation: text("pro_affiliation"),
    proMemberId: text("pro_member_id"),
    projectCount: integer("project_count").default(0).notNull(),
    publicProfileEnabled: boolean("public_profile_enabled")
      .default(true)
      .notNull(),
    songwriterLegalName: text("songwriter_legal_name"),
    stageName: text("stage_name"),
    trackCount: integer("track_count").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("artist_profiles_primary_org_idx").on(table.primaryOrganizationId),
  ]
);

export const artistProfileRoles = pgTable(
  "artist_profile_roles",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    role: artistRoleEnum("role").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => artistProfiles.userId, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })]
);

export const fanProfiles = pgTable("fan_profiles", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  favoriteArtistCount: integer("favorite_artist_count").default(0).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const workspaceProfiles = pgTable("workspace_profiles", {
  adsEnabled: boolean("ads_enabled").default(true).notNull(),
  billingEmail: text("billing_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  premiumPlaybackEnabled: boolean("premium_playback_enabled")
    .default(false)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceType: workspaceTypeEnum("workspace_type").notNull(),
});

export const sellerAccounts = pgTable(
  "seller_accounts",
  {
    chargesEnabled: boolean("charges_enabled").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    detailsSubmitted: boolean("details_submitted").default(false).notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    onboardingStatus: sellerOnboardingStatusEnum("onboarding_status")
      .default("not_started")
      .notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    payoutsEnabled: boolean("payouts_enabled").default(false).notNull(),
    requirementsDue: jsonb("requirements_due").$type<string[]>(),
    stripeAccountId: text("stripe_account_id").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("seller_accounts_stripe_account_id_idx").on(
      table.stripeAccountId
    ),
    index("seller_accounts_user_id_idx").on(table.userId),
    index("seller_accounts_organization_id_idx").on(table.organizationId),
  ]
);

export const profileLinks = pgTable(
  "profile_links",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    handle: text("handle"),
    id: text("id").primaryKey(),
    platform: text("platform").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    url: text("url").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("profile_links_user_id_idx").on(table.userId)]
);

export const userGenrePreferences = pgTable(
  "user_genre_preferences",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    genreId: text("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.genreId] })]
);

export const notificationSettings = pgTable("notification_settings", {
  emailCollaborations: boolean("email_collaborations").default(true).notNull(),
  emailComments: boolean("email_comments").default(true).notNull(),
  emailFollowers: boolean("email_followers").default(true).notNull(),
  emailLive: boolean("email_live").default(true).notNull(),
  emailMessages: boolean("email_messages").default(true).notNull(),
  emailSales: boolean("email_sales").default(true).notNull(),
  emailTrackProcessing: boolean("email_track_processing")
    .default(true)
    .notNull(),
  pushMentions: boolean("push_mentions").default(true).notNull(),
  pushMessages: boolean("push_messages").default(true).notNull(),
  pushReleases: boolean("push_releases").default(true).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const privacySettings = pgTable("privacy_settings", {
  allowMessages: boolean("allow_messages").default(true).notNull(),
  publicProfile: boolean("public_profile").default(true).notNull(),
  showFollowers: boolean("show_followers").default(true).notNull(),
  showLocation: boolean("show_location").default(true).notNull(),
  showTrackCount: boolean("show_track_count").default(true).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
});

export const tracks = pgTable(
  "tracks",
  {
    bpm: integer("bpm"),
    catalogItemType: catalogItemTypeEnum("catalog_item_type")
      .default("single")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    deletedAt: timestamp("deleted_at"),
    description: text("description"),
    downloadsAllowed: boolean("downloads_allowed").default(true).notNull(),
    downloadsRequireFirstPlay: boolean("downloads_require_first_play")
      .default(true)
      .notNull(),
    downloadsRequirePurchase: boolean("downloads_require_purchase")
      .default(false)
      .notNull(),
    exclusiveUntil: timestamp("exclusive_until"),
    genreId: text("genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    isForSale: boolean("is_for_sale").default(false).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    isrc: text("isrc"),
    listeningAccess: listeningAccessEnum("listening_access")
      .default("public")
      .notNull(),
    lyricsStatus: lyricsStatusEnum("lyrics_status")
      .default("missing")
      .notNull(),
    musicalKey: text("musical_key"),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 10, scale: 2 }),
    priceCents: integer("price_cents"),
    productionStatus: trackProductionStatusEnum("production_status")
      .default("demo")
      .notNull(),
    publishedAt: timestamp("published_at"),
    purchaseMode: purchaseModeEnum("purchase_mode")
      .default("digital_download")
      .notNull(),
    purgeAfter: timestamp("purge_after"),
    releaseAt: timestamp("release_at"),
    releaseStrategy: releaseStrategyEnum("release_strategy")
      .default("private")
      .notNull(),
    slug: text("slug").notNull(),
    streamingLinks: jsonb("streaming_links")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("tracks_slug_idx").on(table.slug),
    index("tracks_owner_user_id_idx").on(table.ownerUserId),
    index("tracks_organization_id_idx").on(table.organizationId),
  ]
);

export const trackLicenseOptions = pgTable(
  "track_license_options",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    includesStems: boolean("includes_stems").default(false).notNull(),
    isExclusive: boolean("is_exclusive").default(false).notNull(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    rightsSummary: jsonb("rights_summary").$type<string[]>().notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("track_license_options_track_id_idx").on(table.trackId)]
);

export const trackVariants = pgTable(
  "track_variants",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    title: text("title"),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    variantType: trackVariantTypeEnum("variant_type").notNull(),
  },
  (table) => [index("track_variants_track_id_idx").on(table.trackId)]
);

export const trackAssets = pgTable(
  "track_assets",
  {
    assetKind: trackAssetKindEnum("asset_kind").notNull(),
    bucketName: text("bucket_name"),
    checksum: text("checksum"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    durationMs: integer("duration_ms"),
    id: text("id").primaryKey(),
    integratedLufs: numeric("integrated_lufs", { precision: 6, scale: 2 }),
    isCurrent: boolean("is_current").default(true).notNull(),
    metadata: jsonb("metadata"),
    mimeType: text("mime_type"),
    normalizationTargetLufs: numeric("normalization_target_lufs", {
      precision: 6,
      scale: 2,
    }),
    objectKey: text("object_key"),
    processingVersion: integer("processing_version"),
    purpose: mediaAssetPurposeEnum("purpose"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    sourceAssetId: text("source_asset_id"),
    status: assetStatusEnum("status").default("pending").notNull(),
    storageProvider: assetStorageProviderEnum("storage_provider").notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    trackVariantId: text("track_variant_id").references(
      () => trackVariants.id,
      {
        onDelete: "cascade",
      }
    ),
    truePeakDbtp: numeric("true_peak_dbtp", { precision: 6, scale: 2 }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    uploaderUserId: text("uploader_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.sourceAssetId],
      foreignColumns: [table.id],
      name: "track_assets_source_asset_id_fk",
    }).onDelete("restrict"),
    index("track_assets_track_id_idx").on(table.trackId),
    index("track_assets_source_asset_id_idx").on(table.sourceAssetId),
    index("track_assets_purpose_current_idx").on(
      table.trackId,
      table.purpose,
      table.isCurrent
    ),
    uniqueIndex("track_assets_current_purpose_idx")
      .on(table.trackId, table.purpose, table.assetKind)
      .where(sql`${table.isCurrent} = true and ${table.purpose} is not null`),
    index("track_assets_variant_id_idx").on(table.trackVariantId),
    uniqueIndex("track_assets_derivative_identity_idx").on(
      table.trackId,
      table.sourceAssetId,
      table.purpose,
      table.processingVersion,
      table.assetKind
    ),
    uniqueIndex("track_assets_storage_object_idx").on(
      table.storageProvider,
      table.objectKey
    ),
  ]
);

export const trackStemJobs = pgTable(
  "track_stem_jobs",
  {
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    creditsCharged: integer("credits_charged"),
    creditsRequired: integer("credits_required"),
    error: jsonb("error"),
    id: text("id").primaryKey(),
    inputAssetId: text("input_asset_id")
      .notNull()
      .references(() => trackAssets.id, { onDelete: "cascade" }),
    outputFormat: stemOutputFormatEnum("output_format")
      .default("MP3")
      .notNull(),
    outputType: stemOutputTypeEnum("output_type").default("BOTH").notNull(),
    progress: integer("progress").default(0).notNull(),
    sourceUrlExpiresAt: timestamp("source_url_expires_at"),
    status: stemJobStatusEnum("status").default("queued").notNull(),
    stemsplitJobId: text("stemsplit_job_id"),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    workflowInstanceId: text("workflow_instance_id"),
  },
  (table) => [
    index("track_stem_jobs_track_id_idx").on(table.trackId),
    uniqueIndex("track_stem_jobs_input_asset_id_idx").on(table.inputAssetId),
    index("track_stem_jobs_stemsplit_job_id_idx").on(table.stemsplitJobId),
  ]
);

export const trackLyrics = pgTable(
  "track_lyrics",
  {
    approvedAt: timestamp("approved_at"),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    contributorUserId: text("contributor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    language: text("language"),
    metadata: jsonb("metadata"),
    sourceAssetId: text("source_asset_id").references(() => trackAssets.id, {
      onDelete: "set null",
    }),
    sourceType: lyricsSourceTypeEnum("source_type").default("import").notNull(),
    status: lyricsRevisionStatusEnum("status")
      .default("pending_review")
      .notNull(),
    text: text("text").notNull(),
    timedLines:
      jsonb("timed_lines").$type<
        { endMs: number; startMs: number; text: string }[]
      >(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("track_lyrics_track_id_idx").on(table.trackId),
    index("track_lyrics_track_status_idx").on(table.trackId, table.status),
  ]
);

export const trackCollaborators = pgTable(
  "track_collaborators",
  {
    canDelete: boolean("can_delete").default(false).notNull(),
    canEdit: boolean("can_edit").default(true).notNull(),
    canUpload: boolean("can_upload").default(true).notNull(),
    collaboratorRole: collaboratorRoleEnum("collaborator_role").notNull(),
    collaboratorUserId: text("collaborator_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    creditSplitBps: integer("credit_split_bps"),
    id: text("id").primaryKey(),
    invitationStatus: invitationStatusEnum("invitation_status")
      .default("pending")
      .notNull(),
    inviteEmail: text("invite_email"),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
  },
  (table) => [index("track_collaborators_track_id_idx").on(table.trackId)]
);

export const projects = pgTable(
  "projects",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    description: text("description"),
    exclusiveUntil: timestamp("exclusive_until"),
    exportVersion: integer("export_version").default(1).notNull(),
    genreId: text("genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    isForSale: boolean("is_for_sale").default(false).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    listeningAccess: listeningAccessEnum("listening_access")
      .default("public")
      .notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents"),
    projectType: projectTypeEnum("project_type").notNull(),
    purchaseMode: purchaseModeEnum("purchase_mode")
      .default("digital_download")
      .notNull(),
    releaseDate: timestamp("release_date"),
    slug: text("slug").notNull(),
    status: projectStatusEnum("status").default("draft").notNull(),
    streamingLinks: jsonb("streaming_links")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("projects_slug_idx").on(table.slug),
    index("projects_owner_user_id_idx").on(table.ownerUserId),
  ]
);

export const projectTracks = pgTable(
  "project_tracks",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    position: integer("position").default(0).notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.trackId] })]
);

export const projectAssets = pgTable(
  "project_assets",
  {
    assetKind: projectAssetKindEnum("asset_kind").notNull(),
    bucketName: text("bucket_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    exportVersion: integer("export_version"),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    mimeType: text("mime_type"),
    muxAssetId: text("mux_asset_id"),
    muxPlaybackId: text("mux_playback_id"),
    muxUploadId: text("mux_upload_id"),
    objectKey: text("object_key"),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    sourceAssetId: text("source_asset_id").references(() => trackAssets.id, {
      onDelete: "restrict",
    }),
    status: assetStatusEnum("status").default("pending").notNull(),
    storageProvider: assetStorageProviderEnum("storage_provider").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    uploaderUserId: text("uploader_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("project_assets_project_id_idx").on(table.projectId),
    uniqueIndex("project_assets_export_identity_idx").on(
      table.projectId,
      table.sourceAssetId,
      table.exportVersion,
      table.assetKind
    ),
  ]
);

export const uploadIntents = pgTable(
  "upload_intents",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    entityId: text("entity_id"),
    expiresAt: timestamp("expires_at").notNull(),
    fileName: text("file_name").notNull(),
    id: text("id").primaryKey(),
    mimeType: text("mime_type"),
    objectKey: text("object_key").notNull(),
    registeredAt: timestamp("registered_at"),
    registeredEntityId: text("registered_entity_id"),
    registeredEntityType: text("registered_entity_type"),
    route: text("route").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    status: text("status").default("pending").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("upload_intents_object_key_idx").on(table.objectKey),
    index("upload_intents_status_expires_idx").on(
      table.status,
      table.expiresAt
    ),
    index("upload_intents_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const projectCollaborators = pgTable(
  "project_collaborators",
  {
    canDelete: boolean("can_delete").default(false).notNull(),
    canEdit: boolean("can_edit").default(true).notNull(),
    canUpload: boolean("can_upload").default(true).notNull(),
    collaboratorRole: collaboratorRoleEnum("collaborator_role").notNull(),
    collaboratorUserId: text("collaborator_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    invitationStatus: invitationStatusEnum("invitation_status")
      .default("pending")
      .notNull(),
    inviteEmail: text("invite_email"),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (table) => [index("project_collaborators_project_id_idx").on(table.projectId)]
);

export const listeningParties = pgTable(
  "listening_parties",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    endedAt: timestamp("ended_at"),
    genreId: text("genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    hostUserId: text("host_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    liveRoomId: text("live_room_id"),
    liveVideoProvider: text("live_video_provider").default("mux").notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    playbackMode: listeningPartyPlaybackModeEnum("playback_mode")
      .default("artist_hosted")
      .notNull(),
    playlistId: text("playlist_id"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    scheduledStartAt: timestamp("scheduled_start_at").notNull(),
    startedAt: timestamp("started_at"),
    status: listeningPartyStatusEnum("status").default("scheduled").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("listening_parties_project_id_idx").on(table.projectId),
    index("listening_parties_status_start_idx").on(
      table.status,
      table.scheduledStartAt
    ),
    index("listening_parties_host_user_id_idx").on(table.hostUserId),
  ]
);

export const openVerseListings = pgTable(
  "open_verse_listings",
  {
    accessMode: openVerseAccessModeEnum("access_mode")
      .default("open")
      .notNull(),
    baseMasterAssetId: text("base_master_asset_id").references(
      () => trackAssets.id,
      { onDelete: "restrict" }
    ),
    bpm: integer("bpm"),
    closesAt: timestamp("closes_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    genreId: text("genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    maxSubmissions: integer("max_submissions").default(50).notNull(),
    musicalKey: text("musical_key"),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    previewAssetId: text("preview_asset_id").references(() => trackAssets.id, {
      onDelete: "set null",
    }),
    slotEndsAtMs: integer("slot_ends_at_ms"),
    slotStartsAtMs: integer("slot_starts_at_ms"),
    status: openVerseStatusEnum("status").default("open").notNull(),
    title: text("title").notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("open_verse_listings_track_id_idx").on(table.trackId),
    index("open_verse_listings_owner_user_id_idx").on(table.ownerUserId),
    index("open_verse_listings_status_genre_idx").on(
      table.status,
      table.genreId,
      table.createdAt
    ),
  ]
);

export const openVerseAccessRequests = pgTable(
  "open_verse_access_requests",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => openVerseListings.id, { onDelete: "cascade" }),
    message: text("message"),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reviewedAt: timestamp("reviewed_at"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: openVerseAccessRequestStatusEnum("status")
      .default("pending")
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("open_verse_access_requests_listing_id_idx").on(table.listingId),
    uniqueIndex("open_verse_access_requests_listing_requester_idx").on(
      table.listingId,
      table.requesterUserId
    ),
  ]
);

export const openVerseSubmissions = pgTable(
  "open_verse_submissions",
  {
    adlibAssetId: text("adlib_asset_id").references(() => trackAssets.id, {
      onDelete: "set null",
    }),
    assetId: text("asset_id").references(() => trackAssets.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => openVerseListings.id, { onDelete: "cascade" }),
    message: text("message"),
    status: openVerseSubmissionStatusEnum("status")
      .default("submitted")
      .notNull(),
    submitterUserId: text("submitter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    vocalStemAssetId: text("vocal_stem_asset_id").references(
      () => trackAssets.id,
      { onDelete: "set null" }
    ),
  },
  (table) => [
    index("open_verse_submissions_listing_id_idx").on(table.listingId),
    index("open_verse_submissions_submitter_user_id_idx").on(
      table.submitterUserId
    ),
    uniqueIndex("open_verse_submissions_listing_submitter_idx").on(
      table.listingId,
      table.submitterUserId
    ),
  ]
);

export const videos = pgTable(
  "videos",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    durationMs: integer("duration_ms"),
    externalPlaybackUrl: text("external_playback_url"),
    genreId: text("genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    isPublic: boolean("is_public").default(true).notNull(),
    muxAssetId: text("mux_asset_id"),
    muxPassthrough: text("mux_passthrough"),
    muxPlaybackId: text("mux_playback_id"),
    muxUploadId: text("mux_upload_id"),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    playbackPolicy: videoPlaybackPolicyEnum("playback_policy")
      .default("public")
      .notNull(),
    publishedAt: timestamp("published_at"),
    releaseAt: timestamp("release_at"),
    slug: text("slug").notNull(),
    sourceProjectId: text("source_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    sourceProvider: videoSourceProviderEnum("source_provider")
      .default("mux")
      .notNull(),
    sourceTrackId: text("source_track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    status: assetStatusEnum("status").default("pending").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    verifiedOnPlatform: boolean("verified_on_platform")
      .default(false)
      .notNull(),
    videoKind: videoKindEnum("video_kind").notNull(),
  },
  (table) => [
    index("videos_owner_user_id_idx").on(table.ownerUserId),
    uniqueIndex("videos_slug_idx").on(table.slug),
  ]
);

export const videoComments = pgTable(
  "video_comments",
  {
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
  },
  (table) => [index("video_comments_video_id_idx").on(table.videoId)]
);

export const muxAssets = pgTable(
  "mux_assets",
  {
    aspectRatio: text("aspect_ratio"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    durationSeconds: numeric("duration_seconds"),
    liveStreamId: text("live_stream_id"),
    muxAssetId: text("mux_asset_id").primaryKey(),
    muxUploadId: text("mux_upload_id"),
    passthrough: text("passthrough"),
    playbackIds:
      jsonb("playback_ids").$type<{ id: string; policy: string }[]>(),
    resolutionTier: text("resolution_tier"),
    status: text("status").default("preparing").notNull(),
    tracks: jsonb("tracks"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    videoId: text("video_id").references(() => videos.id, {
      onDelete: "set null",
    }),
    videoQuality: text("video_quality"),
  },
  (table) => [
    index("mux_assets_status_idx").on(table.status),
    index("mux_assets_upload_id_idx").on(table.muxUploadId),
    uniqueIndex("mux_assets_video_id_idx").on(table.videoId),
  ]
);

export const muxUploads = pgTable(
  "mux_uploads",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    muxAssetId: text("mux_asset_id"),
    muxUploadId: text("mux_upload_id").primaryKey(),
    status: text("status").default("waiting").notNull(),
    timeoutSeconds: integer("timeout_seconds").default(3600).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    videoId: text("video_id").references(() => videos.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("mux_uploads_status_idx").on(table.status),
    index("mux_uploads_asset_id_idx").on(table.muxAssetId),
    uniqueIndex("mux_uploads_video_id_idx").on(table.videoId),
  ]
);

export const posts = pgTable(
  "posts",
  {
    caption: text("caption"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postKind: postKindEnum("post_kind").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "cascade",
    }),
    videoId: text("video_id").references(() => videos.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [index("posts_owner_user_id_idx").on(table.ownerUserId)]
);

export const postLikes = pgTable(
  "post_likes",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })]
);

export const postComments = pgTable(
  "post_comments",
  {
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    parentCommentId: text("parent_comment_id"),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("post_comments_post_id_idx").on(table.postId)]
);

export const artistFollows = pgTable(
  "artist_follows",
  {
    artistUserId: text("artist_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    followerUserId: text("follower_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.followerUserId, table.artistUserId] }),
  ]
);

export const userFollows = pgTable(
  "user_follows",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    followerUserId: text("follower_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.followerUserId, table.targetUserId] }),
  ]
);

export const librarySaves = pgTable(
  "library_saves",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.trackId] })]
);

export const recentPlays = pgTable(
  "recent_plays",
  {
    id: text("id").primaryKey(),
    lastPlayedAt: timestamp("last_played_at").defaultNow().notNull(),
    playCount: integer("play_count").default(1).notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("recent_plays_user_id_idx").on(table.userId)]
);

export const playlists = pgTable(
  "playlists",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    isPublic: boolean("is_public").default(false).notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("playlists_owner_user_id_idx").on(table.ownerUserId)]
);

export const playlistTracks = pgTable(
  "playlist_tracks",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.playlistId, table.trackId] })]
);

export const orders = pgTable(
  "orders",
  {
    buyerUserId: text("buyer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key"),
    sellerUserId: text("seller_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: orderStatusEnum("status").default("draft").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }),
    total: numeric("total", { precision: 10, scale: 2 }),
    totalCents: integer("total_cents"),
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "restrict",
    }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("orders_buyer_user_id_idx").on(table.buyerUserId),
    uniqueIndex("orders_transaction_id_idx").on(table.transactionId),
    uniqueIndex("orders_idempotency_key_idx").on(table.idempotencyKey),
  ]
);

export const carts = pgTable(
  "carts",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("carts_user_id_idx").on(table.userId)]
);

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    licenseOptionId: text("license_option_id").references(
      () => trackLicenseOptions.id,
      { onDelete: "set null" }
    ),
    priceCentsSnapshot: integer("price_cents_snapshot").notNull(),
    productType: productTypeEnum("product_type").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").default(1).notNull(),
    sellerUserId: text("seller_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    titleSnapshot: text("title_snapshot").notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cart_items_cart_id_idx").on(table.cartId),
    index("cart_items_track_id_idx").on(table.trackId),
    index("cart_items_project_id_idx").on(table.projectId),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    licenseOptionId: text("license_option_id").references(
      () => trackLicenseOptions.id,
      {
        onDelete: "set null",
      }
    ),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    priceSnapshot: numeric("price_snapshot", {
      precision: 10,
      scale: 2,
    }).notNull(),
    productType: productTypeEnum("product_type").notNull(),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").default(1).notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    videoId: text("video_id").references(() => videos.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("order_items_order_id_idx").on(table.orderId)]
);

export const purchases = pgTable(
  "purchases",
  {
    buyerUserId: text("buyer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    downloadCount: integer("download_count").default(0).notNull(),
    id: text("id").primaryKey(),
    lastDownloadedAt: timestamp("last_downloaded_at"),
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    videoId: text("video_id").references(() => videos.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("purchases_buyer_user_id_idx").on(table.buyerUserId),
    uniqueIndex("purchases_order_item_id_idx").on(table.orderItemId),
  ]
);

export const conversations = pgTable(
  "conversations",
  {
    conversationType: conversationTypeEnum("conversation_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("conversations_organization_id_idx").on(table.organizationId),
  ]
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastReadAt: timestamp("last_read_at"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("conversation_participants_user_conversation_idx").on(
      table.userId,
      table.conversationId
    ),
  ]
);

export const artistFriendRequests = pgTable(
  "artist_friend_requests",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    message: text("message"),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    respondedAt: timestamp("responded_at"),
    status: artistFriendRequestStatusEnum("status")
      .default("pending")
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("artist_friend_requests_recipient_status_idx").on(
      table.recipientUserId,
      table.status
    ),
    index("artist_friend_requests_requester_status_idx").on(
      table.requesterUserId,
      table.status
    ),
    uniqueIndex("artist_friend_requests_pair_idx").on(
      table.requesterUserId,
      table.recipientUserId
    ),
  ]
);

export const messages = pgTable(
  "messages",
  {
    body: text("body").notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: messageStatusEnum("status").default("sent").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_conversation_created_at_idx").on(
      table.conversationId,
      table.createdAt
    ),
  ]
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    displayName: text("display_name").notNull(),
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    mimeType: text("mime_type"),
    objectKey: text("object_key"),
    sizeBytes: integer("size_bytes"),
    sourceProjectId: text("source_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    sourceTrackId: text("source_track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
  },
  (table) => [index("message_attachments_message_id_idx").on(table.messageId)]
);

export const battleProfiles = pgTable("battle_profiles", {
  totalDownloads: integer("total_downloads").default(0).notNull(),
  totalLosses: integer("total_losses").default(0).notNull(),
  totalPurchases: integer("total_purchases").default(0).notNull(),
  totalSaves: integer("total_saves").default(0).notNull(),
  totalVotesReceived: integer("total_votes_received").default(0).notNull(),
  totalWins: integer("total_wins").default(0).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const battleKits = pgTable(
  "battle_kits",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    format: battleFormatEnum("format").notNull(),
    id: text("id").primaryKey(),
    isDefault: boolean("is_default").default(false).notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("battle_kits_organization_id_idx").on(table.organizationId),
    index("battle_kits_owner_user_id_idx").on(table.ownerUserId),
  ]
);

export const battleKitTracks = pgTable(
  "battle_kit_tracks",
  {
    battleKitId: text("battle_kit_id")
      .notNull()
      .references(() => battleKits.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    mainSlot: integer("main_slot"),
    role: battleKitTrackRoleEnum("role").default("main").notNull(),
    seedOrder: integer("seed_order").default(0).notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("battle_kit_tracks_battle_kit_id_idx").on(table.battleKitId),
    uniqueIndex("battle_kit_tracks_kit_track_idx").on(
      table.battleKitId,
      table.trackId
    ),
  ]
);

export const battleChallenges = pgTable(
  "battle_challenges",
  {
    challengerOrganizationId: text("challenger_organization_id").references(
      () => organization.id,
      { onDelete: "set null" }
    ),
    challengerUserId: text("challenger_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    format: battleFormatEnum("format").notNull(),
    genreId: text("genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    message: text("message"),
    opponentArtistUserId: text("opponent_artist_user_id").references(
      () => user.id,
      {
        onDelete: "set null",
      }
    ),
    opponentUsernameSnapshot: text("opponent_username_snapshot"),
    proposedDate: timestamp("proposed_date"),
    proposedTimeLabel: text("proposed_time_label"),
    status: battleChallengeStatusEnum("status").default("pending").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("battle_challenges_challenger_user_id_idx").on(
      table.challengerUserId
    ),
  ]
);

export const battles = pgTable(
  "battles",
  {
    challengerArtistUserId: text("challenger_artist_user_id").references(
      () => user.id,
      {
        onDelete: "set null",
      }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    externalBattleId: text("external_battle_id"),
    format: battleFormatEnum("format").notNull(),
    genreId: text("genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    opponentArtistUserId: text("opponent_artist_user_id").references(
      () => user.id,
      {
        onDelete: "set null",
      }
    ),
    replayVideoId: text("replay_video_id").references(() => videos.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at"),
    status: battleStatusEnum("status").default("scheduled").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    viewerCount: integer("viewer_count").default(0).notNull(),
    visibility: battleVisibilityEnum("visibility").default("public").notNull(),
  },
  (table) => [
    index("battles_external_battle_id_idx").on(table.externalBattleId),
  ]
);

export const battleRounds = pgTable(
  "battle_rounds",
  {
    battleId: text("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    isTiebreaker: boolean("is_tiebreaker").default(false).notNull(),
    roundNumber: integer("round_number").notNull(),
    status: battleRoundStatusEnum("status").default("upcoming").notNull(),
    trackOneId: text("track_one_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    trackOneVotes: integer("track_one_votes").default(0).notNull(),
    trackTwoId: text("track_two_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    trackTwoVotes: integer("track_two_votes").default(0).notNull(),
    votingEndsAt: timestamp("voting_ends_at"),
    winningTrackId: text("winning_track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("battle_rounds_battle_id_idx").on(table.battleId)]
);

export const battleLineupSnapshots = pgTable(
  "battle_lineup_snapshots",
  {
    artistUserId: text("artist_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    battleId: text("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    format: battleFormatEnum("format").notNull(),
    id: text("id").primaryKey(),
    kitId: text("kit_id")
      .notNull()
      .references(() => battleKits.id, { onDelete: "restrict" }),
    tracks: jsonb("tracks").notNull(),
  },
  (table) => [
    uniqueIndex("battle_lineup_snapshots_battle_artist_idx").on(
      table.battleId,
      table.artistUserId
    ),
  ]
);

export const battleQueueEntries = pgTable(
  "battle_queue_entries",
  {
    admittedAt: timestamp("admitted_at"),
    battleId: text("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at"),
    conflictBattleId: text("conflict_battle_id").references(() => battles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    leftAt: timestamp("left_at"),
    position: integer("position").default(0).notNull(),
    status: battleQueueEntryStatusEnum("status").default("queued").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("battle_queue_entries_battle_user_idx").on(
      table.battleId,
      table.userId
    ),
    index("battle_queue_entries_battle_status_idx").on(
      table.battleId,
      table.status,
      table.position
    ),
    index("battle_queue_entries_user_status_idx").on(
      table.userId,
      table.status
    ),
  ]
);

export const battleStats = pgTable(
  "battle_stats",
  {
    downloads: integer("downloads").default(0).notNull(),
    id: text("id").primaryKey(),
    losses: integer("losses").default(0).notNull(),
    purchases: integer("purchases").default(0).notNull(),
    saves: integer("saves").default(0).notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    wins: integer("wins").default(0).notNull(),
  },
  (table) => [index("battle_stats_user_id_idx").on(table.userId)]
);

export const liveExperiences = pgTable(
  "live_experiences",
  {
    battleId: text("battle_id").references(() => battles.id, {
      onDelete: "set null",
    }),
    battleKitId: text("battle_kit_id").references(() => battleKits.id, {
      onDelete: "set null",
    }),
    chatDownloadUrl: text("chat_download_url"),
    chatDownloadUrlExpiry: timestamp("chat_download_url_expiry"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endsAt: timestamp("ends_at"),
    genre: text("genre"),
    id: text("id").primaryKey(),
    ingestErrorCode: text("ingest_error_code"),
    ingestErrorMessage: text("ingest_error_message"),
    ingestStatus: text("ingest_status").default("idle").notNull(),
    kind: liveExperienceKindEnum("kind").notNull(),
    meetingId: text("meeting_id").notNull(),
    peakViewerCount: integer("peak_viewer_count").default(0).notNull(),
    playlistId: text("playlist_id").references(() => playlists.id, {
      onDelete: "set null",
    }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    reconnectUntil: timestamp("reconnect_until"),
    recordingAudioUrl: text("recording_audio_url"),
    recordingExpiresAt: timestamp("recording_expires_at"),
    recordingId: text("recording_id"),
    recordingStatus: text("recording_status"),
    recordingUrl: text("recording_url"),
    replayPublishedAt: timestamp("replay_published_at"),
    source: text("source").default("browser").notNull(),
    startedAt: timestamp("started_at"),
    startsAt: timestamp("starts_at").notNull(),
    status: liveExperienceStatusEnum("status").default("scheduled").notNull(),
    streamInputId: text("stream_input_id"),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    viewerCount: integer("viewer_count").default(0).notNull(),
    visibility: text("visibility").default("public").notNull(),
  },
  (table) => [
    uniqueIndex("live_experiences_meeting_id_idx").on(table.meetingId),
    index("live_experiences_creator_idx").on(table.createdByUserId),
  ]
);

export const analyticsDailyRollups = pgTable(
  "analytics_daily_rollups",
  {
    comments: integer("comments").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dateKey: text("date_key").notNull(),
    downloads: integer("downloads").default(0).notNull(),
    followers: integer("followers").default(0).notNull(),
    id: text("id").primaryKey(),
    likes: integer("likes").default(0).notNull(),
    metadata: jsonb("metadata"),
    plays: integer("plays").default(0).notNull(),
    purchases: integer("purchases").default(0).notNull(),
    revenueCents: integer("revenue_cents").default(0).notNull(),
    scopeId: text("scope_id").notNull(),
    scopeType: analyticsScopeTypeEnum("scope_type").notNull(),
    viewers: integer("viewers").default(0).notNull(),
  },
  (table) => [
    index("analytics_daily_rollups_scope_idx").on(
      table.scopeType,
      table.scopeId
    ),
  ]
);

export const payouts = pgTable(
  "payouts",
  {
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    settledAt: timestamp("settled_at"),
    status: text("status").notNull(),
    stripePayoutId: text("stripe_payout_id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("payouts_user_id_idx").on(table.userId)]
);

export const workflowJobs = pgTable(
  "workflow_jobs",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    error: jsonb("error"),
    finishedAt: timestamp("finished_at"),
    id: text("id").primaryKey(),
    input: jsonb("input"),
    jobType: text("job_type").notNull(),
    output: jsonb("output"),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    status: workflowJobStatusEnum("status").default("queued").notNull(),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    index("workflow_jobs_target_idx").on(table.targetType, table.targetId),
  ]
);

export const mediaProcessingJobs = pgTable(
  "media_processing_jobs",
  {
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currentStage: text("current_stage"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    exportVersion: integer("export_version"),
    id: text("id").primaryKey(),
    input: jsonb("input"),
    mode: mediaProcessingModeEnum("mode"),
    output: jsonb("output"),
    pipelineVersion: integer("pipeline_version").notNull(),
    progressPercent: numeric("progress_percent", { precision: 5, scale: 2 }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    sourceAssetId: text("source_asset_id").references(() => trackAssets.id, {
      onDelete: "restrict",
    }),
    startedAt: timestamp("started_at"),
    status: mediaProcessingJobStatusEnum("status").default("queued").notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "cascade",
    }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    workflowInstanceId: text("workflow_instance_id").notNull(),
    workflowType: mediaWorkflowTypeEnum("workflow_type").notNull(),
  },
  (table) => [
    index("media_processing_jobs_project_idx").on(
      table.projectId,
      table.workflowType,
      table.exportVersion
    ),
    index("media_processing_jobs_track_idx").on(
      table.trackId,
      table.workflowType,
      table.status
    ),
    uniqueIndex("media_processing_jobs_track_identity_idx").on(
      table.workflowType,
      table.trackId,
      table.sourceAssetId,
      table.pipelineVersion,
      table.mode
    ),
    uniqueIndex("media_processing_jobs_project_identity_idx").on(
      table.workflowType,
      table.projectId,
      table.exportVersion
    ),
    uniqueIndex("media_processing_jobs_workflow_instance_idx").on(
      table.workflowType,
      table.workflowInstanceId
    ),
  ]
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    eventType: text("event_type").notNull(),
    externalEventId: text("external_event_id"),
    id: text("id").primaryKey(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at"),
    provider: webhookProviderEnum("provider").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    status: webhookStatusEnum("status").default("received").notNull(),
  },
  (table) => [
    index("webhook_events_provider_idx").on(table.provider, table.eventType),
  ]
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    error: text("error"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextAttemptAt: timestamp("next_attempt_at"),
    payload: jsonb("payload").notNull(),
    provider: text("provider").default("resend").notNull(),
    providerMessageId: text("provider_message_id"),
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    sentAt: timestamp("sent_at"),
    status: emailDeliveryStatusEnum("status").default("queued").notNull(),
    template: text("template").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("email_deliveries_idempotency_key_idx").on(
      table.idempotencyKey
    ),
    index("email_deliveries_status_next_attempt_idx").on(
      table.status,
      table.nextAttemptAt
    ),
    index("email_deliveries_user_id_idx").on(table.userId),
  ]
);

export const planCatalog = pgTable(
  "plan_catalog",
  {
    adsEnabled: boolean("ads_enabled").default(true).notNull(),
    audience: accountTypeEnum("audience").notNull(),
    canViewLiveBattles: boolean("can_view_live_battles")
      .default(false)
      .notNull(),
    canVoteLiveBattles: boolean("can_vote_live_battles")
      .default(false)
      .notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    featureLimits: jsonb("feature_limits").$type<Record<string, number>>(),
    id: text("id").primaryKey(),
    maxSeats: integer("max_seats"),
    monthlyPrice: numeric("monthly_price", {
      precision: 10,
      scale: 2,
    }).notNull(),
    name: text("name").notNull(),
    stripeAnnualPriceId: text("stripe_annual_price_id"),
    stripeMonthlyPriceId: text("stripe_monthly_price_id"),
    supportsWorkspaceSeats: boolean("supports_workspace_seats")
      .default(false)
      .notNull(),
  },
  (table) => [uniqueIndex("plan_catalog_code_idx").on(table.code)]
);

export const subscriptionEntitlements = pgTable(
  "subscription_entitlements",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    entitlementKey: text("entitlement_key").notNull(),
    entitlementValue: text("entitlement_value").notNull(),
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => subscription.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("subscription_entitlements_subscription_id_idx").on(
      table.subscriptionId
    ),
  ]
);

export const searchEmbeddings = pgTable(
  "search_embeddings",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dimensions: integer("dimensions").default(1536).notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    entityId: text("entity_id").notNull(),
    entityType: searchableEntityTypeEnum("entity_type").notNull(),
    id: text("id").primaryKey(),
    indexedAt: timestamp("indexed_at").defaultNow().notNull(),
    metadata: jsonb("metadata"),
    model: text("model").notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    textHash: text("text_hash").notNull(),
    textSnapshot: text("text_snapshot").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("search_embeddings_entity_idx").on(
      table.entityType,
      table.entityId,
      table.model
    ),
    index("search_embeddings_organization_id_idx").on(table.organizationId),
  ]
);

export const rewardConfigurationVersions = pgTable(
  "reward_configuration_versions",
  {
    accountingCadence: text("accounting_cadence").default("monthly").notNull(),
    adCreatorShareBasisPoints: integer("ad_creator_share_basis_points")
      .default(5000)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    creatorAllocationCents: integer("creator_allocation_cents")
      .default(500)
      .notNull(),
    currency: text("currency").default("USD").notNull(),
    deduplicationWindowHours: integer("deduplication_window_hours")
      .default(24)
      .notNull(),
    effectiveFrom: timestamp("effective_from").notNull(),
    effectiveTo: timestamp("effective_to"),
    fanValueWeights: jsonb("fan_value_weights")
      .$type<Record<string, number>>()
      .notNull(),
    id: text("id").primaryKey(),
    liveRewardsEnabled: boolean("live_rewards_enabled")
      .default(false)
      .notNull(),
    minimumPayoutCents: integer("minimum_payout_cents").default(2500).notNull(),
    playbackThresholdPercent: integer("playback_threshold_percent")
      .default(70)
      .notNull(),
    playbackThresholdSeconds: integer("playback_threshold_seconds")
      .default(0)
      .notNull(),
    premiumPriceCents: integer("premium_price_cents").default(2299).notNull(),
    reserveDays: integer("reserve_days").default(30).notNull(),
    status: rewardConfigurationStatusEnum("status").default("draft").notNull(),
    unusedAllocationStrategy: text("unused_allocation_strategy")
      .default("return_to_platform")
      .notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("reward_configuration_versions_version_idx").on(table.version),
    index("reward_configuration_versions_status_idx").on(table.status),
  ]
);

export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    calculatedAt: timestamp("calculated_at"),
    closedAt: timestamp("closed_at"),
    configurationVersionId: text("configuration_version_id").references(
      () => rewardConfigurationVersions.id,
      { onDelete: "restrict" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    finalizedAt: timestamp("finalized_at"),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    payableAt: timestamp("payable_at"),
    periodType: text("period_type").default("monthly").notNull(),
    startsAt: timestamp("starts_at").notNull(),
    status: accountingPeriodStatusEnum("status").default("open").notNull(),
  },
  (table) => [
    uniqueIndex("accounting_periods_window_idx").on(
      table.periodType,
      table.currency,
      table.startsAt,
      table.endsAt
    ),
    index("accounting_periods_status_idx").on(table.status),
  ]
);

export const subscriptionRewardAllocations = pgTable(
  "subscription_reward_allocations",
  {
    accountingPeriodId: text("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "set null" }
    ),
    allocatedAt: timestamp("allocated_at"),
    allocationStatus: subscriptionRewardAllocationStatusEnum(
      "allocation_status"
    )
      .default("pending")
      .notNull(),
    configurationVersionId: text("configuration_version_id").references(
      () => rewardConfigurationVersions.id,
      { onDelete: "restrict" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    creatorAllocationCents: integer("creator_allocation_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    fundedAt: timestamp("funded_at"),
    grossSubscriptionAmountCents: integer(
      "gross_subscription_amount_cents"
    ).notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    reversedAt: timestamp("reversed_at"),
    stripeInvoiceId: text("stripe_invoice_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    subscriptionId: text("subscription_id").references(() => subscription.id, {
      onDelete: "set null",
    }),
    subscriptionPeriodEnd: timestamp("subscription_period_end"),
    subscriptionPeriodStart: timestamp("subscription_period_start").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("subscription_reward_allocations_invoice_idx").on(
      table.stripeInvoiceId
    ),
    index("subscription_reward_allocations_user_period_idx").on(
      table.userId,
      table.subscriptionPeriodStart
    ),
    index("subscription_reward_allocations_accounting_period_idx").on(
      table.accountingPeriodId
    ),
  ]
);

export const playbackSessions = pgTable(
  "playback_sessions",
  {
    assetId: text("asset_id").references(() => trackAssets.id, {
      onDelete: "set null",
    }),
    city: text("city"),
    clientType: text("client_type"),
    clientVersion: text("client_version"),
    countryCode: text("country_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    entitlementSnapshot: jsonb("entitlement_snapshot"),
    id: text("id").primaryKey(),
    lastHeartbeatAt: timestamp("last_heartbeat_at"),
    mutedSeconds: integer("muted_seconds").default(0).notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    playedSeconds: integer("played_seconds").default(0).notNull(),
    premiumAtStart: boolean("premium_at_start").default(false).notNull(),
    regionCode: text("region_code"),
    riskStatus: riskStatusEnum("risk_status").default("clear").notNull(),
    sessionTokenHash: text("session_token_hash"),
    sourceId: text("source_id"),
    sourceType: playbackEventSourceEnum("source_type").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    status: playbackSessionStatusEnum("status").default("started").notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("playback_sessions_user_track_idx").on(table.userId, table.trackId),
    index("playback_sessions_source_idx").on(table.sourceType, table.sourceId),
    index("playback_sessions_started_at_idx").on(table.startedAt),
  ]
);

export const qualifiedStreams = pgTable(
  "qualified_streams",
  {
    accountingPeriodId: text("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "set null" }
    ),
    configurationVersionId: text("configuration_version_id").references(
      () => rewardConfigurationVersions.id,
      { onDelete: "restrict" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    playbackSessionId: text("playback_session_id").references(
      () => playbackSessions.id,
      { onDelete: "set null" }
    ),
    qualificationWindowKey: text("qualification_window_key").notNull(),
    qualifiedAt: timestamp("qualified_at").notNull(),
    riskStatus: riskStatusEnum("risk_status").default("clear").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    sourceId: text("source_id"),
    sourceType: playbackEventSourceEnum("source_type").notNull(),
    status: qualifiedStreamStatusEnum("status").default("qualified").notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("qualified_streams_listener_track_window_idx").on(
      table.userId,
      table.trackId,
      table.qualificationWindowKey,
      table.ruleVersion
    ),
    index("qualified_streams_period_status_idx").on(
      table.accountingPeriodId,
      table.status
    ),
    index("qualified_streams_track_idx").on(table.trackId),
  ]
);

export const rewardUnits = pgTable(
  "reward_units",
  {
    accountingPeriodId: text("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "set null" }
    ),
    artistUserId: text("artist_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    configurationVersionId: text("configuration_version_id").references(
      () => rewardConfigurationVersions.id,
      { onDelete: "restrict" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at").notNull(),
    qualifiedStreamId: text("qualified_stream_id").references(
      () => qualifiedStreams.id,
      { onDelete: "set null" }
    ),
    quantity: integer("quantity").default(1).notNull(),
    riskStatus: riskStatusEnum("risk_status").default("clear").notNull(),
    sourceId: text("source_id"),
    sourceType: playbackEventSourceEnum("source_type"),
    status: rewardUnitStatusEnum("status").default("pending").notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    unitType: rewardUnitTypeEnum("unit_type").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    weightBasisPoints: integer("weight_basis_points").default(10_000).notNull(),
  },
  (table) => [
    index("reward_units_user_period_idx").on(
      table.userId,
      table.accountingPeriodId
    ),
    index("reward_units_artist_period_idx").on(
      table.artistUserId,
      table.accountingPeriodId
    ),
    index("reward_units_status_idx").on(table.status, table.riskStatus),
  ]
);

export const fanValueEvents = pgTable(
  "fan_value_events",
  {
    artistUserId: text("artist_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    eventType: fanValueEventTypeEnum("event_type").notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at").notNull(),
    points: integer("points").notNull(),
    scoreVersion: integer("score_version").notNull(),
    sourceId: text("source_id"),
    sourceType: text("source_type"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("fan_value_events_user_artist_idx").on(
      table.userId,
      table.artistUserId,
      table.occurredAt
    ),
    index("fan_value_events_artist_idx").on(table.artistUserId),
  ]
);

export const fanArtistRelationships = pgTable(
  "fan_artist_relationships",
  {
    artistUserId: text("artist_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    battleVotes: integer("battle_votes").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    engagementTier: fanValueTierEnum("engagement_tier")
      .default("new")
      .notNull(),
    firstEngagedAt: timestamp("first_engaged_at"),
    follows: integer("follows").default(0).notNull(),
    id: text("id").primaryKey(),
    lastEngagedAt: timestamp("last_engaged_at"),
    lifetimeScore: integer("lifetime_score").default(0).notNull(),
    liveAttendanceSeconds: integer("live_attendance_seconds")
      .default(0)
      .notNull(),
    netPurchaseValueCents: integer("net_purchase_value_cents")
      .default(0)
      .notNull(),
    purchaseCount: integer("purchase_count").default(0).notNull(),
    qualifiedStreamCount: integer("qualified_stream_count")
      .default(0)
      .notNull(),
    rawPlayCount: integer("raw_play_count").default(0).notNull(),
    rolling30DayScore: integer("rolling_30_day_score").default(0).notNull(),
    rolling90DayScore: integer("rolling_90_day_score").default(0).notNull(),
    saves: integer("saves").default(0).notNull(),
    scoreVersion: integer("score_version").notNull(),
    shares: integer("shares").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("fan_artist_relationships_user_artist_idx").on(
      table.userId,
      table.artistUserId
    ),
    index("fan_artist_relationships_artist_tier_idx").on(
      table.artistUserId,
      table.engagementTier
    ),
  ]
);

export const recordingRightsholders = pgTable(
  "recording_rightsholders",
  {
    approvedAt: timestamp("approved_at"),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    effectiveFrom: timestamp("effective_from").notNull(),
    effectiveTo: timestamp("effective_to"),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    payeeId: text("payee_id").notNull(),
    payeeType: payeeTypeEnum("payee_type").notNull(),
    shareBasisPoints: integer("share_basis_points").notNull(),
    splitVersion: integer("split_version").notNull(),
    status: rightsholderSplitStatusEnum("status").default("draft").notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("recording_rightsholders_track_status_idx").on(
      table.trackId,
      table.status
    ),
    uniqueIndex("recording_rightsholders_track_payee_version_idx").on(
      table.trackId,
      table.payeeType,
      table.payeeId,
      table.splitVersion
    ),
  ]
);

export const videoAdCampaigns = pgTable(
  "video_ad_campaigns",
  {
    advertiserUserId: text("advertiser_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    budgetCents: integer("budget_cents"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    endsAt: timestamp("ends_at"),
    id: text("id").primaryKey(),
    inventoryType: adInventoryTypeEnum("inventory_type").notNull(),
    metadata: jsonb("metadata"),
    startsAt: timestamp("starts_at").notNull(),
    status: text("status").default("pending_review").notNull(),
    targetRegions: jsonb("target_regions").$type<string[]>(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("video_ad_campaigns_status_idx").on(table.status),
    index("video_ad_campaigns_window_idx").on(table.startsAt, table.endsAt),
  ]
);

export const videoAdImpressions = pgTable(
  "video_ad_impressions",
  {
    accountingPeriodId: text("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "set null" }
    ),
    campaignId: text("campaign_id").references(() => videoAdCampaigns.id, {
      onDelete: "set null",
    }),
    city: text("city"),
    countryCode: text("country_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    impressionValueCents: integer("impression_value_cents")
      .default(0)
      .notNull(),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at").notNull(),
    regionCode: text("region_code"),
    status: adImpressionStatusEnum("status").default("requested").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    videoId: text("video_id").references(() => videos.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("video_ad_impressions_video_period_idx").on(
      table.videoId,
      table.accountingPeriodId
    ),
    index("video_ad_impressions_campaign_idx").on(table.campaignId),
  ]
);

export const adRevenuePeriods = pgTable(
  "ad_revenue_periods",
  {
    accountingPeriodId: text("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "set null" }
    ),
    adServingCostCents: integer("ad_serving_cost_cents").default(0).notNull(),
    collectedRevenueCents: integer("collected_revenue_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    creatorPoolCents: integer("creator_pool_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    invalidTrafficAdjustmentCents: integer("invalid_traffic_adjustment_cents")
      .default(0)
      .notNull(),
    netRevenueCents: integer("net_revenue_cents").notNull(),
    provider: text("provider").notNull(),
    refundsCents: integer("refunds_cents").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("ad_revenue_periods_provider_period_idx").on(
      table.provider,
      table.accountingPeriodId
    ),
  ]
);

export const userWallets = pgTable(
  "user_wallets",
  {
    balanceCents: integer("balance_cents").default(0).notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    stripeCustomerId: text("stripe_customer_id"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("user_wallets_user_id_idx").on(table.userId),
    index("user_wallets_stripe_customer_idx").on(table.stripeCustomerId),
  ]
);

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    advertiserId: text("advertiser_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    billingType: adBillingTypeEnum("billing_type")
      .default("prepaid_wallet")
      .notNull(),
    clickthroughUrl: text("clickthrough_url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    creativeFormat: adCreativeFormatEnum("creative_format")
      .default("audio")
      .notNull(),
    creativeImageUrl: text("creative_image_url"),
    creativeUrl: text("creative_url").notNull(),
    dailyBudgetCents: integer("daily_budget_cents").default(500).notNull(),
    dailyImpressionCap: integer("daily_impression_cap").default(1000).notNull(),
    endDate: timestamp("end_date"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    placement: adPlacementEnum("placement").default("audio_preroll").notNull(),
    startDate: timestamp("start_date").defaultNow().notNull(),
    status: adCampaignStatusEnum("status").default("draft").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("ad_campaigns_advertiser_idx").on(table.advertiserId),
    index("ad_campaigns_placement_idx").on(table.placement),
    index("ad_campaigns_status_dates_idx").on(
      table.status,
      table.startDate,
      table.endDate
    ),
  ]
);

export const adCampaignTargets = pgTable(
  "ad_campaign_targets",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    targetCode: text("target_code").notNull(),
    targetType: adTargetTypeEnum("target_type").notNull(),
  },
  (table) => [
    index("ad_campaign_targets_lookup_idx").on(
      table.targetType,
      table.targetCode
    ),
    uniqueIndex("ad_campaign_targets_unique_idx").on(
      table.campaignId,
      table.targetType,
      table.targetCode
    ),
  ]
);

export const adMetricDaily = pgTable(
  "ad_metric_daily",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    clicksCount: integer("clicks_count").default(0).notNull(),
    date: text("date").notNull(),
    id: text("id").primaryKey(),
    impressionsCount: integer("impressions_count").default(0).notNull(),
    spendCents: integer("spend_cents").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("ad_metric_daily_campaign_date_idx").on(
      table.campaignId,
      table.date
    ),
    index("ad_metric_daily_date_idx").on(table.date),
  ]
);

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    accountType: ledgerAccountTypeEnum("account_type").notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("ledger_accounts_code_currency_owner_idx").on(
      table.code,
      table.currency,
      table.ownerUserId
    ),
  ]
);

export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    accountingPeriodId: text("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata"),
    postedAt: timestamp("posted_at"),
    reversedTransactionId: text("reversed_transaction_id"),
    sourceId: text("source_id"),
    sourceType: text("source_type").notNull(),
    status: ledgerTransactionStatusEnum("status").default("pending").notNull(),
  },
  (table) => [
    uniqueIndex("ledger_transactions_idempotency_key_idx").on(
      table.idempotencyKey
    ),
    index("ledger_transactions_period_idx").on(table.accountingPeriodId),
  ]
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    id: text("id").primaryKey(),
    side: ledgerEntrySideEnum("side").notNull(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("ledger_entries_transaction_idx").on(table.transactionId),
    index("ledger_entries_account_idx").on(table.accountId),
  ]
);

export const creatorEarnings = pgTable(
  "creator_earnings",
  {
    accountingPeriodId: text("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "set null" }
    ),
    artistUserId: text("artist_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    earningType: creatorEarningTypeEnum("earning_type").notNull(),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    heldAmountCents: integer("held_amount_cents").default(0).notNull(),
    id: text("id").primaryKey(),
    ledgerTransactionId: text("ledger_transaction_id").references(
      () => ledgerTransactions.id,
      { onDelete: "set null" }
    ),
    metadata: jsonb("metadata"),
    payableAmountCents: integer("payable_amount_cents").default(0).notNull(),
    payeeId: text("payee_id"),
    payeeType: payeeTypeEnum("payee_type"),
    quantity: integer("quantity").default(1).notNull(),
    rewardUnitId: text("reward_unit_id").references(() => rewardUnits.id, {
      onDelete: "set null",
    }),
    ruleVersion: integer("rule_version"),
    splitVersion: integer("split_version"),
    status: creatorEarningStatusEnum("status").default("estimated").notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    unitRateCents: integer("unit_rate_cents"),
  },
  (table) => [
    index("creator_earnings_artist_period_idx").on(
      table.artistUserId,
      table.accountingPeriodId
    ),
    index("creator_earnings_status_idx").on(table.status),
  ]
);

export const creatorStatements = pgTable(
  "creator_statements",
  {
    accountingPeriodId: text("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "set null" }
    ),
    artistUserId: text("artist_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    finalizedAt: timestamp("finalized_at"),
    grossAmountCents: integer("gross_amount_cents").default(0).notNull(),
    heldAmountCents: integer("held_amount_cents").default(0).notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    paidAmountCents: integer("paid_amount_cents").default(0).notNull(),
    payableAmountCents: integer("payable_amount_cents").default(0).notNull(),
    status: text("status").default("draft").notNull(),
  },
  (table) => [
    uniqueIndex("creator_statements_artist_period_idx").on(
      table.artistUserId,
      table.accountingPeriodId
    ),
  ]
);

export const creatorStatementItems = pgTable(
  "creator_statement_items",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    earningId: text("earning_id").references(() => creatorEarnings.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    statementId: text("statement_id")
      .notNull()
      .references(() => creatorStatements.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("creator_statement_items_statement_earning_idx").on(
      table.statementId,
      table.earningId
    ),
  ]
);

export const payoutHolds = pgTable(
  "payout_holds",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at"),
    holdReason: text("hold_reason").notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    releasedAt: timestamp("released_at"),
    releasedByUserId: text("released_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: payoutHoldStatusEnum("status").default("active").notNull(),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    index("payout_holds_target_idx").on(table.targetType, table.targetId),
    index("payout_holds_status_idx").on(table.status),
  ]
);

export const settlementRuns = pgTable(
  "settlement_runs",
  {
    accountingPeriodId: text("accounting_period_id")
      .notNull()
      .references(() => accountingPeriods.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    error: jsonb("error"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata"),
    runType: text("run_type").default("monthly_settlement").notNull(),
    startedAt: timestamp("started_at"),
    status: workflowJobStatusEnum("status").default("queued").notNull(),
  },
  (table) => [
    uniqueIndex("settlement_runs_idempotency_key_idx").on(table.idempotencyKey),
    index("settlement_runs_period_idx").on(table.accountingPeriodId),
  ]
);

export const projectPreSaves = pgTable(
  "project_pre_saves",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.projectId] })]
);

export const videoPreSaves = pgTable(
  "video_pre_saves",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.videoId] })]
);

export const trackPreSaves = pgTable(
  "track_pre_saves",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.trackId] })]
);

export const userNotifications = pgTable(
  "user_notifications",
  {
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    aggregationKey: text("aggregation_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    entityId: text("entity_id"),
    entityType: text("entity_type"),
    id: text("id").primaryKey(),
    link: text("link"),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    read: boolean("read").default(false).notNull(),
    title: text("title").notNull(),
    type: text("type").default("general").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("user_notifications_user_created_idx").on(
      table.userId,
      table.createdAt,
      table.id
    ),
    index("user_notifications_user_read_created_idx").on(
      table.userId,
      table.read,
      table.createdAt
    ),
    index("user_notifications_user_aggregation_idx").on(
      table.userId,
      table.aggregationKey,
      table.createdAt
    ),
  ]
);

export const notificationEmailCooldowns = pgTable(
  "notification_email_cooldowns",
  {
    lastSentAt: timestamp("last_sent_at").defaultNow().notNull(),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.recipientUserId, table.scope] }),
    index("notification_email_cooldowns_last_sent_idx").on(table.lastSentAt),
  ]
);
