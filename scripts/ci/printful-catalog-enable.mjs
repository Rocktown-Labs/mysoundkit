/* oxlint-disable one-var, sort-vars, node/no-top-level-await -- Explicitly dispatched catalog maintenance CLI. */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const normalize = (value) => String(value ?? "").toLowerCase().replaceAll(/[^a-z0-9]/g, "");

export function matchesModel(product, candidate) {
  const brand = normalize(candidate.brand), model = normalize(candidate.model);
  const words = String(product.name ?? "").toLowerCase().split(/[^a-z0-9]+/);
  return normalize(product.brand) === brand &&
    (normalize(product.model) === model || words.includes(model));
}

export function supportedAreas(groups) {
  return groups.filter((group) => group.technique === "dtg" &&
    group.print_area_type === "simple" && typeof group.placement === "string" &&
    [group.print_area_width, group.print_area_height, group.dpi].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0) &&
    group.mockup_styles?.some((style) => Number.isInteger(style.id)));
}

export function usdDtgPrice(variant) {
  const price = variant.techniques?.find((technique) => technique.technique_key === "dtg")?.price;
  if (typeof price !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(price)) return null;
  const cents = Math.round(Number(price) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function inStock(entry) {
  return Boolean(entry?.techniques?.some((technique) => technique.technique === "dtg" &&
    technique.selling_regions?.some((region) => ["usa", "us", "worldwide", "north_america"].includes(region.name?.toLowerCase()) && region.availability === "in stock")));
}

export function defaultBounds(baseCents) {
  const min = Math.max(1200, Math.ceil(baseCents * 1.6 / 100) * 100);
  return { min, max: Math.max(min + 1500, Math.ceil(baseCents * 3.2 / 100) * 100) };
}

export function printfulReader(secret, fetchImpl = fetch) {
  if (!secret) throw new Error("PRINTFUL_API_KEY is not configured");
  async function request(path, params = {}) {
    const url = new URL(`https://api.printful.com/v2${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${secret}` }, redirect: "error", signal: AbortSignal.timeout(30_000) });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 3) throw new Error(`Printful ${path}: HTTP ${response.status}`);
        const retry = Number(response.headers.get("retry-after"));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1000, 60_000) : 1500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`Printful ${path}: HTTP ${response.status}`);
      return await response.json();
    }
    throw new Error("Printful retries exhausted");
  }
  async function list(path) {
    const result = [], ids = new Set();
    for (let offset = 0; offset < 10_000; offset += 100) {
      const body = await request(path, { limit: 100, offset });
      if (!Array.isArray(body.data)) throw new Error(`Printful ${path}: invalid list`);
      for (const item of body.data) {
        const id = item.id ?? item.catalog_variant_id ?? JSON.stringify(item);
        if (ids.has(id)) throw new Error(`Printful ${path}: repeated page`);
        ids.add(id); result.push(item);
      }
      const total = body.paging?.total;
      if (typeof total === "number" && result.length >= total) return result;
      if (body.data.length < 100) {
        if (typeof total === "number" && result.length < total) throw new Error(`Printful ${path}: incomplete list`);
        return result;
      }
    }
    throw new Error(`Printful ${path}: pagination limit exceeded`);
  }
  return { list, request };
}

export async function auditCatalog({ reader, candidates, onResult = () => {} }) {
  const products = await reader.list("/catalog-products"), results = [], ready = [];
  for (const candidate of candidates) {
    const matches = products.filter((product) => matchesModel(product, candidate));
    const result = { brand: candidate.brand, model: candidate.model, productIds: matches.map((p) => p.id) };
    if (matches.length !== 1) result.status = matches.length ? "ambiguous" : "unmatched";
    else {
      const id = matches[0].id;
      try {
        const detail = await reader.request(`/catalog-products/${id}`), product = detail.data ?? detail;
        if (product.id !== id || !matchesModel(product, candidate)) throw new Error("Product identity changed");
        if (product.is_discontinued) result.status = "discontinued";
        else {
          const groups = await reader.list(`/catalog-products/${id}/mockup-styles`), areas = supportedAreas(groups);
          result.techniques = [...new Set(groups.map((g) => g.technique))];
          result.areaTypes = [...new Set(groups.map((g) => g.print_area_type))];
          if (areas.length === 0) result.status = "unsupported-print-area";
          else {
            const variants = await reader.list(`/catalog-products/${id}/catalog-variants`);
            const availability = await reader.list(`/catalog-products/${id}/availability`);
            const priceBody = await reader.request(`/catalog-products/${id}/prices`, { currency: "USD" }), prices = priceBody.data ?? priceBody;
            if (prices.currency !== "USD") throw new Error("Expected USD product prices");
            const pricesById = new Map((prices.variants ?? []).map((v) => [v.id, usdDtgPrice(v)]));
            const stockById = new Map(availability.map((entry) => [entry.catalog_variant_id, entry]));
            const usable = variants.filter((variant) => pricesById.get(variant.id) && inStock(stockById.get(variant.id)));
            result.variantCount = variants.length; result.inStockCount = usable.length;
            if (usable.length === 0) result.status = "no-priced-us-stock";
            else {
              result.status = "ready"; result.placements = areas.map((area) => area.placement);
              result.cheapestBaseCents = Math.min(...usable.map((variant) => pricesById.get(variant.id)));
              ready.push({ product, groups, variants, pricesById, stockById, result });
            }
          }
        }
      } catch (error) { result.status = "provider-error"; result.error = error.message; }
    }
    results.push(result); onResult(result);
  }
  return { results, ready, catalogCount: products.length };
}

async function main() {
  const candidates = JSON.parse(await readFile(new URL("./printful-catalog-candidates.json", import.meta.url), "utf8"));
  const report = await auditCatalog({ reader: printfulReader(process.env.PRINTFUL_API_KEY), candidates, onResult: (result) => console.info(JSON.stringify(result)) });
  const summary = { catalogCount: report.catalogCount, results: report.results };
  await writeFile("printful-catalog-report.json", JSON.stringify(summary, null, 2));
  console.info(JSON.stringify({ catalogCount: report.catalogCount, ready: report.ready.length, total: report.results.length }));
  if (process.env.APPLY_PRINTFUL_CATALOG === "true") throw new Error("Apply is not implemented yet; dry-run only");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
