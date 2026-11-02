/* eslint-disable require-await, one-var */
/* eslint-disable one-var, unicorn/no-await-expression-member */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useArtistsQuery,
  useTracksInfiniteQuery,
  useTracksQuery,
  useVideosQuery,
} from "./soundkit-api";

interface CapturedQuery {
  queryFn: (context: { pageParam: number }) => Promise<unknown>;
  getNextPageParam?: (last: unknown[], pages: unknown[][]) => unknown;
  placeholderData?: unknown;
}
const state = vi.hoisted(() => ({
  fetch: vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response("[]", { headers: { "content-type": "application/json" } })
  ),
  query: null as CapturedQuery | null,
}));
vi.mock("./api", () => ({ API_BASE_URL: "https://api.example.test" }));
vi.mock("./authenticated-fetch", () => ({ authenticatedFetch: state.fetch }));
vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: (previous: unknown) => previous,
  useInfiniteQuery: (options: CapturedQuery) => {
    state.query = options;
    return {};
  },
  useMutation: () => ({}),
  useQuery: (options: CapturedQuery) => {
    state.query = options;
    return {};
  },
  useQueryClient: () => ({}),
}));

function captured() {
  if (!state.query) {
    throw new Error("Missing query options");
  }
  return state.query;
}
beforeEach(() => {
  state.fetch.mockClear();
  state.query = null;
});
describe("native discovery keeps selected regions", () => {
  it.each([useTracksQuery, useArtistsQuery, useVideosQuery])(
    "keeps empty results without a second global request %#",
    async (hook) => {
      hook({ region: "texas", regionType: "north-america" });
      expect(await captured().queryFn({ pageParam: 1 })).toEqual([]);
      expect(state.fetch).toHaveBeenCalledOnce();
      const url = new URL(String(state.fetch.mock.calls[0]?.[0]));
      expect(url.searchParams.get("region")).toBe("texas");
      expect(captured().placeholderData).toBeUndefined();
    }
  );
  it("keeps subsequent pages in the same region and ends an empty page", async () => {
    useTracksInfiniteQuery({ region: "texas", regionType: "north-america" });
    await captured().queryFn({ pageParam: 2 });
    const url = new URL(String(state.fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get("region")).toBe("texas");
    expect(url.searchParams.get("page")).toBe("2");
    expect(captured().getNextPageParam?.([], [[]])).toBeUndefined();
    expect(state.fetch).toHaveBeenCalledOnce();
  });
});
