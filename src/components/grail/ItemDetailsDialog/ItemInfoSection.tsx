import { runes } from 'electron/items/runes';
import type { Item } from 'electron/types/grail';
import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';

// Component for item information section
export function ItemInfoSection({ item }: { item: Item }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t(translations.grail.itemDetails.itemInformation)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
          {/* Type */}
          <span className="font-medium">{t(translations.grail.itemDetails.type)}</span>
          <Badge variant="secondary" className="w-fit capitalize">
            {item.type}
          </Badge>

          {/* Category */}
          <span className="font-medium">{t(translations.grail.itemDetails.category)}</span>
          <Badge variant="secondary" className="w-fit capitalize">
            {item.category}
          </Badge>

          {/* Treasure Class */}
          <span className="font-medium">{t(translations.grail.itemDetails.treasureClass)}</span>
          <Badge variant="secondary" className="w-fit capitalize">
            {item.treasureClass}
          </Badge>

          {/* Item Base */}
          {item.itemBase && (
            <>
              <span className="font-medium">{t(translations.grail.itemDetails.base)}</span>
              <Badge variant="secondary" className="w-fit capitalize">
                {item.itemBase}
              </Badge>
            </>
          )}

          {/* Set Name */}
          {item.setName && (
            <>
              <span className="font-medium">{t(translations.grail.itemDetails.set)}</span>
              <Badge variant="secondary" className="w-fit capitalize">
                {item.setName}
              </Badge>
            </>
          )}

          {/* Required Runes */}
          {item.type === 'runeword' && item.runes && item.runes.length > 0 && (
            <>
              <span className="font-medium">{t(translations.grail.itemDetails.requiredRunes)}</span>
              <div className="flex flex-col gap-2">
                <Badge variant="secondary">
                  {item.runes
                    .map((runeId) => {
                      const rune = runes.find((r) => r.id === runeId);
                      return rune?.name || runeId;
                    })
                    .join(' + ')}
                </Badge>
              </div>
            </>
          )}

          {/* Ethereal Type */}
          <span className="font-medium">{t(translations.grail.itemDetails.etherealType)}</span>
          <Badge
            variant={
              item.etherealType === 'only'
                ? 'destructive'
                : item.etherealType === 'optional'
                  ? 'default'
                  : 'secondary'
            }
            className="w-fit capitalize"
          >
            {item.etherealType}
          </Badge>

          {/* Code */}
          {item.code && (
            <>
              <span className="font-medium">{t(translations.grail.itemDetails.code)}</span>
              <code className="w-fit rounded bg-muted px-2 py-1 font-mono text-sm">
                {item.code}
              </code>
            </>
          )}

          {/* Link */}
          {item.link && (
            <>
              <span className="font-medium">{t(translations.grail.itemDetails.link)}</span>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {item.link.includes('diablo2.io')
                  ? t(translations.grail.itemDetails.viewOnDiablo2io)
                  : t(translations.grail.itemDetails.viewOnD2runewizard)}
              </a>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
