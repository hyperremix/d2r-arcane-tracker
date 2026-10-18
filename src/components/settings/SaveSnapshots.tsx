import type { SaveFileSnapshot, SaveFileSnapshotGroup } from 'electron/types/saveFileSnapshots';
import {
  DEFAULT_SNAPSHOTS_PER_FILE,
  MAX_SNAPSHOTS_PER_FILE,
  MIN_SNAPSHOTS_PER_FILE,
} from 'electron/types/saveFileSnapshots';
import { History, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { translations } from '@/i18n/translations';
import { formatLocalizedDate, getActiveLocale } from '@/lib/date';
import { useGrailStore } from '@/stores/grailStore';

const messages = translations.settings.saveSnapshots;

/** Formats when a copy was taken, with seconds: copies of a file can be minutes apart. */
function formatSnapshotTime(date: Date): string {
  return formatLocalizedDate(date, undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

/** Formats a file size in kilobytes in the active locale. */
function formatSize(sizeBytes: number): string {
  return new Intl.NumberFormat(getActiveLocale(), {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: 1,
  }).format(sizeBytes / 1024);
}

/** Parses the snapshots-per-file input; undefined when it isn't an integer in the accepted range. */
function parseSnapshotsPerFile(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) &&
    parsed >= MIN_SNAPSHOTS_PER_FILE &&
    parsed <= MAX_SNAPSHOTS_PER_FILE
    ? parsed
    : undefined;
}

interface PendingRestore {
  fileName: string;
  snapshot: SaveFileSnapshot;
}

/**
 * Settings card for the save file snapshots: whether they are kept and how many per file, and the
 * timeline of every save file's copies with a restore action.
 * @returns {JSX.Element} A settings card with the snapshot settings and timeline
 */
export function SaveSnapshotsCard() {
  const { t } = useTranslation();
  const { settings, setSettings } = useGrailStore(
    useShallow((state) => ({ settings: state.settings, setSettings: state.setSettings })),
  );
  const enabledLabelId = useId();
  const enabledDescriptionId = useId();
  const perFileInputId = useId();
  const perFileDescriptionId = useId();
  const fileSelectId = useId();

  const storedPerFile = settings.saveSnapshotsPerFile ?? DEFAULT_SNAPSHOTS_PER_FILE;
  const [perFileDraft, setPerFileDraft] = useState(String(storedPerFile));
  const [groups, setGroups] = useState<SaveFileSnapshotGroup[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | undefined>(undefined);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    setPerFileDraft(String(storedPerFile));
  }, [storedPerFile]);

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = (await window.electronAPI?.saveSnapshots.list()) ?? [];
      setGroups(loaded);
      setLoadFailed(false);
      setSelectedFileName((current) =>
        loaded.some((group) => group.fileName === current) ? current : loaded[0]?.fileName,
      );
    } catch (error) {
      console.error('Failed to load save file snapshots:', error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const commitPerFile = () => {
    const parsed = parseSnapshotsPerFile(perFileDraft);
    if (parsed === undefined) {
      setPerFileDraft(String(storedPerFile));
      return;
    }
    if (parsed !== storedPerFile) {
      void setSettings({ saveSnapshotsPerFile: parsed });
    }
  };

  const handleRestore = async () => {
    if (!pendingRestore) {
      return;
    }
    const { fileName, snapshot } = pendingRestore;
    const time = formatSnapshotTime(snapshot.createdAt);
    setIsRestoring(true);
    try {
      await window.electronAPI?.saveSnapshots.restore(snapshot.id);
      toast.success(t(messages.restoreSuccess), {
        description: t(messages.restoreSuccessDescription, { fileName, time }),
      });
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to restore save file:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        t(message.includes('GAME_RUNNING') ? messages.gameRunning : messages.restoreFailed),
      );
    } finally {
      setIsRestoring(false);
      setPendingRestore(undefined);
    }
  };

  const selectedGroup = groups.find((group) => group.fileName === selectedFileName);
  const fileOptions = groups.map((group) => ({
    value: group.fileName,
    label: t(group.fileExists ? messages.fileOption : messages.fileOptionMissing, {
      fileName: group.fileName,
      count: group.snapshots.length,
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" aria-hidden="true" />
          {t(messages.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-xs">{t(messages.description)}</p>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <h4 id={enabledLabelId} className="font-medium text-sm">
              {t(messages.enabled)}
            </h4>
            <p id={enabledDescriptionId} className="text-muted-foreground text-xs">
              {t(messages.enabledDescription)}
            </p>
          </div>
          <Switch
            checked={settings.saveSnapshotsEnabled ?? true}
            onCheckedChange={(checked) => void setSettings({ saveSnapshotsEnabled: checked })}
            aria-labelledby={enabledLabelId}
            aria-describedby={enabledDescriptionId}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={perFileInputId}>{t(messages.perFile)}</Label>
          <Input
            id={perFileInputId}
            type="number"
            inputMode="numeric"
            min={MIN_SNAPSHOTS_PER_FILE}
            max={MAX_SNAPSHOTS_PER_FILE}
            step={1}
            className="w-32"
            value={perFileDraft}
            aria-describedby={perFileDescriptionId}
            onChange={(event) => setPerFileDraft(event.target.value)}
            onBlur={commitPerFile}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitPerFile();
              }
            }}
          />
          <p id={perFileDescriptionId} className="text-muted-foreground text-xs">
            {t(messages.perFileDescription, {
              min: MIN_SNAPSHOTS_PER_FILE,
              max: MAX_SNAPSHOTS_PER_FILE,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {groups.length > 0 && (
            <div className="grid min-w-64 flex-1 gap-2">
              <Label htmlFor={fileSelectId}>{t(messages.fileLabel)}</Label>
              <Select
                items={fileOptions}
                value={selectedFileName ?? null}
                onValueChange={(next) => next && setSelectedFileName(next as string)}
              >
                <SelectTrigger id={fileSelectId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fileOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void loadSnapshots()}
            disabled={isLoading}
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {t(messages.refresh)}
          </Button>
        </div>

        {loadFailed && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
            <AlertDescription className="text-xs">{t(messages.loadFailed)}</AlertDescription>
          </Alert>
        )}

        {!loadFailed && !isLoading && groups.length === 0 && (
          <p className="text-muted-foreground text-sm">{t(messages.empty)}</p>
        )}

        {selectedGroup && (
          <Table aria-label={t(messages.timelineLabel, { fileName: selectedGroup.fileName })}>
            <TableHeader>
              <TableRow>
                <TableHead>{t(messages.columnTime)}</TableHead>
                <TableHead>{t(messages.columnType)}</TableHead>
                <TableHead>{t(messages.columnSize)}</TableHead>
                <TableHead>{t(messages.columnLevel)}</TableHead>
                <TableHead className="text-right">{t(messages.columnAction)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedGroup.snapshots.map((snapshot) => {
                const time = formatSnapshotTime(snapshot.createdAt);
                return (
                  <TableRow key={snapshot.id}>
                    <TableCell>{time}</TableCell>
                    <TableCell>
                      {t(snapshot.kind === 'backup' ? messages.kindBackup : messages.kindSnapshot)}
                    </TableCell>
                    <TableCell>{formatSize(snapshot.sizeBytes)}</TableCell>
                    <TableCell>{snapshot.characterLevel ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        aria-label={t(messages.restoreLabel, {
                          fileName: selectedGroup.fileName,
                          time,
                        })}
                        onClick={() =>
                          setPendingRestore({ fileName: selectedGroup.fileName, snapshot })
                        }
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        {t(messages.restore)}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <AlertDialog
          open={pendingRestore !== undefined}
          onOpenChange={(open) => {
            if (!open && !isRestoring) {
              setPendingRestore(undefined);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(messages.confirmTitle)}</AlertDialogTitle>
              <AlertDialogDescription render={<div />}>
                {pendingRestore && (
                  <span className="mb-2 block">
                    {t(messages.confirmDescription, {
                      fileName: pendingRestore.fileName,
                      time: formatSnapshotTime(pendingRestore.snapshot.createdAt),
                    })}
                  </span>
                )}
                <span className="mb-2 block text-sm">{t(messages.confirmBackupNote)}</span>
                <span className="block text-sm">{t(messages.confirmGameNote)}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRestoring}>
                {t(translations.common.cancel)}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestore}
                disabled={isRestoring}
                variant="destructive"
              >
                {isRestoring ? t(messages.restoring) : t(messages.restore)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
