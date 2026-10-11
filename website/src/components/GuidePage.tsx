import { ChevronRight, FileText } from 'lucide-react';
import type { Guide } from '../content';
import { guides, guideUrl } from '../content';
import { guideBreadcrumbJsonLd } from '../guides/pageMeta';
import { SiteFooter } from './SiteFooter';
import { SiteTitleBar } from './SiteTitleBar';
import { SkipLink } from './SkipLink';
import '../guides/guide-prose.css';

interface GuidePageProps {
  guide: Guide;
  /** The guide rendered to HTML at build time (see renderGuideMarkdown) */
  html: string;
}

const homeUrl = import.meta.env.BASE_URL;

/**
 * A guide from docs/ as a page of the site, with the home page's title bar and footer. The title
 * bar links go to the home page's sections.
 */
export function GuidePage({ guide, html }: GuidePageProps) {
  const otherGuides = guides.filter((other) => other.file !== guide.file);

  return (
    <>
      <SkipLink />
      <SiteTitleBar homeUrl={homeUrl} />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm">
            <li>
              <a
                href={homeUrl}
                className="rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Home
              </a>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5" />
            </li>
            <li className="text-foreground">
              <span aria-current="page">{guide.title}</span>
            </li>
          </ol>
        </nav>

        {/* Hydration reads the prerendered HTML back from this element (see pageForRoot) */}
        <article
          data-guide={guide.slug}
          className="guide-prose"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown from docs/ in this repository, rendered at build time without raw HTML
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <nav aria-labelledby="more-guides" className="mt-16 border-border border-t pt-8">
          <h2
            id="more-guides"
            className="mb-4 font-display font-semibold text-foreground text-xl tracking-tight"
          >
            More guides
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {otherGuides.map((other) => (
              <li key={other.file}>
                <a
                  href={guideUrl(other.file)}
                  className="group flex h-full items-center gap-3 rounded-lg border border-border bg-card/40 px-3 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground text-sm">{other.title}</span>
                    <span className="block text-muted-foreground text-xs">{other.description}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD built from the guide list, with `<` escaped
        dangerouslySetInnerHTML={{ __html: guideBreadcrumbJsonLd(guide) }}
      />
    </>
  );
}
