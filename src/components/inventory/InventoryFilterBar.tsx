import type { VaultLocationContext } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import type { TypeFilter } from '@/components/inventory/inventoryItems';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(translations.inventoryBrowser.title)}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder={t(translations.inventoryBrowser.searchPlaceholder)}
          aria-label={t(translations.common.search)}
          className="md:col-span-2"
        />
        <Select value={characterId} onValueChange={(value) => onCharacterIdChange(value ?? 'all')}>
          <SelectTrigger>
            <SelectValue placeholder={t(translations.inventoryBrowser.character)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(translations.inventoryBrowser.allCharacters)}</SelectItem>
            {characterOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={locationContext}
          onValueChange={(value) =>
            onLocationContextChange((value as LocationFilter | null) ?? 'all')
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t(translations.inventoryBrowser.locationFilter)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(translations.inventoryBrowser.allLocations)}</SelectItem>
            {LOCATION_FILTER_OPTIONS.map((location) => (
              <SelectItem key={location} value={location}>
                {t(translations.inventoryBrowser.location[location])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(value) => onTypeFilterChange((value as TypeFilter | null) ?? 'all')}
        >
          <SelectTrigger>
            <SelectValue placeholder={t(translations.inventoryBrowser.type)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(translations.inventoryBrowser.allTypes)}</SelectItem>
            {TYPE_FILTER_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {t(translations.inventoryBrowser.typeOptions[type])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
