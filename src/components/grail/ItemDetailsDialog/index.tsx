import type { Item, VaultCategory, VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useItemIcon } from '@/hooks/useItemIcon';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.png';
import { RuneImages } from '../RuneImages';
import { CharacterProgressTable } from './CharacterProgressTable';
import { ItemInfoSection } from './ItemInfoSection';
import { ProgressStatusSection } from './ProgressStatusSection';

interface ItemDetailsDialogProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toVaultUpsertInput(item: Item): VaultItemUpsertInput {
  return {
    fingerprint: `grail:${item.id}`,
    itemName: item.name,
    itemCode: item.code,
    type: item.type,
    quality: item.type,
    ethereal: item.etherealType === 'only',
    rawItemJson: JSON.stringify(item),
    sourceCharacterName: 'Grail Tracker',
    sourceFileType: 'd2s',
    locationContext: 'unknown',
    grailItemId: item.id,
    isPresentInLatestScan: false,
  };
}

function findLinkedVaultItem(vaultItems: VaultItem[], item: Item): VaultItem | undefined {
  return vaultItems.find((vaultItem) => vaultItem.grailItemId === item.id);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex dialog component with many features
export function ItemDetailsDialog({ itemId, open, onOpenChange }: ItemDetailsDialogProps) {
  const { t } = useTranslation();
  const { items, progress, characters, selectedCharacterId, toggleItemFound, settings } =
    useGrailStore();
  const [isVaultActionPending, setIsVaultActionPending] = useState(false);
  const [vaultCategories, setVaultCategories] = useState<VaultCategory[]>([]);
  const [linkedVaultItem, setLinkedVaultItem] = useState<VaultItem | null>(null);

  const item = useMemo(() => {
    if (!itemId) {
      return null;
    }

    return items.find((i) => i.id === itemId) || null;
  }, [items, itemId]);

  const progressLookup = useProgressLookup(
    item ? [item] : [],
    progress,
    settings,
    selectedCharacterId,
  );
  const itemProgress = useMemo(
    () => (item ? progressLookup.get(item.id) : null),
    [item, progressLookup],
  );

  const placeholderItem: Item = {
    id: '',
    name: '',
    link: '',
    etherealType: 'none',
    type: 'unique',
    category: 'weapons',
    subCategory: '1h_swords',
    treasureClass: 'normal',
  };
  const { iconUrl, isLoading } = useItemIcon(item || placeholderItem);

  const loadVaultMetadata = useCallback(async (): Promise<void> => {
    if (!item || !open || !window.electronAPI?.vault) {
      return;
    }

    const [categories, searchResult] = await Promise.all([
      window.electronAPI.vault.listCategories(),
      window.electronAPI.vault.search({
        text: item.name,
        presentState: 'all',
        page: 1,
        pageSize: 100,
      }),
    ]);

    setVaultCategories(categories);
    setLinkedVaultItem(findLinkedVaultItem(searchResult.items, item) ?? null);
  }, [item, open]);

  useEffect(() => {
    void loadVaultMetadata();
  }, [loadVaultMetadata]);

  const handleToggleFound = useCallback(() => {
    if (!item || !selectedCharacterId) {
      return;
    }

    toggleItemFound(item.id, selectedCharacterId, true);
  }, [item, selectedCharacterId, toggleItemFound]);

  const handleVaultAction = useCallback(async (): Promise<void> => {
    if (!item || isVaultActionPending || !window.electronAPI?.vault) {
      return;
    }

    setIsVaultActionPending(true);
    const previousVaultItem = linkedVaultItem;

    try {
      if (linkedVaultItem) {
        setLinkedVaultItem(null);
        await window.electronAPI.vault.removeItem(linkedVaultItem.id);
      } else {
        const newVaultItem = await window.electronAPI.vault.addItem(toVaultUpsertInput(item));
        setLinkedVaultItem(newVaultItem);
      }

      await loadVaultMetadata();
    } catch {
      setLinkedVaultItem(previousVaultItem);
    } finally {
      setIsVaultActionPending(false);
    }
  }, [isVaultActionPending, item, linkedVaultItem, loadVaultMetadata]);

  if (!item) {
    return null;
  }

  const isFound = itemProgress?.overallFound || false;
  const assignedCategoryNames = (linkedVaultItem?.categoryIds ?? [])
    .map((categoryId) => vaultCategories.find((category) => category.id === categoryId)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-between gap-4">
            {item.type === 'runeword' && item.runes && item.runes.length > 0 ? (
              <div className="flex items-center">
                <RuneImages runeIds={item.runes} viewMode="grid" />
              </div>
            ) : settings.showItemIcons && item.type !== 'runeword' ? (
              <div className="relative h-20 w-20">
                <img
                  src={iconUrl}
                  alt={item.name}
                  className={cn('h-full w-full object-contain', isLoading && 'opacity-0')}
                  onError={(e) => {
                    if (e.currentTarget.src !== `${window.location.origin}${placeholderUrl}`) {
                      e.currentTarget.src = placeholderUrl;
                    }
                  }}
                />
                {isLoading && (
                  <div className="absolute inset-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                )}
              </div>
            ) : null}

            <div>
              <DialogTitle className="font-bold text-2xl">{item.name}</DialogTitle>
            </div>
            {((item.type === 'runeword' && item.runes && item.runes.length > 0) ||
              (settings.showItemIcons && item.type !== 'runeword')) && (
              <div className="relative w-20" />
            )}
          </div>
        </DialogHeader>

        <div className="-mx-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 px-6">
            <ItemInfoSection item={item} />
            <ProgressStatusSection item={item} itemProgress={itemProgress} />

            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-sm">
                  {t(translations.grail.itemDetails.vaultStatusTitle)}
                </div>
                <Badge variant={linkedVaultItem ? 'default' : 'secondary'}>
                  {linkedVaultItem
                    ? t(translations.grail.itemDetails.vaulted)
                    : t(translations.grail.itemDetails.notVaulted)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {assignedCategoryNames.length > 0 ? (
                  assignedCategoryNames.map((name) => (
                    <Badge key={name} variant="outline">
                      {name}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">{t(translations.grail.itemDetails.noVaultTags)}</Badge>
                )}
              </div>
            </div>

            {characters.length > 0 && (
              <CharacterProgressTable characters={characters} progress={progress} item={item} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isVaultActionPending}
            onClick={() => void handleVaultAction()}
          >
            {linkedVaultItem ? (
              <ArchiveRestore className="mr-1 h-4 w-4" />
            ) : (
              <Archive className="mr-1 h-4 w-4" />
            )}
            {linkedVaultItem
              ? t(translations.grail.itemDetails.unvaultAction)
              : t(translations.grail.itemDetails.vaultAction)}
          </Button>
          {selectedCharacterId && (
            <Button onClick={handleToggleFound} variant={isFound ? 'outline' : 'default'}>
              {isFound
                ? t(translations.grail.itemDetails.markAsNotFound)
                : t(translations.grail.itemDetails.markAsFound)}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(translations.common.close)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
