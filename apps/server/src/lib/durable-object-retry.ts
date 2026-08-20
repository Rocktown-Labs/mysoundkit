/* eslint-disable one-var */
interface DurableObjectFailure {
  overloaded?: boolean;
  retryable?: boolean;
}

const isDurableObjectFailure = (
  error: unknown
): error is DurableObjectFailure => typeof error === "object" && error !== null;

export const retryDurableObjectCall = async <T>(
  operation: () => Promise<T>,
  options: { baseDelayMs?: number; maxAttempts?: number } = {}
): Promise<T> => {
  const baseDelayMs = options.baseDelayMs ?? 100,
    maxAttempts = options.maxAttempts ?? 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        !isDurableObjectFailure(error) ||
        !error.retryable ||
        error.overloaded ||
        attempt === maxAttempts - 1
      ) {
        throw error;
      }

      const backoffMs = Math.min(
        20_000,
        baseDelayMs * 2 ** attempt * (0.5 + Math.random())
      );
      await scheduler.wait(backoffMs);
    }
  }

  throw new Error("Durable Object call exhausted its retry attempts");
};
