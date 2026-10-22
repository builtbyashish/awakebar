import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { buildSleepAssertion } from './scripts/build-sleep-assertion.mjs';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'AwakeBar',
    appBundleId: 'com.awakebar.app',
    asar: true,
    // Tray icons and the sleep-assertion helper are read from disk at runtime,
    // so keep them out of the asar.
    extraResource: ['assets', 'bin'],
    extendInfo: {
      // Menu bar only: no Dock icon and no app switcher entry.
      LSUIElement: true,
    },
  },
  rebuildConfig: {},
  hooks: {
    // Compile for the arch being packaged, so an x64 build made on Apple
    // silicon ships an x64 helper.
    generateAssets: async (_config, _platform, arch) => {
      buildSleepAssertion(arch);
    },
  },
  makers: [new MakerZIP({}, ['darwin'])],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
      ],
      renderer: [],
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
};

export default config;
