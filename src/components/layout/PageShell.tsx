import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for the PageShell component.
 */
export interface PageShellProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * Wraps the children in the standard page padding and vertical rhythm.
   * Disable it for pages whose children manage their own padding.
   */
  padded?: boolean;
  /** Optional className for the padded content wrapper (ignored when `padded` is false) */
  contentClassName?: string;
}

/**
 * Shared page shell that provides the single vertical scroll container of a page.
 * It fills the remaining height below the title bar (`flex-1 min-h-0`) and scrolls its
 * content, so pages do not need viewport-relative height hacks.
 * The ref is forwarded to the scroll container (e.g. for scroll-spy listeners).
 * @returns {JSX.Element} The page scroll container
 */
export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(function PageShell(
  { className, contentClassName, padded = true, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="page-shell"
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      {...props}
    >
      {padded ? <div className={cn('space-y-6 p-6', contentClassName)}>{children}</div> : children}
    </div>
  );
});
