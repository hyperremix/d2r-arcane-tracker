import { useLayoutEffect } from 'react';
import { type InitGrailDataOptions, initGrailData } from '@/stores/grailStore';
import { useSettingsLanguage } from './useSettingsLanguage';
import { useTheme } from './useTheme';

/**
 * Options for {@link useWindowBootstrap}.
 */
export type WindowBootstrapOptions = InitGrailDataOptions;

/**
 * Shared setup of every window's root component (main window, widget and inventory snapshot
 * window): loads the grail data and settings once for the window, keeps them in sync with the
 * main process, and applies the theme and language from the settings.
 *
 * The data is loaded in a layout effect so the loading flag is set before the first paint;
 * otherwise the empty store would briefly render the "no items" state before the spinner.
 * @param {WindowBootstrapOptions} [options] - Pass `followSettingsUpdates: true` in windows that
 * do not save settings themselves, so changes saved in the main window reach them
 */
export function useWindowBootstrap({
  followSettingsUpdates = false,
}: WindowBootstrapOptions = {}): void {
  useLayoutEffect(() => initGrailData({ followSettingsUpdates }), [followSettingsUpdates]);

  useTheme();
  useSettingsLanguage();
}
