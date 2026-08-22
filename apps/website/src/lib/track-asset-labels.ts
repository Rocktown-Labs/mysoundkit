/* oxlint-disable one-var */
interface TrackAssetLabelInput {
  assetKind: string;
  purpose?: null | string;
}

export const trackAssetLabel = (asset: TrackAssetLabelInput): string => {
  if (asset.purpose === "streaming") {
    return "SoundKit Stream";
  }
  if (asset.purpose === "download") {
    return "Download Copy";
  }
  if (asset.purpose === "lossless_download") {
    return "Lossless Download";
  }
  if (asset.purpose === "open_verse_snippet") {
    return "Open Verse Clip";
  }
  if (asset.purpose === "preview") {
    return "Preview";
  }
  if (asset.purpose === "battle") {
    return "Legacy Battle Audio";
  }
  return asset.assetKind.replaceAll("_", " ");
};

export const trackAssetDescription = (
  asset: TrackAssetLabelInput
): null | string => {
  if (asset.purpose === "streaming") {
    return "Normalized playback audio used for SoundKit streams and battles";
  }
  if (asset.purpose === "download") {
    return "Listener download generated from your current master";
  }
  if (asset.purpose === "lossless_download") {
    return "Lossless download generated from your current master";
  }
  if (asset.purpose === "preview") {
    return "Short preview created for older uploads";
  }
  return null;
};
