const accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID is required.");
}

if (!apiToken) {
  throw new Error("CLOUDFLARE_API_TOKEN is required.");
}

const get = async (path: string) => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4${path}`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );

  return response;
},
  main = async () => {
    const r = await get(`/accounts/${accountId}/hyperdrive/configs`);
    console.log("status", r.status);
    const d = (await r.json()) as {
      result?: {
        config?: { origin?: Record<string, unknown> };
        host?: string;
        id?: string;
        name?: string;
        origin?: { host?: string } & Record<string, unknown>;
      }[];
    };
    if (d.result) {
      for (const hd of d.result) {
        console.log("id:", hd.id, "name:", hd.name);
        console.log(
          "  origin:",
          JSON.stringify(hd.origin || hd.config?.origin || {})
        );
        console.log("  host:", hd.origin?.host || hd.config?.origin?.host);
      }
    } else {
      console.log(JSON.stringify(d).slice(0, 800));
    }
  };

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
