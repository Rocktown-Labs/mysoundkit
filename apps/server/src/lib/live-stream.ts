/* eslint-disable one-var */

const CLOUDFLARE_STREAM_HOST_SUFFIX = ".cloudflarestream.com";

export type CloudflareStreamConnection =
  | "connected"
  | "disconnected"
  | "unknown";

export interface CloudflareStreamConnectionInput {
  experienceStatus: string;
  inputStatus?: null | string;
  lifecycleLive?: boolean | null;
}

export type CloudflareStreamStatus = null | string | { state?: null | string };

export const normalizeCloudflareStreamStatus = (
  status?: CloudflareStreamStatus
): string => {
  if (typeof status === "string" && status.trim()) {
    return status;
  }

  if (status && typeof status === "object" && status.state?.trim()) {
    return status.state;
  }

  return "idle";
};

export const cloudflareStreamCustomerBaseUrl = (
  customerCode?: null | string
): string | null => {
  const normalizedCustomerCode = customerCode
    ?.trim()
    .replace(/^https?:\/\//u, "")
    .split("/", 1)[0];

  if (!normalizedCustomerCode) {
    return null;
  }

  const hostname = normalizedCustomerCode.endsWith(
    CLOUDFLARE_STREAM_HOST_SUFFIX
  )
    ? normalizedCustomerCode
    : `${normalizedCustomerCode.startsWith("customer-") ? "" : "customer-"}${normalizedCustomerCode}${CLOUDFLARE_STREAM_HOST_SUFFIX}`;

  return `https://${hostname}`;
};

export const fetchCloudflareStreamResponse = async (
  url: string,
  init?: RequestInit
): Promise<Response | null> => {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
};

export const parseCloudflareStreamResponse = async <T>(
  response: Response | null
): Promise<T | null> => {
  if (!response?.ok) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const resolveCloudflareStreamConnection = ({
  experienceStatus,
  inputStatus,
  lifecycleLive,
}: CloudflareStreamConnectionInput): CloudflareStreamConnection => {
  const normalizedInputStatus = inputStatus?.trim().toLowerCase();

  if (experienceStatus === "ended") {
    return "unknown";
  }

  if (lifecycleLive === true) {
    return "connected";
  }

  if (lifecycleLive === false) {
    return experienceStatus === "live" ? "disconnected" : "unknown";
  }

  if (
    normalizedInputStatus === "connected" ||
    normalizedInputStatus === "reconnected"
  ) {
    return "connected";
  }

  if (
    normalizedInputStatus === "client_disconnect" ||
    normalizedInputStatus === "failed_to_connect" ||
    normalizedInputStatus === "failed_to_reconnect" ||
    normalizedInputStatus === "reconnecting" ||
    normalizedInputStatus === "ttl_exceeded"
  ) {
    return "disconnected";
  }

  return "unknown";
};

export const resolveCloudflareStreamInputStatus = ({
  experienceStatus,
  fallbackStatus,
  ingestStatus,
}: {
  experienceStatus: string;
  fallbackStatus: string;
  ingestStatus?: null | string;
}): string => {
  if (experienceStatus === "ended") {
    return "disconnected";
  }
  if (ingestStatus === "connected") {
    return "connected";
  }
  if (ingestStatus === "reconnecting") {
    return "reconnecting";
  }
  return fallbackStatus;
};
