import { createCloudflareApi } from "alchemy/cloudflare";

const api = await createCloudflareApi(),
  r = await api.get(`/accounts/${api.accountId}/hyperdrive/configs`);
console.log("status", r.status);
const d = await r.json();
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
