/* oxlint-disable one-var, sort-vars, node/no-top-level-await -- Explicitly dispatched catalog maintenance CLI. */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "");

export function matchesModel(product, candidate) {
  const brand = normalize(candidate.brand),
    model = normalize(candidate.model);
  const words = String(product.name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  return (
    normalize(product.brand) === brand &&
    (normalize(product.model) === model || words.includes(model))
  );
}

export function supportedAreas(groups) {
  return groups.filter(
    (group) =>
      group.technique === "dtg" &&
      group.print_area_type === "simple" &&
      typeof group.placement === "string" &&
      [group.print_area_width, group.print_area_height, group.dpi].every(
        (n) => typeof n === "number" && Number.isFinite(n) && n > 0
      ) &&
      group.mockup_styles?.some((style) => Number.isInteger(style.id))
  );
}

export function usdDtgPrice(variant) {
  const price = variant.techniques?.find(
    (technique) => technique.technique_key === "dtg"
  )?.price;
  if (typeof price !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(price))
    {return null;}
  const cents = Math.round(Number(price) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function inStock(entry) {
  return Boolean(
    entry?.techniques?.some(
      (technique) =>
        technique.technique === "dtg" &&
        technique.selling_regions?.some(
          (region) =>
            ["usa", "us", "worldwide", "north_america"].includes(
              region.name?.toLowerCase()
            ) && region.availability === "in stock"
        )
    )
  );
}

export function defaultBounds(baseCents) {
  const min = Math.max(1200, Math.ceil((baseCents * 1.6) / 100) * 100);
  return {
    max: Math.max(min + 1500, Math.ceil((baseCents * 3.2) / 100) * 100),
    min,
  };
}

export function printfulReader(secret, fetchImpl = fetch) {
  if (!secret) {throw new Error("PRINTFUL_API_KEY is not configured");}
  async function request(path, params = {}) {
    const url = new URL(`https://api.printful.com/v2${path}`);
    for (const [key, value] of Object.entries(params))
      {url.searchParams.set(key, String(value));}
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${secret}` },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 3)
          {throw new Error(`Printful ${path}: HTTP ${response.status}`);}
        const retry = Number(response.headers.get("retry-after"));
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Number.isFinite(retry) && retry > 0
              ? Math.min(retry * 1000, 60_000)
              : 1500 * (attempt + 1)
          )
        );
        continue;
      }
      if (!response.ok)
        {throw new Error(`Printful ${path}: HTTP ${response.status}`);}
      return await response.json();
    }
    throw new Error("Printful retries exhausted");
  }
  async function list(path) {
    const result = [],
      ids = new Set();
    for (let offset = 0; offset < 10_000; offset += 100) {
      const body = await request(path, { limit: 100, offset });
      if (!Array.isArray(body.data))
        {throw new Error(`Printful ${path}: invalid list`);}
      for (const item of body.data) {
        const id = item.id ?? item.catalog_variant_id ?? JSON.stringify(item);
        if (ids.has(id)) {throw new Error(`Printful ${path}: repeated page`);}
        ids.add(id);
        result.push(item);
      }
      const total = body.paging?.total;
      if (typeof total === "number" && result.length >= total) {return result;}
      if (body.data.length < 100) {
        if (typeof total === "number" && result.length < total)
          {throw new Error(`Printful ${path}: incomplete list`);}
        return result;
      }
    }
    throw new Error(`Printful ${path}: pagination limit exceeded`);
  }
  return { list, request };
}

export async function auditCatalog({
  reader,
  candidates,
  onResult = () => {},
}) {
  const products = await reader.list("/catalog-products"),
    results = [],
    ready = [];
  for (const candidate of candidates) {
    const matches = products.filter((product) =>
      matchesModel(product, candidate)
    );
    const result = {
      brand: candidate.brand,
      model: candidate.model,
      productIds: matches.map((p) => p.id),
    };
    if (matches.length === 1)
      {
      const id = matches[0].id;
      try {
        const detail = await reader.request(`/catalog-products/${id}`),
          product = detail.data ?? detail;
        if (product.id !== id || !matchesModel(product, candidate))
          throw new Error("Product identity changed");
        if (product.is_discontinued) result.status = "discontinued";
        else {
          const groups = await reader.list(
              `/catalog-products/${id}/mockup-styles`
            ),
            areas = supportedAreas(groups);
          result.techniques = [...new Set(groups.map((g) => g.technique))];
          result.areaTypes = [...new Set(groups.map((g) => g.print_area_type))];
          if (areas.length === 0) result.status = "unsupported-print-area";
          else {
            const variants = await reader.list(
              `/catalog-products/${id}/catalog-variants`
            );
            const availability = await reader.list(
              `/catalog-products/${id}/availability`
            );
            const priceBody = await reader.request(
                `/catalog-products/${id}/prices`,
                { currency: "USD" }
              ),
              prices = priceBody.data ?? priceBody;
            if (prices.currency !== "USD")
              throw new Error("Expected USD product prices");
            const pricesById = new Map(
              (prices.variants ?? []).map((v) => [v.id, usdDtgPrice(v)])
            );
            const stockById = new Map(
              availability.map((entry) => [entry.catalog_variant_id, entry])
            );
            const usable = variants.filter(
              (variant) =>
                pricesById.get(variant.id) && inStock(stockById.get(variant.id))
            );
            result.variantCount = variants.length;
            result.inStockCount = usable.length;
            if (usable.length === 0) result.status = "no-priced-us-stock";
            else {
              result.status = "ready";
              result.placements = areas.map((area) => area.placement);
              result.cheapestBaseCents = Math.min(
                ...usable.map((variant) => pricesById.get(variant.id))
              );
              ready.push({
                product,
                groups,
                variants,
                pricesById,
                stockById,
                result,
              });
            }
          }
        }
      } catch (error) {
        result.status = "provider-error";
        result.error = error.message;
      }
    }
    else {result.status = matches.length ? "ambiguous" : "unmatched";}
    results.push(result);
    onResult(result);
  }
  return { catalogCount: products.length, ready, results };
}

export async function enableProduct(client, entry) {
  const { product, groups, variants, pricesById, stockById, result } = entry;
  const defaults = defaultBounds(result.cheapestBaseCents);
  const rules = {
    placements: groups.map((group) => ({
      dpi: group.dpi ?? null,
      placement: group.placement,
      printAreaHeight: group.print_area_height ?? null,
      printAreaType: group.print_area_type ?? null,
      printAreaWidth: group.print_area_width ?? null,
      technique: group.technique ?? null,
    })),
  };
  const rows = variants
    .filter((variant) => pricesById.get(variant.id))
    .map((variant) => ({
      availability: stockById.get(variant.id) ?? null,
      base_price_cents: pricesById.get(variant.id),
      color: variant.color ?? null,
      color_code: variant.color_code ?? null,
      id: String(variant.id),
      image: variant.image ?? null,
      in_stock: inStock(stockById.get(variant.id)),
      name: variant.name,
      size: variant.size ?? null,
    }));
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    const before = await client.query(
      "SELECT id, is_curated, retail_min_cents, retail_max_cents FROM merch_catalog_products WHERE id = $1 FOR UPDATE",
      [String(product.id)]
    );
    await client.query(
      `INSERT INTO merch_catalog_products
      (id, name, brand, description, image, type, is_curated, is_discontinued, placements, techniques, mockup_style_ids, print_file_rules, retail_min_cents, retail_max_cents)
      VALUES ($1,$2,$3,$4,$5,$6,true,false,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,description=excluded.description,image=excluded.image,type=excluded.type,
      is_curated=true,is_discontinued=false,placements=excluded.placements,techniques=excluded.techniques,mockup_style_ids=excluded.mockup_style_ids,
      print_file_rules=excluded.print_file_rules,synced_at=now(),updated_at=now()`,
      [
        String(product.id),
        product.name,
        product.brand ?? null,
        product.description ?? null,
        product.image ?? null,
        product.type ?? null,
        JSON.stringify(product.placements ?? []),
        JSON.stringify(product.techniques ?? []),
        JSON.stringify(
          groups.flatMap((group) =>
            (group.mockup_styles ?? []).map((style) => style.id)
          )
        ),
        JSON.stringify(rules),
        defaults.min,
        defaults.max,
      ]
    );
    await client.query(
      "UPDATE merch_catalog_variants SET in_stock=false,updated_at=now() WHERE catalog_product_id=$1",
      [String(product.id)]
    );
    const written = await client.query(
      `INSERT INTO merch_catalog_variants
      (id,catalog_product_id,name,size,color,color_code,image,base_price_cents,in_stock,availability)
      SELECT r.id,$1,r.name,r.size,r.color,r.color_code,r.image,r.base_price_cents,r.in_stock,r.availability
      FROM jsonb_to_recordset($2::jsonb) AS r(id text,name text,size text,color text,color_code text,image text,base_price_cents int,in_stock boolean,availability jsonb)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,size=excluded.size,color=excluded.color,color_code=excluded.color_code,image=excluded.image,
      base_price_cents=excluded.base_price_cents,in_stock=excluded.in_stock,availability=excluded.availability,synced_at=now(),updated_at=now()
      WHERE merch_catalog_variants.catalog_product_id=excluded.catalog_product_id RETURNING id`,
      [String(product.id), JSON.stringify(rows)]
    );
    if (written.rowCount !== rows.length)
      {throw new Error("Variant identity conflict; rolled back");}
    const after = await client.query(
      `SELECT p.id,p.is_curated,p.retail_min_cents,p.retail_max_cents,count(v.id) FILTER (WHERE v.in_stock)::int AS in_stock_count
      FROM merch_catalog_products p LEFT JOIN merch_catalog_variants v ON v.catalog_product_id=p.id WHERE p.id=$1 GROUP BY p.id`,
      [String(product.id)]
    );
    const saved = after.rows[0],
      previous = before.rows[0];
    if (
      !saved?.is_curated ||
      saved.in_stock_count !== result.inStockCount ||
      (previous &&
        (saved.retail_min_cents !== previous.retail_min_cents ||
          saved.retail_max_cents !== previous.retail_max_cents))
    )
      {throw new Error("Catalog verification failed; rolled back");}
    await client.query("COMMIT");
    return { after: saved, before: previous ?? null, id: product.id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const candidates = JSON.parse(
    await readFile(
      new URL("printful-catalog-candidates.json", import.meta.url),
      "utf-8"
    )
  );
  const reader = printfulReader(process.env.PRINTFUL_API_KEY);
  for (const path of ["/catalog-products/586/catalog-variants", "/catalog-products/586/mockup-styles", "/catalog-products/586/availability"]) {
    const sample = await reader.request(path, {limit: 100,offset: 0});
    console.info(JSON.stringify({ diagnostic: path, keys: Object.keys(sample), paging: sample.paging, pagination: sample.pagination, count: sample.data?.length, firstKeys: sample.data?.[0] ? Object.keys(sample.data[0]) : [], groupIds: sample.data?.slice(0, 3).map((x)=>({id:x.id, placement:x.placement, technique:x.technique,print_area_type:x.print_area_type})) }));
  }
  const report = await auditCatalog({
    candidates,
    onResult: (result) => console.info(JSON.stringify(result)),
    reader,
  });
  const summary = {
    catalogCount: report.catalogCount,
    results: report.results,
  };
  await writeFile(
    "printful-catalog-report.json",
    JSON.stringify(summary, null, 2)
  );
  console.info(
    JSON.stringify({
      catalogCount: report.catalogCount,
      ready: report.ready.length,
      total: report.results.length,
    })
  );
  if (process.env.APPLY_PRINTFUL_CATALOG === "true") {
    if (!process.env.DATABASE_URL)
      {throw new Error("DATABASE_URL is not configured");}
    if (report.results.some((result) => result.status === "provider-error"))
      {throw new Error(
        "Provider audit is incomplete; no catalog changes applied"
      );}
    const require = createRequire(
        new URL("../../packages/db/package.json", import.meta.url)
      ),
      { Client } = require("pg");
    const client = new Client({
      application_name: "soundkit/catalog-enable-556",
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10_000,
    });
    summary.applied = [];
    try {
      await client.connect();
      for (const entry of report.ready) {
        const applied = await enableProduct(client, entry);
        summary.applied.push(applied);
        await writeFile(
          "printful-catalog-report.json",
          JSON.stringify(summary, null, 2)
        );
        console.info(
          JSON.stringify({
            enabled: applied.id,
            inStockCount: applied.after.in_stock_count,
          })
        );
      }
    } finally {
      await client.end();
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
