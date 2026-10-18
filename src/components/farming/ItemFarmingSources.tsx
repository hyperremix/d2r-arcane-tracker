import type { Character, FarmingItemSource, FarmingItemSources, Item } from 'electron/types/grail';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { translations } from '@/i18n/translations';
import {
  FARMING_INPUT_DEBOUNCE_MS,
  getDefaultFarmingCharacterLevel,
  isFarmableItem,
} from '@/lib/farming';
import { useFarmingSessionStore } from '@/stores/farmingSessionStore';
import { formatDropRateRange, formatLevelRange } from './dropRateText';
import { FarmingInputs } from './FarmingInputs';

/** Sources shown before "Show all". */
const COLLAPSED_SOURCE_COUNT = 8;

/**
 * Loads where an item drops for the current /players, magic find and character level, once they
 * have stopped changing for a moment.
 */
function useItemSources(itemId: string, characters: Character[]) {
  const storedPlayers = useFarmingSessionStore((state) => state.players);
  const storedMagicFind = useFarmingSessionStore((state) => state.magicFind);
  const storedCharacterLevel = useFarmingSessionStore((state) => state.characterLevel);
  const players = useDebouncedValue(storedPlayers, FARMING_INPUT_DEBOUNCE_MS);
  const magicFind = useDebouncedValue(storedMagicFind, FARMING_INPUT_DEBOUNCE_MS);
  const characterLevel = useDebouncedValue(
    storedCharacterLevel ?? getDefaultFarmingCharacterLevel(characters),
    FARMING_INPUT_DEBOUNCE_MS,
  );
  const [result, setResult] = useState<FarmingItemSources | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.farming
      .getItemSources({ itemId, players, magicFind, characterLevel })
      .then((sources) => {
        if (cancelled) return;
        setResult(sources);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Failed to load the drop sources:', error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, players, magicFind, characterLevel]);

  return { result, failed };
}

function SourceRow({ source }: { source: FarmingItemSource }) {
  const { t, i18n } = useTranslation();
  return (
    <TableRow>
      <TableCell className="whitespace-normal align-top">
        <div className="font-medium">
          {source.name}
          {source.terrorZoneId && (
            <Badge variant="outline" className="ml-2">
              {t(translations.farming.itemSources.terrorized)}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground text-xs">
          {[
            source.areaName,
            t(translations.farming.difficulties[source.difficulty]),
            t(translations.farming.monsterKinds[source.monsterKind]),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap align-top">
        {formatLevelRange(t, source.monsterLevel)}
      </TableCell>
      <TableCell className="whitespace-nowrap align-top">
        {formatDropRateRange(t, i18n.language, source.dropsPerKill)}
      </TableCell>
    </TableRow>
  );
}

function SourcesTable({ sources }: { sources: FarmingItemSource[] }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? sources : sources.slice(0, COLLAPSED_SOURCE_COUNT);
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t(translations.farming.itemSources.source)}</TableHead>
            <TableHead>{t(translations.farming.monsterLevel)}</TableHead>
            <TableHead>{t(translations.farming.itemSources.dropRate)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((source) => (
            <SourceRow key={`${source.locationId}|${source.monsterKind}`} source={source} />
          ))}
        </TableBody>
      </Table>
      {sources.length > COLLAPSED_SOURCE_COUNT && (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll
            ? t(translations.farming.itemSources.showFewer)
            : t(translations.farming.itemSources.showAll, { count: sources.length })}
        </Button>
      )}
    </div>
  );
}

function SourcesBody({ itemId, characters }: { itemId: string; characters: Character[] }) {
  const { t } = useTranslation();
  const { result, failed } = useItemSources(itemId, characters);

  if (failed)
    return <p className="text-destructive text-sm">{t(translations.farming.loadFailed)}</p>;
  if (!result) {
    return (
      <p className="text-muted-foreground text-sm">{t(translations.farming.itemSources.loading)}</p>
    );
  }
  if (result.status === 'unavailable') {
    return (
      <p className="text-muted-foreground text-sm">
        {t(translations.farming.itemSources.unavailable)}{' '}
        <Link to="/farming" className="underline underline-offset-2">
          {t(translations.farming.itemSources.openAdvisor)}
        </Link>
      </p>
    );
  }
  if (!result.known || result.sources.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t(
          result.known
            ? translations.farming.itemSources.noSources
            : translations.farming.itemSources.unknown,
        )}
      </p>
    );
  }
  return (
    <>
      <DropRateInputs />
      <SourcesTable sources={result.sources} />
      <p className="text-muted-foreground text-xs">{t(translations.farming.itemSources.note)}</p>
    </>
  );
}

/** The /players and magic find inputs the drop rates are calculated for. */
function DropRateInputs() {
  const players = useFarmingSessionStore((state) => state.players);
  const magicFind = useFarmingSessionStore((state) => state.magicFind);
  const setPlayers = useFarmingSessionStore((state) => state.setPlayers);
  const setMagicFind = useFarmingSessionStore((state) => state.setMagicFind);
  return (
    <FarmingInputs
      players={{ value: players, onChange: setPlayers }}
      magicFind={{ value: magicFind, onChange: setMagicFind }}
    />
  );
}

/**
 * The "Where to farm" section of the item details: the monsters that drop the item, with the
 * expected drops per kill for the /players and magic find set here. Hidden for runewords.
 */
export function ItemFarmingSources({ item, characters }: { item: Item; characters: Character[] }) {
  const { t } = useTranslation();
  const headingId = useId();

  if (!isFarmableItem(item)) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-3 border-t pt-4">
      <h3 id={headingId} className="font-display font-semibold leading-none tracking-wide">
        {t(translations.farming.itemSources.title)}
      </h3>
      <SourcesBody itemId={item.id} characters={characters} />
    </section>
  );
}
