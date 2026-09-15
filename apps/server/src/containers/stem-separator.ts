/* eslint-disable one-var, sort-vars, typescript/explicit-member-accessibility */
import { Container } from "@cloudflare/containers";
import type { OutboundHandlerContext } from "@cloudflare/containers";

const STEM_ACCESS_STATE_KEY = "soundkit_stem_access",
  INTERNAL_R2_HOST = "soundkit-r2.internal";

interface StemSeparatorAccess {
  sourceObjectKey: string;
  targetObjectKeys: string[];
}

const validObjectKey = (value: string) =>
    value.length > 0 &&
    value.length <= 1024 &&
    !value.startsWith("/") &&
    !value.includes("../"),
  objectKeyFromRequest = (request: Request) => {
    const url = new URL(request.url),
      prefix = "/objects/";
    if (!url.pathname.startsWith(prefix)) {
      return null;
    }
    const objectKey = url.pathname
      .slice(prefix.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
    return validObjectKey(objectKey) ? objectKey : null;
  };

export class StemSeparatorContainer extends Container<Env> {
  defaultPort = 8080;
  // Demucs CPU separation of a 3-minute track takes minutes and the full
  // end-to-end request (download + separate + 2x transcode + uploads) can
  // approach 30 minutes; the container must outlive the Workflow step.
  sleepAfter = "30m";
  enableInternet = false;
  allowedHosts = [INTERNAL_R2_HOST];
  pingEndpoint = "/health";

  async configureJob(access: StemSeparatorAccess): Promise<void> {
    if (
      !validObjectKey(access.sourceObjectKey) ||
      access.targetObjectKeys.some((key) => !validObjectKey(key))
    ) {
      throw new Error("Stem separator object access is invalid.");
    }

    await this.ctx.storage.put(STEM_ACCESS_STATE_KEY, {
      sourceObjectKey: access.sourceObjectKey,
      targetObjectKeys: [...new Set(access.targetObjectKeys)],
    } satisfies StemSeparatorAccess);
  }

  async canAccessObject(objectKey: string, method: string): Promise<boolean> {
    const access = await this.ctx.storage.get<StemSeparatorAccess>(
      STEM_ACCESS_STATE_KEY
    );
    if (!access) {
      return false;
    }
    if (method === "GET" || method === "HEAD") {
      return objectKey === access.sourceObjectKey;
    }
    if (method === "PUT") {
      return access.targetObjectKeys.includes(objectKey);
    }
    return false;
  }
}

StemSeparatorContainer.outboundByHost = {
  [INTERNAL_R2_HOST]: async (
    request: Request,
    env: Env,
    context: OutboundHandlerContext
  ) => {
    const objectKey = objectKeyFromRequest(request),
      bucket = env.MEDIA_BUCKET;
    if (!(objectKey && bucket)) {
      return new Response("Media object unavailable.", { status: 404 });
    }

    const separatorNamespace =
        env.STEM_SEPARATOR as unknown as DurableObjectNamespace<StemSeparatorContainer>,
      containerId = separatorNamespace.idFromString(context.containerId),
      container = separatorNamespace.get(containerId),
      authorized = await container.canAccessObject(objectKey, request.method);
    if (!authorized) {
      return new Response("Media object access denied.", { status: 403 });
    }

    if (request.method === "HEAD") {
      const object = await bucket.head(objectKey);
      return new Response(null, {
        headers: object
          ? {
              "content-length": String(object.size),
              "content-type":
                object.httpMetadata?.contentType ?? "application/octet-stream",
            }
          : undefined,
        status: object ? 200 : 404,
      });
    }

    if (request.method === "GET") {
      const object = await bucket.get(objectKey);
      if (!object) {
        return new Response("Media object not found.", { status: 404 });
      }
      const headers = new Headers({
        "content-length": String(object.size),
      });
      object.writeHttpMetadata(headers);
      return new Response(object.body, { headers });
    }

    if (request.method === "PUT" && request.body) {
      const contentType = request.headers.get("content-type"),
        object = await bucket.put(objectKey, request.body, {
          httpMetadata: contentType ? { contentType } : undefined,
        });
      return Response.json({ etag: object.httpEtag, key: object.key });
    }

    return new Response("Method not allowed.", { status: 405 });
  },
};
