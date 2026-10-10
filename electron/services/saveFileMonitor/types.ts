import type {
  D2SaveFile,
  ParsedInventoryItemWithRaw,
  ParsedInventorySnapshot,
} from '../../types/grail';
import type { SaveParseStatus } from './saveFileParser';

export interface FileParseSuccess {
  saveName: string;
  success: true;
  inventorySnapshot: ParsedInventorySnapshot;
  /** Header data of the file, read from the same buffer the items came from. */
  saveFile: D2SaveFile;
  /** Every item of the file, including socketed ones the snapshot omits. */
  parsedItems: ParsedInventoryItemWithRaw[];
}

/** A complete parse: the only result vault reconciliation may act on. */
export interface CompleteFileParseResult extends FileParseSuccess {
  parseStatus: 'parsed';
  /** Fingerprints of every item in the file, including socketed ones the snapshot omits. */
  presentFingerprints: string[];
  /** Location-independent identity of each item, parallel to `presentFingerprints`. */
  presentIdentityKeys: string[];
}

/** A parse that read no items or only some of them; it must never mark vault rows as missing. */
export interface IncompleteFileParseResult extends FileParseSuccess {
  parseStatus: Exclude<SaveParseStatus, 'parsed'>;
}

export interface FailedFileParseResult {
  saveName: string;
  success: false;
}

export type SingleFileParseResult =
  | CompleteFileParseResult
  | IncompleteFileParseResult
  | FailedFileParseResult;
