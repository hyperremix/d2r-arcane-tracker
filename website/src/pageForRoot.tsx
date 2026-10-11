import type { ReactElement } from 'react';
import { App } from './App';
import { GuidePage } from './components/GuidePage';
import { guides } from './content';

/**
 * The page to render into the root element. The guide pages are prerendered from docs/ at build
 * time (website/build.ts), so the client reads their article HTML back from the page to hydrate
 * them: the client bundle doesn't contain the guides or the Markdown renderer. Everything else is
 * the home page.
 */
export function pageForRoot(rootElement: Element): ReactElement {
  const article = rootElement.querySelector<HTMLElement>('article[data-guide]');
  const guide = article && guides.find((candidate) => candidate.slug === article.dataset.guide);
  if (article && guide) {
    return <GuidePage guide={guide} html={article.innerHTML} />;
  }
  return <App />;
}
