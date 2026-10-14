import { describe, expect, it } from "vitest";

import { DEFAULT_APP_URL, resolveAppUrl } from "./app-config";

describe("resolveAppUrl", () => {
  it("defaults to the production web app", () => {
    expect(resolveAppUrl()).toBe(DEFAULT_APP_URL);
    expect(resolveAppUrl("")).toBe(DEFAULT_APP_URL);
    expect(resolveAppUrl("   ")).toBe(DEFAULT_APP_URL);
  });

  it("accepts http and https overrides for development and staging", () => {
    expect(resolveAppUrl("http://localhost:4311")).toBe(
      "http://localhost:4311"
    );
    expect(resolveAppUrl("https://staging.mysoundkit.com")).toBe(
      "https://staging.mysoundkit.com"
    );
  });

  it("trims whitespace and trailing slashes", () => {
    expect(resolveAppUrl(" https://mysoundkit.com/ ")).toBe(
      "https://mysoundkit.com"
    );
    expect(resolveAppUrl("https://mysoundkit.com///")).toBe(
      "https://mysoundkit.com"
    );
  });

  it("rejects non-http(s) values instead of loading them", () => {
    expect(() => resolveAppUrl("file:///Users")).toThrow(/http\(s\) URL/u);
    expect(() => resolveAppUrl("soundkit://dashboard")).toThrow(
      /http\(s\) URL/u
    );
    // oxlint-disable-next-line eslint/no-script-url -- fixture input the resolver must reject
    expect(() => resolveAppUrl("javascript:alert(1)")).toThrow(
      /http\(s\) URL/u
    );
  });
});
