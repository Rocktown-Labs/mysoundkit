export const profileLinkPlatforms = [
  "apple_music",
  "instagram",
  "personal_site",
  "soundcloud",
  "spotify",
  "tiktok",
  "twitter",
  "youtube",
] as const;

export type ProfileLinkPlatform = (typeof profileLinkPlatforms)[number];

export interface ProfileLinkInput {
  platform: ProfileLinkPlatform;
  value?: string | null;
}

export interface NormalizedProfileLink {
  handle: string | null;
  platform: ProfileLinkPlatform;
  url: string;
}

const stripAt = (value: string) => value.replace(/^@+/u, "");

const stripTrailingSlash = (value: string) => value.replace(/\/+$/u, "");

const normalizedUrl = (value: string) => {
  if (/^https?:\/\//iu.test(value)) {
    return stripTrailingSlash(value);
  }

  return null;
};

const platformUrlForHandle = (
  platform: ProfileLinkPlatform,
  handle: string
) => {
  const cleanHandle = stripAt(handle).trim();

  if (!cleanHandle) {
    return null;
  }

  switch (platform) {
    case "apple_music": {
      return `https://music.apple.com/artist/${cleanHandle}`;
    }
    case "instagram": {
      return `https://www.instagram.com/${cleanHandle}`;
    }
    case "personal_site": {
      return normalizedUrl(cleanHandle) ?? `https://${cleanHandle}`;
    }
    case "soundcloud": {
      return `https://soundcloud.com/${cleanHandle}`;
    }
    case "spotify": {
      return `https://open.spotify.com/artist/${cleanHandle}`;
    }
    case "tiktok": {
      return `https://www.tiktok.com/@${cleanHandle}`;
    }
    case "twitter": {
      return `https://x.com/${cleanHandle}`;
    }
    case "youtube": {
      return cleanHandle.startsWith("channel/")
        ? `https://www.youtube.com/${cleanHandle}`
        : `https://www.youtube.com/@${cleanHandle}`;
    }
    default: {
      return null;
    }
  }
};

const handleFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.split("/").findLast((part) => part.length > 0);
    return path ? stripAt(decodeURIComponent(path)) : null;
  } catch {
    return null;
  }
};

export const normalizeProfileLink = ({
  platform,
  value,
}: ProfileLinkInput): NormalizedProfileLink | null => {
  const input = value?.trim();

  if (!input) {
    return null;
  }

  const inputUrl = normalizedUrl(input);
  const url = inputUrl ?? platformUrlForHandle(platform, input);

  if (!url) {
    return null;
  }

  return {
    handle: inputUrl ? handleFromUrl(url) : stripAt(input).trim(),
    platform,
    url,
  };
};

export const normalizeProfileLinks = (links: ProfileLinkInput[]) =>
  links
    .map((link) => normalizeProfileLink(link))
    .filter((link): link is NormalizedProfileLink => Boolean(link));
