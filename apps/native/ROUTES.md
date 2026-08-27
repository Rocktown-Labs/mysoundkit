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

The four product tabs are generated from `NATIVE_TAB_ROUTES`. Each tab owns a
native stack, so its menu destinations keep the tab bar visible while opening a
placeholder route. Authentication remains in the Account drawer destination.

## Placeholder routes

The navigation shell currently exposes the same destination menus as the web
mobile navigation:

- Explore: Songs, Projects, Videos, Genres, Artists, Shop, and Communities
- Library: Recently Played, Recently Watched, Playlists, Saved Tracks,
  Purchased, and Account
- Live: Battles, Listening Parties, and Streams
- Dashboard: My Music, My Career, Live, and Create New

These routes intentionally show a branded “Route ready” placeholder until their
feature surfaces are implemented natively. The placeholder status means the
navigation contract is real; it does not imply that the underlying feature is
complete.

## Intentional differences

- Admin, pricing/checkout marketing, and project editing remain web-only.
- High-bandwidth creator uploads have native placeholder routes for navigation
  preview, but the production upload flow remains web-only until native media
  handling is implemented.
- Responsive mobile web navigation is not the Expo tab bar. It continues to use
  TanStack Router and the web navigation components.
- Explore is the native default tab, whereas authenticated web creators may land
  on `/dashboard`.

## API contract

`lib/soundkit-api.ts` instantiates `hc<AppType>` from the server's canonical Hono
RPC contract. Normal JSON API access must use this client. Binary uploads,
streaming media, webhook callbacks, and WebSockets remain explicit transport
exceptions, matching `apps/server/src/rpc-contract-policy.ts`.
