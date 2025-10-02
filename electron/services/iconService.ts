import { existsSync, promises as fs } from 'node:fs';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { app } from 'electron';

/**
 * Service for managing D2R item icons.
 * Handles icon extraction from D2R installation with in-memory caching.
 */
export class IconService {
  private d2rPath: string | null = null;
  private iconCache: Map<string, string> = new Map();
  private readonly cacheFile: string;

  constructor() {
    // Cache file stored in app data directory
    const userDataPath = app.getPath('userData');
    this.cacheFile = path.join(userDataPath, 'icon-cache.json');
    this.loadCacheFromDisk();
  }

  /**
   * Detects the D2R installation path based on the operating system.
   * @returns The D2R installation path or null if not found
   */
  findD2RInstallation(): string | null {
    if (this.d2rPath) {
      return this.d2rPath;
    }

    const possiblePaths: string[] = [];
    const currentPlatform = platform();
    const home = homedir();

    if (currentPlatform === 'win32') {
      // Windows paths
      possiblePaths.push(
        'C:\\Program Files (x86)\\Diablo II Resurrected',
        'C:\\Program Files\\Diablo II Resurrected',
        'D:\\Program Files (x86)\\Diablo II Resurrected',
        'D:\\Program Files\\Diablo II Resurrected',
        // Steam
        'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Diablo II Resurrected',
        'D:\\Steam\\steamapps\\common\\Diablo II Resurrected',
        // Battle.net default
        path.join(home, 'Games', 'Diablo II Resurrected'),
      );
    } else if (currentPlatform === 'darwin') {
      // macOS paths
      possiblePaths.push(
        '/Applications/Diablo II Resurrected.app',
        path.join(home, 'Applications', 'Diablo II Resurrected.app'),
      );
    }

    // Check each path
    for (const possiblePath of possiblePaths) {
      if (existsSync(possiblePath)) {
        console.log(`Found D2R installation at: ${possiblePath}`);
        this.d2rPath = possiblePath;
        return possiblePath;
      }
    }

    return null;
  }

  /**
   * Gets the path to an item icon file in the D2R installation.
   * @param itemCode - The D2R internal item code
   * @returns The full path to the icon file or null if not found
   */
  private getIconFilePath(itemCode: string): string | null {
    const d2rPath = this.findD2RInstallation();
    if (!d2rPath) {
      return null;
    }

    // Common icon locations in D2R
    const possibleLocations = [
      path.join(d2rPath, 'Data', 'hd', 'items', `${itemCode}.png`),
      path.join(d2rPath, 'Data', 'global', 'items', `${itemCode}.png`),
      path.join(d2rPath, 'data', 'hd', 'items', `${itemCode}.png`),
      path.join(d2rPath, 'data', 'global', 'items', `${itemCode}.png`),
    ];

    for (const location of possibleLocations) {
      if (existsSync(location)) {
        return location;
      }
    }

    return null;
  }

  /**
   * Retrieves an item icon as a base64-encoded data URL.
   * Uses cache when available, otherwise loads from D2R installation.
   * @param itemCode - The D2R internal item code
   * @returns Base64 data URL of the icon or null if not found
   */
  async getIconAsBase64(itemCode: string): Promise<string | null> {
    // Check memory cache first
    const cachedIcon = this.iconCache.get(itemCode);
    if (cachedIcon !== undefined) {
      return cachedIcon;
    }

    // Try to load from D2R installation
    const iconPath = this.getIconFilePath(itemCode);
    if (!iconPath) {
      // console.warn(`Icon file not found for code: ${itemCode}`);
      return null;
    }

    try {
      const buffer = await fs.readFile(iconPath);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      // Cache the result
      this.iconCache.set(itemCode, dataUrl);

      // Persist cache to disk (async, don't await)
      this.saveCacheToDisk();

      return dataUrl;
    } catch (error) {
      console.error(`Failed to load icon for ${itemCode}:`, error);
      return null;
    }
  }

  /**
   * Preloads multiple icons into the cache.
   * Useful for loading commonly used icons on app startup.
   * @param itemCodes - Array of item codes to preload
   */
  async preloadIcons(itemCodes: string[]): Promise<void> {
    console.log(`Preloading ${itemCodes.length} icons...`);
    await Promise.all(itemCodes.map((code) => this.getIconAsBase64(code)));
    console.log('Icon preloading complete');
  }

  /**
   * Clears the in-memory icon cache.
   */
  clearCache(): void {
    this.iconCache.clear();
    console.log('Icon cache cleared');
  }

  /**
   * Gets the current cache size.
   * @returns Number of cached icons
   */
  getCacheSize(): number {
    return this.iconCache.size;
  }

  /**
   * Checks if D2R installation is available.
   * @returns True if D2R is found
   */
  isD2RAvailable(): boolean {
    return this.findD2RInstallation() !== null;
  }

  /**
   * Loads the icon cache from disk.
   * @private
   */
  private async loadCacheFromDisk(): Promise<void> {
    try {
      if (existsSync(this.cacheFile)) {
        const data = await fs.readFile(this.cacheFile, 'utf-8');
        const cache = JSON.parse(data) as Record<string, string>;

        // Restore cache to Map
        for (const [key, value] of Object.entries(cache)) {
          this.iconCache.set(key, value);
        }

        console.log(`Loaded ${this.iconCache.size} icons from cache`);
      }
    } catch (error) {
      console.error('Failed to load icon cache from disk:', error);
    }
  }

  /**
   * Saves the icon cache to disk.
   * @private
   */
  private async saveCacheToDisk(): Promise<void> {
    try {
      // Convert Map to plain object
      const cache: Record<string, string> = {};
      for (const [key, value] of this.iconCache.entries()) {
        cache[key] = value;
      }

      await fs.writeFile(this.cacheFile, JSON.stringify(cache), 'utf-8');
    } catch (error) {
      console.error('Failed to save icon cache to disk:', error);
    }
  }

  /**
   * Gets cache statistics for debugging.
   * @returns Object with cache information
   */
  getCacheStats(): { size: number; d2rAvailable: boolean; cachePath: string } {
    return {
      size: this.iconCache.size,
      d2rAvailable: this.isD2RAvailable(),
      cachePath: this.cacheFile,
    };
  }
}

// Singleton instance
export const iconService = new IconService();
