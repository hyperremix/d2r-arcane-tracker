import { useEffect } from 'react';

/**
 * Checks whether the keyboard event target is a text field or other editable element
 * where typing must not be intercepted by global shortcuts.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * Checks whether a dialog, alert dialog or an open select listbox is currently displayed.
 * The filters popover is itself a dialog, so it counts as open too.
 */
function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"]') !== null;
}

/**
 * Identifies which focus-search shortcut, if any, a key press is.
 * @returns {'find' | 'slash' | undefined} `find` for Ctrl/Cmd+F, `slash` for `/`
 */
function getSearchShortcut(event: KeyboardEvent): 'find' | 'slash' | undefined {
  if (event.defaultPrevented || event.isComposing || event.altKey) return undefined;
  const hasCommandModifier = event.ctrlKey || event.metaKey;
  if (hasCommandModifier && !event.shiftKey && event.key.toLowerCase() === 'f') return 'find';
  if (!hasCommandModifier && event.key === '/') return 'slash';
  return undefined;
}

/**
 * Checks whether a focus-search shortcut should move focus to the search input. It must not
 * interrupt typing in another field (or typing "/" into the search itself) or an open dialog.
 */
function shouldFocusSearch(
  event: KeyboardEvent,
  shortcut: 'find' | 'slash',
  input: HTMLInputElement,
): boolean {
  if (event.target === input) return shortcut === 'find';
  return !isEditableTarget(event.target) && !isDialogOpen();
}

/**
 * Focuses the search field when the user presses `/` or Ctrl/Cmd+F, unless they are typing in
 * another field or a dialog is open. The listener is removed when the toolbar unmounts.
 * @param {string} inputId - The id of the search input
 */
export function useFocusSearchShortcut(inputId: string) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const input = document.getElementById(inputId);
      const shortcut = getSearchShortcut(event);
      if (!(input instanceof HTMLInputElement) || !shortcut) return;
      if (!shouldFocusSearch(event, shortcut, input)) return;

      event.preventDefault();
      input.focus();
      input.select();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inputId]);
}
