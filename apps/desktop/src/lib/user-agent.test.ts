import { describe, expect, it } from "vitest";

import {
  stripDesktopTokensFromClientHints,
  stripDesktopTokensFromUserAgent,
} from "./user-agent";

describe("stripDesktopTokensFromUserAgent", () => {
  it("removes Electron and app-name tokens from the default UA", () => {
    expect(
      stripDesktopTokensFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) soundkit-desktop/0.2.0 Chrome/140.0.0.0 Electron/44.1.1 Safari/537.36"
      )
    ).toBe(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    );
  });

  it("leaves ordinary browser UAs untouched", () => {
    const plainUa =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

    expect(stripDesktopTokensFromUserAgent(plainUa)).toBe(plainUa);
  });

  it("matches tokens case-insensitively and tolerates the bare app name", () => {
    expect(
      stripDesktopTokensFromUserAgent("Mozilla/5.0 ELECTRON/44.0 desktop/0.1.0")
    ).toBe("Mozilla/5.0");
  });
});

describe("stripDesktopTokensFromClientHints", () => {
  it("removes Electron and app brands from sec-ch-ua", () => {
    expect(
      stripDesktopTokensFromClientHints(
        '"Chromium";v="140", "Electron";v="44", "soundkit-desktop";v="0.2.0"'
      )
    ).toBe('"Chromium";v="140"');
  });

  it("handles tokens in any position", () => {
    expect(
      stripDesktopTokensFromClientHints('"Electron";v="44", "Chromium";v="140"')
    ).toBe('"Chromium";v="140"');
  });

  it("leaves plain browser hints untouched", () => {
    const hints = '"Chromium";v="140", "Not_A Brand";v="24"';

    expect(stripDesktopTokensFromClientHints(hints)).toBe(hints);
  });
});
