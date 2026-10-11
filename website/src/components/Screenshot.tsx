import { cn } from '@/lib/utils';

interface ScreenshotProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * An app screenshot (1440×900 window, captured at 2×) framed like the app window.
 */
export function Screenshot({ src, alt, className }: ScreenshotProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40',
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        width={1440}
        height={900}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}
