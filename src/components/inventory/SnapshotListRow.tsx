import type { Character, CharacterInventorySnapshot } from 'electron/types/grail';
import { ExternalLink } from 'lucide-react';
import { type DragEvent, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CharacterIcon } from '@/components/grail/StatusIcons';
import {
  formatSourceFileTypeLabel,
  isSharedStashFileType,
} from '@/components/inventory/inventoryItemLabels';
import { Badge } from '@/components/ui/badge';
import { translations } from '@/i18n/translations';
import { itemSubCategoryLabelKeys } from '@/lib/labelKeys';

export interface SnapshotListRowProps {
  snapshot: CharacterInventorySnapshot;
  /** The tracked character of a `.d2s` snapshot, if known; supplies its class and level. */
  character?: Character;
  onOpen: (snapshot: CharacterInventorySnapshot) => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>, snapshot: CharacterInventorySnapshot) => void;
  onDragLeave: (snapshot: CharacterInventorySnapshot) => void;
  onDrop: () => void;
}

/**
 * Finds the tracked character of a character snapshot: by id first, else by name. Shared stashes
 * have no character class, so they never match.
 */
export function findSnapshotCharacter(
  snapshot: CharacterInventorySnapshot,
  characters: Character[],
): Character | undefined {
  if (snapshot.sourceFileType !== 'd2s') {
    return undefined;
  }

  const playable = characters.filter((character) => character.characterClass !== 'shared_stash');
  return (
    (snapshot.characterId
      ? playable.find((character) => character.id === snapshot.characterId)
      : undefined) ?? playable.find((character) => character.name === snapshot.characterName)
  );
}

/**
 * One character or shared stash in the main inventory list: class icon, name, class and level (or
 * the file kind) and the number of matching items. Clicking it opens the file in its own window;
 * dragging an item over it opens that window after a short delay.
 */
export function SnapshotListRow({
  snapshot,
  character,
  onOpen,
  onDragOver,
  onDragLeave,
  onDrop,
}: SnapshotListRowProps) {
  const { t } = useTranslation();
  const nameId = useId();
  const detailsId = useId();
  const countId = useId();

  const iconClass =
    character?.characterClass ??
    (isSharedStashFileType(snapshot.sourceFileType) ? 'shared_stash' : '');
  const details = character
    ? t(translations.inventoryBrowser.snapshotList.classLevel, {
        characterClass: t(itemSubCategoryLabelKeys[character.characterClass]),
        level: character.level,
      })
    : formatSourceFileTypeLabel(snapshot.sourceFileType, t);

  return (
    <button
      type="button"
      aria-labelledby={`${nameId} ${detailsId} ${countId}`}
      className="group flex w-full items-center gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-left hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onClick={() => onOpen(snapshot)}
      onDragOver={(event) => onDragOver(event, snapshot)}
      onDragLeave={() => onDragLeave(snapshot)}
      onDrop={onDrop}
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-primary"
      >
        <CharacterIcon characterClass={iconClass} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={nameId} className="truncate font-medium text-sm">
          {snapshot.characterName}
        </span>
        <span id={detailsId} className="truncate text-muted-foreground text-xs">
          {details}
        </span>
      </span>
      <Badge id={countId} variant="outline" className="shrink-0">
        {t(translations.inventoryBrowser.itemsCount, { count: snapshot.items.length })}
      </Badge>
      <ExternalLink
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100"
      />
    </button>
  );
}
