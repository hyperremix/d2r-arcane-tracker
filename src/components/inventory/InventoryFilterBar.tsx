import type { VaultLocationContext } from 'electron/types/grail';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TypeFilter } from '@/components/inventory/inventoryItems';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';

export type LocationFilter = 'all' | VaultLocationContext;

const LOCATION_FILTER_OPTIONS = ['equipped', 'inventory', 'stash', 'mercenary', 'corpse'] as const;
const TYPE_FILTER_OPTIONS = ['unique', 'set', 'runeword', 'rune', 'other'] as const;

export interface InventoryFilterBarProps {
  searchText: string;
  onSearchTextChange: (searchText: string) => void;
  characterId: string;
  onCharacterIdChange: (characterId: string) => void;
  /** Character id and display name pairs. */
  characterOptions: [string, string][];
  locationContext: LocationFilter;
  onLocationContextChange: (locationContext: LocationFilter) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (typeFilter: TypeFilter) => void;
}

interface FilterOption {
  value: string;
  label: string;
}

/** Search box and character, location and type filters of the inventory browser. */
export function InventoryFilterBar({
  searchText,
  onSearchTextChange,
  characterId,
  onCharacterIdChange,
  characterOptions,
  locationContext,
  onLocationContextChange,
  typeFilter,
  onTypeFilterChange,
}: InventoryFilterBarProps) {
  const { t } = useTranslation();
  const searchId = useId();
  const characterSelectId = useId();
  const locationSelectId = useId();
  const typeSelectId = useId();

  // Base UI renders the selected label in the trigger only when it gets the options as `items`.
  const characterItems: FilterOption[] = [
    { value: 'all', label: t(translations.inventoryBrowser.allCharacters) },
    ...characterOptions.map(([id, name]) => ({ value: id, label: name })),
  ];
  const locationItems: FilterOption[] = [
    { value: 'all', label: t(translations.inventoryBrowser.allLocations) },
    ...LOCATION_FILTER_OPTIONS.map((location) => ({
      value: location,
      label: t(translations.inventoryBrowser.location[location]),
    })),
  ];
  const typeItems: FilterOption[] = [
    { value: 'all', label: t(translations.inventoryBrowser.allTypes) },
    ...TYPE_FILTER_OPTIONS.map((type) => ({
      value: type,
      label: t(translations.inventoryBrowser.typeOptions[type]),
    })),
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor={searchId}>{t(translations.common.search)}</Label>
          <Input
            id={searchId}
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder={t(translations.inventoryBrowser.searchPlaceholder)}
          />
        </div>
        <FilterSelect
          id={characterSelectId}
          label={t(translations.inventoryBrowser.character)}
          items={characterItems}
          value={characterId}
          onValueChange={onCharacterIdChange}
        />
        <FilterSelect
          id={locationSelectId}
          label={t(translations.inventoryBrowser.locationFilter)}
          items={locationItems}
          value={locationContext}
          onValueChange={(value) => onLocationContextChange(value as LocationFilter)}
        />
        <FilterSelect
          id={typeSelectId}
          label={t(translations.inventoryBrowser.type)}
          items={typeItems}
          value={typeFilter}
          onValueChange={(value) => onTypeFilterChange(value as TypeFilter)}
        />
      </CardContent>
    </Card>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  items: FilterOption[];
  value: string;
  onValueChange: (value: string) => void;
}

/** A labelled filter dropdown; clearing the selection falls back to `all`. */
function FilterSelect({ id, label, items, value, onValueChange }: FilterSelectProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onValueChange((next as string | null) ?? 'all')}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
