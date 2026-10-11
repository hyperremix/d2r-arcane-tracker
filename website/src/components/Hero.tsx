import { Download, Github } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import grailWallUrl from '../../../docs/screenshots/grail-wall.webp';
// Smaller copies of grail-wall.webp for the hero's srcset, made with
// `cwebp -q 85 -m 6 -resize <width> 0 grail-wall.webp -o grail-wall-<width>w.webp` (cwebp 1.6.0).
import grailWall1380Url from '../../../docs/screenshots/grail-wall-1380w.webp';
import grailWall1840Url from '../../../docs/screenshots/grail-wall-1840w.webp';
import { version } from '../../../package.json';
import { links } from '../content';

/** The grail shown in the hero screenshot, so the progress summary above it matches it. */
const SAMPLE_GRAIL = {
  found: 196,
  total: 634,
  types: [
    { label: 'Unique', found: 110, total: 381, dotClassName: 'bg-item-unique' },
    { label: 'Set', found: 36, total: 127, dotClassName: 'bg-item-set' },
    { label: 'Rune', found: 31, total: 33, dotClassName: 'bg-item-rune' },
    { label: 'Runeword', found: 19, total: 93, dotClassName: 'bg-item-runeword' },
  ],
};

/**
 * The app's grail page, continued from the title bar: a live progress summary and type chips
 * rebuilt in HTML, running into a screenshot of the item wall below them.
 */
function GrailPreview() {
  const percent = (SAMPLE_GRAIL.found / SAMPLE_GRAIL.total) * 100;
  const summary = `${SAMPLE_GRAIL.found} of ${SAMPLE_GRAIL.total} found`;

  return (
    <figure
      aria-label={`The Holy Grail page of the app: ${summary}`}
      className="relative mt-14 sm:mt-20"
    >
      <div aria-hidden="true" className="space-y-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
          <span className="min-w-[6ch] font-semibold text-foreground text-sm tabular-nums">
            {percent.toFixed(1)}%
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full animate-grail-fill rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
            {summary}
          </span>
        </div>
        <ul className="flex flex-wrap gap-2">
          {SAMPLE_GRAIL.types.map((type) => (
            <li
              key={type.label}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-sm"
            >
              <span className={cn('size-2 rounded-full', type.dotClassName)} />
              {type.label}
              <span className="text-muted-foreground text-xs tabular-nums">
                {type.found}/{type.total}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mask-b-from-55% mt-6 overflow-hidden rounded-t-xl">
        <img
          src={grailWallUrl}
          srcSet={`${grailWall1380Url} 1380w, ${grailWall1840Url} 1840w, ${grailWallUrl} 2760w`}
          // The rendered width: the section's content box (max-w-7xl minus padding), and 220% of it
          // on phones (see className)
          sizes="(min-width: 1280px) 1232px, (min-width: 640px) calc(100vw - 48px), calc(220vw - 71px)"
          alt="A wall of grail item cards: found items in their item color, missing items dimmed"
          width={1380}
          height={714}
          // On phones the full wall is too small to read, so show its left part at a larger size
          className="block h-auto w-full max-sm:w-[220%] max-sm:max-w-none"
          // React 18 doesn't know the camelCase `fetchPriority` prop (added in React 19) and warns
          // about it; the lowercase attribute is passed through to the HTML, also when prerendered.
          {...{ fetchpriority: 'high' }}
        />
      </div>
    </figure>
  );
}

/**
 * Opening section: what the app is, how to get it, and the grail page it opens on.
 */
export function Hero() {
  return (
    <section id="top" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-24">
      <div className="max-w-3xl">
        <h1 className="font-display font-semibold text-4xl text-foreground leading-[1.1] tracking-tight sm:text-6xl">
          D2R Arcane Tracker
        </h1>
        <p className="mt-5 max-w-[56ch] text-lg text-muted-foreground leading-relaxed sm:text-xl">
          A Holy Grail tracker for Diablo II: Resurrected. It reads your save files and records
          every unique, set item, rune and runeword you find, so you never have to type one in.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={links.latestRelease}
            className={cn(buttonVariants({ size: 'lg' }), 'h-11 px-4 text-base')}
          >
            <Download aria-hidden="true" />
            Download for Windows
          </a>
          <a
            href={links.repository}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-11 px-4 text-base',
            )}
          >
            <Github aria-hidden="true" />
            View on GitHub
          </a>
        </div>
        <p className="mt-4 text-muted-foreground text-sm">
          Version {version} for Windows 10 and later. Free and open source.
        </p>
      </div>
      <GrailPreview />
    </section>
  );
}
