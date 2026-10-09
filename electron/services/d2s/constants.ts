import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';

/** Save file versions the d2s library reads: classic 96-99 and the D2R versions 0-2. */
export const D2S_CONSTANT_VERSIONS: readonly number[] = [96, 97, 98, 99, 0, 1, 2];

/** The library-wide constant registry of the d2s library. */
export interface D2sConstantRegistry {
  getConstantData(version: number): d2sTypes.IConstantData;
  setConstantData(version: number, constants: d2sTypes.IConstantData): void;
}

/**
 * Registers constant data for every supported save file version that has none yet. Versions that
 * already have constants are left alone, so calling it again changes nothing.
 */
export function registerD2sConstants(registry: D2sConstantRegistry): void {
  for (const version of D2S_CONSTANT_VERSIONS) {
    try {
      registry.getConstantData(version);
    } catch {
      registry.setConstantData(version, version === 99 ? constants99 : constants96);
    }
  }
}

/**
 * Makes sure the d2s library can read and write character saves. `d2s.read` and `d2s.write` look
 * their constants up in a library-wide registry, so this must run before any character save is
 * read or written. Every service that reads or writes saves calls it; it is idempotent.
 */
export function ensureD2sConstants(): void {
  registerD2sConstants(d2s);
}
