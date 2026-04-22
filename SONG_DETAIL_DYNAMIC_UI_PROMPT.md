# Song Detail Dynamic UI Prompt

The current song/detail page is visually moving in the right direction, but it is too hardcoded around a producer beat/license purchase flow. For this pass, only update the UI and mock data for the song/detail page. Do not change the real API, database schema, auth, checkout, persistence, or backend behavior.

SoundKit needs the same detail page to support both regular music releases and producer instrumental releases from mock data.

## Goal

Make the song/detail page dynamic so the page changes based on the mocked catalog item type and purchase mode.

The page should support:

- Regular music releases such as singles, albums, and EPs.
- Producer/instrumental releases such as beats and instrumentals.

Regular music releases should feel more like iTunes or Amazon Music: fans are buying a song, album, or EP. Producer/instrumental releases can keep the current license-oriented direction: artists or creators are licensing a beat or instrumental.

## Important Scope

- Only work on UI and mock data.
- Do not add real schema changes.
- Do not add real API changes.
- Do not add checkout or payment behavior.
- Do not add backend persistence.
- Do not hardcode the page to one mocked track.

The purpose of this pass is to make the UI data-ready so we can wire the real API later.

## Suggested Mock Shape

Adapt these names to match the existing code style, but keep the same concept.

```ts
type ArtistRole = "musician" | "producer";

type CatalogItemType = "single" | "album" | "ep" | "beat" | "instrumental";

type PurchaseMode = "digital_download" | "license";

type MockArtist = {
  id: string;
  name: string;
  handle?: string;
  roles: ArtistRole[];
  verified?: boolean;
  avatarUrl?: string;
  genre?: string;
  location?: string;
  followers?: string;
  listeners?: string;
};

type MockCatalogItem = {
  id: string;
  type: CatalogItemType;
  purchaseMode: PurchaseMode;
  title: string;
  artist: MockArtist;
  coverArtUrl: string;
  genre?: string;
  tags?: string[];
  bpm?: number;
  musicalKey?: string;
  duration?: string;
  streamCount?: string;
  description?: string;
  priceLabel: string;
  isOwned?: boolean;
  isPurchasable: boolean;
  isStreamable: boolean;
  assets: MockCatalogAsset[];
  licenseOptions?: MockLicenseOption[];
  visualContent?: MockVisualContent[];
};

type MockCatalogAsset = {
  id: string;
  label: string;
  subtitle?: string;
  kind:
    | "master"
    | "clean"
    | "instrumental"
    | "alternate_mix"
    | "artwork"
    | "booklet"
    | "tagged_mp3"
    | "untagged_wav"
    | "stems"
    | "midi"
    | "license_pdf";
  format?: string;
  included: boolean;
};

type MockLicenseOption = {
  id: string;
  name: string;
  priceLabel: string;
  rightsSummary: string[];
  includesStems?: boolean;
  isExclusive?: boolean;
};

type MockVisualContent = {
  id: string;
  title: string;
  thumbnailUrl: string;
  type: "video" | "photo" | "artwork";
};
```

## UI Behavior

The detail page should render based on `catalogItem.type` and `catalogItem.purchaseMode`.

When `purchaseMode` is `"digital_download"`:

- The purchase area should feel like buying a single, album, or EP.
- Use copy such as "Buy Track", "Buy Album", "Own this release", or similar depending on the item type.
- Show the price from mock data.
- Show included download assets from mock data.
- Show play/stream controls when `isStreamable` is true.
- Show an owned or purchased state when `isOwned` is true.
- Do not show beat license language, usage rights, exclusivity, or agreement copy unless it comes from the item data and makes sense for the item.

When `purchaseMode` is `"license"`:

- Keep the producer/license-oriented UI style.
- Show license options if `licenseOptions` are present.
- Show rights text from the selected license option.
- Show beat-specific assets such as tagged MP3, untagged WAV, stems, MIDI, or license PDF when present.
- Show BPM and key when present.
- Do not assume every instrumental has every asset type.

## Data-Driven Requirements

- Asset rows must come from `catalogItem.assets`.
- License rights text must come from `licenseOptions`.
- Pricing must come from mock data.
- Artist role display must come from `artist.roles`.
- BPM and key should only render when the item has those fields.
- Visual content should come from `visualContent`.
- The component should not hardcode labels such as "Main Master", "Clean Version", "Studio Instrumental", or specific license rights directly in JSX.

## Mock Data To Add

Please add enough mock data to switch between these cases during development:

- A normal single by a musician.
- An album or EP by a musician.
- A beat or instrumental by a producer with license options.
- An artist who is only a musician.
- An artist who is only a producer.
- An artist who is both a musician and producer.
- At least one item where `isOwned` is true.

## Acceptance Criteria

- The same song/detail page can render a regular single, an album or EP, and a producer beat/instrumental by changing mock data.
- The purchase area changes based on `purchaseMode`.
- Regular music releases do not look like beat license pages.
- Beat/instrumental releases can keep the current license-oriented direction.
- Asset lists, rights text, pricing, metadata, artist roles, and owned state come from mock data.
- Existing visual polish and layout direction are preserved.
- No real API, database, auth, checkout, or persistence changes are made.
- Run `bun x ultracite fix` before finishing.
