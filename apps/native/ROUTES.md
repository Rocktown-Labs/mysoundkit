# Native route architecture

`lib/route-manifest.ts` is the canonical web-to-native route map. Run
`bun run check-routes` from this package whenever tab ownership or route support
changes.

## Native navigation ownership

| Tab       | Expo route   | Stack responsibility                                               |
| --------- | ------------ | ------------------------------------------------------------------ |
| Explore   | `/`          | Public tracks, projects, videos, artists, communities, and shop    |
| Library   | `/library`   | Saved/recent content, playlists, purchases, and listener settings  |
| Live      | `/live`      | Battles, listening parties, and creator streams                    |
| Dashboard | `/dashboard` | Creator catalog, community, messages, live tools, and career tools |

Authentication remains in the root Account drawer destination. The four product
tabs are generated from `NATIVE_TAB_ROUTES`, while `CANONICAL_ROUTES` records the
owning stack and implementation status for every mapped destination.

## Intentional differences

- Admin, pricing/checkout marketing, and high-bandwidth creator upload/edit
  workflows remain web-only. Native links should open their canonical web URL.
- Responsive mobile web navigation is not the Expo tab bar. It continues to use
  TanStack Router and the web navigation components.
- A `planned` native route has reserved stack ownership but is not presented as
  implemented. This prevents placeholder screens from accidentally becoming a
  public contract.
- Explore is the native default tab, whereas authenticated web creators may land
  on `/dashboard`.

## API contract

`lib/soundkit-api.ts` instantiates `hc<AppType>` from the server's canonical Hono
RPC contract. Normal JSON API access must use this client. Binary uploads,
streaming media, webhook callbacks, and WebSockets remain explicit transport
exceptions, matching `apps/server/src/rpc-contract-policy.ts`.
