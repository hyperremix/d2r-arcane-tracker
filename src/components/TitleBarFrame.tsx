import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Makes the whole title bar a window drag region (Electron-specific CSS property). */
const DRAG_REGION_STYLE = {
  WebkitAppRegion: 'drag',
  appRegion: 'drag',
} as CSSProperties;

/**
 * Props for {@link TitleBarFrame}.
 */
interface TitleBarFrameProps {
  children: ReactNode;
  /** Additional classes for the title bar, e.g. the gap between its sections. */
  className?: string;
  /**
   * Reserve space on both sides, so content that grows to fill the bar stays centered between
   * the native window controls.
   */
  centered?: boolean;
}

/**
 * Frame shared by the custom title bars of all windows: a draggable bar that leaves room for
 * the native window controls (the macOS traffic lights on the left, the Windows/Linux title bar
 * overlay on the right). Interactive elements inside are excluded from the drag region by the
 * `.titlebar` rules in `index.css`.
 * Follows Electron best practices from: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
 * @returns {JSX.Element} The title bar frame around the given content
 */
export function TitleBarFrame({ children, className, centered = false }: TitleBarFrameProps) {
  // The platform is exposed synchronously by the preload script; outside Electron the macOS
  // layout is used
  const isMac = (window.electronAPI?.platform ?? 'darwin') === 'darwin';

  return (
    <header
      className={cn(
        'titlebar flex h-12 min-h-12 w-full select-none items-center border-border border-b px-4',
        className,
      )}
      style={DRAG_REGION_STYLE}
    >
      {/* Left section - macOS traffic lights spacing */}
      {isMac ? <div className="w-20 shrink-0" /> : centered && <div className="w-8 shrink-0" />}

      {children}

      {/* Right section - spacing for the Windows/Linux native controls overlay */}
      {isMac ? centered && <div className="w-20 shrink-0" /> : <div className="w-36 shrink-0" />}
    </header>
  );
}
