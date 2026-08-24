# Cloudflare optimization backlog

This document records Cloudflare experiments that are intentionally **not** enabled by the Explore regional-discovery work. Future agents should read `.agents/skills/cloudflare/SKILL.md` and retrieve current Cloudflare documentation before changing production infrastructure.

## Smart Placement experiment

### Current baseline

The API Worker is explicitly placed next to PlanetScale/Hyperdrive:

```ts
placement: {
  region: "aws:us-east-1",
}
```

The same placement is declared in `apps/server/wrangler.jsonc` and `packages/infra/alchemy.run.ts`. Smart Placement is therefore an alternative to the existing regional placement, not an upgrade from placement being disabled.

### Revisit when

- Public API cache hit rate and database timing are observable for at least seven representative days.
- SoundKit has meaningful traffic outside the eastern United States.
- Playback-start metrics can be separated from catalog/API metrics.

### Experiment contract

Compare explicit `aws:us-east-1` placement against Smart Placement while holding the application version and cache policy constant. Record:

- Worker wall time and CPU time
- Hyperdrive/database duration
- Request p50, p95, and p99
- Playback-start latency separately from JSON APIs
- Error rate and timeout rate
- Geographic segment/colo
- Public-cache HIT/MISS/BYPASS state

Use a staged traffic split or repeatable load profile. Do not treat sequential before/after weeks as conclusive because inventory, traffic geography, and cache warmth can change.

### Rollback

Restore explicit `aws:us-east-1` placement in both infrastructure declarations and redeploy. Never leave Wrangler and Alchemy placement declarations inconsistent.

## Image Transformations enablement

Large checked-in placeholders were converted to WebP, and public media URLs are canonicalized. Cloudflare Image Transformations remain disabled until the zone is configured safely.

Before enabling transformations:

1. Enable Image Transformations for the website zone.
2. Allow only SoundKit's canonical public media origin under **Images → Transformations → Sources**. Do not allow `*`.
3. Add a feature-gated URL helper using fixed widths and `format=auto`.
4. Transform only public artwork/profile images. Exclude blobs, data URLs, masters, stems, downloads, and guarded playback.
5. On transformation failure, fall back once to the canonical original URL before showing a placeholder.
6. Measure transformed requests, unique transformation cardinality, bytes, LCP, and cost before broad rollout.

Canonical URL form:

```text
/cdn-cgi/image/format=auto,width=640/https://media.mysoundkit.com/media/<objectKey>
```

Do not use the obsolete `f=auto` spelling.

## R2 Event Notifications

Upload intents are now the ownership source of truth, and the cron sweep reconciles legacy objects with cursor pagination. Do not add ObjectCreate notifications merely to duplicate seven-day cleanup.

Event Notifications are worth revisiting only for observability or near-real-time intent enrichment. Queue consumers must remain idempotent because event delivery can be duplicated and asynchronous. The expiry cron must remain the final cleanup authority.
