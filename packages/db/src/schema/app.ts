import {
  boolean,
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

import { organization, subscription, user } from "./auth";

export const accountTypeEnum = pgEnum("account_type", ["artist", "fan"]);
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
  "instrumental",
  "verse_vocal",
  "adlib",
  "session_file",
  "reference_audio",
  "variant_audio",
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
export const productTypeEnum = pgEnum("product_type", ["track", "video"]);
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
export const battleFormatEnum = pgEnum("battle_format", [
  "best_of_3",
  "best_of_5",
  "best_of_7",
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
export const webhookProviderEnum = pgEnum("webhook_provider", [
  "stripe",
  "mux",
  "battle_service",
]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processed",
  "failed",
  "ignored",
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
    bio: text("bio"),
    city: text("city"),
    country: text("country"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    displayName: text("display_name"),
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
    projectCount: integer("project_count").default(0).notNull(),
    publicProfileEnabled: boolean("public_profile_enabled")
      .default(true)
      .notNull(),
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
  emailSales: boolean("email_sales").default(true).notNull(),
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

export const tracks = pgTable(
  "tracks",
  {
    bpm: integer("bpm"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currency: text("currency").default("USD").notNull(),
    description: text("description"),
    genreId: text("genre_id").references(() => genres.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    isForSale: boolean("is_for_sale").default(false).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    musicalKey: text("musical_key"),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 10, scale: 2 }),
    productionStatus: trackProductionStatusEnum("production_status")
      .default("demo")
      .notNull(),
    publishedAt: timestamp("published_at"),
    slug: text("slug").notNull(),
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
    metadata: jsonb("metadata"),
    mimeType: text("mime_type"),
    objectKey: text("object_key"),
    sizeBytes: integer("size_bytes"),
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
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    uploaderUserId: text("uploader_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("track_assets_track_id_idx").on(table.trackId),
    index("track_assets_variant_id_idx").on(table.trackVariantId),
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
    description: text("description"),
    id: text("id").primaryKey(),
    isPublic: boolean("is_public").default(true).notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectType: projectTypeEnum("project_type").notNull(),
    releaseDate: timestamp("release_date"),
    slug: text("slug").notNull(),
    status: projectStatusEnum("status").default("draft").notNull(),
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
    id: text("id").primaryKey(),
    mimeType: text("mime_type"),
    muxAssetId: text("mux_asset_id"),
    muxPlaybackId: text("mux_playback_id"),
    muxUploadId: text("mux_upload_id"),
    objectKey: text("object_key"),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sizeBytes: integer("size_bytes"),
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
  (table) => [index("project_assets_project_id_idx").on(table.projectId)]
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

export const videos = pgTable(
  "videos",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    durationMs: integer("duration_ms"),
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
    sourceProjectId: text("source_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
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
    videoKind: videoKindEnum("video_kind").notNull(),
  },
  (table) => [index("videos_owner_user_id_idx").on(table.ownerUserId)]
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
    sellerUserId: text("seller_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: orderStatusEnum("status").default("draft").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }),
    total: numeric("total", { precision: 10, scale: 2 }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("orders_buyer_user_id_idx").on(table.buyerUserId)]
);

export const orderItems = pgTable(
  "order_items",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    priceSnapshot: numeric("price_snapshot", {
      precision: 10,
      scale: 2,
    }).notNull(),
    productType: productTypeEnum("product_type").notNull(),
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
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    trackId: text("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    videoId: text("video_id").references(() => videos.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("purchases_buyer_user_id_idx").on(table.buyerUserId)]
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
  (table) => [primaryKey({ columns: [table.conversationId, table.userId] })]
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
  (table) => [index("messages_conversation_id_idx").on(table.conversationId)]
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
    title: text("title").notNull(),
  },
  (table) => [index("battle_kits_organization_id_idx").on(table.organizationId)]
);

export const battleKitTracks = pgTable(
  "battle_kit_tracks",
  {
    battleKitId: text("battle_kit_id")
      .notNull()
      .references(() => battleKits.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    seedOrder: integer("seed_order").default(0).notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("battle_kit_tracks_battle_kit_id_idx").on(table.battleKitId),
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
    id: text("id").primaryKey(),
    monthlyPrice: numeric("monthly_price", {
      precision: 10,
      scale: 2,
    }).notNull(),
    name: text("name").notNull(),
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
