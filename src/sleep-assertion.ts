import { app, powerSaveBlocker } from 'electron';
import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';

/*
 * Keeping the Mac awake is delegated to the bundled AwakeBar-sleep helper, which
 * takes an IOKit assertion named "AwakeBar". Electron's powerSaveBlocker does the
 * same job but names its assertion "Electron" in `pmset -g assertions`, and the
 * name is not settable through the API.
 *
 * If the helper cannot run for any reason, powerSaveBlocker takes over: a
 * mislabelled assertion is better than a Mac that sleeps through your work.
 */

let helper: ChildProcess | null = null;
let fallbackId: number | null = null;

const helperPath = () =>
  path.join(
    app.isPackaged ? process.resourcesPath : app.getAppPath(),
    'bin',
    'AwakeBar-sleep',
  );

const startFallback = () => {
  if (fallbackId === null) {
    fallbackId = powerSaveBlocker.start('prevent-app-suspension');
  }
};

const stopFallback = () => {
  if (fallbackId !== null) {
    powerSaveBlocker.stop(fallbackId);
    fallbackId = null;
  }
};

const startHelper = () => {
  // stdin stays open as the leash: closing it, or dying, releases the assertion.
  const child = spawn(helperPath(), { stdio: ['pipe', 'ignore', 'inherit'] });

  child.once('error', (error) => {
    if (helper !== child) {
      return;
    }

    helper = null;
    console.error('AwakeBar-sleep could not start:', error);
    startFallback();
  });

  child.once('exit', (code, signal) => {
    // Only a surprise if we still wanted the assertion held.
    if (helper !== child) {
      return;
    }

    helper = null;
    console.error(`AwakeBar-sleep exited unexpectedly (${signal ?? code})`);
    startFallback();
  });

  return child;
};

export const isHoldingSleepAssertion = () =>
  helper !== null || fallbackId !== null;

export const takeSleepAssertion = () => {
  if (!isHoldingSleepAssertion()) {
    helper = startHelper();
  }
};

export const releaseSleepAssertion = () => {
  const child = helper;

  // Cleared first so the exit handler knows this one was deliberate.
  helper = null;
  child?.stdin?.end();
  child?.kill();

  stopFallback();
};
