import { FAQ } from './components/FAQ';
import { FeatureTabs } from './components/FeatureTabs';
import { Guides } from './components/Guides';
import { Hero } from './components/Hero';
import { Install } from './components/Install';
import { MoreFeatures } from './components/MoreFeatures';
import { SiteFooter } from './components/SiteFooter';
import { SiteTitleBar } from './components/SiteTitleBar';
import { SkipLink } from './components/SkipLink';
import { StructuredData } from './components/StructuredData';

/**
 * The project website: one page that looks like the app.
 */
export function App() {
  return (
    <>
      <SkipLink />
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
