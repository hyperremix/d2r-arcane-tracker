import { contextBridge, ipcRenderer } from 'electron';
import type {
  Character,
  D2SaveFile,
  FileReaderResponse,
  GrailProgress,
  HolyGrailItem,
  MonitoringStatus,
  Settings,
} from './types/grail';

// --------- Expose some API to the Renderer process ---------
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

// Expose Grail API
contextBridge.exposeInMainWorld('electronAPI', {
  grail: {
    // Characters
    getCharacters: (): Promise<Character[]> => ipcRenderer.invoke('grail:getCharacters'),

    // Items
    getItems: (): Promise<HolyGrailItem[]> => ipcRenderer.invoke('grail:getItems'),
    seedItems: (items: HolyGrailItem[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:seedItems', items),
    autoSeed: (): Promise<{ success: boolean; seeded: boolean }> =>
      ipcRenderer.invoke('grail:autoSeed'),
    needsSeeding: (): Promise<{ needsSeeding: boolean }> =>
      ipcRenderer.invoke('grail:needsSeeding'),

    // Progress
    getProgress: (characterId?: string): Promise<GrailProgress[]> =>
      ipcRenderer.invoke('grail:getProgress', characterId),
    updateProgress: (progress: GrailProgress): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:updateProgress', progress),

    // Settings
    getSettings: (): Promise<Partial<Settings>> => ipcRenderer.invoke('grail:getSettings'),
    updateSettings: (settings: Partial<Settings>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:updateSettings', settings),

    // Statistics
    getStatistics: (
      characterId?: string,
    ): Promise<{
      totalItems: number;
      foundItems: number;
      uniqueItems: number;
      setItems: number;
      runes: number;
      foundUnique: number;
      foundSet: number;
      foundRunes: number;
    }> => ipcRenderer.invoke('grail:getStatistics', characterId),

    // Backup
    backup: (backupPath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:backup', backupPath),
    restore: (backupPath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:restore', backupPath),
    restoreFromBuffer: (backupBuffer: Uint8Array): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:restoreFromBuffer', backupBuffer),
    truncateUserData: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:truncateUserData'),
  },

  saveFile: {
    // Save file monitoring
    startMonitoring: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('saveFile:startMonitoring'),
    stopMonitoring: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('saveFile:stopMonitoring'),
    getSaveFiles: (): Promise<D2SaveFile[]> => ipcRenderer.invoke('saveFile:getSaveFiles'),
    getMonitoringStatus: (): Promise<MonitoringStatus> =>
      ipcRenderer.invoke('saveFile:getMonitoringStatus'),
    updateSaveDirectory: (saveDir: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('saveFile:updateSaveDirectory', saveDir),
    restoreDefaultDirectory: (): Promise<{ success: boolean; defaultDirectory: string }> =>
      ipcRenderer.invoke('saveFile:restoreDefaultDirectory'),
  },

  itemDetection: {
    // Item detection
    enable: (): Promise<{ success: boolean }> => ipcRenderer.invoke('itemDetection:enable'),
    disable: (): Promise<{ success: boolean }> => ipcRenderer.invoke('itemDetection:disable'),
    setGrailItems: (items: HolyGrailItem[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('itemDetection:setGrailItems', items),
  },

  dialog: {
    // File dialogs
    showSaveDialog: (options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: string[];
    }): Promise<{ canceled: boolean; filePath?: string }> =>
      ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: string[];
    }): Promise<{ canceled: boolean; filePaths?: string[] }> =>
      ipcRenderer.invoke('dialog:showOpenDialog', options),
  },

  data: {
    onUpdate: (callback: (data: FileReaderResponse) => void) =>
      ipcRenderer.on('data:onUpdate', (_event, value) => callback(value)),
  },
});
