import { contextBridge, ipcRenderer } from 'electron';
import { createElectronAPI, createIpcBridge, type ElectronPlatform } from './ipc/api';

/**
 * Exposes the typed API, built from the IPC contract, to the renderer as `window.electronAPI`.
 */
contextBridge.exposeInMainWorld(
  'electronAPI',
  createElectronAPI(createIpcBridge(ipcRenderer), process.platform as ElectronPlatform),
);
