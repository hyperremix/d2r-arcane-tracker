import type { Character, D2Item, D2SaveFile, GrailProgress, HolyGrailItem, MonitoringStatus, Settings } from './grail'

export interface ElectronAPI {
  grail: {
    // Characters
    getCharacters(): Promise<Character[]>

    // Items
    getItems(): Promise<HolyGrailItem[]>

    // Progress
    getProgress(characterId?: string): Promise<GrailProgress[]>
    updateProgress(progress: GrailProgress): Promise<{ success: boolean }>

    // Settings
    getSettings(): Promise<Partial<Settings>>
    updateSettings(settings: Partial<Settings>): Promise<{ success: boolean }>

    // Statistics
    getStatistics(characterId?: string): Promise<{
      totalItems: number
      foundItems: number
      uniqueItems: number
      setItems: number
      runes: number
      foundUnique: number
      foundSet: number
      foundRunes: number
    }>

    // Backup
    backup(backupPath: string): Promise<{ success: boolean }>
    restore(backupPath: string): Promise<{ success: boolean }>
    restoreFromBuffer(backupBuffer: Uint8Array): Promise<{ success: boolean }>
    truncateUserData(): Promise<{ success: boolean }>
  }

  saveFile: {
    // Save file monitoring
    startMonitoring(): Promise<{ success: boolean }>
    stopMonitoring(): Promise<{ success: boolean }>
    getSaveFiles(): Promise<D2SaveFile[]>
    getMonitoringStatus(): Promise<MonitoringStatus>
    updateSaveDirectory(saveDir: string): Promise<{ success: boolean }>
    restoreDefaultDirectory(): Promise<{ success: boolean; defaultDirectory: string }>
  }

  itemDetection: {
    // Item detection
    enable(): Promise<{ success: boolean }>
    disable(): Promise<{ success: boolean }>
    setGrailItems(items: HolyGrailItem[]): Promise<{ success: boolean }>
  }

  dialog: {
    // File dialogs
    showSaveDialog(options: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
      properties?: string[]
    }): Promise<{ canceled: boolean; filePath?: string }>
    showOpenDialog(options: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
      properties?: string[]
    }): Promise<{ canceled: boolean; filePaths?: string[] }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
