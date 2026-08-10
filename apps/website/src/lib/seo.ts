import { SITE_NAME, SITE_URL, SOCIAL_IMAGE_URL } from "@/lib/site";

const absoluteUrlPattern = /^https?:\/\//iu;

export const absoluteSiteUrl = (pathOrUrl: string) => {
  if (absoluteUrlPattern.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${SITE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
};

export const seoDescription = (
  value: string | null | undefined,
  fallback: string
) => {
  const cleanValue = value?.replaceAll(/\s+/gu, " ").trim();
  const description = cleanValue || fallback;

  return description.length > 158
    ? `${description.slice(0, 155).trimEnd()}...`
    : description;
};

export const seoImageUrl = (imageUrl: string | null | undefined) =>
  imageUrl && imageUrl !== "/placeholder.svg"
    ? absoluteSiteUrl(imageUrl)
    : SOCIAL_IMAGE_URL;

export const createShareMeta = ({
  canonicalPath,
  description,
  imageUrl,
  title,
  type = "website",
}: {
  canonicalPath: string;
  description: string;
  imageUrl?: string | null;
  title: string;
  type?: "music.album" | "music.song" | "profile" | "website";
}) => {
  const canonicalUrl = absoluteSiteUrl(canonicalPath);
  const socialImage = seoImageUrl(imageUrl);

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
      { content: description, property: "og:description" },
      { content: socialImage, property: "og:image" },
      { content: "summary_large_image", name: "twitter:card" },
      { content: title, name: "twitter:title" },
      { content: description, name: "twitter:description" },
      { content: socialImage, name: "twitter:image" },
    ],
  };
};
