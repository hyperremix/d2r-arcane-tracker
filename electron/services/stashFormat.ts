const D2I_SECTOR_SIGNATURE = 0xaa55aa55;
const D2I_SECTOR_HEADER_SIZE = 64;
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
}

function readPayloadSignature(buffer: Buffer, payloadOffset: number, payloadSize: number): string {
  if (payloadSize < 2) {
    return '';
  }

  const signatureBytes = buffer.subarray(payloadOffset, payloadOffset + 2);
  const asciiSignature = signatureBytes.toString('ascii');

  if (/^[\x20-\x7e]{2}$/.test(asciiSignature)) {
    return asciiSignature;
  }

  return signatureBytes.toString('hex');
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
  };
}
