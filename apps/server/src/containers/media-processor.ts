/* eslint-disable one-var, sort-vars, typescript/explicit-member-accessibility */
import { Container } from "@cloudflare/containers";
import type { OutboundHandlerContext } from "@cloudflare/containers";

const MEDIA_ACCESS_STATE_KEY = "soundkit_media_access",
  INTERNAL_R2_HOST = "soundkit-r2.internal";

interface MediaProcessorAccess {
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

export class MediaProcessorContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "10m";
  enableInternet = false;
  allowedHosts = [INTERNAL_R2_HOST];

  async configureJob(access: MediaProcessorAccess): Promise<void> {
    if (
      !validObjectKey(access.sourceObjectKey) ||
      access.targetObjectKeys.some((key) => !validObjectKey(key))
    ) {
      throw new Error("Media processor object access is invalid.");
    }

    await this.ctx.storage.put(MEDIA_ACCESS_STATE_KEY, {
      sourceObjectKey: access.sourceObjectKey,
      targetObjectKeys: [...new Set(access.targetObjectKeys)],
    } satisfies MediaProcessorAccess);
  }

  async canAccessObject(objectKey: string, method: string): Promise<boolean> {
    const access = await this.ctx.storage.get<MediaProcessorAccess>(
      MEDIA_ACCESS_STATE_KEY
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

MediaProcessorContainer.outboundByHost = {
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

    const mediaProcessorNamespace =
        env.MEDIA_PROCESSOR as unknown as DurableObjectNamespace<MediaProcessorContainer>,
      containerId = mediaProcessorNamespace.idFromString(context.containerId),
      container = mediaProcessorNamespace.get(containerId),
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
