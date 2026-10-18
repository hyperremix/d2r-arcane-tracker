import type {
  GrailExportFormat,
  GrailImportPreview,
  GrailImportUnmatched,
} from 'electron/types/grailTransfer';
import { ArrowLeftRight, Download, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';
import { toLocalIsoDate } from '@/lib/date';
import { getFileName } from '@/lib/path';
import { useGrailStore } from '@/stores/grailStore';

const messages = translations.settings.grailTransfer;

/** Error messages of the main process mapped to the message shown for them. */
const IMPORT_ERROR_MESSAGES: Record<string, string> = {
  IMPORT_FILE_TOO_LARGE: messages.errors.tooLarge,
  IMPORT_FILE_UNREADABLE: messages.errors.unreadable,
  IMPORT_FORMAT_UNSUPPORTED: messages.errors.unsupported,
  IMPORT_TOO_MANY_ENTRIES: messages.errors.tooManyEntries,
  IMPORT_EXPIRED: messages.errors.expired,
  IMPORT_UNKNOWN_CHARACTER: messages.errors.unknownCharacter,
};

function getImportErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = Object.keys(IMPORT_ERROR_MESSAGES).find((errorCode) => message.includes(errorCode));
  return code ? IMPORT_ERROR_MESSAGES[code] : messages.errors.generic;
}

/**
 * Settings card that exports the grail progress to JSON or CSV and imports finds from a file after
 * a preview of what changes.
 * @returns {JSX.Element} A settings card with the export and import controls
 */
