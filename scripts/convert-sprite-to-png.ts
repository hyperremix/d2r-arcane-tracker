#!/usr/bin/env tsx

/**
 * Convert Diablo 2 Resurrected .sprite files to PNG format.
 * SpA1 format parser and converter using TypeScript.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PNG } from 'pngjs';

interface SpriteHeader {
  signature: string;
  width: number;
  height: number;
  frameCount: number;
  headerSize: number;
  pixelDataSize: number;
  storedHeight: number;
}

function parseSpriteHeader(data: Buffer): SpriteHeader {
  /**Parse the SpA1 sprite file header.*/
  const signature = data.toString('ascii', 0, 4);
  if (signature !== 'SpA1') {
    throw new Error(`Invalid sprite signature: ${signature}`);
  }

  // Parse header fields
  const width = data.readUInt16LE(6);
  const storedHeight = data.readUInt16LE(8); // This may not be the actual height
  const frameCount = data.readUInt32LE(12);

  // Read actual pixel data size from offset 32-35
  const pixelDataSize = data.readUInt32LE(32);

  // Calculate actual height from pixel data size
  const bytesPerPixel = 4; // RGBA format
  const actualHeight = Math.floor(pixelDataSize / (width * bytesPerPixel));

  return {
    signature,
    width,
    height: actualHeight, // Use calculated height instead of stored height
    frameCount,
    headerSize: 40, // Correct header size
    pixelDataSize,
    storedHeight, // Keep for debugging
  };
}

function convertSpriteToPng(spritePath: string, outputPath?: string): string {
  /**
   * Convert a D2R .sprite file to PNG format.
   *
   * Args:
   *   spritePath: Path to the .sprite file
   *   outputPath: Path for the output PNG file (optional)
   *
   * Returns:
   *   Path to the created PNG file
   */
  const spriteFile = path.resolve(spritePath);

  try {
    fs.accessSync(spriteFile);
  } catch {
    throw new Error(`Sprite file not found: ${spritePath}`);
  }

  if (!outputPath) {
    const ext = path.extname(spriteFile);
    outputPath = spriteFile.replace(ext, '.png');
  }

  console.log(`Reading sprite file: ${spritePath}`);

  // Read the entire file
  const data = fs.readFileSync(spritePath);

  // Parse header
  const header = parseSpriteHeader(data);
  console.log(`Signature: ${header.signature}`);
  console.log(`Stored dimensions: ${header.width} x ${header.storedHeight}`);
  console.log(`Calculated dimensions: ${header.width} x ${header.height}`);
  console.log(`Frame count: ${header.frameCount}`);
  console.log(`Header size: ${header.headerSize} bytes`);
  console.log(`Pixel data size from header: ${header.pixelDataSize} bytes`);

  const width = header.width;
  const height = header.height;
  const headerSize = header.headerSize;

  // Extract pixel data (starts after header)
  // Assuming RGBA format (4 bytes per pixel)
  const pixelDataStart = headerSize;
  const pixelDataSize = header.pixelDataSize; // Use the size from header

  console.log(`Expected pixel data size: ${pixelDataSize} bytes`);
  console.log(`Actual data available: ${data.length - headerSize} bytes`);

  // Try to extract RGBA pixel data
  const pixelData = data.slice(pixelDataStart, pixelDataStart + pixelDataSize);

  if (pixelData.length < pixelDataSize) {
    console.log(
      `Warning: Not enough pixel data. Got ${pixelData.length}, expected ${pixelDataSize}`,
    );
    // Pad with transparent pixels if needed
    const padding = Buffer.alloc(pixelDataSize - pixelData.length, 0);
    const paddedPixelData = Buffer.concat([pixelData, padding]);
    createPngFromData(paddedPixelData, width, height, outputPath);
  } else {
    createPngFromData(pixelData, width, height, outputPath);
  }

  return outputPath;
}

function createPngFromData(
  pixelData: Buffer,
  width: number,
  height: number,
  outputPath: string,
): void {
  /**Create PNG from RGBA pixel data, with fallback to BGRA conversion.*/
  try {
    // Create image from RGBA data
    const png = new PNG({ width, height });

    // Copy pixel data directly
    pixelData.copy(png.data);

    // Save as PNG
    const stream = fs.createWriteStream(outputPath);
    png.pack().pipe(stream);

    stream.on('finish', () => {
      console.log(`✅ Successfully converted to: ${outputPath}`);
      console.log(`   Image size: ${width} x ${height}`);
      console.log(`   Mode: RGBA`);
    });

    stream.on('error', (error) => {
      console.log(`Error creating image: ${error}`);
      throw error;
    });
  } catch (error) {
    console.log(`Error creating image: ${error}`);

    // Try alternative: maybe it's BGRA instead of RGBA
    console.log('\nTrying BGRA format...');
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

      const stream = fs.createWriteStream(outputPath);
      png.pack().pipe(stream);

      stream.on('finish', () => {
        console.log(`✅ Successfully converted (BGRA) to: ${outputPath}`);
      });

      stream.on('error', (error2) => {
        console.log(`Error with BGRA format too: ${error2}`);
        throw error2;
      });
    } catch (error2) {
      console.log(`Error with BGRA format too: ${error2}`);
      throw error2;
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: tsx convert-sprite-to-png.ts <sprite_file> [output_file]');
    process.exit(1);
  }

  const spriteFile = args[0];
  const outputFile = args[1];

  try {
    const result = convertSpriteToPng(spriteFile, outputFile);
    console.log(`\n✨ Conversion complete: ${result}`);
  } catch (error) {
    console.log(`\n❌ Conversion failed: ${error}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
