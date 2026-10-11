import { ExternalLink, FileText } from 'lucide-react';
import { guides, guideUrl, links } from '../content';

/**
 * Links to the guides in the repository, as rows like the app's inventory list.
 */
export function Guides() {
  return (
    <section id="guides" className="border-border border-t bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-5">
          <h2 className="font-display font-semibold text-3xl text-foreground tracking-tight sm:text-4xl">
            Holy Grail guides
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            How the grail tracker works, from your first grail to farming runs and terror zones.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Something not working? Search the{' '}
            <a href={links.issues} className="text-primary underline-offset-4 hover:underline">
              issues
            </a>{' '}
            or ask in{' '}
            <a href={links.discussions} className="text-primary underline-offset-4 hover:underline">
              Discussions
            </a>
            .
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {guides.map((guide) => (
            <li key={guide.file}>
              <a
                href={guideUrl(guide.file)}
                className="group flex h-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground text-sm">{guide.title}</span>
                  <span className="block text-muted-foreground text-xs">{guide.description}</span>
                </span>
                <ExternalLink
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
