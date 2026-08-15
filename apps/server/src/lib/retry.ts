import { timeoutError } from "@/lib/errors";

export interface RetryOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxRetries?: number;
  onRetry?: (event: {
    attempt: number;
    delayMs: number;
    error: unknown;
    label: string;
  }) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_MAX_RETRIES = 2,
 DEFAULT_BASE_DELAY_MS = 100,
 DEFAULT_MAX_DELAY_MS = 1500,
 TRANSIENT_ERROR_PATTERNS = [
  "connection terminated",
  "connection timeout",
  "deadlock detected",
  "econnreset",
  "etimedout",
  "fetch failed",
  "rate limit",
  "serialization_failure",
  "terminating connection",
  "timeout",
  "too many requests",
] as const,

// Promise is required here because Cloudflare Workers exposes setTimeout, not
// the Node timers/promises API.
/* eslint-disable promise/avoid-new */
 sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Operation aborted."));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(signal.reason ?? new Error("Operation aborted."));
      },
      { once: true }
    );
  }),
/* eslint-enable promise/avoid-new */

 jitteredDelay = ({
  attempt,
  baseDelayMs,
  maxDelayMs,
}: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
}) => {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt),
   jitter = Math.floor(Math.random() * exponentialDelay * 0.35);

  return exponentialDelay + jitter;
},

 isRetryableStatus = (status: number) =>
  status === 408 ||
  status === 409 ||
  status === 425 ||
  status === 429 ||
  status >= 500;

export const isRetryableError = (error: unknown) => {
  if (error instanceof Response) {
    return isRetryableStatus(error.status);
  }

  if (error && typeof error === "object") {
    const maybeStatus = "status" in error ? Number(error.status) : Number.NaN;

    if (Number.isFinite(maybeStatus) && isRetryableStatus(maybeStatus)) {
      return true;
    }

    const maybeCode =
      "code" in error && typeof error.code === "string"
        ? error.code.toLowerCase()
        : "";

    if (["40001", "40p01", "53300", "57p01", "57p03"].includes(maybeCode)) {
      return true;
    }
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);

  return TRANSIENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const withTimeout = async <T>(
  label: string,
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 10_000
): Promise<T> => {
  const controller = new AbortController(),
   timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw timeoutError(`${label} timed out.`, error);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const withRetry = async <T>(
  label: string,
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES,
   baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
   maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = options.timeoutMs
        ? await withTimeout(label, () => operation(), options.timeoutMs)
        : await operation();

      return result;
    } catch (error) {
      const shouldRetry = attempt < maxRetries && isRetryableError(error);

      if (!shouldRetry) {
        throw error;
      }

      const delayMs = jitteredDelay({ attempt, baseDelayMs, maxDelayMs });
      options.onRetry?.({ attempt: attempt + 1, delayMs, error, label });
      await sleep(delayMs, options.signal);
    }
  }

  throw new Error(`${label} retry loop exited unexpectedly.`);
};
