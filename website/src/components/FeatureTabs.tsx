import { Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Feature, features, guideUrl } from '../content';
import { Screenshot } from './Screenshot';

function FeaturePanel({ feature }: { feature: Feature }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
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
          href={guideUrl(feature.guide.file)}
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
 * A tour of the app's five pages, as tabs with the labels and icons of the app's title bar.
 */
export function FeatureTabs() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <h2 className="font-display font-semibold text-3xl text-foreground tracking-tight sm:text-4xl">
        What's in the app
      </h2>
      <p className="mt-3 max-w-[60ch] text-muted-foreground">
        Five pages, one for each part of the hunt. Pick one to see it.
      </p>
      <Tabs defaultValue={features[0].id} className="mt-10 gap-10">
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
