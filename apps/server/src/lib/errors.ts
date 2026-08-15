import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { ZodError } from "zod";

import type { AppEnv } from "@/lib/types";

type ErrorCode =
  | "bad_request"
  | "conflict"
  | "forbidden"
  | "internal_error"
  | "not_found"
  | "rate_limited"
  | "service_unavailable"
  | "timeout"
  | "unauthorized";

export class AppError extends Error {
  code: ErrorCode;
  details?: unknown;
  expose: boolean;
  retryAfterSeconds?: number;
  status: number;

  constructor({
    cause,
    code,
    details,
    expose = true,
    message,
    retryAfterSeconds,
    status,
  }: {
    cause?: unknown;
    code: ErrorCode;
    details?: unknown;
    expose?: boolean;
    message: string;
    retryAfterSeconds?: number;
    status: number;
  }) {
    super(message, { cause });
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.expose = expose;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

export const conflictError = (message: string, cause?: unknown) =>
  new AppError({
    cause,
    code: "conflict",
    message,
    status: HttpStatusCodes.CONFLICT,
  });

export const serviceUnavailableError = (message: string, cause?: unknown) =>
  new AppError({
    cause,
    code: "service_unavailable",
    message,
    status: HttpStatusCodes.SERVICE_UNAVAILABLE,
  });

export const timeoutError = (message: string, cause?: unknown) =>
  new AppError({
    cause,
    code: "timeout",
    message,
    status: HttpStatusCodes.GATEWAY_TIMEOUT,
  });

const statusCodeFromError = (error: unknown) => {
  if (isAppError(error)) {
    return error.status;
  }

  if (error instanceof ZodError) {
    return HttpStatusCodes.BAD_REQUEST;
  }

  if (error instanceof SyntaxError) {
    return HttpStatusCodes.BAD_REQUEST;
  }

  return HttpStatusCodes.INTERNAL_SERVER_ERROR;
},

 codeFromStatus = (status: number): ErrorCode => {
  if (status === HttpStatusCodes.BAD_REQUEST) {
    return "bad_request";
  }

  if (status === HttpStatusCodes.UNAUTHORIZED) {
    return "unauthorized";
  }

  if (status === HttpStatusCodes.FORBIDDEN) {
    return "forbidden";
  }

  if (status === HttpStatusCodes.NOT_FOUND) {
    return "not_found";
  }

  if (status === HttpStatusCodes.CONFLICT) {
    return "conflict";
  }

  if (status === HttpStatusCodes.TOO_MANY_REQUESTS) {
    return "rate_limited";
  }

  if (status === HttpStatusCodes.GATEWAY_TIMEOUT) {
    return "timeout";
  }

  if (status === HttpStatusCodes.SERVICE_UNAVAILABLE) {
    return "service_unavailable";
  }

  return "internal_error";
};

export const errorPayload = ({
  error,
  requestId,
}: {
  error: unknown;
  requestId: string;
}) => {
  const status = statusCodeFromError(error),
   code = isAppError(error) ? error.code : codeFromStatus(status);
  let message = "Something went wrong. Please try again.";

  if (isAppError(error) && error.expose) {
    ({ message } = error);
  } else if (error instanceof ZodError || error instanceof SyntaxError) {
    message = "Invalid request payload.";
  }

  return {
    code,
    message,
    requestId,
  };
};

export const jsonError = (c: Context<AppEnv>, error: unknown) => {
  const status = statusCodeFromError(error),
   payload = errorPayload({
    error,
    requestId: c.get("requestId"),
  });

  if (isAppError(error) && error.retryAfterSeconds) {
    c.header("Retry-After", String(error.retryAfterSeconds));
  }

  return c.json(payload, status as ContentfulStatusCode);
};

export const serializeErrorForLog = (error: unknown) => {
  if (isAppError(error)) {
    return {
      code: error.code,
      details: error.details,
      message: error.message,
      name: error.name,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return { message: String(error), name: "UnknownError" };
};
