import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for the PageHeader component.
 */
export interface PageHeaderProps {
  /** Page title, rendered as the page's single `h1` */
  title: ReactNode;
  /** Optional supporting text shown below the title */
  description?: ReactNode;
  /** Optional actions (buttons, toggles, ...) aligned to the end of the header */
  actions?: ReactNode;
  /** Hides the header visually while keeping the heading available to assistive technology */
  visuallyHidden?: boolean;
  /** Optional className for the header container */
  className?: string;
}

/**
 * Shared page header that renders the page title as an `h1` with an optional description
 * and actions slot, using consistent spacing and typography across all pages.
 * @returns {JSX.Element} The page header
 */
export function PageHeader({
  title,
  description,
  actions,
  visuallyHidden = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        'flex flex-wrap items-start justify-between gap-4',
        visuallyHidden && 'sr-only',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
