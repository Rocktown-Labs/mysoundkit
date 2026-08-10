export type ShareOutcome = "shared" | "copied" | "unsupported";

/**
 * Shares a link using the native Web Share API when available, falling back
 * to copying the URL to the clipboard.
 */
export const shareLink = async ({
  text,
  title,
  url,
}: {
  text?: string;
  title?: string;
  url: string;
}): Promise<ShareOutcome> => {
  if (typeof navigator === "undefined") {
    return "unsupported";
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        text,
        title,
        url,
      });
      return "shared";
    } catch {
      // AbortError means the user cancelled; fall through to clipboard copy.
    }
  }

  if (typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "unsupported";
    }
  }

  return "unsupported";
};
