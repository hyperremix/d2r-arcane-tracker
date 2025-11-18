import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type KeyboardEventLike = KeyboardEvent | ReactKeyboardEvent<Element>;

interface ParsedShortcut {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta']);
const PRIMARY_MODIFIER_LABEL = 'Ctrl';

const SPECIAL_KEY_ALIASES: Record<string, string> = {
  space: ' ',
  spacebar: ' ',
  esc: 'escape',
  escape: 'escape',
  return: 'enter',
  cmd: 'ctrl',
  command: 'ctrl',
  option: 'alt',
};

const DISPLAY_KEY_OVERRIDES: Record<string, string> = {
  ' ': 'Space',
  escape: 'Esc',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
};

const isPlatformMac = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return navigator.platform.toLowerCase().includes('mac');
};

const normalizeToken = (token: string) => token.replace(/\s+/g, '').toLowerCase();

type Modifier = 'ctrl' | 'shift' | 'alt';

const getModifierFromToken = (token: string): Modifier | null => {
  switch (token) {
    case 'ctrl':
    case 'control':
    case 'cmd':
    case 'command':
      return 'ctrl';
    case 'shift':
      return 'shift';
    case 'alt':
    case 'option':
      return 'alt';
    default:
      return null;
  }
};

const normalizeShortcutKeyToken = (token: string) => {
  const comparisonKey = normalizeKeyForComparison(SPECIAL_KEY_ALIASES[token] ?? token);
  if (comparisonKey && !MODIFIER_KEYS.has(comparisonKey)) {
    return comparisonKey;
  }
  return '';
};

const normalizeKeyForComparison = (key: string | undefined | null) => {
  if (!key) {
    return '';
  }
  const normalizedKey = SPECIAL_KEY_ALIASES[normalizeToken(key)] ?? key;
  if (normalizedKey === ' ') {
    return ' ';
  }
  if (normalizedKey.length === 1) {
    return normalizedKey.toLowerCase();
  }
  return normalizedKey.toLowerCase();
};

const formatKeyForDisplay = (key: string) => {
  if (DISPLAY_KEY_OVERRIDES[key]) {
    return DISPLAY_KEY_OVERRIDES[key];
  }
  if (key === ' ') {
    return DISPLAY_KEY_OVERRIDES[' '] ?? 'Space';
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key.replace(/(^\w)|(\s+\w)/g, (match) => match.toUpperCase());
};

const buildShortcutString = (parsed: ParsedShortcut) => {
  if (!parsed.key) {
    return '';
  }
  const parts: string[] = [];
  if (parsed.ctrl) {
    parts.push(PRIMARY_MODIFIER_LABEL);
  }
  if (parsed.shift) {
    parts.push('Shift');
  }
  if (parsed.alt) {
    parts.push('Alt');
  }
  parts.push(formatKeyForDisplay(parsed.key));
  return parts.join('+');
};

const resolveIsMac = (options?: { isMac?: boolean }) => options?.isMac ?? isPlatformMac();

const eventHasPrimaryModifier = (event: KeyboardEventLike, isMac: boolean) =>
  isMac ? event.metaKey : event.ctrlKey;

export const parseShortcut = (shortcut: string): ParsedShortcut => {
  const parts = shortcut
    .split('+')
    .map((part) => normalizeToken(part))
    .filter(Boolean);

  let key = '';
  const modifiers: Record<Modifier, boolean> = {
    ctrl: false,
    shift: false,
    alt: false,
  };

  for (const part of parts) {
    const modifier = getModifierFromToken(part);
    if (modifier) {
      modifiers[modifier] = true;
      continue;
    }

    if (!key) {
      key = normalizeShortcutKeyToken(part);
    }
  }

  return {
    ctrl: modifiers.ctrl,
    shift: modifiers.shift,
    alt: modifiers.alt,
    key,
  };
};

export const normalizeShortcut = (shortcut: string) => {
  const parsed = parseShortcut(shortcut);
  return buildShortcutString(parsed);
};

const parseEvent = (event: KeyboardEventLike, isMac: boolean): ParsedShortcut => {
  const rawKey = event.key ?? '';
  const normalizedKey = normalizeKeyForComparison(rawKey);
  const isModifierKey = MODIFIER_KEYS.has(normalizeToken(rawKey));

  return {
    ctrl: eventHasPrimaryModifier(event, isMac),
    shift: event.shiftKey,
    alt: event.altKey,
    key: isModifierKey ? '' : normalizedKey,
  };
};

export const shortcutFromEvent = (event: KeyboardEventLike, options?: { isMac?: boolean }) => {
  const isMac = resolveIsMac(options);
  const parsed = parseEvent(event, isMac);
  if (!parsed.key) {
    return '';
  }
  return buildShortcutString(parsed);
};

export const matchesShortcut = (
  event: KeyboardEventLike,
  shortcut: string,
  options?: { isMac?: boolean },
) => {
  if (!shortcut) {
    return false;
  }
  const parsedShortcut = parseShortcut(shortcut);
  const isMac = resolveIsMac(options);
  const eventParsed = parseEvent(event, isMac);

  return (
    parsedShortcut.ctrl === eventParsed.ctrl &&
    parsedShortcut.shift === eventParsed.shift &&
    parsedShortcut.alt === eventParsed.alt &&
    parsedShortcut.key === eventParsed.key
  );
};
