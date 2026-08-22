/* eslint-disable one-var, sort-vars, promise/prefer-await-to-callbacks, promise/prefer-await-to-then */
import { createServer } from "node:http";

import {
  analyzeSourceObject,
  createDerivativeObject,
  DerivativeValidationError,
  inspectSourceObject,
} from "./processor.mjs";

const PORT = Number(process.env.PORT ?? 8080),
  MAX_JSON_BODY_BYTES = 256 * 1024,
  renderPurposes = new Set([
    "battle",
    "download",
    "lossless_download",
    "open_verse_snippet",
    "project_export",
    "streaming",
  ]),
  jsonResponse = (response, status, body) => {
    const payload = JSON.stringify(body);
    response.writeHead(status, {
      "content-length": Buffer.byteLength(payload),
      "content-type": "application/json; charset=utf-8",
    });
    response.end(payload);
  },
  readJsonBody = async (request) => {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > MAX_JSON_BODY_BYTES) {
        throw new Error("Request payload is too large.");
      }
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  },
  requiredString = (value, fieldName) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${fieldName} is required.`);
    }
    return value;
  },
  optionalClip = (value) => {
    if (value === undefined || value === null) {
      return;
    }
    if (
      typeof value !== "object" ||
      !Number.isInteger(value.startMs) ||
      !Number.isInteger(value.endMs) ||
      value.startMs < 0 ||
      value.endMs <= value.startMs
    ) {
      throw new Error("clip must contain a valid startMs/endMs range.");
    }
    return { endMs: value.endMs, startMs: value.startMs };
  },
  optionalMetadata = (value) => {
    if (value === undefined || value === null) {
      return {};
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("metadata must be an object.");
    }
    return value;
  },
  handleRequest = async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (request.method === "GET" && url.pathname === "/health") {
      jsonResponse(response, 200, { ok: true, service: "soundkit-media" });
      return;
    }
    if (request.method !== "POST") {
      jsonResponse(response, 404, { message: "Not found." });
      return;
    }

    const body = await readJsonBody(request),
      sourceObjectKey = requiredString(body.sourceObjectKey, "sourceObjectKey");
    if (url.pathname === "/v1/inspect") {
      jsonResponse(response, 200, await inspectSourceObject(sourceObjectKey));
      return;
    }
    if (url.pathname === "/v1/analyze") {
      jsonResponse(
        response,
        200,
        await analyzeSourceObject(sourceObjectKey, optionalClip(body.clip))
      );
      return;
    }
    if (url.pathname === "/v1/render") {
      const purpose = requiredString(body.purpose, "purpose");
      if (!renderPurposes.has(purpose)) {
        throw new Error("Unsupported derivative purpose.");
      }
      jsonResponse(
        response,
        200,
        await createDerivativeObject({
          clip: optionalClip(body.clip),
          metadata: optionalMetadata(body.metadata),
          purpose,
          sourceObjectKey,
          targetObjectKey: requiredString(
            body.targetObjectKey,
            "targetObjectKey"
          ),
        })
      );
      return;
    }
    jsonResponse(response, 404, { message: "Not found." });
  },
  server = createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      const message =
          error instanceof Error ? error.message : "Media processing failed.",
        stack = error instanceof Error ? error.stack : null;
      process.stderr.write(
        `${JSON.stringify({ event: "media_processor_request_failed", message, stack })}\n`
      );
      jsonResponse(
        response,
        error instanceof DerivativeValidationError ? 422 : 500,
        {
          code:
            error instanceof DerivativeValidationError
              ? "DERIVATIVE_VALIDATION_FAILED"
              : "MEDIA_PROCESSING_FAILED",
          message,
        }
      );
    });
  });

server.requestTimeout = 35 * 60 * 1000;
server.headersTimeout = 60 * 1000;
server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`SoundKit media processor listening on ${PORT}\n`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
