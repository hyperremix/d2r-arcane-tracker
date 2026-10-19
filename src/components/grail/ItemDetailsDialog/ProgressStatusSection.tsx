import type { GrailProgress, Item } from 'electron/types/grail';
import { Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import {
  type GrailTrackingSettings,
  getVersionFindStatuses,
  type VersionFindStatus,
} from '@/lib/ethereal';
import { cn } from '@/lib/utils';

type StatusKind = 'found' | 'foundNotTracked' | 'missing';

function getStatusKind({
  tracked,
  found,
}: Pick<VersionFindStatus, 'tracked' | 'found'>): StatusKind {
  if (!found) return 'missing';
  return tracked ? 'found' : 'foundNotTracked';
}

function getStatusClasses(kind: StatusKind): string {
  return cn(
    'inline-flex items-center gap-1 font-medium',
    kind === 'found' && 'text-found',
    // A missing version is neutral rather than an error color; the empty circle and the text tell
    // it apart from a find that isn't tracked
    (kind === 'foundNotTracked' || kind === 'missing') && 'text-muted-foreground',
  );
}

/**
 * "Found" / "Found (not tracked)" / "Not found" text with a matching icon. Color, icon and text
 * all carry the state, so it doesn't rely on hue alone.
 */
function StatusText({ kind }: { kind: StatusKind }) {
  const { t } = useTranslation();

  return (
    <>
      {kind === 'missing' ? (
        <Circle className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Check className="h-4 w-4" aria-hidden="true" />
      )}
      {kind === 'found' && t(translations.common.found)}
      {kind === 'foundNotTracked' && t(translations.grail.itemDetails.foundNotTracked)}
      {kind === 'missing' && t(translations.common.notFound)}
    </>
  );
}

/**
 * The item's found status under its name. Each tracked version shows whether it was found; a
 * version that isn't tracked only shows up when it was found anyway, labelled as not tracked, so
 * a find never reads as "Not found" and never counts as found. With one version to show, a single
 * status line is shown; with both, the normal and the ethereal status sit side by side.
 */
export function ProgressStatusSection({
  item,
  itemProgress,
  settings,
}: {
  item: Item;
  itemProgress: GrailProgress[];
  settings: GrailTrackingSettings;
}) {
  const { t } = useTranslation();
  const statuses = getVersionFindStatuses(item, itemProgress, settings);

  if (statuses.length <= 1) {
    const kind = getStatusKind(statuses[0] ?? { tracked: true, found: false });
    return (
      <p className={getStatusClasses(kind)}>
        <StatusText kind={kind} />
      </p>
    );
  }

  return (
    <dl className="flex flex-wrap justify-center gap-x-4 gap-y-1">
      {statuses.map((status) => {
        const kind = getStatusKind(status);
        return (
          <div key={status.version} className="flex items-center gap-1">
            <dt className="text-muted-foreground">
              {status.version === 'normal'
                ? t(translations.grail.itemDetails.normalStatus)
                : t(translations.grail.itemDetails.etherealStatus)}
            </dt>
            <dd className={getStatusClasses(kind)}>
              <StatusText kind={kind} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
