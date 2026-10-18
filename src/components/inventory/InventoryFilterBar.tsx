import type { VaultLocationContext } from 'electron/types/grail';
import { Plus, X } from 'lucide-react';
import { type ChangeEvent, useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TypeFilter } from '@/components/inventory/inventoryItems';
import type {
  EtherealFilter,
  ItemPropertyFilters,
  ItemSortOrder,
  SocketMatch,
  StatCondition,
} from '@/components/inventory/itemPropertyFilters';
import { Button } from '@/components/ui/button';
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
import { ITEM_STAT_FILTER_KEYS, type ItemStatFilterKey } from '@/lib/itemProperties';

export type LocationFilter = 'all' | VaultLocationContext;

const LOCATION_FILTER_OPTIONS = ['equipped', 'inventory', 'stash', 'mercenary', 'corpse'] as const;
const TYPE_FILTER_OPTIONS = ['unique', 'set', 'runeword', 'rune', 'other'] as const;
const SOCKET_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;
const SOCKET_MATCH_OPTIONS: readonly SocketMatch[] = ['exactly', 'atLeast'];
const ETHEREAL_OPTIONS: readonly EtherealFilter[] = ['any', 'ethereal', 'notEthereal'];
const SORT_OPTIONS: readonly ItemSortOrder[] = ['default', 'rollQuality'];
const ANY_SOCKETS = 'any';

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
  /** Item property filters and sort order; their fields are shown only when this is given. */
  propertyFilterProps?: ItemPropertyFilterFieldsProps;
}

interface FilterOption {
  value: string;
  label: string;
}

/**
 * Search box, character, location and type filters of the inventory browser and, when given, the
 * item property filters (base item, sockets, ethereal, roll quality, stats) and the sort order of
 * the matching and vaulted items. The filters narrow the characters and stashes list and the vaulted
 * items of the main view; the windows opened from the list always show every item. Grouped in a
 * fieldset whose legend and description name that scope.
 */
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
  propertyFilterProps,
}: InventoryFilterBarProps) {
  const { t } = useTranslation();
  const searchId = useId();
  const characterSelectId = useId();
  const locationSelectId = useId();
  const typeSelectId = useId();
  const scopeId = useId();

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
    <fieldset aria-describedby={scopeId} className="rounded-md border border-border/60 p-3">
      <legend className="px-1 font-medium text-sm">
        {t(translations.inventoryBrowser.filters.legend)}
      </legend>
      <p id={scopeId} className="mb-3 text-muted-foreground text-xs">
        {t(translations.inventoryBrowser.filters.scope)}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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
      </div>
      {propertyFilterProps && <ItemPropertyFilterFields {...propertyFilterProps} />}
    </fieldset>
  );
}

