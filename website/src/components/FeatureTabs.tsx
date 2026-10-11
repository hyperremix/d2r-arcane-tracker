import { Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Feature, type FeatureId, features, guideUrl } from '../content';
import { useHashSelection } from '../hooks/useHashSelection';
import { Screenshot } from './Screenshot';

const FEATURE_IDS = features.map((feature) => feature.id);

function FeaturePanel({ feature }: { feature: Feature }) {
  return (
    // The feature's anchor. The margin keeps the tab list in view above it when it's scrolled to.
    <div
      id={feature.id}
      className="grid scroll-mt-22 gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12"
    >
      <div className="space-y-5 lg:pt-4">
        <h3 className="font-display font-semibold text-2xl text-foreground tracking-tight">
          {feature.title}
        </h3>
        <p className="text-base text-muted-foreground leading-relaxed">{feature.description}</p>
        <ul className="space-y-2.5">
          {feature.points.map((point) => (
            <li key={point} className="flex gap-2.5 text-foreground text-sm leading-relaxed">
              <Check className="mt-0.5 size-4 shrink-0 text-found" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
        <a
          href={guideUrl(feature.guide.file, feature.guide.hash)}
          className="inline-block text-primary text-sm underline-offset-4 hover:underline"
        >
          {feature.guide.label}
        </a>
      </div>
      <Screenshot src={feature.screenshot} alt={feature.screenshotAlt} />
    </div>
  );
}

/**
 * All five features in one line each, always visible: only the selected tab's panel is shown, so
 * this keeps every feature readable without opening its tab, also in the prerendered HTML. Each
 * row links to its feature's anchor and opens its tab.
 */
function FeatureOverview({ onShow }: { onShow: (id: FeatureId) => void }) {
  return (
    <ul className="grid gap-2">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <li key={feature.id}>
            <a
              href={`#${feature.id}`}
              onClick={() => onShow(feature.id)}
              className="flex h-full items-start gap-3 rounded-lg border border-border bg-card/40 px-3 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground text-sm">{feature.title}</span>
                <span className="block text-muted-foreground text-sm leading-relaxed">
                  {feature.summary}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The app's five pages: a one-line overview of each, then a tour as tabs with the labels and
 * icons of the app's title bar. A link to a feature's anchor (`#run-tracker`) opens its tab.
 */
export function FeatureTabs() {
  const { selected, select, show } = useHashSelection(FEATURE_IDS, features[0].id);

  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-5">
          <h2 className="font-display font-semibold text-3xl text-foreground tracking-tight sm:text-4xl">
            Holy Grail tracker features
          </h2>
          <p className="max-w-[60ch] text-muted-foreground leading-relaxed">
            Five pages, one for each part of the D2R grail hunt. Pick one to see it.
          </p>
        </div>
        <FeatureOverview onShow={show} />
      </div>
      <Tabs
        value={selected}
        onValueChange={(value: FeatureId) => select(value)}
        className="mt-16 gap-10"
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <TabsList variant="line" className="h-10">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <TabsTrigger key={feature.id} value={feature.id} className="px-3 text-sm">
                  <Icon aria-hidden="true" />
                  {feature.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        {features.map((feature) => (
          <TabsContent key={feature.id} value={feature.id} keepMounted>
            <FeaturePanel feature={feature} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
