# SoundKit artist profiles

Standalone TanStack Start artist-profile app for `bio.mysoundkit.com/{username}`.

## Local development

Run the API and profile app from the workspace root:

```bash
pnpm --filter server dev
pnpm --filter bio dev
```

The app uses `VITE_SERVER_URL` for the public artist/media API,
`VITE_SOUNDKIT_WEB_URL` for first-party SoundKit links, and
`VITE_TURNSTILE_SITE_KEY` for signup bot protection. Tipping signs users in
on `mysoundkit.com` through a popup handoff and sends the resulting Better Auth
bearer session to the existing `/v1/payments/tips` flow. No SoundKit session
cookie is assumed on the configured SoundKit web origin.

## Domain rollout

The initial rollout is provisioned as the `soundkit-bio` Alchemy Worker on the
existing `mysoundkit.com` zone:

- Production: `https://bio.mysoundkit.com`
- Pull requests: `https://bio-pr-<number>.mysoundkit.com`

The `soundkit.bio` custom domain can be attached later without changing the
profile routes. Set `SOUNDKIT_BIO_URL` only when overriding the generated
origin.
