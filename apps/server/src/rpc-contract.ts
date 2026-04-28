import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";

import type {
  directVideoUploadResponseSchema,
  meResponseSchema,
  planSchema,
  projectDashboardDetailSchema,
  projectSummarySchema,
  sellerOnboardingResponseSchema,
  sellerStatusSchema,
  trackDashboardDetailSchema,
  trackProcessingStatusSchema,
  trackSummarySchema,
  videoSummarySchema,
} from "./lib/schemas";
import {
  createProjectBodySchema,
  createSellerAccountLinkBodySchema,
  createTrackAssetBodySchema,
  createTrackBodySchema,
  createVideoBodySchema,
  directVideoUploadBodySchema,
  onboardingArtistBodySchema,
  onboardingFanBodySchema,
  onboardingResponseSchema,
  updateProjectBodySchema,
  updateTrackBodySchema,
} from "./lib/schemas";

const jsonValidator = <Schema extends z.ZodType>(schema: Schema) =>
  validator("json", (value) => schema.parse(value) as z.infer<Schema>);

const checkoutBodySchema = z.object({
  cancelUrl: z.url(),
  planCode: z.string(),
  referenceId: z.string().optional(),
  seats: z.number().int().positive().optional(),
  successUrl: z.url(),
});

const checkoutResponseSchema = onboardingResponseSchema.pick({
  checkoutUrl: true,
  requiresCheckout: true,
  setupRequired: true,
});

export const rpcContract = new Hono()
  .get("/v1/me/", (c) => c.json({} as z.infer<typeof meResponseSchema>))
  .post(
    "/v1/onboarding/artist",
    jsonValidator(onboardingArtistBodySchema),
    (c) => c.json({} as z.infer<typeof onboardingResponseSchema>, 201)
  )
  .post("/v1/onboarding/fan", jsonValidator(onboardingFanBodySchema), (c) =>
    c.json({} as z.infer<typeof onboardingResponseSchema>, 201)
  )
  .get("/v1/billing/plans", (c) => c.json([] as z.infer<typeof planSchema>[]))
  .post("/v1/billing/checkout", jsonValidator(checkoutBodySchema), (c) =>
    c.json({} as z.infer<typeof checkoutResponseSchema>)
  )
  .get("/v1/tracks/", (c) => c.json([] as z.infer<typeof trackSummarySchema>[]))
  .post("/v1/tracks/", jsonValidator(createTrackBodySchema), (c) =>
    c.json({} as z.infer<typeof trackSummarySchema>, 201)
  )
  .get("/v1/tracks/:trackId", (c) =>
    c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .patch("/v1/tracks/:trackId", jsonValidator(updateTrackBodySchema), (c) =>
    c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .post(
    "/v1/tracks/:trackId/assets",
    jsonValidator(createTrackAssetBodySchema),
    (c) => c.json({} as z.infer<typeof trackDashboardDetailSchema>)
  )
  .post("/v1/tracks/:trackId/process", (c) =>
    c.json({} as z.infer<typeof trackProcessingStatusSchema>)
  )
  .get("/v1/projects/", (c) =>
    c.json([] as z.infer<typeof projectSummarySchema>[])
  )
  .post("/v1/projects/", jsonValidator(createProjectBodySchema), (c) =>
    c.json({} as z.infer<typeof projectSummarySchema>, 201)
  )
  .get("/v1/projects/:projectId", (c) =>
    c.json({} as z.infer<typeof projectDashboardDetailSchema>)
  )
  .patch(
    "/v1/projects/:projectId",
    jsonValidator(updateProjectBodySchema),
    (c) => c.json({} as z.infer<typeof projectDashboardDetailSchema>)
  )
  .get("/v1/videos/", (c) => c.json([] as z.infer<typeof videoSummarySchema>[]))
  .post("/v1/videos/", jsonValidator(createVideoBodySchema), (c) =>
    c.json({} as z.infer<typeof videoSummarySchema>, 201)
  )
  .post(
    "/v1/videos/direct-upload",
    jsonValidator(directVideoUploadBodySchema),
    (c) => c.json({} as z.infer<typeof directVideoUploadResponseSchema>, 201)
  )
  .get("/v1/seller/status", (c) =>
    c.json({} as z.infer<typeof sellerStatusSchema>)
  )
  .post(
    "/v1/seller/account-link",
    jsonValidator(createSellerAccountLinkBodySchema),
    (c) => c.json({} as z.infer<typeof sellerOnboardingResponseSchema>)
  );

export type AppType = typeof rpcContract;
