import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for a single toggle button inside a segmented control.
 */
interface SegmentButtonProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

/**
 * A single button inside a segmented control. Uses aria-pressed to expose its state.
 */
export function SegmentButton({ pressed, onClick, children }: SegmentButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-[5px] px-2.5 font-medium text-muted-foreground text-sm outline-none transition-colors',
        'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        pressed && 'bg-background text-foreground shadow-xs',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Props for the SegmentedControl component.
 */
interface SegmentedControlProps {
  legend: string;
  children: ReactNode;
  /** Stretches the control to the available width, sharing it equally between the buttons. */
  fullWidth?: boolean;
}

/**
 * A group of mutually exclusive toggle buttons rendered as a labeled fieldset.
 */
export function SegmentedControl({ legend, children, fullWidth = false }: SegmentedControlProps) {
  return (
    <fieldset
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-muted p-0.5',
        fullWidth && 'flex w-full *:flex-1',
      )}
    >
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  );
}
