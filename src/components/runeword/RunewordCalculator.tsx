import type { Item } from 'electron/types/grail';
import { RefreshCw } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';
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

type BroaderAvailability = Exclude<RunewordAvailabilityFilter, 'craftable'>;

const availabilityFilters: RunewordAvailabilityFilter[] = ['craftable', 'missingOne', 'all'];

/**
 * Tiers broader than each availability filter, in the order they are suggested.
 */
const broaderAvailabilityTiers: Record<RunewordAvailabilityFilter, BroaderAvailability[]> = {
  craftable: ['missingOne', 'all'],
  missingOne: ['all'],
  all: [],
};

const availabilityLabelKeys: Record<RunewordAvailabilityFilter, string> = {
  craftable: translations.runeword.calculator.availability.craftable,
  missingOne: translations.runeword.calculator.availability.missingOne,
  all: translations.grail.advancedSearch.statusAll,
};

/**
 * Label keys for the empty-state button that switches to a broader availability tier.
 */
const showAvailabilityLabelKeys: Record<BroaderAvailability, string> = {
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
 * Segmented control choosing between craftable, missing-at-most-one and all runewords.
 * Rendered as a labeled fieldset of toggle buttons exposing their state via aria-pressed.
 */
function AvailabilityFilter({ value, onChange }: AvailabilityFilterProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="flex items-stretch rounded-md border border-border bg-muted p-0.5">
      <legend className="sr-only">{t(translations.runeword.calculator.availabilityLegend)}</legend>
      {availabilityFilters.map((filter) => {
        const pressed = value === filter;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(filter)}
            className={cn(
              'inline-flex min-h-7 flex-1 items-center justify-center rounded-[5px] px-2 py-1 text-center font-medium text-muted-foreground text-xs outline-none transition-colors',
              'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
              pressed && 'bg-background text-foreground shadow-xs',
            )}
          >
            {t(availabilityLabelKeys[filter])}
          </button>
        );
      })}
    </fieldset>
  );
}

/**
 * RunewordCalculator component that serves as the main page for the runeword calculator.
 * Displays all runewords with filtering capabilities by name and available runes.
 * Loads runewords directly from the database to work independently of grailRunewords setting.
 */
export function RunewordCalculator() {
  const { t } = useTranslation();
  const searchInputId = useId();
  const [allRunewords, setAllRunewords] = useState<Item[]>([]);
  const [availableRunes, setAvailableRunes] = useState<Record<string, number>>({});
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

        setAvailableRunes(await loadAvailableRunes());
      } catch (error) {
        console.error('Failed to load data:', error);
        setIsScanning(false);
        // Fallback: try to load runes even if refresh failed
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

  // Filter runewords by name, selected runes and availability, then sort by craftability
  const filteredRunewords = useMemo(() => {
    const byName = filterRunewordsByName(allRunewords, searchTerm);
    const byRunes = filterRunewordsByRunes(byName, selectedRunes, availability, availableRunes);
    return sortRunewordsByCraftability(byRunes, availableRunes);
  }, [allRunewords, searchTerm, selectedRunes, availability, availableRunes]);

  /**
   * Rescans save files and reloads owned rune counts without hiding the current results.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSaveFiles();
      setAvailableRunes(await loadAvailableRunes());
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
      (tier) => filterRunewordsByRunes(byName, selectedRunes, tier, availableRunes).length > 0,
    );
  }, [allRunewords, searchTerm, selectedRunes, availability, availableRunes]);

  // "Nothing craftable" is only a valid diagnosis when no search or rune filter narrows the list.
  const hasActiveFilters = searchTerm.trim() !== '' || selectedRunes.length > 0;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-6 p-6">
      <PageHeader
        className="col-span-2"
        title={t(translations.runeword.calculator.title)}
        description={t(translations.runeword.calculator.subtitle)}
      />

      {/* Left Sidebar - Filters */}
      <div className="flex min-h-0 flex-col gap-6">
        <Card className="flex flex-1 flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {/* Search Bar */}
            <div className="flex flex-col gap-2">
              <Label htmlFor={searchInputId}>
                {t(translations.runeword.calculator.searchLabel)}
              </Label>
              <Input
                id={searchInputId}
                type="text"
                placeholder={t(translations.runeword.calculator.searchPlaceholder)}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <AvailabilityFilter value={availability} onChange={setAvailability} />
            {/* Results Count and Refresh */}
            <div className="flex items-center justify-between gap-2">
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
                className="ml-auto"
                disabled={isLoading || isRefreshing}
                aria-busy={isRefreshing}
                onClick={handleRefresh}
              >
                <RefreshCw aria-hidden="true" className={cn(isRefreshing && 'animate-spin')} />
                {t(translations.runeword.calculator.refreshRunes)}
              </Button>
            </div>
            <RuneFilters
              selectedRunes={selectedRunes}
              onRuneSelectionChange={setSelectedRunes}
              availableRunes={availableRunes}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right Content - Runewords */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
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

        {/* Runeword Grid: columns follow the available width, not the viewport */}
        {!isLoading && filteredRunewords.length > 0 && (
          <div
            data-testid="runeword-grid"
            className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4 pb-7"
          >
            {filteredRunewords.map((runeword) => (
              <RunewordCard key={runeword.id} runeword={runeword} availableRunes={availableRunes} />
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
  );
}
