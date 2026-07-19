import { BitReader } from '@dschu012/d2s/lib/binary/bitreader';

interface MutableBitReader extends BitReader {
  ReadBitArray?: (count: number) => Uint8Array;
  ReadBits?: (bytes: Uint8Array, count: number) => Uint8Array;
}

function toPositiveBitCount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function wrapBoundedRead<TArgs extends unknown[], TResult>(
  reader: MutableBitReader,
  payloadBitLength: number,
  context: string,
  opName: string,
  method: ((...args: TArgs) => TResult) | undefined,
  bitCountResolver: (...args: TArgs) => number,
): ((...args: TArgs) => TResult) | undefined {
  if (typeof method !== 'function') {
    return undefined;
  }

  const bound = method.bind(reader);
  return (...args: TArgs) => {
    const bitCount = bitCountResolver(...args);
    if (reader.offset + bitCount > payloadBitLength) {
      throw new Error(
        `${context}: EOF while reading ${opName} at bit ${reader.offset} (need ${bitCount}, size ${payloadBitLength})`,
      );
    }
    return bound(...args);
  };
}

export function createBoundedBitReader(payload: Uint8Array, context: string): BitReader {
  const reader = new BitReader(payload) as MutableBitReader;
  const payloadBitLength = payload.length * 8;

  const boundedReadBit = wrapBoundedRead(
    reader,
    payloadBitLength,
    context,
    'bit',
    reader.ReadBit,
    () => 1,
  );
  if (boundedReadBit) {
    reader.ReadBit = boundedReadBit as BitReader['ReadBit'];
  }

  const boundedReadString = wrapBoundedRead(
    reader,
    payloadBitLength,
    context,
    'string',
    reader.ReadString,
    (length: number) => toPositiveBitCount(length, 0) * 8,
  );
  if (boundedReadString) {
    reader.ReadString = boundedReadString as BitReader['ReadString'];
  }

  const boundedReadUInt8 = wrapBoundedRead(
    reader,
    payloadBitLength,
    context,
    'uint8',
    reader.ReadUInt8,
    (bits?: number) => toPositiveBitCount(bits, 8),
  );
  if (boundedReadUInt8) {
    reader.ReadUInt8 = boundedReadUInt8 as BitReader['ReadUInt8'];
  }

  const boundedReadUInt16 = wrapBoundedRead(
    reader,
    payloadBitLength,
    context,
    'uint16',
    reader.ReadUInt16,
    (bits?: number) => toPositiveBitCount(bits, 16),
  );
  if (boundedReadUInt16) {
    reader.ReadUInt16 = boundedReadUInt16 as BitReader['ReadUInt16'];
  }

  const boundedReadUInt32 = wrapBoundedRead(
    reader,
    payloadBitLength,
    context,
    'uint32',
    reader.ReadUInt32,
    (bits?: number) => toPositiveBitCount(bits, 32),
  );
  if (boundedReadUInt32) {
    reader.ReadUInt32 = boundedReadUInt32 as BitReader['ReadUInt32'];
  }

  const boundedReadBitArray = wrapBoundedRead(
    reader,
    payloadBitLength,
    context,
    'bit-array',
    reader.ReadBitArray,
    (count: number) => toPositiveBitCount(count, 0),
  );
  if (boundedReadBitArray) {
    reader.ReadBitArray = boundedReadBitArray;
  }

  const boundedReadBits = wrapBoundedRead(
    reader,
    payloadBitLength,
    context,
    'bits',
    reader.ReadBits,
    (_bytes: Uint8Array, count: number) => toPositiveBitCount(count, 0),
  );
  if (boundedReadBits) {
    reader.ReadBits = boundedReadBits;
  }

  return reader;
}
