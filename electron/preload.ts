import { contextBridge, ipcRenderer } from 'electron';
import { createElectronAPI, createIpcBridge, type ElectronPlatform } from './ipc/api';

/**
 * Legacy generic IPC access, kept until every renderer call site uses `window.electronAPI`.
 * @deprecated Use the typed `window.electronAPI` methods and `window.electronAPI.on`.
 */
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
});

/**
 * Exposes the typed API, built from the IPC contract, to the renderer as `window.electronAPI`.
 */
contextBridge.exposeInMainWorld(
  'electronAPI',
  createElectronAPI(createIpcBridge(ipcRenderer), process.platform as ElectronPlatform),
);