/** A whole number typed into a number field, or undefined when it is empty or not a number. */
function readNumberInput(event: ChangeEvent<HTMLInputElement>): number | undefined {
  const value = event.target.value.trim();
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function isOneOf<T extends string>(options: readonly T[], value: string): value is T {
  return (options as readonly string[]).includes(value);
}

export interface ItemPropertyFilterFieldsProps {
  filters: ItemPropertyFilters;
  onChange: (filters: ItemPropertyFilters) => void;
  sortOrder: ItemSortOrder;
  onSortOrderChange: (sortOrder: ItemSortOrder) => void;
}

/** Base item, sockets, ethereal, roll quality and stat filters, and the sort order. */
function ItemPropertyFilterFields({
  filters,
  onChange,
  sortOrder,
  onSortOrderChange,
}: ItemPropertyFilterFieldsProps) {
  const { t } = useTranslation();
  const baseItemId = useId();
  const socketsId = useId();
  const socketMatchId = useId();
  const etherealId = useId();
  const minRollId = useId();
  const sortId = useId();
  const labels = translations.inventoryBrowser.filters;

  const socketItems: FilterOption[] = [
    { value: ANY_SOCKETS, label: t(labels.anySockets) },
    ...SOCKET_COUNT_OPTIONS.map((count) => ({ value: String(count), label: String(count) })),
  ];
  const socketMatchItems: FilterOption[] = SOCKET_MATCH_OPTIONS.map((match) => ({
    value: match,
    label: t(labels.socketMatchOptions[match]),
  }));
  const etherealItems: FilterOption[] = ETHEREAL_OPTIONS.map((option) => ({
    value: option,
    label: t(labels.etherealOptions[option]),
  }));
  const sortItems: FilterOption[] = SORT_OPTIONS.map((option) => ({
    value: option,
    label: t(labels.sortOptions[option]),
  }));

  const updateStatCondition = (id: number, update: Partial<StatCondition>) => {
    onChange({
      ...filters,
      statConditions: filters.statConditions.map((condition) =>
        condition.id === id ? { ...condition, ...update } : condition,
      ),
    });
  };
  const addStatCondition = () => {
    const nextId = Math.max(0, ...filters.statConditions.map((condition) => condition.id)) + 1;
    onChange({
      ...filters,
      statConditions: [...filters.statConditions, { id: nextId, stat: ITEM_STAT_FILTER_KEYS[0] }],
    });
  };
  const removeStatCondition = (id: number) => {
    onChange({
      ...filters,
      statConditions: filters.statConditions.filter((condition) => condition.id !== id),
    });
  };

  return (
    <div className="mt-3 space-y-3 border-border/60 border-t pt-3">
      <p className="font-medium text-sm">{t(labels.itemProperties)}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor={baseItemId}>{t(labels.baseItem)}</Label>
          <Input
            id={baseItemId}
            value={filters.baseText}
            onChange={(event) => onChange({ ...filters, baseText: event.target.value })}
            placeholder={t(labels.baseItemPlaceholder)}
          />
        </div>
        <FilterSelect
          id={socketsId}
          label={t(labels.sockets)}
          items={socketItems}
          value={filters.socketCount === undefined ? ANY_SOCKETS : String(filters.socketCount)}
          onValueChange={(value) => {
            const count = Number(value);
            onChange({ ...filters, socketCount: Number.isInteger(count) ? count : undefined });
          }}
        />
        <FilterSelect
          id={socketMatchId}
          label={t(labels.socketMatch)}
          items={socketMatchItems}
          value={filters.socketMatch}
          disabled={filters.socketCount === undefined}
          onValueChange={(value) =>
            onChange({ ...filters, socketMatch: value === 'atLeast' ? 'atLeast' : 'exactly' })
          }
        />
        <FilterSelect
          id={etherealId}
          label={t(labels.ethereal)}
          items={etherealItems}
          value={filters.ethereal}
          onValueChange={(value) =>
            onChange({ ...filters, ethereal: isOneOf(ETHEREAL_OPTIONS, value) ? value : 'any' })
          }
        />
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor={minRollId}>{t(labels.minRollPercent)}</Label>
          <Input
            id={minRollId}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={filters.minRollPercent ?? ''}
            onChange={(event) => onChange({ ...filters, minRollPercent: readNumberInput(event) })}
          />
        </div>
        <FilterSelect
          id={sortId}
          label={t(labels.sortBy)}
          items={sortItems}
          value={sortOrder}
          onValueChange={(value) =>
            onSortOrderChange(isOneOf(SORT_OPTIONS, value) ? value : 'default')
          }
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium text-sm">{t(labels.stats)}</legend>
        {filters.statConditions.map((condition) => (
          <StatConditionFields
            key={condition.id}
            condition={condition}
            onChange={(update) => updateStatCondition(condition.id, update)}
            onRemove={() => removeStatCondition(condition.id)}
          />
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addStatCondition}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          {t(labels.addStat)}
        </Button>
      </fieldset>
    </div>
  );
}

interface StatConditionFieldsProps {
  condition: StatCondition;
  onChange: (update: Partial<StatCondition>) => void;
  onRemove: () => void;
}

/** One "has stat X at least N" row: the stat, the minimum value and a remove button. */
function StatConditionFields({ condition, onChange, onRemove }: StatConditionFieldsProps) {
  const { t } = useTranslation();
  const statId = useId();
  const minValueId = useId();
  const labels = translations.inventoryBrowser.filters;
  const statLabel = t(labels.statOptions[condition.stat]);
  const statItems: FilterOption[] = ITEM_STAT_FILTER_KEYS.map((stat) => ({
    value: stat,
    label: t(labels.statOptions[stat]),
  }));

  return (
    <div className="grid grid-cols-[1fr_8rem_auto] items-end gap-2 md:max-w-xl">
      <FilterSelect
        id={statId}
        label={t(labels.stat)}
        items={statItems}
        value={condition.stat}
        onValueChange={(value) =>
          onChange({
            stat: isOneOf<ItemStatFilterKey>(ITEM_STAT_FILTER_KEYS, value) ? value : condition.stat,
          })
        }
      />
      <div className="grid gap-2">
        <Label htmlFor={minValueId}>{t(labels.statMinValue)}</Label>
        <Input
          id={minValueId}
          type="number"
          inputMode="numeric"
          aria-label={t(labels.statMinValueLabel, { stat: statLabel })}
          value={condition.minValue ?? ''}
          onChange={(event) => onChange({ minValue: readNumberInput(event) })}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t(labels.removeStat, { stat: statLabel })}
        onClick={onRemove}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  items: FilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

/** A labelled filter dropdown; clearing the selection falls back to `all`. */
function FilterSelect({ id, label, items, value, onValueChange, disabled }: FilterSelectProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        disabled={disabled}
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
