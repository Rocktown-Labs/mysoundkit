/* eslint-disable max-classes-per-file */
import { env } from "@soundkit/env/server";

import { logWarn } from "@/middleware/structured-logging";

const MAX_PRINTFUL_ATTEMPTS = 4,
  MAX_RETRY_AFTER_MS = 60_000,
  MOCKUP_DEFAULT_FORMAT = "jpg" as const,
  PRINTFUL_API_BASE_URL = "https://api.printful.com/v2";

export class PrintfulNotConfiguredError extends Error {
  public constructor() {
    super("Printful API is not configured.");
    this.name = "PrintfulNotConfiguredError";
  }
}

export class PrintfulRequestError extends Error {
  public readonly status: number;

  public constructor(
    message: string,
    {
      instance,
      status,
      type,
    }: { instance?: string; status: number; type?: string }
  ) {
    super(
      `${message}${instance ? ` (instance ${instance})` : ""}${
        type ? ` — ${type}` : ""
      }`
    );
    this.name = "PrintfulRequestError";
    this.status = status;
  }
}

export interface PrintfulProblemDetails {
  detail?: string;
  instance?: string;
  status?: number;
  title?: string;
  type?: string;
}

export interface PrintfulRateLimitSnapshot {
  limit: number | null;
  remaining: number | null;
  resetSeconds: number | null;
}

const getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  jitteredMs = (baseMs: number) => baseMs + Math.floor(Math.random() * 250),
  /* eslint-disable promise/avoid-new */
  sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
/* eslint-enable promise/avoid-new */

export const isPrintfulConfigured = () =>
  Boolean(getEnvValue("PRINTFUL_API_KEY"));

export const printfulPriceToCents = (
  price: string | number | null | undefined
) => {
  const value = typeof price === "number" ? price : Number(price ?? "");

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid Printful price value.");
  }

  return Math.round(value * 100);
};

/**
 * Unwraps Printful's mixed response conventions. Some v2 endpoints return the
 * payload directly (catalog products), most wrap it in `{ data: ... }`.
 */
