declare module '@dschu012/d2s' {
  export namespace types {
    export interface IItem {
      [key: string]: any;
    }

    export interface ID2S {
      [key: string]: any;
    }

    export interface IStashPage {
      items: IItem[];
      [key: string]: any;
    }

    export interface IStash {
      hardcore: boolean;
      pages: IStashPage[];
      [key: string]: any;
    }

    export interface IConstantData {
      [key: string]: any;
    }
  }

  export function read(
    buffer: Uint8Array,
    constants?: types.IConstantData,
    userConfig?: Record<string, unknown>,
  ): Promise<types.ID2S>;

  export function write(
    data: types.ID2S,
    constants?: types.IConstantData,
    userConfig?: Record<string, unknown>,
  ): Promise<Uint8Array>;

  export function readItem(
    buffer: Uint8Array,
    version: number,
    constants?: types.IConstantData,
    userConfig?: Record<string, unknown>,
  ): Promise<types.IItem>;

  export function writeItem(
    item: types.IItem,
    version: number,
    constants?: types.IConstantData,
    userConfig?: Record<string, unknown>,
  ): Promise<Uint8Array>;

  export function getConstantData(version: number): types.IConstantData;
  export function setConstantData(version: number, constants: types.IConstantData): void;
}

declare module '@dschu012/d2s/lib/d2/types' {
  export interface IItem {
    [key: string]: any;
  }
}

declare module '@dschu012/d2s/lib/d2/stash' {
  import type { types } from '@dschu012/d2s';

  export function read(
    buffer: Uint8Array,
    constants?: types.IConstantData,
    version?: number | null,
    userConfig?: Record<string, unknown>,
  ): Promise<types.IStash>;

  export function write(
    data: types.IStash,
    constants: types.IConstantData,
    version: number,
    userConfig?: Record<string, unknown>,
  ): Promise<Uint8Array>;
}

declare module '@dschu012/d2s/lib/data/versions/96_constant_data' {
  export const constants: any;
}

declare module '@dschu012/d2s/lib/data/versions/99_constant_data' {
  export const constants: any;
}

declare module '@dschu012/d2s/lib/data/versions/105_constant_data' {
  export const constants: any;
}

declare module '@dschu012/d2s/lib/binary/bitreader' {
  export class BitReader {
    bits: Uint8Array;
    offset: number;

    constructor(buffer: ArrayBuffer | Uint8Array);

    ReadString(length: number): string;
    ReadUInt8(bits?: number): number;
    ReadUInt16(bits?: number): number;
    ReadUInt32(bits?: number): number;
    ReadBit(): number;
    SeekBit(offset: number): void;
  }
}

declare module '@dschu012/d2s/lib/d2/items' {
  import type { types } from '@dschu012/d2s';
  import type { BitReader } from '@dschu012/d2s/lib/binary/bitreader';

  export function readItems(
    reader: BitReader,
    version: number,
    constants: types.IConstantData,
    config: Record<string, unknown>,
    char?: types.ID2S,
  ): Promise<types.IItem[]>;
}
