import { FAQ } from './components/FAQ';
import { FeatureTabs } from './components/FeatureTabs';
import { Guides } from './components/Guides';
import { Hero } from './components/Hero';
import { Install } from './components/Install';
import { MoreFeatures } from './components/MoreFeatures';
import { SiteFooter } from './components/SiteFooter';
import { SiteTitleBar } from './components/SiteTitleBar';
import { StructuredData } from './components/StructuredData';

/**
 * The project website: one page that looks like the app.
 */
export function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteTitleBar />
      <main id="main">
        <Hero />
        <FeatureTabs />
        <MoreFeatures />
        <Install />
        <FAQ />
        <Guides />
      </main>
      <SiteFooter />
      <StructuredData />
    </>
  );
}
