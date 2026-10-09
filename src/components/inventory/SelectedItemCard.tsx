import type { ParsedInventoryItem } from 'electron/types/grail';
import { PackagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  formatLocation,
  formatSourceFileTypeLabel,
  getCoordinatesLabel,
  getDimensionsLabel,
  getPresenceLabel,
  getSlotLabel,
} from '@/components/inventory/inventoryItemLabels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';

export interface SelectedItemCardProps {
  item: ParsedInventoryItem | undefined;
  /** Whether the item is vaulted; `undefined` when the vault does not track it. */
  isVaultPresent: boolean | undefined;
  isVaulting: boolean;
  onVault: (item: ParsedInventoryItem) => void;
}

/** Details of the selected inventory item and the button that vaults it. */
export function SelectedItemCard({
  item,
  isVaultPresent,
  isVaulting,
  onVault,
}: SelectedItemCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t(translations.inventoryBrowser.selectedItemTitle)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!item ? (
          <div className="text-muted-foreground text-sm">
            {t(translations.inventoryBrowser.noSelectedItem)}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="font-medium">{item.itemName}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="outline" className="capitalize">
                  {item.quality}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {formatLocation(item, t)}
                </Badge>
                <Badge variant="outline">{formatSourceFileTypeLabel(item.sourceFileType, t)}</Badge>
                <Badge
                  variant={
                    isVaultPresent === true
                      ? 'default'
                      : isVaultPresent === false
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {getPresenceLabel(isVaultPresent, t)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div>
                <span className="text-muted-foreground">
                  {t(translations.inventoryBrowser.details.coordinatesLabel)}
                </span>{' '}
                {getCoordinatesLabel(item, t)}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t(translations.inventoryBrowser.details.dimensionsLabel)}
                </span>{' '}
                {getDimensionsLabel(item, t)}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t(translations.inventoryBrowser.details.slotLabel)}
                </span>{' '}
                {getSlotLabel(item, t)}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t(translations.inventoryBrowser.details.characterLabel)}
                </span>{' '}
                {item.characterName}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              aria-label={t(translations.inventoryBrowser.vaultAction)}
              disabled={isVaulting || isVaultPresent === true}
              onClick={() => onVault(item)}
            >
              <PackagePlus className="mr-1 h-4 w-4" />
              {t(translations.inventoryBrowser.vaultAction)}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
