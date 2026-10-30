# Google sign-in setup

The website already includes a Google button and the four-color Google logo. The server advertises provider availability at `GET /v1/auth/capabilities`; the button is hidden when `google` is false. Google sign-in requires both OAuth credentials at runtime.

## Production

1. Create or reuse a Google Cloud OAuth **Web application** client for SoundKit. Configure the consent screen and its publication/test-user settings as appropriate for your users.
2. Register this exact authorized redirect URI:

   `https://api.mysoundkit.com/auth/callback/google`

   SoundKit uses Better Auth's `/auth` base path. This is the server callback, distinct from the website destination after sign-in.
3. In GitHub **Settings → Secrets and variables → Actions**, add the client values as secrets named `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (repository or `production` environment). Do not commit them or paste them into issue/PR comments.
4. Run the production deployment workflow on merged `master`. The workflow passes the credentials to Alchemy; the client secret is bound as a redacted Cloudflare Worker secret.
5. Check that `https://api.mysoundkit.com/v1/auth/capabilities` returns `{"google":true}`. Then open `/login` or `/signup`: **Continue with Google** and its logo should appear. A person with an approved Google account should complete the consent flow to verify the full exchange.

Only the production deployment forwards these production OAuth credentials. PR previews remain without this provider; enabling a preview requires separate credentials/configuration and an explicitly registered callback for that preview. Local development can set both variables in the server/infra environment and register `http://localhost:3000/auth/callback/google` for a local API using that origin.

## Troubleshooting

- `google:false`: at least one runtime credential is absent. Check secret names and redeploy; adding GitHub secrets alone does not update an existing Worker.
- `redirect_uri_mismatch`: register the exact API origin and `/auth/callback/google` path emitted by the deployment.
- Google denies access to an unpublished consent screen: check the client's test-user/publication configuration in Google Cloud.
- Email sign-in stays available when Google is unconfigured.

References: [Better Auth Google provider](https://better-auth.com/docs/authentication/google), [Google web-server OAuth configuration](https://developers.google.com/identity/protocols/oauth2/web-server).
