import type { Item, VaultItemFilter } from 'electron/types/grail';
import i18n from 'i18next';
import { RefreshCw } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { loadInventorySearchResponse } from '@/components/inventory/inventorySearch';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import {
  collectOwnedRunewordBases,
  countAvailableGems,
  getRunewordReadiness,
  type OwnedRunewordBase,
} from '@/lib/runeword-readiness';
import {
  filterRunewordsByName,
  filterRunewordsByRunes,
  type RunewordAvailabilityFilter,
  sortRunewordsByCraftability,
} from '@/lib/runeword-utils';
import { cn } from '@/lib/utils';
import { RuneFilters } from './RuneFilters';
import { RunewordCard } from './RunewordCard';

/**
 * Loads all runewords from the database
 */
async function loadRunewords(): Promise<Item[]> {
  const runewords = await window.electronAPI?.grail.getAllRunewords();
  if (runewords) {
    console.log(`Loaded ${runewords.length} runewords`);
    return runewords;
  }
  return [];
}

/**
 * Refreshes save files to get latest rune data
 */
async function refreshSaveFiles(): Promise<void> {
  console.log('Refreshing save files...');
  await window.electronAPI?.saveFile.refreshSaveFiles();
  console.log('Save files refreshed');
}

/**
 * Loads available rune counts from save files
 */
async function loadAvailableRunes(): Promise<Record<string, number>> {
  const runes = await window.electronAPI?.saveFile.getAvailableRunes();
  return runes || {};
}

/** Gems and runeword bases owned across the save files and the vault. */
interface OwnedItems {
  availableGems: Record<string, number>;
  ownedBases: OwnedRunewordBase[];
}

/** Every item of the latest save file scan that is not socketed into another one, and the vault. */
const OWNED_ITEMS_FILTER: VaultItemFilter = {
  includeSocketed: false,
  vaultedState: 'vaulted',
  page: 1,
  pageSize: 200,
};

/**
 * Loads gem counts from save files and the runeword bases owned in save files and the vault.
 * Without them the calculator still works from the rune counts, so a failure yields none.
 */
async function loadOwnedItems(): Promise<OwnedItems> {
  try {
    const response = await loadInventorySearchResponse(OWNED_ITEMS_FILTER);
    return {
      availableGems: countAvailableGems(response.inventory.snapshots),
      ownedBases: collectOwnedRunewordBases(response.inventory.snapshots, response.vault.items),
    };
  } catch (error) {
    console.error('Failed to load owned gems and bases:', error);
    toast.error(i18n.t(translations.runeword.calculator.ownedItemsFailed));
    return { availableGems: {}, ownedBases: [] };
  }
}

type BroaderAvailability = Exclude<RunewordAvailabilityFilter, 'ready'>;

const availabilityFilters: RunewordAvailabilityFilter[] = [
  'ready',
  'craftable',
  'upgradable',
  'missingOne',
  'all',
];

/**
 * Tiers broader than each availability filter, in the order they are suggested.
 */
const broaderAvailabilityTiers: Record<RunewordAvailabilityFilter, BroaderAvailability[]> = {
  ready: ['craftable', 'upgradable', 'missingOne', 'all'],
  craftable: ['upgradable', 'missingOne', 'all'],
  upgradable: ['missingOne', 'all'],
  missingOne: ['all'],
  all: [],
};

const availabilityLabelKeys: Record<RunewordAvailabilityFilter, string> = {
  ready: translations.runeword.calculator.availability.ready,
  craftable: translations.runeword.calculator.availability.craftable,
  upgradable: translations.runeword.calculator.availability.upgradable,
  missingOne: translations.runeword.calculator.availability.missingOne,
  all: translations.grail.advancedSearch.statusAll,
};

/**
 * Keys of the rule each availability filter applies, offered as its tooltip and accessible
 * description.
 */
const availabilityDescriptionKeys: Record<RunewordAvailabilityFilter, string> = {
  ready: translations.runeword.calculator.availabilityDescription.ready,
  craftable: translations.runeword.calculator.availabilityDescription.craftable,
  upgradable: translations.runeword.calculator.availabilityDescription.upgradable,
  missingOne: translations.runeword.calculator.availabilityDescription.missingOne,
  all: translations.runeword.calculator.availabilityDescription.all,
};

/**
 * Label keys for the empty-state button that switches to a broader availability tier.
 */
const showAvailabilityLabelKeys: Record<BroaderAvailability, string> = {
  craftable: translations.runeword.calculator.showCraftable,
  upgradable: translations.runeword.calculator.showUpgradable,
  missingOne: translations.runeword.calculator.showMissingOne,
  all: translations.runeword.calculator.showAll,
};

