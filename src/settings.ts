import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type Settings = {
  /** Start keeping the Mac awake as soon as AwakeBar launches. */
  keepAwakeOnLaunch: boolean;
};

const defaults: Settings = { keepAwakeOnLaunch: false };

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

export const loadSettings = (): Settings => {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(settingsFile(), 'utf8'),
    ) as Partial<Settings>;
    return { ...defaults, ...parsed };
  } catch {
    // No settings yet, or the file is unreadable: fall back to defaults.
    return { ...defaults };
  }
};

export const saveSettings = (settings: Settings) => {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), `${JSON.stringify(settings, null, 2)}\n`);
  } catch (error) {
    console.error('Could not save settings:', error);
  }
};
