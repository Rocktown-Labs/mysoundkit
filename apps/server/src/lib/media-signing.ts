/* eslint-disable one-var, sort-vars */
import { env } from "@soundkit/env/server";

const SIGNED_MEDIA_TTL_SECONDS = 30 * 60,
  encoder = new TextEncoder(),
  signingSecret = () => {
    const secret = env.BETTER_AUTH_SECRET;
    if (!secret) {
      throw new Error(
        "BETTER_AUTH_SECRET is required for signed media access."
      );
    }
    return secret;
  },
  bytesToHex = (bytes: ArrayBuffer) =>
    [...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  signPayload = async (payload: string) => {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(signingSecret()),
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"]
      ),
      signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(payload)
      );
    return bytesToHex(signature);
  },
  signaturePayload = ({
    assetId,
    expires,
    trackId,
  }: {
    assetId: string;
    expires: number;
    trackId: string;
  }) => `${trackId}.${assetId}.${expires}`;

export const createSignedMediaSourceUrl = async ({
  assetId,
  trackId,
}: {
  assetId: string;
  trackId: string;
}) => {
  const expires = Math.floor(Date.now() / 1000) + SIGNED_MEDIA_TTL_SECONDS,
    signature = await signPayload(
      signaturePayload({ assetId, expires, trackId })
    ),
    apiBaseUrl = env.BETTER_AUTH_URL.replace(/\/+$/u, "");
  return `${apiBaseUrl}/v1/tracks/${encodeURIComponent(trackId)}/assets/${encodeURIComponent(assetId)}/source?expires=${expires}&signature=${signature}`;
};

export const verifySignedMediaSource = async ({
  assetId,
  expires,
  signature,
  trackId,
}: {
  assetId: string;
  expires: number;
  signature: string;
  trackId: string;
}) => {
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isInteger(expires) ||
    expires < now ||
    expires > now + SIGNED_MEDIA_TTL_SECONDS
  ) {
    return false;
  }
  const expected = await signPayload(
      signaturePayload({ assetId, expires, trackId })
    ),
    expectedBytes = encoder.encode(expected),
    suppliedBytes = encoder.encode(signature.toLowerCase());
  if (expectedBytes.byteLength !== suppliedBytes.byteLength) {
    return false;
  }
  return crypto.subtle.timingSafeEqual(expectedBytes, suppliedBytes);
};
