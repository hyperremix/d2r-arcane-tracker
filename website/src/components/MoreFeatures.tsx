import type { LucideIcon } from 'lucide-react';
import { AppWindow, Bell, Database, MapPinned } from 'lucide-react';

interface MoreFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const moreFeatures: MoreFeature[] = [
  {
    icon: AppWindow,
    title: 'Overlay widget',
    description:
      'An always-on-top window with your grail progress or the current run timer. Lock it and clicks pass through to the game.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'A sound, an in-app card or a Windows notification when you find a new item.',
  },
  {
    icon: MapPinned,
    title: 'Terror zones',
    description: 'Choose which zones the terror zone rotation can pick.',
  },
  {
    icon: Database,
    title: 'Your data stays on your PC',
    description:
      'Progress, runs and vaulted items are kept in a local database. Back it up and restore it from the settings.',
  },
];

/**
 * The smaller features, as a list of rows like the app's settings and inventory lists.
 */
export function MoreFeatures() {
  return (
    <section aria-labelledby="more-features" className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
        <h2
          id="more-features"
          className="font-display font-semibold text-2xl text-foreground tracking-tight"
        >
          Also in the app
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {moreFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title} className="flex gap-4 px-5 py-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground text-sm">{feature.title}</h3>
                  <p className="mt-0.5 text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
