import { createWriteStream, existsSync, promises as fs } from 'node:fs';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { PNG } from 'pngjs';

/**
 * Result of sprite conversion operation
 */
export interface ConversionResult {
  success: boolean;
  totalFiles: number;
  convertedFiles: number;
  skippedFiles: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * Current status of sprite conversion
 */
export interface ConversionStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progress?: { current: number; total: number };
  lastResult?: ConversionResult;
}

/**
 * Sprite header information for SpA1 format
 */
interface SpriteHeader {
  signature: string;
  width: number;
  height: number;
  frameCount: number;
  headerSize: number;
  pixelDataSize: number;
  storedHeight: number;
}

/**
 * Service for managing D2R item icons.
 * Handles sprite conversion from D2R installation to PNGs stored in userData.
 */
export class IconService {
  private d2rPath: string | null = null;
  private iconCache: Map<string, string> = new Map();
  private readonly cacheFile: string;
  private readonly iconDirectory: string;
  private conversionStatus: ConversionStatus = { status: 'not_started' };

  constructor() {
    // Cache file and icon directory stored in app data directory
    const userDataPath = app.getPath('userData');
    this.cacheFile = path.join(userDataPath, 'icon-cache.json');
    this.iconDirectory = path.join(userDataPath, 'item-icons');
    this.loadCacheFromDisk();
  }

  /**
   * Sets the D2R installation path
   * @param d2rPath - Path to D2R installation
   */
  setD2RPath(d2rPath: string): void {
    this.d2rPath = d2rPath;
  }

  /**
   * Gets the current D2R installation path
   * @returns The D2R installation path or null if not set
   */
  getD2RPath(): string | null {
    return this.d2rPath;
  }

