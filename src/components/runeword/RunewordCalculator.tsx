import type { Item } from 'electron/types/grail';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { filterRunewordsByName, filterRunewordsByRunes } from '@/lib/runeword-utils';
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

/**
 * RunewordCalculator component that serves as the main page for the runeword calculator.
 * Displays all runewords with filtering capabilities by name and available runes.
 * Loads runewords directly from the database to work independently of grailRunewords setting.
 */
export function RunewordCalculator() {
  const [allRunewords, setAllRunewords] = useState<Item[]>([]);
  const [availableRunes, setAvailableRunes] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRunes, setSelectedRunes] = useState<string[]>([]);
  const [showPartial, setShowPartial] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

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

  // Filter runewords based on search term and selected runes
  const filteredRunewords = useMemo(() => {
    let filtered = allRunewords;

    // Apply name filter
    filtered = filterRunewordsByName(filtered, searchTerm);

    // Apply rune filter
    filtered = filterRunewordsByRunes(filtered, selectedRunes, showPartial, availableRunes);

    return filtered;
  }, [allRunewords, searchTerm, selectedRunes, showPartial, availableRunes]);

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left Sidebar - Filters */}
      <div className="flex w-80 shrink-0 flex-col gap-6">
        <div>
          <h1 className="mb-2 font-bold text-3xl">Runeword Calculator</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find which runewords you can craft with your available runes
          </p>
        </div>

        {/* Search Bar */}
        <Card className="flex flex-1 flex-col overflow-hidden">
          <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden">
            {/* Results Count */}
            {!isLoading && (
              <div className="text-gray-600 text-sm dark:text-gray-400">
                Showing {filteredRunewords.length} of {allRunewords.length} runewords
              </div>
            )}
            <Input
              type="text"
              placeholder="Search runewords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <RuneFilters
              selectedRunes={selectedRunes}
              onRuneSelectionChange={setSelectedRunes}
              availableRunes={availableRunes}
              showPartial={showPartial}
              onShowPartialChange={setShowPartial}
              className="flex-1 overflow-y-auto"
            />
          </CardContent>
        </Card>
      </div>

      {/* Right Content - Runewords */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
              <p className="font-medium text-gray-600 dark:text-gray-400">
                {isScanning ? 'Scanning save files...' : 'Loading rune data...'}
              </p>
              {isScanning && (
                <p className="mt-2 text-gray-500 text-sm dark:text-gray-500">
                  This may take a few moments
                </p>
              )}
            </div>
          </div>
        )}

        {/* Runeword Grid */}
        {!isLoading && filteredRunewords.length > 0 && (
          <div className="grid grid-cols-2 gap-4 pb-7 md:grid-cols-3 lg:grid-cols-4">
            {filteredRunewords.map((runeword) => (
              <RunewordCard key={runeword.id} runeword={runeword} availableRunes={availableRunes} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredRunewords.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-600 text-lg dark:text-gray-400">No runewords found</p>
            <p className="mt-2 text-gray-500 text-sm dark:text-gray-500">
              Try adjusting your filters or search term
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