/**
 * Props for the AvailabilityFilter segmented control.
 */
interface AvailabilityFilterProps {
  value: RunewordAvailabilityFilter;
  onChange: (value: RunewordAvailabilityFilter) => void;
}

/**
 * Segmented control choosing between runewords you have the runes and a base for, the runes for,
 * the runes for with cube upgrades, all but at most one rune for, and all runewords.
 * Rendered as a labeled fieldset of toggle buttons exposing their state via aria-pressed. Each
 * label names its rule in short; the full rule is the button's tooltip and accessible description.
 */
function AvailabilityFilter({ value, onChange }: AvailabilityFilterProps) {
  const { t } = useTranslation();
  const descriptionIdPrefix = useId();

  return (
    <fieldset className="flex items-stretch rounded-md border border-border bg-muted p-0.5">
      <legend className="sr-only">{t(translations.runeword.calculator.availabilityLegend)}</legend>
      {availabilityFilters.map((filter) => {
        const pressed = value === filter;
        const description = t(availabilityDescriptionKeys[filter]);
        const descriptionId = `${descriptionIdPrefix}-${filter}`;
        return (
          <Tooltip key={filter}>
            <TooltipTrigger
              type="button"
              aria-pressed={pressed}
              aria-describedby={descriptionId}
              onClick={() => onChange(filter)}
              className={cn(
                'inline-flex min-h-7 flex-1 items-center justify-center whitespace-nowrap rounded-[5px] px-3 py-1 text-center font-medium text-muted-foreground text-xs outline-none transition-colors',
                'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                pressed && 'bg-background text-foreground shadow-xs',
              )}
            >
              {t(availabilityLabelKeys[filter])}
              {/* The tooltip only renders while open, so the rule is also kept, hidden, in the
                  button as its accessible description */}
              <span id={descriptionId} hidden>
                {description}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{description}</TooltipContent>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}

/**
 * RunewordCalculator component that serves as the main page for the runeword calculator.
 * Displays all runewords with filtering capabilities by name and available runes, with the rune
 * upgrades owned runes and gems allow and the owned bases each runeword fits.
 * Loads runewords directly from the database to work independently of grailRunewords setting.
 */
export function RunewordCalculator() {
  const { t } = useTranslation();
  const searchInputId = useId();
  const [allRunewords, setAllRunewords] = useState<Item[]>([]);
  const [availableRunes, setAvailableRunes] = useState<Record<string, number>>({});
  const [ownedItems, setOwnedItems] = useState<OwnedItems>({ availableGems: {}, ownedBases: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRunes, setSelectedRunes] = useState<string[]>([]);
  const [availability, setAvailability] = useState<RunewordAvailabilityFilter>('craftable');
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load runewords, progress, and refresh save files on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setAllRunewords(await loadRunewords());

        setIsScanning(true);
        await refreshSaveFiles();
        setIsScanning(false);

        const [runes, owned] = await Promise.all([loadAvailableRunes(), loadOwnedItems()]);
        setAvailableRunes(runes);
        setOwnedItems(owned);
      } catch (error) {
        console.error('Failed to load data:', error);
        setIsScanning(false);
        // Fallback: try to load runes, gems and bases even if refresh failed
        setOwnedItems(await loadOwnedItems());
        try {
          setAvailableRunes(await loadAvailableRunes());
        } catch (runeError) {
          console.error('Failed to load available runes:', runeError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const readinessById = useMemo(
    () =>
      getRunewordReadiness(
        allRunewords,
        availableRunes,
        ownedItems.availableGems,
        ownedItems.ownedBases,
      ),
    [allRunewords, availableRunes, ownedItems],
  );

  // Filter runewords by name, selected runes and availability, then sort by craftability
  const filteredRunewords = useMemo(() => {
    const byName = filterRunewordsByName(allRunewords, searchTerm);
    const byRunes = filterRunewordsByRunes(
      byName,
      selectedRunes,
      availability,
      availableRunes,
      readinessById,
    );
    return sortRunewordsByCraftability(byRunes, availableRunes);
  }, [allRunewords, searchTerm, selectedRunes, availability, availableRunes, readinessById]);

  /**
   * Rescans save files and reloads owned rune counts without hiding the current results.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSaveFiles();
      const [runes, owned] = await Promise.all([loadAvailableRunes(), loadOwnedItems()]);
      setAvailableRunes(runes);
      setOwnedItems(owned);
    } catch (error) {
      console.error('Failed to refresh available runes:', error);
      toast.error(t(translations.runeword.calculator.refreshFailed));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Suggest the first broader tier that would reveal results under the active search and rune filters.
  const nextAvailability = useMemo(() => {
    const byName = filterRunewordsByName(allRunewords, searchTerm);
    return broaderAvailabilityTiers[availability].find(
      (tier) =>
        filterRunewordsByRunes(byName, selectedRunes, tier, availableRunes, readinessById).length >
        0,
    );
  }, [allRunewords, searchTerm, selectedRunes, availability, availableRunes, readinessById]);

  // "Nothing craftable" is only a valid diagnosis when no search or rune filter narrows the list.
  const hasActiveFilters = searchTerm.trim() !== '' || selectedRunes.length > 0;

  return (
    // The page fits the window: the sidebar stays in place and only the runeword grid scrolls.
    // Padding is split on purpose: the root pads the top and left, while the header, toolbar and
    // scroll area pad their own right side and the sidebar and scroll area their own bottom. That
    // way the grid's scroll container itself reaches the right and bottom window edges and its
    // scrollbar reads as the page scrollbar. The sidebar is narrow (a four-column rune grid) below
    // the xl breakpoint so the runeword grid keeps most of a small window, and widens to five
    // columns above it.
    <div className="grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-6 pt-6 pl-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <PageHeader
        className="col-span-2 pr-6"
        title={t(translations.runeword.calculator.title)}
        description={t(translations.runeword.calculator.subtitle)}
      />

      {/* Left Sidebar - Rune filters, as tall as its content but never taller than the window */}
      <div className="flex min-h-0 flex-col pb-6">
        <Card data-testid="runeword-sidebar" className="flex min-h-0 flex-col overflow-hidden py-4">
          <CardContent className="flex min-h-0 flex-1 flex-col px-4">
            <RuneFilters
              selectedRunes={selectedRunes}
              onRuneSelectionChange={setSelectedRunes}
              availableRunes={availableRunes}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right Content - Toolbar and runewords */}
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <div
          data-testid="runeword-toolbar"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 pr-6"
        >
          <Label htmlFor={searchInputId} className="sr-only">
            {t(translations.runeword.calculator.searchLabel)}
          </Label>
          <Input
            id={searchInputId}
            type="text"
            className="max-w-56 grow basis-40"
            placeholder={t(translations.runeword.calculator.searchPlaceholder)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <AvailabilityFilter value={availability} onChange={setAvailability} />
          <div className="ml-auto flex items-center gap-4">
            {!isLoading && (
              <div className="text-muted-foreground text-sm" aria-live="polite">
                {t(translations.runeword.calculator.showingResults, {
                  filtered: filteredRunewords.length,
                  total: allRunewords.length,
                })}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || isRefreshing}
              aria-busy={isRefreshing}
              onClick={handleRefresh}
            >
              <RefreshCw aria-hidden="true" className={cn(isRefreshing && 'animate-spin')} />
              {t(translations.runeword.calculator.refreshRunes)}
            </Button>
          </div>
        </div>

        {/* Runeword grid scroll container */}
        <div
          data-testid="runeword-scroll-area"
          className="min-h-0 flex-1 overflow-y-auto pr-6 pb-6"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                <p className="font-medium text-muted-foreground">
                  {isScanning
                    ? t(translations.runeword.calculator.scanningSaveFiles)
                    : t(translations.runeword.calculator.loadingRuneData)}
                </p>
                {isScanning && (
                  <p className="mt-2 text-muted-foreground text-sm">
                    {t(translations.runeword.calculator.thisMayTake)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Runeword Grid: columns follow the available width, not the viewport. Each card spans
            four rows (header, runes, missing runes, footer) via subgrid and takes its row gap from
            this grid. */}
          {!isLoading && filteredRunewords.length > 0 && (
            <div
              data-testid="runeword-grid"
              className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4"
            >
              {filteredRunewords.map((runeword) => (
                <RunewordCard
                  key={runeword.id}
                  runeword={runeword}
                  availableRunes={availableRunes}
                  readiness={readinessById[runeword.id]}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredRunewords.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-lg text-muted-foreground">
                {availability === 'craftable' && !hasActiveFilters
                  ? t(translations.runeword.calculator.noCraftable)
                  : t(translations.runeword.calculator.noRunewordsFound)}
              </p>
              <p className="mt-2 text-muted-foreground text-sm">
                {t(translations.runeword.calculator.adjustFilters)}
              </p>
              {nextAvailability && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setAvailability(nextAvailability)}
                >
                  {t(showAvailabilityLabelKeys[nextAvailability])}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
