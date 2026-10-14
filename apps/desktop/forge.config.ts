import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({}),
    // The deb/rpm installers default their binary and package names to the
    // package.json "name" ("desktop"), which neither matches our
    // executableName nor names a sane Linux package. Wire all three
    // explicitly so /usr/bin/soundkit-desktop is what ships.
    new MakerDeb({
      options: {
        bin: "soundkit-desktop",
        name: "soundkit-desktop",
        productName: "SoundKit Desktop",
      },
    }),
    new MakerRpm({
      options: {
        bin: "soundkit-desktop",
        name: "soundkit-desktop",
        productName: "SoundKit Desktop",
      },
    }),
  ],
  packagerConfig: {
    appBundleId: "com.rocktonlabs.soundkit.desktop",
    asar: true,
    executableName: "soundkit-desktop",
    // Relative because Forge transpiles this config into a temp bundle where
    // __dirname doesn't point at the app; electron-forge always runs with
    // cwd = apps/desktop (pnpm scripts and CI both invoke it that way).
    icon: "src/icons/icon",
    // Registers soundkit:// for macOS (Info.plist); Windows/Linux register at
    // runtime via app.setAsDefaultProtocolClient in the main process.
    protocols: [
      {
        name: "SoundKit",
        schemes: ["soundkit"],
      },
    ],
  },
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process,
      // Preload scripts, Worker process, etc.
      build: [
        {
          config: "vite.main.config.ts",
          entry: "src/main.ts",
          target: "main",
        },
        {
          config: "vite.preload.config.ts",
          entry: "src/preload.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          config: "vite.renderer.config.ts",
          name: "main_window",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  rebuildConfig: {},
};

export default config;
