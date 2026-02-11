import type {
  VaultCategory,
  VaultCategoryCreateInput,
  VaultItem,
  VaultItemFilter,
  VaultLocationContext,
} from 'electron/types/grail';
import { GripVertical, PackageMinus, Tag, TagIcon, Trash2 } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';

type PresenceFilter = 'all' | 'present' | 'missing';

type DragVaultPayload = {
  type: 'vault-item';
  itemId: string;
};

function formatLocation(
  item: VaultItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (item.locationContext === 'stash' && item.stashTab !== undefined) {
    return t(translations.vault.location.stashTab, { tab: item.stashTab });
  }

  return t(translations.vault.location[item.locationContext]);
}

export function ItemVault() {
  const { t } = useTranslation();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [categories, setCategories] = useState<VaultCategory[]>([]);
  const [isUnvaulting, setIsUnvaulting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [presence, setPresence] = useState<PresenceFilter>('all');
  const [locationContext, setLocationContext] = useState<'all' | VaultLocationContext>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('');
  const [dragOverUnvaultDropzone, setDragOverUnvaultDropzone] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    const filter: VaultItemFilter = {
      text: searchText.trim() || undefined,
      locationContext: locationContext === 'all' ? undefined : locationContext,
      presentState: presence,
      categoryIds: selectedCategoryId === 'all' ? undefined : [selectedCategoryId],
      page: 1,
      pageSize: 200,
    };

    const [vaultItems, vaultCategories] = await Promise.all([
      window.electronAPI.vault.search(filter),
      window.electronAPI.vault.listCategories(),
    ]);

    setItems(vaultItems.items);
    setCategories(vaultCategories);
  }, [locationContext, presence, searchText, selectedCategoryId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const createCategory = async (): Promise<void> => {
    if (!newCategoryName.trim()) {
      return;
    }

    const input: VaultCategoryCreateInput = {
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      color: newCategoryColor.trim() || undefined,
    };

    await window.electronAPI.vault.createCategory(input);
    setNewCategoryName('');
    setNewCategoryColor('');
    await loadData();
  };

  const toggleCategory = async (item: VaultItem, categoryId: string): Promise<void> => {
    const currentCategoryIds = item.categoryIds ?? [];
    const nextCategoryIds = currentCategoryIds.includes(categoryId)
      ? currentCategoryIds.filter((id) => id !== categoryId)
      : [...currentCategoryIds, categoryId];

    await window.electronAPI.vault.updateItemTags(item.id, nextCategoryIds);
    await loadData();
  };

  const unvaultItem = useCallback(
    async (itemId: string): Promise<void> => {
      if (isUnvaulting) {
        return;
      }

      setIsUnvaulting(true);
      const previous = items;
      setItems((prev) => prev.filter((item) => item.id !== itemId));

      try {
        await window.electronAPI.vault.removeItem(itemId);
        await loadData();
      } catch {
        setItems(previous);
      } finally {
        setIsUnvaulting(false);
      }
    },
    [isUnvaulting, items, loadData],
  );

  const categoriesById = useMemo(() => {
    const map = new Map<string, VaultCategory>();

    for (const category of categories) {
      map.set(category.id, category);
    }

    return map;
  }, [categories]);

  const handleCardDragStart = (event: DragEvent<HTMLButtonElement>, item: VaultItem) => {
    const payload: DragVaultPayload = {
      type: 'vault-item',
      itemId: item.id,
    };

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
  };

  const handleUnvaultDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOverUnvaultDropzone(false);

    const rawPayload = event.dataTransfer.getData('application/json');
    if (!rawPayload) {
      return;
    }

    const payload = JSON.parse(rawPayload) as DragVaultPayload;
    if (payload.type !== 'vault-item') {
      return;
    }

    await unvaultItem(payload.itemId);
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t(translations.vault.title)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t(translations.vault.searchPlaceholder)}
              aria-label={t(translations.common.search)}
              className="md:col-span-2"
            />
            <Select
              value={locationContext}
              onValueChange={(value) =>
                setLocationContext((value as 'all' | VaultLocationContext | null) ?? 'all')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t(translations.vault.allLocations)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(translations.vault.allLocations)}</SelectItem>
                <SelectItem value="equipped">{t(translations.vault.location.equipped)}</SelectItem>
                <SelectItem value="inventory">
                  {t(translations.vault.location.inventory)}
                </SelectItem>
                <SelectItem value="stash">{t(translations.vault.location.stash)}</SelectItem>
                <SelectItem value="mercenary">
                  {t(translations.vault.location.mercenary)}
                </SelectItem>
                <SelectItem value="corpse">{t(translations.vault.location.corpse)}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={presence}
              onValueChange={(value) => setPresence((value as PresenceFilter | null) ?? 'all')}
            >
              <SelectTrigger>
                <SelectValue placeholder={t(translations.vault.allPresence)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(translations.vault.presenceOptions.all)}</SelectItem>
                <SelectItem value="present">
                  {t(translations.vault.presenceOptions.present)}
                </SelectItem>
                <SelectItem value="missing">
                  {t(translations.vault.presenceOptions.missing)}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedCategoryId}
              onValueChange={(value) => setSelectedCategoryId(value ?? 'all')}
            >
              <SelectTrigger>
                <SelectValue placeholder={t(translations.vault.allCategories)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(translations.vault.allCategories)}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <button
          type="button"
          className={[
            'rounded-lg border border-dashed p-3 text-center text-sm transition-colors',
            dragOverUnvaultDropzone
              ? 'border-primary bg-primary/10'
              : 'border-border text-muted-foreground',
          ].join(' ')}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOverUnvaultDropzone(true);
          }}
          onDragLeave={() => setDragOverUnvaultDropzone(false)}
          onDrop={(event) => {
            void handleUnvaultDrop(event);
          }}
        >
          {t(translations.vault.dropToUnvault)}
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t(translations.vault.manageCategories)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder={t(translations.vault.newCategoryName)}
              />
              <Input
                value={newCategoryColor}
                onChange={(event) => setNewCategoryColor(event.target.value)}
                placeholder={t(translations.vault.newCategoryColor)}
              />
              <Button onClick={createCategory}>{t(translations.vault.saveCategory)}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge key={category.id} variant="secondary" className="flex items-center gap-2">
                  <TagIcon className="h-3 w-3" />
                  {category.name}
                  <button
                    type="button"
                    aria-label={t(translations.vault.delete)}
                    onClick={async () => {
                      await window.electronAPI.vault.deleteCategory(category.id);
                      await loadData();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {items.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {t(translations.vault.noItems)}
            </CardContent>
          </Card>
        )}

        {items.length > 0 && (
          <Card>
            <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{item.itemName}</div>
                    <Badge variant={item.isPresentInLatestScan ? 'default' : 'secondary'}>
                      {item.isPresentInLatestScan
                        ? t(translations.vault.presentInScan)
                        : t(translations.vault.missingSince)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="capitalize">
                      {item.quality}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      draggable
                      onDragStart={(event) => {
                        handleCardDragStart(event, item);
                      }}
                      aria-label={t(translations.vault.dragToUnvault)}
                    >
                      <GripVertical className="h-3 w-3" />
                    </Button>
                    <Badge variant="outline" className="capitalize">
                      {formatLocation(item, t)}
                    </Badge>
                    <Badge variant="outline">{item.sourceFileType.toUpperCase()}</Badge>
                  </div>

                  <div className="mt-3 text-muted-foreground text-xs">
                    {item.lastSeenAt &&
                      t(translations.vault.lastSeen, {
                        character:
                          item.sourceCharacterName ??
                          t(translations.vault.lastSeenUnknownCharacter),
                        date: item.lastSeenAt.toLocaleString(),
                      })}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="text-muted-foreground text-xs">
                      {t(translations.vault.assignTags)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {categories.map((category) => {
                        const isSelected = (item.categoryIds ?? []).includes(category.id);
                        return (
                          <Button
                            key={`${item.id}-${category.id}`}
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className="h-7"
                            onClick={async () => {
                              await toggleCategory(item, category.id);
                            }}
                          >
                            <Tag className="mr-1 h-3 w-3" />
                            {categoriesById.get(category.id)?.name ?? category.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={isUnvaulting}
                      onClick={() => {
                        void unvaultItem(item.id);
                      }}
                    >
                      <PackageMinus className="mr-1 h-4 w-4" />
                      {t(translations.vault.unvaultAction)}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
