import type { VaultLocationContext } from 'electron/types/grail';
import type { TFunction } from 'i18next';
import { ChevronDown, Plus, RotateCcw, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActiveFilterChips } from '@/components/grail/search/ActiveFilterChips';
import type { TypeFilter } from '@/components/inventory/inventoryItems';
import {
  DEFAULT_ITEM_PROPERTY_FILTERS,
  type EtherealFilter,
  type ItemPropertyFilters,
  type ItemSortOrder,
  type SocketMatch,
  type StatCondition,
} from '@/components/inventory/itemPropertyFilters';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

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
  /** Item property filters and sort order; when given, their fields sit behind "More filters". */
  propertyFilterProps?: ItemPropertyFilterFieldsProps;
}

interface FilterOption {
  value: string;
  label: string;
}

/** A removable chip for one active filter. */
interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** One chip per active item property filter; each stat row gets its own chip. */
function buildPropertyFilterChips(
  { filters, onChange }: ItemPropertyFilterFieldsProps,
  t: TFunction,
): FilterChip[] {
  const labels = translations.inventoryBrowser.filters;
  const chips: FilterChip[] = [];
  const baseText = filters.baseText.trim();

  if (baseText) {
    chips.push({
      key: 'baseItem',
      label: t(labels.chips.value, { filter: t(labels.baseItem), value: baseText }),
      onRemove: () => onChange({ ...filters, baseText: '' }),
    });
  }
  if (filters.socketCount !== undefined) {
    chips.push({
      key: 'sockets',
      label: t(
        filters.socketMatch === 'atLeast'
          ? labels.chips.socketsAtLeast
          : labels.chips.socketsExactly,
        { count: filters.socketCount },
      ),
      onRemove: () => onChange({ ...filters, socketCount: undefined }),
    });
  }
  if (filters.ethereal !== 'any') {
    chips.push({
      key: 'ethereal',
      label: t(labels.chips.value, {
        filter: t(labels.ethereal),
        value: t(labels.etherealOptions[filters.ethereal]),
      }),
      onRemove: () => onChange({ ...filters, ethereal: 'any' }),
    });
  }
  if (filters.minRollPercent !== undefined) {
    chips.push({
      key: 'minRollPercent',
      label: t(labels.chips.minRollPercent, { value: filters.minRollPercent }),
      onRemove: () => onChange({ ...filters, minRollPercent: undefined }),
    });
  }
  for (const condition of filters.statConditions) {
    const stat = t(labels.statOptions[condition.stat]);
    chips.push({
      key: `stat-${condition.id}`,
      label:
        condition.minValue === undefined
          ? t(labels.chips.value, { filter: t(labels.stat), value: stat })
          : t(labels.chips.statAtLeast, { stat, value: condition.minValue }),
      onRemove: () =>
        onChange({
          ...filters,
          statConditions: filters.statConditions.filter(({ id }) => id !== condition.id),
        }),
    });
  }

  return chips;
}

