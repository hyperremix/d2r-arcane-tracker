import { D2R_PATTERNS, D2RGameState, OFFSET_ADJUSTMENTS } from '../config/d2rPatterns';
import { findPatternString } from './patternScanner';

/**
 * Resolves the module-relative UI offset from a position-preserving snapshot of the D2R.exe image
 * (buffer index === RVA).
 *
 * The UI pattern is `test bpl, bpl; setz byte ptr [rip+disp32]`. The displacement is a signed
 * RIP-relative value, so the UI offset is `patternRva + 10 + disp32`. The in-game flag lives at
 * `UI - 0xA`.
 *
 * Every pattern match is validated rather than trusting the first one:
 * - the in-game flag address must fall inside the module image
 * - candidates whose flag byte currently reads as a known game state (0 or 1) are preferred
 *
 * @param image - Module image snapshot where index equals RVA
 * @returns The UI offset (RVA), or undefined if no usable match exists
 */
export function resolveUiOffset(image: Buffer): number | undefined {
  const pattern = D2R_PATTERNS.UI;
  const { UI_READ_OFFSET, UI_INSTRUCTION_OFFSET, UI_STATE_ADJUSTMENT } = OFFSET_ADJUSTMENTS;

  let fallback: number | undefined;
  let searchFrom = 0;

  while (searchFrom < image.length) {
    const matchOffset = findPatternString(image, pattern.pattern, pattern.mask, searchFrom);
    if (matchOffset === -1) {
      break;
    }
    searchFrom = matchOffset + 1;

    if (matchOffset + UI_READ_OFFSET + 4 > image.length) {
      continue;
    }

    const displacement = image.readInt32LE(matchOffset + UI_READ_OFFSET);
    const uiOffset = matchOffset + UI_INSTRUCTION_OFFSET + displacement;
    const stateOffset = uiOffset - UI_STATE_ADJUSTMENT;

    if (stateOffset < 0 || stateOffset >= image.length) {
      continue;
    }

    const stateValue = image[stateOffset];
    if (stateValue === D2RGameState.Lobby || stateValue === D2RGameState.InGame) {
      return uiOffset;
    }

    fallback ??= uiOffset;
  }

  return fallback;
}
