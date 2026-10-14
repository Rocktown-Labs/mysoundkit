#!/usr/bin/env node
/**
 * Generates the desktop app icon set (icns/ico/png) from the SoundKit brand
 * SVG used by the website favicon (apps/website/public/icon.svg).
 *
 * The brand SVG is color-scheme adaptive; the app icon fixes the dark app
 * style (near-black rounded square, white glyph). Rendering goes through the
 * repo's Playwright chromium at 1024px so the output is deterministic and
 * crisp, then png2icons packs the platform formats.
 *
 * Run via `pnpm --filter desktop run icons` after changing the brand SVG.
 */
/* oxlint-disable eslint/sort-vars, eslint/one-var -- declarator order follows data dependencies; Node CLI scripts use one const per step. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "@playwright/test";
import png2icons from "png2icons";

const ICON_SIZE = 1024,
  here = import.meta.dirname,
  desktopDir = path.resolve(here, ".."),
  repoRoot = path.resolve(desktopDir, "..", ".."),
  brandLogoPath = path.join(
    repoRoot,
    "apps",
    "website",
    "public",
    "brand",
    "logo.png"
  ),
  iconsDir = path.join(desktopDir, "src", "icons");

const renderBrandIcon = async () => {
  const logoBuffer = await readFile(brandLogoPath),
    logoBase64 = logoBuffer.toString("base64"),
    browser = await chromium.launch();

  try {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { height: ICON_SIZE, width: ICON_SIZE },
    });

    await page.setContent(
      `<body style="margin:0;padding:0;background:transparent;width:${ICON_SIZE}px;height:${ICON_SIZE}px;display:flex;align-items:center;justify-content:center;">
        <div style="width:${ICON_SIZE}px;height:${ICON_SIZE}px;background:#000000;border-radius:228px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 4px rgba(255,255,255,0.15);overflow:hidden;">
          <img src="data:image/png;base64,${logoBase64}" style="width:780px;height:auto;object-fit:contain;" alt="SoundKit" />
        </div>
      </body>`,
      { waitUntil: "load" }
    );

    return await page.screenshot({
      clip: { height: ICON_SIZE, width: ICON_SIZE, x: 0, y: 0 },
      omitBackground: true,
      type: "png",
    });
  } finally {
    await browser.close();
  }
};

const buildIcons = async () => {
  await mkdir(iconsDir, { recursive: true });

  const iconPng = await renderBrandIcon(),
    icns = png2icons.createICNS(iconPng, png2icons.BICUBIC, 0),
    ico = png2icons.createICO(iconPng, png2icons.BICUBIC, 0, false, true);

  if (!icns || !ico) {
    throw new Error("png2icons failed to pack the desktop icon set.");
  }

  await writeFile(path.join(iconsDir, "icon-1024.png"), iconPng);
  await writeFile(path.join(iconsDir, "icon.png"), iconPng);
  await writeFile(path.join(iconsDir, "icon.icns"), icns);
  await writeFile(path.join(iconsDir, "icon.ico"), ico);

  console.log(`Desktop icons written to ${path.relative(repoRoot, iconsDir)}`);
};

void (async () => {
  try {
    await buildIcons();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
