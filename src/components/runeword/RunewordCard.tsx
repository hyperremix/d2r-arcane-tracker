import { gems } from 'electron/items/gems';
import { runes } from 'electron/items/runes';
import type { Item } from 'electron/types/grail';
import { ChevronDown, CircleCheck, CircleSlash, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatLocation, isSharedStashFileType } from '@/components/inventory/inventoryItemLabels';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { translations } from '@/i18n/translations';
import { getExternalLinkLabelKey, getExternalLinkSiteKey } from '@/lib/links';
import type { OwnedRunewordBase, RunewordReadiness } from '@/lib/runeword-readiness';
import type { RuneUpgradeStep } from '@/lib/runeword-upgrades';
import { getRunewordCompletionStatus } from '@/lib/runeword-utils';
import { cn } from '@/lib/utils';
import { RuneImages } from '../grail/RuneImages';

/**
 * Props for the RunewordCard component
 */
interface RunewordCardProps {
  /** The runeword item to display */
  runeword: Item;
  /** Available rune counts from save files */
  availableRunes: Record<string, number>;
  /** Upgrade plan and owned bases; without it the card shows neither */
  readiness?: RunewordReadiness;
  /** Optional className for styling */
  className?: string;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function getRuneName(runeId: string): string {
  return runes.find((rune) => rune.id === runeId)?.name ?? runeId;
}

function getGemName(gemCode: string): string {
  return gems.find((gem) => gem.code === gemCode)?.name ?? gemCode;
}

/** One upgrade step as a sentence, for example "Cube 3 Lem + Flawed Emerald → Pul, 2 times". */
function formatUpgradeStep(step: RuneUpgradeStep, t: Translate): string {
  const values = {
    count: step.runeCount,
    rune: getRuneName(step.runeId),
    result: getRuneName(step.resultRuneId),
  };
  const text = step.gemCode
    ? t(translations.runeword.card.upgradeStepWithGem, { ...values, gem: getGemName(step.gemCode) })
    : t(translations.runeword.card.upgradeStepWithoutGem, values);
  return t(translations.runeword.card.upgradeStepRepeat, { count: step.times, step: text });
}

/** Where an owned base is: the vault, or the character or shared stash and the place in it. */
function formatBaseLocation(base: OwnedRunewordBase, t: Translate): string {
  if (base.location.kind === 'vault') {
    return t(translations.inventoryBrowser.vaulted);
  }

  const { item } = base.location;
  const source = isSharedStashFileType(item.sourceFileType)
    ? t(translations.inventoryBrowser.sourceFileTypes.sharedStash)
    : item.characterName;
  return t(translations.runeword.card.baseLocation, {
    source,
    location: formatLocation(item, t),
  });
}

/**
 * Props for the BaseStatus component
 */
interface BaseStatusProps {
  /** Owned bases the runeword can be made in */
  bases: OwnedRunewordBase[];
}

/**
 * The line under a runeword's name: how many owned bases it fits, which expands into the list of
 * them, or that none does. An icon tells the two states apart besides the color.
 */
function BaseStatus({ bases }: BaseStatusProps) {
  const { t } = useTranslation();

  if (bases.length === 0) {
    return (
      <p className="inline-flex items-center gap-1.5 font-medium text-muted-foreground text-sm">
        <CircleSlash aria-hidden="true" className="size-4 shrink-0" />
        {t(translations.runeword.card.noOwnedBase)}
      </p>
    );
  }

  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-medium text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
        {t(translations.runeword.card.ownedBases, { count: bases.length })}
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="flex flex-col gap-1.5 pt-1.5 text-xs">
          {bases.map((base) => (
            <li key={base.key} className="flex min-w-0 flex-col">
              <span className="flex flex-wrap items-center gap-1">
                <span className="break-words">{base.itemName}</span>
                {base.ethereal && (
                  <Badge variant="ethereal">{t(translations.grail.itemDetails.ethereal)}</Badge>
                )}
              </span>
              <span className="break-words text-muted-foreground">
                {formatBaseLocation(base, t)}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * RunewordCard component that displays a runeword with its required runes.
 *
 * With readiness, the card leads with the owned bases the runeword fits, right under the name,
 * since owning a base decides whether it can be made; the count expands into a list. Runes are
 * only called out when some are missing: a line names them, the rune images cross them out, and
 * the Horadric Cube upgrades that make them follow.
 *
 * The card spans three rows of its parent grid (header, runes, footer) and shares them through a
 * subgrid, so headers, rune rows and footers line up across every card in the same grid row even
 * when a long name wraps. The missing runes follow the runes in their row, so a card without them
 * has no empty row. The card sets its own, tighter row gap instead of the grid's, to stay compact.
 *
 * The card is `relative` so the absolutely positioned `sr-only` text of the missing rune markers
 * is contained by the card instead of the page, where it would stretch the document's scrollable
 * height.
 */
export function RunewordCard({
  runeword,
  availableRunes,
  readiness,
  className,
}: RunewordCardProps) {
  const { t } = useTranslation();
  const completionStatus = getRunewordCompletionStatus(runeword, availableRunes);
  const runeIds = runeword.runes ?? [];
  // A runeword needs one socket per rune
  const socketCount = runeIds.length;
  const { missingRunes } = completionStatus;
  const upgradeSteps = completionStatus.complete ? [] : (readiness?.upgradePlan ?? []);

  return (
    <Card
      className={cn(
        'relative row-span-3 grid grid-rows-subgrid gap-2 px-4 py-3 transition-all hover:shadow-md',
        className,
      )}
    >
      {/* Header: the name gets the full card width and the owned bases sit on their own line below
          it. Most names fit on one line; a long one wraps instead of being cut off. */}
      <div className="flex min-w-0 flex-col items-start gap-1">
        <h3 className="w-full break-words font-semibold text-lg leading-tight">{runeword.name}</h3>
        {readiness && <BaseStatus bases={readiness.bases} />}
      </div>

      {/* Required runes, followed by the missing runes and the upgrades that make them. The runes
          wrap onto as many lines as the card needs. The wrapper keeps the row in place even
          without runes. */}
      <div className="flex min-w-0 flex-col items-start gap-2 text-xs">
        {runeIds.length > 0 && (
          <RuneImages
            runeIds={runeIds}
            showRuneNames
            completionStatus={completionStatus}
            className="flex flex-wrap gap-x-2 gap-y-1"
          />
        )}
        {missingRunes.length > 0 && (
          <p className="font-medium">
            {t(translations.runeword.card.missingRunes, {
              count: missingRunes.length,
              runes: missingRunes.map(getRuneName).join(', '),
            })}
          </p>
        )}
        {upgradeSteps.length > 0 && (
          <>
            <Badge variant="secondary">{t(translations.runeword.card.makeableWithUpgrades)}</Badge>
            <ol
              aria-label={t(translations.runeword.card.upgradePlanLabel)}
              className="flex list-decimal flex-col gap-0.5 pl-4 text-muted-foreground"
            >
              {upgradeSteps.map((step) => (
                <li key={step.resultRuneId}>{formatUpgradeStep(step, t)}</li>
              ))}
            </ol>
          </>
        )}
      </div>

      {/* Footer: one socket per rune, and a link to the runeword's page on an external site. Both
          stay on one line each; on a card too narrow for both, the link wraps to its own line. */}
      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1 border-border border-t pt-2 text-xs">
        {socketCount > 0 && (
          <span className="whitespace-nowrap text-muted-foreground">
            {t(translations.runeword.card.sockets, { count: socketCount })}
          </span>
        )}
        {runeword.link && (
          <a
            href={runeword.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t(getExternalLinkLabelKey(runeword.link))}
            className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-foreground underline decoration-muted-foreground underline-offset-4 hover:decoration-foreground"
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI?.shell.openExternal(runeword.link);
            }}
          >
            {/* The footer shows just the site name so it fits on one row; the accessible name is
                the full "View on ..." label the item details dialog uses and contains the text */}
            {t(getExternalLinkSiteKey(runeword.link))}
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        )}
      </div>
    </Card>
  );
}
