# SoundKit.bio

Standalone TanStack Start artist-profile app for `soundkit.bio/{username}`.

## Local development

Run the API and profile app from the workspace root:

```bash
pnpm --filter server dev
pnpm --filter bio dev
```

The app uses `VITE_SERVER_URL` for the public artist/media API and
`VITE_SOUNDKIT_WEB_URL` for first-party SoundKit links. Tipping signs users in
on `mysoundkit.com` through a popup handoff and sends the resulting Better Auth
bearer session to the existing `/v1/payments/tips` flow. No SoundKit session
cookie is assumed on `soundkit.bio`.

## Domain rollout

The app is provisioned as the `soundkit-bio` Alchemy Worker. The custom
`soundkit.bio` domain must be purchased and attached before a production
`alchemy deploy`; preview stages use a `bio-<stage>.mysoundkit.com` domain.
Set `SOUNDKIT_BIO_URL` only when overriding the generated origin.
