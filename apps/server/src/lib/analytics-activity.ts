export interface ActivityCache {
  match: (key: Request) => Promise<Response | undefined>;
  put: (key: Request, value: Response) => Promise<void>;
}

/** Best-effort per-PoP throttle; Postgres owns daily uniqueness and exclusions. */
export async function recordDailyActivity({
  userId,
  environment,
  origin,
  cache,
  record,
  now = new Date(),
}: {
  userId: string;
  environment: string;
  origin: string;
  cache?: ActivityCache;
  record: () => Promise<void>;
  now?: Date;
}): Promise<void> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(userId)
  ),
   keyHash = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join(""),
   key = new Request(
    new URL(
      `/__internal_activity/${environment}/${now.toISOString().slice(0, 10)}/${keyHash}`,
      origin
    )
  );
  try {
    if (await cache?.match(key)) {return;}
  } catch {
    /* Cache failure must not suppress activity. */
  }
  await record();
  try {
    await cache?.put(
      key,
      new Response("1", { headers: { "Cache-Control": "max-age=900" } })
    );
  } catch {
    /* A later miss safely retries against the database uniqueness key. */
  }
}
