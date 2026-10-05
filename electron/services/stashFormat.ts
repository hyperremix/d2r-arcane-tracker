const D2I_SECTOR_SIGNATURE = 0xaa55aa55;
export const D2I_SECTOR_HEADER_SIZE = 64;
const MAX_SECTORS = 1024;

export interface D2iSectorDescriptor {
  offset: number;
  size: number;
  payloadOffset: number;
  payloadSize: number;
  payloadSignature: string;
}

export interface D2iMetadata {
  version: number;
  hardcore: boolean;
  sectors: D2iSectorDescriptor[];
  /**
   * Bytes after the last readable sector. A well-formed file is the exact concatenation of its
   * sectors, so anything left over (a truncated tail, or a sector with a bad signature) means the
   * file was damaged or cut off and `sectors` does not describe all of it.
   */
  trailingBytes: number;
}

function readPayloadSignature(buffer: Buffer, payloadOffset: number, payloadSize: number): string {
  if (payloadSize < 2) {
    return '';
  }

  const signatureBytes = buffer.subarray(payloadOffset, payloadOffset + 2);

  // Check the raw bytes: Node's 'ascii' decoding drops the high bit, so 0xC0 0xED would read as
  // the printable "@m".
  if (signatureBytes.every((byte) => byte >= 0x20 && byte <= 0x7e)) {
    return signatureBytes.toString('latin1');
  }

  return signatureBytes.toString('hex');
}

/**
 * Reads only the format version from the first sector header, without validating any sector size.
 * Lets callers tell a damaged v105+ file (whose metadata read throws) from a pre-105 file.
 * Returns `undefined` when the buffer does not start with a sector header.
 */
export function readD2iHeaderVersion(buffer: Buffer): number | undefined {
  if (buffer.length < 12 || buffer.readUInt32LE(0) !== D2I_SECTOR_SIGNATURE) {
    return undefined;
  }

  return buffer.readUInt32LE(8);
}

export function readD2iMetadata(buffer: Buffer): D2iMetadata {
  if (buffer.length < D2I_SECTOR_HEADER_SIZE) {
    throw new Error(`Invalid d2i file: expected at least ${D2I_SECTOR_HEADER_SIZE} bytes`);
  }

  const firstSignature = buffer.readUInt32LE(0);
  if (firstSignature !== D2I_SECTOR_SIGNATURE) {
    throw new Error('Unsupported d2i format: missing sector header signature 0xAA55AA55');
  }

  const sectors: D2iSectorDescriptor[] = [];
  let offset = 0;

  for (let i = 0; i < MAX_SECTORS && offset + D2I_SECTOR_HEADER_SIZE <= buffer.length; i += 1) {
    const signature = buffer.readUInt32LE(offset);
    // A bad signature ends the sector list; the rest is reported through `trailingBytes`.
    if (signature !== D2I_SECTOR_SIGNATURE) {
      break;
    }

    const size = buffer.readUInt32LE(offset + 16);
    if (size < D2I_SECTOR_HEADER_SIZE) {
      throw new Error(`Invalid d2i sector size ${size} at offset ${offset}`);
    }

    if (offset + size > buffer.length) {
      throw new Error(
        `Invalid d2i sector size ${size} at offset ${offset}: exceeds file length ${buffer.length}`,
      );
    }

    const payloadOffset = offset + D2I_SECTOR_HEADER_SIZE;
    const payloadSize = size - D2I_SECTOR_HEADER_SIZE;
    sectors.push({
      offset,
      size,
      payloadOffset,
      payloadSize,
      payloadSignature: readPayloadSignature(buffer, payloadOffset, payloadSize),
    });

    offset += size;
  }

  if (sectors.length === 0) {
    throw new Error('Invalid d2i file: no stash sectors found');
  }

  const firstSectorOffset = sectors[0].offset;
  const hardcore = buffer.readUInt32LE(firstSectorOffset + 4) === 0;
  const version = buffer.readUInt32LE(firstSectorOffset + 8);

  return {
    version,
    hardcore,
    sectors,
    trailingBytes: buffer.length - offset,
  };
}