/**
 * Search box, character, location and type filters of the inventory browser and, when given, the
 * item property filters (base item, sockets, ethereal, roll quality, stats) and the sort order of
 * the matching and vaulted items behind a "More filters" toggle that counts the active ones. Every
 * active filter, hidden or not, shows as a removable chip next to a "Clear all" action. The filters
 * narrow the characters and stashes list and the vaulted items of the main view; the windows opened
 * from the list always show every item.
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
  const moreFiltersId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const labels = translations.inventoryBrowser.filters;

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

  const primaryChips: FilterChip[] = [];
  const addSelectChip = (
    key: string,
    filter: string,
    items: FilterOption[],
    value: string,
    onRemove: () => void,
  ) => {
    if (value !== 'all') {
      const label = items.find((item) => item.value === value)?.label ?? value;
      primaryChips.push({ key, label: t(labels.chips.value, { filter, value: label }), onRemove });
    }
  };
  const trimmedSearchText = searchText.trim();
  if (trimmedSearchText) {
    primaryChips.push({
      key: 'search',
      label: t(labels.chips.value, {
        filter: t(translations.common.search),
        value: trimmedSearchText,
      }),
      onRemove: () => onSearchTextChange(''),
    });
  }
  addSelectChip(
    'character',
    t(translations.inventoryBrowser.character),
    characterItems,
    characterId,
    () => onCharacterIdChange('all'),
  );
  addSelectChip(
    'location',
    t(translations.inventoryBrowser.locationFilter),
    locationItems,
    locationContext,
    () => onLocationContextChange('all'),
  );
  addSelectChip('type', t(translations.inventoryBrowser.type), typeItems, typeFilter, () =>
    onTypeFilterChange('all'),
  );
  const propertyChips = propertyFilterProps ? buildPropertyFilterChips(propertyFilterProps, t) : [];
  const chips = [...primaryChips, ...propertyChips];

  const clearAll = () => {
    onSearchTextChange('');
    onCharacterIdChange('all');
    onLocationContextChange('all');
    onTypeFilterChange('all');
    propertyFilterProps?.onChange(DEFAULT_ITEM_PROPERTY_FILTERS);
    // The chips and this button go away, so keyboard focus moves to the search box
    document.getElementById(searchId)?.focus();
  };

  return (
    <fieldset className="rounded-md border border-border/60 p-3">
      <legend className="px-1 font-medium text-sm">{t(labels.legend)}</legend>
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
      {(propertyFilterProps || chips.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {propertyFilterProps && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={isExpanded}
              aria-controls={moreFiltersId}
              aria-label={
                propertyChips.length > 0
                  ? t(labels.moreFiltersWithCount, { count: propertyChips.length })
                  : undefined
              }
              onClick={() => setIsExpanded((current) => !current)}
            >
              {t(labels.moreFilters)}
              {propertyChips.length > 0 && (
                <Badge variant="secondary" className="tabular-nums" aria-hidden="true">
                  {propertyChips.length}
                </Badge>
              )}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'transition-transform motion-reduce:transition-none',
                  isExpanded && 'rotate-180',
                )}
              />
            </Button>
          )}
          {chips.length > 0 && (
            <>
              <ActiveFilterChips chips={chips} />
              <Button type="button" variant="ghost" size="sm" className="h-7" onClick={clearAll}>
                <RotateCcw aria-hidden="true" />
                {t(translations.grail.advancedSearch.clearAll)}
              </Button>
            </>
          )}
        </div>
      )}
      {propertyFilterProps && (
        <div id={moreFiltersId} hidden={!isExpanded}>
          <ItemPropertyFilterFields {...propertyFilterProps} />
        </div>
      )}
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
  const addStatButtonRef = useRef<HTMLElement>(null);
  const [newConditionId, setNewConditionId] = useState<number>();
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
  const sortOptionItems: FilterOption[] = SORT_OPTIONS.map((option) => ({
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
    setNewConditionId(nextId);
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
    // The removed row's button is gone, so keyboard focus moves to the button that adds a row
    addStatButtonRef.current?.focus();
  };

  return (
    <fieldset className="mt-3 min-w-0 space-y-3 border-border/60 border-t pt-3">
      <legend className="px-1 font-medium text-sm">{t(labels.itemProperties)}</legend>
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
          items={sortOptionItems}
          value={sortOrder}
          onValueChange={(value) =>
            onSortOrderChange(isOneOf(SORT_OPTIONS, value) ? value : 'default')
          }
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium text-sm">{t(labels.stats)}</legend>
        {filters.statConditions.map((condition, index) => (
          <StatConditionFields
            key={condition.id}
            condition={condition}
            number={index + 1}
            focusOnMount={condition.id === newConditionId}
            onChange={(update) => updateStatCondition(condition.id, update)}
            onRemove={() => removeStatCondition(condition.id)}
          />
        ))}
        <Button
          ref={addStatButtonRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={addStatCondition}
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          {t(labels.addStat)}
        </Button>
      </fieldset>
    </fieldset>
  );
}

interface StatConditionFieldsProps {
  condition: StatCondition;
  /** Position of the row among the stat rows, starting at 1. */
  number: number;
  /** Moves keyboard focus to the stat dropdown when the row is added. */
  focusOnMount: boolean;
  onChange: (update: Partial<StatCondition>) => void;
  onRemove: () => void;
}

/** One "has stat X at least N" row: the stat, the minimum value and a remove button. */
function StatConditionFields({
  condition,
  number,
  focusOnMount,
  onChange,
  onRemove,
}: StatConditionFieldsProps) {
  const { t } = useTranslation();
  const statId = useId();
  const minValueId = useId();
  const labels = translations.inventoryBrowser.filters;
  useEffect(() => {
    if (focusOnMount) {
      document.getElementById(statId)?.focus();
    }
  }, [focusOnMount, statId]);
  const statLabel = t(labels.statOptions[condition.stat]);
  const statItems: FilterOption[] = ITEM_STAT_FILTER_KEYS.map((stat) => ({
    value: stat,
    label: t(labels.statOptions[stat]),
  }));

  return (
    <fieldset
      aria-label={t(labels.statRow, { number })}
      className="grid min-w-0 grid-cols-[1fr_8rem_auto] items-end gap-2 md:max-w-xl"
    >
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
    </fieldset>
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

/** A labelled filter dropdown; clearing the selection falls back to its first option. */
function FilterSelect({ id, label, items, value, onValueChange, disabled }: FilterSelectProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => onValueChange((next as string | null) ?? items[0]?.value ?? value)}
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