export const unwrapPrintfulPayload = <T>(payload: unknown): T => {
  if (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "data" in payload &&
    !("id" in payload)
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
};

export const unwrapPrintfulList = <T>(payload: unknown): T[] => {
  const value = unwrapPrintfulPayload<unknown>(payload);

  return Array.isArray(value) ? (value as T[]) : [];
};

interface PrintfulRequestInput {
  body?: Record<string, unknown>;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, number | string>;
  path: string;
}

const buildPrintfulUrl = ({
    path,
    query,
  }: {
    path: string;
    query?: Record<string, number | string>;
  }) => {
    const url = new URL(`${PRINTFUL_API_BASE_URL}${path}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    return url;
  },
  parseProblemDetails = async (response: Response) => {
    const body = await response.text(),
      problem: PrintfulProblemDetails = { status: response.status };

    try {
      Object.assign(problem, JSON.parse(body) as PrintfulProblemDetails);
    } catch {
      problem.detail = body.slice(0, 300);
    }

    return problem;
  },
  buildPrintfulHeaders = ({
    apiKey,
    body,
    storeId,
  }: {
    apiKey: string;
    body?: Record<string, unknown>;
    storeId: string;
  }) =>
    new Headers({
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(storeId ? { "X-PF-Store-Id": storeId } : {}),
    }),
  resolveRetryDelayMs = (response: Response, attempt: number) => {
    const retryAfterSeconds = Number(response.headers.get("Retry-After"));

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS);
    }

    return 500 * 2 ** attempt;
  };

/**
 * Core Printful API v2 request helper.
 *
 * - Bearer private-token auth; account-level tokens additionally send
 *   `X-PF-Store-Id` when configured.
 * - Honors the leaky-bucket rate limiter: on `429` it waits the `Retry-After`
 *   header (plus jitter) instead of hammering the endpoint; `5xx` retries with
 *   exponential backoff. Everything else fails fast with an RFC 9457
 *   problem-details error.
 */
export const printfulRequest = async <T>({
  body,
  method = "GET",
  path,
  query,
}: PrintfulRequestInput): Promise<T> => {
  const apiKey = getEnvValue("PRINTFUL_API_KEY");

  if (!apiKey) {
    throw new PrintfulNotConfiguredError();
  }

  const storeId = getEnvValue("PRINTFUL_STORE_ID"), // eslint-disable-line sort-vars
    headers = buildPrintfulHeaders({ apiKey, body, storeId }),
    url = buildPrintfulUrl({ path, query });

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      body: body ? JSON.stringify(body) : undefined,
      headers,
      method,
    });

    if (response.status === 429 && attempt < MAX_PRINTFUL_ATTEMPTS - 1) {
      const delayMs = jitteredMs(resolveRetryDelayMs(response, attempt));

      logWarn({
        attempt,
        delayMs,
        event: "printful_rate_limited",
        path,
      });

      await sleep(delayMs);
      continue;
    }

    if (response.status >= 500 && attempt < MAX_PRINTFUL_ATTEMPTS - 1) {
      await sleep(jitteredMs(250 * 2 ** attempt));
      continue;
    }

    if (!response.ok) {
      const problem = await parseProblemDetails(response);

      throw new PrintfulRequestError(
        problem.detail ??
          problem.title ??
          `Printful request failed with ${response.status}.`,
        {
          instance: problem.instance,
          status: response.status,
          type: problem.type,
        }
      );
    }

    if (response.status === 204) {
      return null as T;
    }

    return (await response.json()) as T;
  }
};

// ---------------------------------------------------------------------------
// Catalog v2 (curated blanks cache)
// ---------------------------------------------------------------------------

export interface PrintfulTechnique {
  is_default?: boolean;
  key: string;
  display_name?: string;
}

export interface PrintfulPlacement {
  layers?: Record<string, unknown>[];
  placement: string;
  placement_options?: Record<string, unknown>[];
  technique: string;
}

export interface PrintfulCatalogProduct {
  brand?: string | null;
  description?: string | null;
  id: number;
  image?: string | null;
  is_discontinued?: boolean;
  main_category_id?: number;
  model?: string | null;
  name: string;
  placements?: PrintfulPlacement[];
  techniques?: PrintfulTechnique[];
  type?: string | null;
  variant_count?: number;
}

export interface PrintfulCatalogVariant {
  catalog_product_id?: number;
  color?: string | null;
  color_code?: string | null;
  id: number;
  image?: string | null;
  name: string;
  size?: string | null;
}

export interface PrintfulVariantPrice {
  currency?: string;
  discount_tiers?: {
    bulk_discount_percentage: number;
    quantity: number;
  }[];
  variant?: {
    id: number;
    techniques?: {
      discounted_price?: string;
      price?: string;
      technique_display_name?: string;
      technique_key?: string;
    }[];
  };
}

export interface PrintfulMockupStyleGroup {
  dpi?: number;
  mockup_styles?: {
    category_name?: string;
    id: number;
    view_name?: string;
  }[];
  placement: string;
  print_area_height?: number;
  print_area_type?: string;
  print_area_width?: number;
  technique?: string;
}

export interface PrintfulAvailabilityEntry {
  catalog_variant_id: number;
  techniques?: {
    selling_regions?: {
      availability?: string;
      name?: string;
    }[];
    technique?: string;
  }[];
}

export const getPrintfulCatalogProduct = async (productId: number) => {
  const payload = await printfulRequest({
    path: `/catalog-products/${encodeURIComponent(String(productId))}`,
  });

  return unwrapPrintfulPayload<PrintfulCatalogProduct | null>(payload);
};

export const getPrintfulCatalogProducts = async ({
  limit = 100,
  offset = 0,
  textSearch,
}: {
  limit?: number;
  offset?: number;
  textSearch?: string;
}) => {
  const payload = await printfulRequest({
    path: "/catalog-products",
    query: {
      limit,
      offset,
      // v2 has no free-text name filter — we page broadly and filter
      // client-side (or server-side in the route) instead.
      ...(textSearch ? { sort_type: "name" } : {}),
    },
  });

  return unwrapPrintfulList<PrintfulCatalogProduct>(payload);
};

/**
 * Searches Printful's catalog by fetching paged results and filtering by
 * product name server-side, since Printful v2 has no free-text search.
 */
export const searchPrintfulCatalogProducts = async (
  query: string,
  maxResults = 10
) => {
  const allProducts = await getPrintfulCatalogProducts({ limit: 100 }),
    normalized = query.toLowerCase().trim(),
    matches =
      normalized.length === 0
        ? allProducts
        : allProducts.filter(
            (product) =>
              product.name.toLowerCase().includes(normalized) ||
              product.type?.toLowerCase().includes(normalized) ||
              product.brand?.toLowerCase().includes(normalized)
          );

  return matches.slice(0, maxResults);
};

export const getPrintfulCatalogVariants = async (productId: number) => {
  const payload = await printfulRequest({
    path: `/catalog-products/${encodeURIComponent(String(productId))}/catalog-variants`,
  });

  return unwrapPrintfulList<PrintfulCatalogVariant>(payload);
};

export const getPrintfulVariantPrice = async (variantId: number) => {
  const payload = await printfulRequest({
    path: `/catalog-variants/${encodeURIComponent(String(variantId))}/prices`,
  });

  return unwrapPrintfulPayload<PrintfulVariantPrice | null>(payload);
};

export interface PrintfulProductPrices {
  currency?: string;
  product?: {
    id?: number;
    placements?: Record<string, unknown>[];
  };
  variants?: {
    id: number;
    techniques?: {
      discounted_price?: string;
      price?: string;
      technique_display_name?: string;
      technique_key?: string;
    }[];
  }[];
}

export const getPrintfulProductPrices = async (productId: number) => {
  const payload = await printfulRequest({
    path: `/catalog-products/${encodeURIComponent(String(productId))}/prices`,
  });

  return unwrapPrintfulPayload<PrintfulProductPrices | null>(payload);
};

export const getPrintfulMockupStyles = async (productId: number) => {
  const payload = await printfulRequest({
    path: `/catalog-products/${encodeURIComponent(String(productId))}/mockup-styles`,
  });

  return unwrapPrintfulList<PrintfulMockupStyleGroup>(payload);
};

export const getPrintfulProductAvailability = async (productId: number) => {
  const payload = await printfulRequest({
    path: `/catalog-products/${encodeURIComponent(String(productId))}/availability`,
  });

  return unwrapPrintfulList<PrintfulAvailabilityEntry>(payload);
};

// ---------------------------------------------------------------------------
// Files v2 (print file library)
// ---------------------------------------------------------------------------

export interface PrintfulFile {
  created?: string;
  filename?: string;
  hash?: string;
  id: number;
  mime_type?: string;
  preview_url?: string | null;
  status?: string;
  type?: string;
  url: string;
  visible?: boolean;
}

export const registerPrintfulFile = async ({
  filename,
  url,
}: {
  filename?: string;
  url: string;
}) => {
  const payload = await printfulRequest({
    body: { filename, url },
    method: "POST",
    path: "/files",
  });

  return unwrapPrintfulPayload<PrintfulFile | null>(payload);
};

// ---------------------------------------------------------------------------
// Mockup Generator v2 (async tasks)
// ---------------------------------------------------------------------------

export interface PrintfulMockupTask {
  catalog_variant_mockups: Array<{
    catalog_variant_id: number;
    mockups: Array<{
      catalog_variant_id: number;
      display_name?: string;
      id?: string;
      mockup_style_id?: number;
      placement?: string;
      rendering?: string;
      url?: string;
    }>;
  }>;
  failure_reasons: string[];
  id: number;
  status: "completed" | "failed" | "pending";
}

export const createPrintfulMockupTask = async ({
  format = MOCKUP_DEFAULT_FORMAT,
  products,
}: {
  format?: "jpg" | "png";
  products: Array<{
    catalog_product_id: number;
    catalog_variant_ids: number[];
    mockup_style_ids: number[];
    placements: Array<Record<string, unknown>>;
    source: "catalog";
  }>;
}) => {
  const payload = await printfulRequest({
    body: { format, products },
    method: "POST",
    path: "/mockup-tasks",
  });

  return unwrapPrintfulPayload<PrintfulMockupTask>(payload);
};

export const getPrintfulMockupTask = async (taskId: number) => {
  const payload = await printfulRequest({
    path: "/mockup-tasks",
    query: { id: taskId },
  });

  return unwrapPrintfulPayload<PrintfulMockupTask | null>(payload);
};
