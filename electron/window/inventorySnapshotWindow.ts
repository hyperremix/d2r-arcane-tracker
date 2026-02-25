import path from 'node:path';
import { BrowserWindow } from 'electron';
import type { InventorySnapshotWindowTarget } from '../types/grail';

const inventorySnapshotWindows = new Map<string, BrowserWindow>();

function getSnapshotWindowKey(target: InventorySnapshotWindowTarget): string {
  return `${target.sourceFileType}:${target.sourceFilePath}`;
}

function getSnapshotHash(target: InventorySnapshotWindowTarget): string {
  const searchParams = new URLSearchParams({
    sourceFilePath: target.sourceFilePath,
    sourceFileType: target.sourceFileType,
    characterName: target.characterName,
  });

  return `/inventory-snapshot?${searchParams.toString()}`;
}

function focusSnapshotWindow(window: BrowserWindow): void {
  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

export function openInventorySnapshotWindow(
  target: InventorySnapshotWindowTarget,
  __dirname: string,
  viteDevServerUrl?: string,
  rendererDist?: string,
): BrowserWindow {
  const windowKey = getSnapshotWindowKey(target);
  const existingWindow = inventorySnapshotWindows.get(windowKey);

  if (existingWindow && !existingWindow.isDestroyed()) {
    focusSnapshotWindow(existingWindow);
    return existingWindow;
  }

  const snapshotWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    title: `${target.characterName} Inventory`,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const hash = getSnapshotHash(target);

  if (viteDevServerUrl) {
    snapshotWindow.loadURL(`${viteDevServerUrl}#${hash}`);
  } else {
    snapshotWindow.loadFile(path.join(rendererDist || '', 'index.html'), {
      hash,
    });
  }

  snapshotWindow.on('closed', () => {
    inventorySnapshotWindows.delete(windowKey);
  });

  inventorySnapshotWindows.set(windowKey, snapshotWindow);

  return snapshotWindow;
}

export function closeInventorySnapshotWindows(): void {
  for (const snapshotWindow of inventorySnapshotWindows.values()) {
    if (!snapshotWindow.isDestroyed()) {
      snapshotWindow.close();
    }
  }

  inventorySnapshotWindows.clear();
}
