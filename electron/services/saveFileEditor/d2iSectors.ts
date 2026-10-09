import { D2I_SECTOR_HEADER_SIZE, readD2iMetadata } from '../stashFormat';

/**
 * Low-level layout of modern .d2i stashes: JM sectors and rebuilding a file around a new sector payload.
 */

// Byte offset within the sector header where the total sector size (header + payload) is stored.
const D2I_SECTOR_SIZE_FIELD_OFFSET = 16;

// Byte offsets within a JM item-list header.
export const JM_ITEM_COUNT_OFFSET = 2; // bytes 2-3 = LE uint16 item count
export const JM_ITEM_DATA_OFFSET = 4; // item bytes start at byte 4

/**
 * Rebuilds a .d2i buffer, replacing one sector's payload with `newPayload`.
 * All other sectors are kept byte-for-byte identical.
 */
export function rebuildD2iBuffer(
  buffer: Buffer,
  sectors: Array<{ offset: number; size: number }>,
  targetSectorOffset: number,
  newPayload: Buffer,
): Buffer {
  const parts: Buffer[] = [];
  for (const sector of sectors) {
    const header = Buffer.from(
      buffer.subarray(sector.offset, sector.offset + D2I_SECTOR_HEADER_SIZE),
    );
    if (sector.offset === targetSectorOffset) {
      header.writeUInt32LE(
        D2I_SECTOR_HEADER_SIZE + newPayload.length,
        D2I_SECTOR_SIZE_FIELD_OFFSET,
      );
      parts.push(header, newPayload);
    } else {
      const sectorData = buffer.subarray(
        sector.offset + D2I_SECTOR_HEADER_SIZE,
        sector.offset + sector.size,
      );
      parts.push(header, Buffer.from(sectorData));
    }
  }
  return Buffer.concat(parts);
}

export interface ModernResourceSector {
  sectorIndex: number;
  offset: number;
  size: number;
  payloadOffset: number;
  payloadSize: number;
}

export function resolveModernJmSectors(buffer: Buffer): {
  metadata: ReturnType<typeof readD2iMetadata>;
  jmSectors: ModernResourceSector[];
} {
  const metadata = readD2iMetadata(buffer);
  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  return { metadata, jmSectors };
}
