import { app, Menu, nativeImage, powerSaveBlocker, Tray } from 'electron';
import path from 'node:path';
import { loadSettings, type Settings, saveSettings } from './settings';

let tray: Tray | null = null;
let blockerId: number | null = null;
let settings: Settings = { keepAwakeOnLaunch: false };

const isAwake = () =>
  blockerId !== null && powerSaveBlocker.isStarted(blockerId);

// Assets live beside the app in dev, and in Contents/Resources once packaged.
const assetPath = (file: string) =>
  path.join(
    app.isPackaged ? process.resourcesPath : app.getAppPath(),
    'assets',
    file,
  );

const trayIcon = (file: string) => {
  const icon = nativeImage.createFromPath(assetPath(file));
  // Template images are recolored by macOS to match the menu bar.
  icon.setTemplateImage(true);
  return icon;
};

const setAwake = (enabled: boolean) => {
  if (enabled && blockerId === null) {
    // 'prevent-app-suspension' stops the system sleeping while still letting
    // the display turn off. 'prevent-display-sleep' would keep the screen on.
    blockerId = powerSaveBlocker.start('prevent-app-suspension');
  } else if (!enabled && blockerId !== null) {
    powerSaveBlocker.stop(blockerId);
    blockerId = null;
  }

  refreshTray();
};

const refreshTray = () => {
  if (!tray) {
    return;
  }

  const awake = isAwake();

  tray.setImage(trayIcon(awake ? 'awakeTemplate.png' : 'idleTemplate.png'));
  tray.setToolTip(
    awake ? 'AwakeBar — keeping your Mac awake' : 'AwakeBar — sleep allowed',
  );

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: awake ? 'Keeping your Mac awake' : 'Your Mac can sleep',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Keep Mac Awake',
        type: 'checkbox',
        checked: awake,
        click: (item) => setAwake(item.checked),
      },
      { label: 'Display sleep: allowed', enabled: false },
      { type: 'separator' },
      {
        label: 'Keep Awake at Launch',
        type: 'checkbox',
        checked: settings.keepAwakeOnLaunch,
        click: (item) => {
          settings = { ...settings, keepAwakeOnLaunch: item.checked };
          saveSettings(settings);
        },
      },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) =>
          app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { label: 'Quit AwakeBar', click: () => app.quit() },
    ]),
  );
};

// A second copy would add a second menu bar icon, each with its own blocker.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.whenReady().then(() => {
  // Menu bar only: no Dock icon, no windows.
  app.dock?.hide();

  settings = loadSettings();
  tray = new Tray(trayIcon('idleTemplate.png'));
  setAwake(settings.keepAwakeOnLaunch);
});

app.on('before-quit', () => {
  setAwake(false);
});

// There are no windows to close, so nothing should end the app but Quit.
app.on('window-all-closed', () => {});
