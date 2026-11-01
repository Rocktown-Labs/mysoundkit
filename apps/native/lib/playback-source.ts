export interface NativePlaybackSource {
  headers?: Record<string, string>;
  uri: string;
}

const guardedPlaybackPath = /^\/v1\/tracks\/[^/]+\/playback$/u;

export function isCredentialedPlaybackUrl(
  uri: string,
  apiBaseUrl: string
): boolean {
  try {
    const api = new URL(apiBaseUrl),
      source = new URL(uri);
    return (
      (source.protocol === "https:" || source.protocol === "http:") &&
      source.origin === api.origin &&
      !source.username &&
      !source.password &&
      guardedPlaybackPath.test(source.pathname)
    );
  } catch {
    return false;
  }
}

export async function resolvePlaybackSource({
  uri,
  apiBaseUrl,
  getCookie,
}: {
  uri: string;
  apiBaseUrl: string;
  getCookie: () => Promise<string | null | undefined>;
}): Promise<NativePlaybackSource> {
  if (!isCredentialedPlaybackUrl(uri, apiBaseUrl)) {
    return { uri };
  }
  try {
    const cookie = await getCookie();
    return cookie ? { headers: { cookie }, uri } : { uri };
  } catch {
    return { uri };
  }
}

export async function loadPendingPlayback<Track>({
  getPendingTrack,
  resolveSource,
  replaceSource,
  play,
}: {
  getPendingTrack: () => Track | null;
  resolveSource: (track: Track) => Promise<NativePlaybackSource>;
  replaceSource: (source: NativePlaybackSource) => void;
  play: () => void;
}): Promise<boolean> {
  const capturedTrack = getPendingTrack(),
    source = capturedTrack === null ? null : await resolveSource(capturedTrack);
  if (
    capturedTrack === null ||
    source === null ||
    getPendingTrack() !== capturedTrack
  ) {
    return false;
  }
  replaceSource(source);
  play();
  return true;
}