  /**
   * Detects the D2R installation path based on the operating system.
   * @returns The D2R installation path or null if not found
   */
  findD2RInstallation(): string | null {
    if (this.d2rPath && existsSync(this.d2rPath)) {
      return this.d2rPath;
    }

    const possiblePaths: string[] = [];
    const currentPlatform = platform();
    const home = homedir();

    if (currentPlatform === 'win32') {
      // Windows paths
      possiblePaths.push(
        'C:\\Games\\Diablo II Resurrected',
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
   * Parses the SpA1 sprite file header
   * @param data - Buffer containing sprite data
   * @returns Parsed sprite header
   */
  private parseSpriteHeader(data: Buffer): SpriteHeader {
    const signature = data.toString('ascii', 0, 4);
    if (signature !== 'SpA1') {
      throw new Error(`Invalid sprite signature: ${signature}`);
    }

    // Parse header fields
    const width = data.readUInt16LE(6);
    const storedHeight = data.readUInt16LE(8);
    const frameCount = data.readUInt32LE(12);

    // Read actual pixel data size from offset 32-35
    const pixelDataSize = data.readUInt32LE(32);

    // Calculate actual height from pixel data size
    const bytesPerPixel = 4; // RGBA format
    const actualHeight = Math.floor(pixelDataSize / (width * bytesPerPixel));

    return {
      signature,
      width,
      height: actualHeight,
      frameCount,
      headerSize: 40,
      pixelDataSize,
      storedHeight,
    };
  }

  /**
   * Creates a PNG from pixel data buffer
   * @param pixelData - RGBA pixel data
   * @param width - Image width
   * @param height - Image height
   * @param outputPath - Path to save the PNG
   */
  private async createPngFromBuffer(
    pixelData: Buffer,
    width: number,
    height: number,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create PNG from RGBA data
        const png = new PNG({ width, height });

        // Copy pixel data directly
        pixelData.copy(png.data);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        fs.mkdir(outputDir, { recursive: true }).then(() => {
          // Save as PNG
          const stream = createWriteStream(outputPath);
          png.pack().pipe(stream);

          stream.on('finish', () => {
            resolve();
          });

          stream.on('error', () => {
            // Try BGRA fallback
            this.createPngFromBufferBGRA(pixelData, width, height, outputPath)
              .then(resolve)
              .catch(reject);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Creates a PNG from pixel data buffer with BGRA format
   * @param pixelData - BGRA pixel data
   * @param width - Image width
   * @param height - Image height
   * @param outputPath - Path to save the PNG
   */
  private async createPngFromBufferBGRA(
    pixelData: Buffer,
    width: number,
    height: number,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Convert BGRA to RGBA by swapping R and B channels
        const pixelArray = Buffer.from(pixelData);
        for (let i = 0; i < pixelArray.length; i += 4) {
          // Swap R and B (bytes 0 and 2)
          const r = pixelArray[i];
          pixelArray[i] = pixelArray[i + 2];
          pixelArray[i + 2] = r;
        }

        const png = new PNG({ width, height });
        pixelArray.copy(png.data);

        const stream = createWriteStream(outputPath);
        png.pack().pipe(stream);

        stream.on('finish', () => {
          resolve();
        });

        stream.on('error', (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Converts a single sprite file to PNG
   * @param spritePath - Path to the sprite file
   * @param outputPath - Path for the output PNG
   */
  private async convertSpriteFile(spritePath: string, outputPath: string): Promise<void> {
    // Read the sprite file
    const data = await fs.readFile(spritePath);

    // Parse header
    const header = this.parseSpriteHeader(data);

    const width = header.width;
    const height = header.height;
    const headerSize = header.headerSize;

    // Extract pixel data (starts after header)
    const pixelDataStart = headerSize;
    const pixelDataSize = header.pixelDataSize;

    // Extract RGBA pixel data
    let pixelData = data.slice(pixelDataStart, pixelDataStart + pixelDataSize);

    // Pad with transparent pixels if needed
    if (pixelData.length < pixelDataSize) {
      const padding = Buffer.alloc(pixelDataSize - pixelData.length, 0);
      pixelData = Buffer.concat([pixelData, padding]);
    }

    // Convert to PNG
    await this.createPngFromBuffer(pixelData, width, height, outputPath);
  }

  /**
   * Recursively finds all sprite files in a directory
   * @param directory - Directory to search
   * @returns Array of sprite file paths
   */
  private async findSpriteFiles(directory: string): Promise<string[]> {
    const spriteFiles: string[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findSpriteFiles(fullPath);
          spriteFiles.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.sprite')) {
          spriteFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${directory}:`, error);
    }

    return spriteFiles;
  }

  /**
   * Converts all sprite files from D2R installation to PNGs
   * @param d2rPath - Path to D2R installation
   * @param onProgress - Progress callback
   * @returns Conversion result
   */
  async convertAllSprites(
    d2rPath: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<ConversionResult> {
    this.conversionStatus = { status: 'in_progress', progress: { current: 0, total: 0 } };

    const result: ConversionResult = {
      success: false,
      totalFiles: 0,
      convertedFiles: 0,
      skippedFiles: 0,
      errors: [],
    };

    try {
      // Ensure icon directory exists
      await fs.mkdir(this.iconDirectory, { recursive: true });

      // Find the sprite directory
      const spriteDir = path.join(d2rPath, 'Data', 'hd', 'global', 'ui', 'items');
      if (!existsSync(spriteDir)) {
        throw new Error(`Sprite directory not found: ${spriteDir}`);
      }

      // Find all sprite files
      const spriteFiles = await this.findSpriteFiles(spriteDir);
      result.totalFiles = spriteFiles.length;
      this.conversionStatus.progress = { current: 0, total: result.totalFiles };

      console.log(`Found ${spriteFiles.length} sprite files to convert`);

      // Convert each sprite file
      for (let i = 0; i < spriteFiles.length; i++) {
        const spriteFile = spriteFiles[i];
        const filename = path.basename(spriteFile, '.sprite');
        const outputPath = path.join(this.iconDirectory, `${filename}.png`);

        try {
          // Skip if already exists (idempotent)
          if (existsSync(outputPath)) {
            result.skippedFiles++;
          } else {
            await this.convertSpriteFile(spriteFile, outputPath);
            result.convertedFiles++;
          }

          // Report progress every 10 files or on last file
          if ((i + 1) % 10 === 0 || i === spriteFiles.length - 1) {
            this.conversionStatus.progress = { current: i + 1, total: result.totalFiles };
            onProgress?.(i + 1, result.totalFiles);
          }
        } catch (error) {
          console.error(`Failed to convert ${spriteFile}:`, error);
          result.errors.push({
            file: spriteFile,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      result.success = result.errors.length === 0 || result.convertedFiles > 0;
      this.conversionStatus = {
        status: result.success ? 'completed' : 'failed',
        lastResult: result,
      };

      console.log(
        `Conversion complete: ${result.convertedFiles} converted, ${result.skippedFiles} skipped, ${result.errors.length} errors`,
      );
    } catch (error) {
      console.error('Sprite conversion failed:', error);
      result.success = false;
      result.errors.push({
        file: 'N/A',
        error: error instanceof Error ? error.message : String(error),
      });
      this.conversionStatus = { status: 'failed', lastResult: result };
    }

    return result;
  }

  /**
   * Gets an icon by filename from the converted PNG directory
   * @param filename - The icon filename (e.g., "item.png")
   * @returns Base64 data URL or null if not found
   */
  async getIconByFilename(filename: string): Promise<string | null> {
    // Check memory cache first
    const cachedIcon = this.iconCache.get(filename);
    if (cachedIcon !== undefined) {
      return cachedIcon;
    }

    // Try to load from converted PNG directory
    const iconPath = path.join(this.iconDirectory, filename);
    if (!existsSync(iconPath)) {
      return null;
    }

    try {
      const buffer = await fs.readFile(iconPath);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      // Cache the result
      this.iconCache.set(filename, dataUrl);

      // Persist cache to disk (async, don't await)
      this.saveCacheToDisk();

      return dataUrl;
    } catch (error) {
      console.error(`Failed to load icon ${filename}:`, error);
      return null;
    }
  }

  /**
   * Gets an icon by item name (legacy support)
   * @returns Base64 data URL or null if not found
   */
  async getIconByName(): Promise<string | null> {
    // For now, this is a placeholder that returns null
    // The actual item name to filename mapping would need to be implemented
    // based on your item database
    return null;
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
   * Gets the current conversion status
   * @returns Current conversion status
   */
  getConversionStatus(): ConversionStatus {
    return this.conversionStatus;
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
  getCacheStats(): {
    size: number;
    iconDirectory: string;
    cacheFile: string;
    conversionStatus: ConversionStatus;
  } {
    return {
      size: this.iconCache.size,
      iconDirectory: this.iconDirectory,
      cacheFile: this.cacheFile,
      conversionStatus: this.conversionStatus,
    };
  }
}

// Singleton instance
export const iconService = new IconService();
