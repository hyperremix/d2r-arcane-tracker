import type { InventorySnapshotWindowTarget, VaultSourceFileType } from 'electron/types/grail';
import { VALID_SOURCE_FILE_TYPES } from 'electron/utils/vaultState';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CharacterInventoryBrowser } from '@/components/inventory/CharacterInventoryBrowser';
import { TitleBarFrame } from '@/components/TitleBarFrame';
import { useWindowBootstrap } from '@/hooks/useWindowBootstrap';
import { translations } from '@/i18n/translations';
import logoUrl from '/logo.png';

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

  return (
    <TitleBarFrame centered>
      <div className="flex flex-1 items-center justify-center gap-2 px-2">
        <img src={logoUrl} alt={t(translations.app.title)} className="h-5 w-5" />
        <span className="truncate font-semibold text-sm tracking-wide">{title}</span>
      </div>
    </TitleBarFrame>
  );
}

export default function InventorySnapshotWindowApp(): JSX.Element {
  const { t } = useTranslation();

  // Load the grail data (also used for the item icons), follow settings saved in the main window
  // and apply theme and language based on user settings
  useWindowBootstrap({ followSettingsUpdates: true });
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
