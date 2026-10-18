import { gems } from 'electron/items/gems';
import { runes } from 'electron/items/runes';
import type { Item } from 'electron/types/grail';
import { ChevronDown, ExternalLink } from 'lucide-react';
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
 * RunewordCard component that displays a runeword with its required runes and completion status.
 * The owned/total badge is the single completion signal; missing runes are crossed out.
 *
 * With readiness, the card also shows the Horadric Cube upgrades that make the missing runes and
 * the owned bases the runeword fits, which expand into a list.
 *
 * The card spans four rows of its parent grid (header, runes, readiness, footer) and shares them
 * through a subgrid, so headers, rune rows, readiness and footers line up across every card in the
 * same grid row even when a long name wraps. The card sets `gap-[normal]`, which makes the subgrid inherit its
 * row gap from the parent grid, so the gap is defined in one place (the grid).
 *
 * The card is `relative` so the badge's absolutely positioned `sr-only` text is contained by the
 * card instead of the page, where it would stretch the document's scrollable height.
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
  const upgradeSteps = completionStatus.complete ? [] : (readiness?.upgradePlan ?? []);

  return (
    <Card
      className={cn(
        'relative row-span-4 grid grid-rows-subgrid gap-[normal] px-6 transition-all hover:shadow-md',
        className,
      )}
    >
      {/* Header: the name gets the full card width and the badges sit on their own line below
          it, so long names never collide with them. Most names fit on one line; a long one wraps
          instead of being cut off. */}
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <h3 className="w-full break-words font-semibold text-lg leading-tight">{runeword.name}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={completionStatus.complete ? 'default' : 'outline'}
            className={cn(
              'font-mono',
              completionStatus.complete && 'bg-success text-success-foreground',
            )}
          >
            <span aria-hidden="true">
              {t(translations.runeword.card.runesOwned, {
                available: completionStatus.availableCount,
                total: completionStatus.totalCount,
              })}
            </span>
            <span className="sr-only">
              {t(translations.runeword.card.runesOwnedLabel, {
                available: completionStatus.availableCount,
                total: completionStatus.totalCount,
              })}
            </span>
          </Badge>
          {upgradeSteps.length > 0 && (
            <Badge variant="secondary">{t(translations.runeword.card.makeableWithUpgrades)}</Badge>
          )}
        </div>
      </div>

      {/* Required runes; the wrapper keeps the row in place even without runes */}
      <div>
        {runeIds.length > 0 && (
          <RuneImages
            runeIds={runeIds}
            viewMode="grid"
            showRuneNames
            completionStatus={completionStatus}
          />
        )}
      </div>

      {/* Readiness: the upgrades that make the missing runes, then the owned bases, collapsed into
          a count so long lists do not stretch every card of the row. The wrapper keeps the row in
          place without readiness. */}
      <div className="flex min-w-0 flex-col gap-2 text-xs">
        {upgradeSteps.length > 0 && (
          <ol
            aria-label={t(translations.runeword.card.upgradePlanLabel)}
            className="flex list-decimal flex-col gap-0.5 pl-4 text-muted-foreground"
          >
            {upgradeSteps.map((step) => (
              <li key={step.resultRuneId}>{formatUpgradeStep(step, t)}</li>
            ))}
          </ol>
        )}
        {readiness && readiness.bases.length === 0 && (
          <p className="text-muted-foreground">{t(translations.runeword.card.noOwnedBase)}</p>
        )}
        {readiness && readiness.bases.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="group inline-flex items-center gap-1 rounded-sm font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <ChevronDown
                aria-hidden="true"
                className="size-3 transition-transform group-aria-expanded:rotate-180"
              />
              {t(translations.runeword.card.ownedBases, { count: readiness.bases.length })}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="flex flex-col gap-1.5 pt-1.5">
                {readiness.bases.map((base) => (
                  <li key={base.key} className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="break-words">{base.itemName}</span>
                      {base.ethereal && (
                        <Badge variant="ethereal">
                          {t(translations.grail.itemDetails.ethereal)}
                        </Badge>
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
        )}
      </div>

      {/* Footer: one socket per rune, and a link to the runeword's page on an external site. Both
          stay on one line each; on a card too narrow for both, the link wraps to its own line. */}
      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1 border-border border-t pt-3 text-xs">
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
            className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline"
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
