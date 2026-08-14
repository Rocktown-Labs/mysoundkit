import { SITE_NAME, SITE_URL, SOCIAL_IMAGE_URL } from "@/lib/site";

const absoluteUrlPattern = /^https?:\/\//iu;

export const absoluteSiteUrl = (pathOrUrl: string) => {
  if (absoluteUrlPattern.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${SITE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
};

const normalize = (value: string) => value.replaceAll(/\s+/gu, " ").trim();

const truncateTo = (value: string, maxLength: number) =>
  value.length > maxLength
    ? `${value.slice(0, maxLength - 1).trimEnd()}…`
    : value;

/**
 * Returns the platform `description` copy truncated to a sensible ceiling.
 * Callers should pass a rich fallback so short user content still renders a
 * full search result / social card instead of a two-word caption.
 */
export const seoDescription = (
  value: string | null | undefined,
  fallback: string
) => truncateTo(normalize(value || fallback), 158);

/**
 * Same as `seoDescription` but tuned for Open Graph / Twitter preview cards,
 * which want roughly 80-125 characters of copy.
 */
export const seoOgDescription = (
  value: string | null | undefined,
  fallback: string
) => truncateTo(normalize(value || fallback), 150);

export const seoImageUrl = (imageUrl: string | null | undefined) =>
  imageUrl && imageUrl !== "/placeholder.svg"
    ? absoluteSiteUrl(imageUrl)
    : SOCIAL_IMAGE_URL;

export const createShareMeta = ({
  canonicalPath,
  description,
  imageUrl,
  ogDescription,
  song,
  title,
  type = "website",
}: {
  canonicalPath: string;
  description: string;
  imageUrl?: string | null;
  ogDescription?: string | null;
  song?: {
    audioUrl?: string | null;
    durationMs?: number | null;
    musicianUrl?: string | null;
  } | null;
  title: string;
  type?: "music.album" | "music.song" | "profile" | "website";
}) => {
  const canonicalUrl = absoluteSiteUrl(canonicalPath);
  const socialImage = seoImageUrl(imageUrl);
  const sharedDescription = normalize(ogDescription || description);
  const usesFallbackImage = !imageUrl || imageUrl === "/placeholder.svg";
  // Only declare dimensions when the image is the known-good 1200x630 social
  // card. For user-uploaded art the dimensions are unknown server-side;
  // emitting wrong hints would break the LinkedIn/Facebook card more than
  // omitting them.
  const imageDimensionMeta = usesFallbackImage
    ? [
        { content: "1200", property: "og:image:width" },
        { content: "630", property: "og:image:height" },
      ]
    : [];

  return {
    links: [
      {
        href: canonicalUrl,
        rel: "canonical",
      },
    ],
    meta: [
      { title },
      { content: description, name: "description" },
      { content: SITE_NAME, property: "og:site_name" },
      { content: type, property: "og:type" },
      { content: canonicalUrl, property: "og:url" },
      { content: title, property: "og:title" },
      { content: sharedDescription, property: "og:description" },
      { content: socialImage, property: "og:image" },
      { content: socialImage, property: "og:image:secure_url" },
      ...imageDimensionMeta,
      { content: "en_US", property: "og:locale" },
      ...(song?.durationMs == null
        ? []
        : [
            {
              content: String(Math.round(song.durationMs / 1000)),
              property: "music:duration",
            },
          ]),
      ...(song?.musicianUrl
        ? [{ content: song.musicianUrl, property: "music:musician" }]
        : []),
      ...(song?.audioUrl
        ? [{ content: song.audioUrl, property: "og:audio" }]
        : []),
      { content: "summary_large_image", name: "twitter:card" },
      { content: "@soundkit", name: "twitter:site" },
      { content: title, name: "twitter:title" },
      { content: sharedDescription, name: "twitter:description" },
      { content: socialImage, name: "twitter:image" },
      { content: `${title} artwork`, name: "twitter:image:alt" },
    ],
  };
};