export function GrailTransferCard() {
  const { t } = useTranslation();
  const characters = useGrailStore((state) => state.characters);
  const characterSelectId = useId();
  const [exportingFormat, setExportingFormat] = useState<GrailExportFormat | undefined>(undefined);
  const [isReading, setIsReading] = useState(false);
  const [preview, setPreview] = useState<GrailImportPreview | undefined>(undefined);
  const [characterId, setCharacterId] = useState<string | undefined>(undefined);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | undefined>(undefined);

  const handleExport = async (format: GrailExportFormat) => {
    try {
      setExportingFormat(format);
      const result = await window.electronAPI?.dialog.showSaveDialog({
        title: t(messages.exportDialogTitle),
        defaultPath: `holy-grail-progress-${toLocalIsoDate()}.${format}`,
        filters: [
          {
            name: t(format === 'json' ? messages.jsonFilter : messages.csvFilter),
            extensions: [format],
          },
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      });
      if (result?.canceled || !result?.filePath) {
        return;
      }

      const content = await window.electronAPI?.grail.exportProgress(format);
      await window.electronAPI?.dialog.writeFile(result.filePath, content ?? '');
      toast.success(t(messages.exportSuccess), {
        description: t(messages.exportSuccessDescription, {
          filename: getFileName(result.filePath),
        }),
      });
    } catch (error) {
      console.error('Failed to export grail progress:', error);
      toast.error(t(messages.exportFailed));
    } finally {
      setExportingFormat(undefined);
    }
  };

  const handleChooseImportFile = async () => {
    try {
      setIsReading(true);
      setImportError(undefined);
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: t(messages.importDialogTitle),
        filters: [{ name: t(messages.importFilter), extensions: ['json', 'csv'] }],
        properties: ['openFile'],
      });
      const filePath = result?.filePaths?.[0];
      if (result?.canceled || !filePath) {
        return;
      }

      const loaded = await window.electronAPI?.grail.previewImport(filePath);
      if (loaded) {
        setCharacterId((current) =>
          characters.some((character) => character.id === current) ? current : characters[0]?.id,
        );
        setPreview(loaded);
      }
    } catch (error) {
      console.error('Failed to read grail import file:', error);
      setImportError(t(getImportErrorKey(error)));
    } finally {
      setIsReading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) {
      return;
    }
    try {
      setIsImporting(true);
      const result = await window.electronAPI?.grail.applyImport(preview.importId, characterId);
      toast.success(t(messages.importSuccess), {
        description: t(messages.importSuccessDescription, {
          added: result?.added ?? 0,
          earlierDates: result?.earlierDates ?? 0,
        }),
      });
      setPreview(undefined);
    } catch (error) {
      console.error('Failed to import grail progress:', error);
      toast.error(t(getImportErrorKey(error)));
    } finally {
      setIsImporting(false);
    }
  };

  const formatUnmatched = ({ name, version }: GrailImportUnmatched) =>
    version
      ? t(messages.unmatchedVersion, {
          name,
          version: t(version === 'ethereal' ? messages.versionEthereal : messages.versionNormal),
        })
      : name;

  const hasChanges =
    preview !== undefined && (preview.newCount > 0 || preview.earlierDateCount > 0);
  const needsCharacter = preview !== undefined && preview.newCount > 0;
  const canImport = hasChanges && !isImporting && (!needsCharacter || characterId !== undefined);
  const characterOptions = characters.map((character) => ({
    value: character.id,
    label: character.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
          {t(messages.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            <h3 className="font-medium text-sm">{t(messages.export)}</h3>
          </div>
          <p className="text-muted-foreground text-xs">{t(messages.exportDescription)}</p>
          <div className="flex flex-wrap gap-2">
            {(['json', 'csv'] as const).map((format) => (
              <Button
                key={format}
                size="sm"
                variant={format === 'json' ? 'default' : 'outline'}
                className="gap-2"
                disabled={exportingFormat !== undefined}
                onClick={() => void handleExport(format)}
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                {exportingFormat === format
                  ? t(messages.exporting)
                  : t(format === 'json' ? messages.exportJson : messages.exportCsv)}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" aria-hidden="true" />
            <h3 className="font-medium text-sm">{t(messages.import)}</h3>
          </div>
          <p className="text-muted-foreground text-xs">{t(messages.importDescription)}</p>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isReading}
            onClick={() => void handleChooseImportFile()}
          >
            <Upload className="h-3 w-3" aria-hidden="true" />
            {isReading ? t(messages.reading) : t(messages.importButton)}
          </Button>
          {importError && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
              <AlertDescription className="text-xs">{importError}</AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialog
          open={preview !== undefined}
          onOpenChange={(open) => {
            if (!open && !isImporting) {
              setPreview(undefined);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(messages.importDialogTitle)}</AlertDialogTitle>
              <AlertDialogDescription render={<div />}>
                {preview && (
                  <div className="space-y-3 text-sm">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      <dt className="font-medium">{t(messages.fileLabel)}</dt>
                      <dd className="break-all font-mono text-xs">{preview.fileName}</dd>
                      <dt className="font-medium">{t(messages.sourceLabel)}</dt>
                      <dd>{t(messages.source[preview.source])}</dd>
                    </dl>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>{t(messages.newCount, { count: preview.newCount })}</li>
                      <li>{t(messages.existingCount, { count: preview.existingCount })}</li>
                      {preview.earlierDateCount > 0 && (
                        <li>{t(messages.earlierDateCount, { count: preview.earlierDateCount })}</li>
                      )}
                    </ul>
                    {preview.unmatched.length > 0 && (
                      <div className="space-y-1">
                        <p>{t(messages.unmatchedCount, { count: preview.unmatched.length })}</p>
                        <ul className="max-h-32 list-disc overflow-y-auto pl-5 text-xs">
                          {preview.unmatched.map((entry) => (
                            <li key={`${entry.name}:${entry.version ?? ''}`}>
                              {formatUnmatched(entry)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!hasChanges && <p className="font-medium">{t(messages.nothingToImport)}</p>}
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {needsCharacter &&
              (characters.length > 0 ? (
                <div className="grid gap-2">
                  <Label htmlFor={characterSelectId}>{t(messages.characterLabel)}</Label>
                  <Select
                    items={characterOptions}
                    value={characterId ?? null}
                    onValueChange={(next) => next && setCharacterId(next as string)}
                  >
                    <SelectTrigger id={characterSelectId} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {characterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    {t(messages.characterDescription)}
                  </p>
                </div>
              ) : (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
                  <AlertDescription className="text-xs">
                    {t(messages.noCharacters)}
                  </AlertDescription>
                </Alert>
              ))}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isImporting}>
                {t(translations.common.cancel)}
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleImport()} disabled={!canImport}>
                {isImporting ? t(messages.importing) : t(messages.confirm)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
