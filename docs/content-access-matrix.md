# Track access matrix (#513 / #525)

This is the first caller family moved to a shared explicit policy. Server-owned
purchase and accepted invitation records establish access; client account type,
UI visibility, checkout success pages and analytics events do not.

| Caller | Public/free | Public/premium-or-purchased | Private | Soft-deleted |
| --- | --- | --- | --- | --- |
| Anonymous or ordinary fan | Listen | No full playback | Denied | Denied |
| Active premium listener | Listen | Listen while entitled | Denied | Denied |
| Retained direct/project purchaser | Listen | Listen | Listen | Listen while media remains retained |
| Track owner | Listen/manage | Listen/manage | Listen/manage | Existing owner recovery access retained |
| Accepted direct/project collaborator | Listen | Listen/manage | Listen/manage | Denied without a retained purchase |
| Pending/rejected collaborator | Ordinary listener rules | Ordinary listener rules | Denied | Denied |

`resolveTrackPlaybackAccess` in `content-access.ts` decides guarded playback.
`hasAcceptedTrackCollaboration` supplies the same accepted direct/project facts
to playback and collaborator detail routes. The guarded playback response is
private/no-store and denies unauthorized callers before reading media bytes.
Expiration of a track's exclusivity window still follows `resolveListeningAccess`;
premium is never a substitute for private-content authority.

A purchase grants paid access unless its associated positive-value transaction
is refunded and confirmed individual Stripe Refund facts cover the full amount.
Partial refunds retain access. Multiple partial refunds revoke access once their
confirmed total reaches the full transaction amount. Every digital item in that
fully refunded transaction loses its paid grant; a separate valid purchase or
owner/collaborator authority still grants access.

Purchase/receipt history is preserved; revoked history has no download links.
Free orders and orders without a payment transaction keep their grants. Ambiguous
legacy charge totals (ch_ IDs) and a refunded status alone are insufficient to
revoke access; those require observational reconciliation, not guessed repairs.
The provider writer records only confirmed individual Refund facts (re_ IDs)
atomically with the refunded transaction state. No refund is issued or historical
financial record rewritten by this read-only entitlement policy (#527).

## Other caller boundaries

- Library metadata uses the existing SQL visibility policy: retained direct or
  project purchases survive visibility/deletion; accepted collaboration requires
  a non-deleted track. This change fixes playback rejecting those library buyers
  and project collaborators.
- Public catalog detail stays public and non-deleted. A buyer's retained library
  playback does not expose the artist dashboard or turn a private track into a
  discoverable public catalog page. Broader metadata/capability migration remains
  a separate caller-family change.
- Downloads use the artist's download/first-play/purchase policies and keep raw
  master/stem/session sources owner-only. Listening permission does not grant raw
  source downloads or project export/edit authority.
- Generic media URLs, artwork and open-verse snippets retain their separate asset
  policies. They are not substitutes for the guarded full-track playback route.
- Playback qualification/royalty eligibility is distinct from permission to hear
  media. Private/owner playback must not be reported as a new qualifying public
  stream merely because it was authorized.

No schema migration, provider money action or broad security-audit sign-off is
part of this increment. Future caller migrations must extend this matrix and
prove their own API/media/download behavior without collapsing distinct rules.
