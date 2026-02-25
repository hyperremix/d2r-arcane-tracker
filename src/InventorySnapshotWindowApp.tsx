import type { InventorySnapshotWindowTarget, VaultSourceFileType } from 'electron/types/grail';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CharacterInventoryBrowser } from '@/components/inventory/CharacterInventoryBrowser';
import { useTheme } from '@/hooks/useTheme';
import { translations } from '@/i18n/translations';
import logoUrl from '/logo.png';

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

function SnapshotTitleBar({ title }: { title: string }): JSX.Element {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<'darwin' | 'win32' | 'linux'>('darwin');

  useEffect(() => {
    if (window.electronAPI) {
      setPlatform(window.electronAPI.platform);
    }
  }, []);

  const isMac = platform === 'darwin';

  return (
    <div
      className="titlebar flex h-12 min-h-12 w-full select-none items-center border-gray-200 border-b px-4 dark:border-gray-800"
      style={
        {
          WebkitAppRegion: 'drag',
          appRegion: 'drag',
        } as React.CSSProperties
      }
    >
      {isMac ? <div className="w-20" /> : <div className="w-8" />}
      <div className="flex flex-1 items-center justify-center gap-2 px-2">
        <img src={logoUrl} alt={t(translations.app.title)} className="h-5 w-5" />
        <span className="truncate font-semibold text-sm tracking-wide">{title}</span>
      </div>
      {isMac ? <div className="w-20" /> : <div className="w-36" />}
    </div>
  );
}

export default function InventorySnapshotWindowApp(): JSX.Element {
  const { t } = useTranslation();

  useTheme();
  const locationHash = window.location.hash;

  const snapshotTarget = useMemo(() => parseSnapshotTargetFromHash(locationHash), [locationHash]);
  const snapshotWindowTitle =
    snapshotTarget?.characterName ?? t(translations.titleBar.inventoryBrowser);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <SnapshotTitleBar title={snapshotWindowTitle} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!snapshotTarget ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
            {t(translations.inventoryBrowser.snapshotWindow.invalidTarget)}
          </div>
        ) : (
          <CharacterInventoryBrowser mode="snapshot" snapshotTarget={snapshotTarget} />
        )}
      </div>
    </div>
  );
}
