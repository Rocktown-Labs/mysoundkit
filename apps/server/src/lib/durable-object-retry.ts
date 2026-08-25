/* eslint-disable one-var */
interface DurableObjectFailure {
  message?: string;
  overloaded?: boolean;
  retryable?: boolean;
}

const isDurableObjectFailure = (
    error: unknown
  ): error is DurableObjectFailure =>
    typeof error === "object" && error !== null,
  isInactiveDurableObjectMessage = (message: string) =>
    /connection closed.*durable object instance is no longer active/iu.test(
      message
    );

export const isRetryableDurableObjectError = (error: unknown) => {
  if (!isDurableObjectFailure(error) || error.overloaded) {
    return false;
  }

  const message = error instanceof Error ? error.message : error.message ?? "";
  return Boolean(error.retryable) || isInactiveDurableObjectMessage(message);
};

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
        !isRetryableDurableObjectError(error) ||
        attempt === maxAttempts - 1
      ) {
        throw error;
      }

      const backoffMs = Math.min(
        20_000,
        baseDelayMs * 2 ** attempt * (0.5 + Math.random())
      );
      await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error("Durable Object call exhausted its retry attempts");
};
