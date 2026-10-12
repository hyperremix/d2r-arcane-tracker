import { runes } from 'electron/items/runes';
import type { Item } from 'electron/types/grail';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import {
  etherealTypeLabelKeys,
  itemCategoryLabelKeys,
  itemTreasureClassLabelKeys,
  itemTypeLabelKeys,
} from '@/lib/labelKeys';
import { getExternalLinkLabelKey } from '@/lib/links';
import { cn } from '@/lib/utils';

/**
 * One "Label: value" line of the item facts, laid out like a line of an in-game item tooltip.
 */
function FactLine({
  label,
  valueClassName,
  children,
}: {
  label: string;
  valueClassName?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="inline text-muted-foreground">{label}</dt>{' '}
      <dd className={cn('inline', valueClassName)}>{children}</dd>
    </div>
  );
}

function getRuneNames(runeIds: string[]): string {
  return runeIds.map((runeId) => runes.find((r) => r.id === runeId)?.name || runeId).join(' + ');
}

/**
 * The item's facts (type, category, treasure class, set, runes, ethereal type) as plain centered
 * text lines, followed by the link to the item's page on diablo2.io or d2runewizard.
 */
export function ItemInfoSection({ item }: { item: Item }) {
  const { t } = useTranslation();
  const keys = translations.grail.itemDetails;
  const hasRunes = item.type === 'runeword' && item.runes && item.runes.length > 0;

  return (
    <div className="grid gap-3 text-center">
      <dl className="grid gap-1">
        <FactLine label={t(keys.type)}>{t(itemTypeLabelKeys[item.type])}</FactLine>
        <FactLine label={t(keys.category)}>{t(itemCategoryLabelKeys[item.category])}</FactLine>
        <FactLine label={t(keys.treasureClass)}>
          {t(itemTreasureClassLabelKeys[item.treasureClass])}
        </FactLine>
        {item.setName && (
          <FactLine label={t(keys.set)} valueClassName="text-item-set">
            {item.setName}
          </FactLine>
        )}
        {hasRunes && item.runes && (
          <FactLine label={t(keys.requiredRunes)} valueClassName="text-item-rune">
            {getRuneNames(item.runes)}
          </FactLine>
        )}
        <FactLine
          label={t(keys.etherealType)}
          valueClassName={item.etherealType === 'none' ? undefined : 'text-ethereal'}
        >
          {t(etherealTypeLabelKeys[item.etherealType])}
        </FactLine>
      </dl>

      {item.link && (
        <p>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline underline-offset-4 hover:text-primary/80"
          >
            {t(getExternalLinkLabelKey(item.link))}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </p>
      )}
    </div>
  );
}
