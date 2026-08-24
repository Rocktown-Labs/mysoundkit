/**
 * Minimal structural shape of a track asset row relevant to public media
 * authorization. Drizzle rows satisfy this: both columns are enum-typed
 * string columns and may be NULL for legacy rows.
 */
export interface TrackAssetAuthorization {
  assetKind: string | null;
  purpose: string | null;
}

/**
 * Cover art exists in two shapes: v2-pipeline rows carry purpose "artwork",
 * while legacy rows carry assetKind "cover_art" with a NULL purpose. Both are
 * publicly servable on public tracks.
 */
export const isPublicTrackArtwork = (
  asset: TrackAssetAuthorization
): boolean => asset.purpose === "artwork" || asset.assetKind === "cover_art";
