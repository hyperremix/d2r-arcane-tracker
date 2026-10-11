import { Download, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { version } from '../../../package.json';
import { links } from '../content';

const code = 'rounded bg-muted px-1 py-0.5 font-mono text-[0.8125rem] text-foreground';

const steps: { title: string; body: ReactNode }[] = [
  {
    title: 'Download the installer',
    body: (
      <>
        Get <code className={code}>D2R-Arcane-Tracker-Windows-{version}-Setup.exe</code> from the{' '}
        <a href={links.latestRelease} className="text-primary underline-offset-4 hover:underline">
          latest release
        </a>
        .
      </>
    ),
  },
  {
    title: 'Run it',
    body: (
      <>
        The app isn't code-signed, so Windows may show "Windows protected your PC". Select{' '}
        <strong className="font-medium text-foreground">More info</strong>, then{' '}
        <strong className="font-medium text-foreground">Run anyway</strong>.
      </>
    ),
  },
  {
    title: 'Choose your save folder',
    body: (
      <>
        The setup wizard asks for it. It's usually{' '}
        <code className={code}>%USERPROFILE%\Saved Games\Diablo II Resurrected</code>.
      </>
    ),
  },
  {
    title: 'Play',
    body: 'The game saves when you leave a game, so new finds show up once you are back in the menu.',
  },
];

/**
 * Install steps and system requirements.
 */
export function Install() {
  return (
    <section id="install" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-5">
          <h2 className="font-display font-semibold text-3xl text-foreground tracking-tight sm:text-4xl">
            Install D2R Arcane Tracker
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Needs Windows 10 or later (64-bit) and Diablo II: Resurrected.
          </p>
          <a href={links.latestRelease} className={cn(buttonVariants({ size: 'lg' }), 'px-4')}>
            <Download aria-hidden="true" />
            Download version {version}
          </a>
        </div>
        <div className="space-y-6">
          <ol className="space-y-6">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border font-semibold text-foreground text-sm tabular-nums"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 pt-1">
                  <h3 className="font-medium text-foreground">{step.title}</h3>
                  <p className="mt-1 text-muted-foreground text-sm leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Alert live="polite">
            <Info aria-hidden="true" />
            <AlertTitle>Updates install themselves</AlertTitle>
            <AlertDescription>
              The app checks for a new version on startup and installs it when you confirm. Your
              grail and settings are kept.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </section>
  );
}
