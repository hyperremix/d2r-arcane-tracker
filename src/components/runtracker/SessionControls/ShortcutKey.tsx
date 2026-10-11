import { getModifierKeyNames, parseShortcut } from '@/lib/hotkeys';
import { cn } from '@/lib/utils';

// Key names as the `aria-keyshortcuts` attribute expects them (UI Events key values)
const ARIA_KEY_NAMES: Record<string, string> = {
  ' ': 'Space',
  escape: 'Escape',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
};

/**
 * Converts a stored shortcut (e.g. "Ctrl+Shift+E") into an `aria-keyshortcuts` value for the
 * current platform (e.g. "Meta+Shift+E" on macOS, where the stored Ctrl fires with Command).
 * @param shortcut - The stored shortcut
 * @returns The attribute value, or undefined if the shortcut has no usable key
 */
export function toAriaKeyShortcuts(shortcut: string): string | undefined {
  const parsed = parseShortcut(shortcut);
  if (!parsed.key) {
    return undefined;
  }
  const isMac = getModifierKeyNames().primaryModifier === 'Command';
  const key =
    ARIA_KEY_NAMES[parsed.key] ??
    (parsed.key.length === 1
      ? parsed.key.toUpperCase()
      : parsed.key.replace(/^\w/, (c) => c.toUpperCase()));
  return [
    parsed.ctrl ? (isMac ? 'Meta' : 'Control') : '',
    parsed.shift ? 'Shift' : '',
    parsed.alt ? 'Alt' : '',
    key,
  ]
    .filter(Boolean)
    .join('+');
}

interface ShortcutKeyProps {
  /** Platform-formatted shortcut label, e.g. "⌘R" or "Ctrl+R". */
  shortcut: string;
  className?: string;
}

/**
 * Small key chip showing the keyboard shortcut of the action it sits in. It is hidden from
 * assistive technology; the action exposes the shortcut through `aria-keyshortcuts` instead.
 */
export function ShortcutKey({ shortcut, className }: ShortcutKeyProps) {
  // The wrapper carries aria-hidden; Biome treats <kbd> itself as an interactive element
  return (
    <span aria-hidden="true" className={cn('inline-flex', className)}>
      <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/30 px-1 font-medium font-sans text-xs tabular-nums leading-none opacity-80">
        {shortcut}
      </kbd>
    </span>
  );
}
