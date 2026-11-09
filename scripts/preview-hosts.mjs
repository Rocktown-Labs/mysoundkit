const isolatedPreview =
    /^(?:api\.|bio\.)?pr-(?<number>[1-9]\d*)\.preview\.soundkit\.bio$/u,
  legacyPreview =
    /^(?:soundkit-web|api|bio)-pr-(?<number>[1-9]\d*)\.mysoundkit\.com$/u;

/** Return only a known SoundKit preview's PR number; backing hosts are excluded. */
export function previewHostPr(hostname) {
  if (typeof hostname !== "string") {
    return null;
  }
  const match = isolatedPreview.exec(hostname) ?? legacyPreview.exec(hostname);
  return match ? Number(match.groups.number) : null;
}
