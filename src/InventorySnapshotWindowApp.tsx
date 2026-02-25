import type { InventorySnapshotWindowTarget, VaultSourceFileType } from 'electron/types/grail';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CharacterInventoryBrowser } from '@/components/inventory/CharacterInventoryBrowser';
import { useTheme } from '@/hooks/useTheme';
import { translations } from '@/i18n/translations';

const VALID_SOURCE_FILE_TYPES = new Set<VaultSourceFileType>(['d2s', 'sss', 'd2x', 'd2i']);

function parseSnapshotTargetFromHash(hash: string): InventorySnapshotWindowTarget | undefined {
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) {
    return undefined;
  }

  const query = hash.slice(queryStart + 1);
  const params = new URLSearchParams(query);

  const sourceFilePath = params.get('sourceFilePath')?.trim();
  const sourceFileType = params.get('sourceFileType')?.trim() as VaultSourceFileType | undefined;
  const characterName = params.get('characterName')?.trim();

  if (!sourceFilePath || !characterName || !sourceFileType) {
    return undefined;
  }

  if (!VALID_SOURCE_FILE_TYPES.has(sourceFileType)) {
    return undefined;
  }

  return {
    sourceFilePath,
    sourceFileType,
    characterName,
  };
}

export default function InventorySnapshotWindowApp(): JSX.Element {
  const { t } = useTranslation();

  useTheme();
  const locationHash = window.location.hash;

  const snapshotTarget = useMemo(() => parseSnapshotTargetFromHash(locationHash), [locationHash]);

  if (!snapshotTarget) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
        {t(translations.inventoryBrowser.snapshotWindow.invalidTarget)}
      </div>
    );
  }

  return <CharacterInventoryBrowser mode="snapshot" snapshotTarget={snapshotTarget} />;
}
