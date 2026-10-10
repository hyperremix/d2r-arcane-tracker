import type { Run, RunItem, Session } from 'electron/types/grail';
import { CopyIcon, DownloadIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { translations } from '@/i18n/translations';
import { toLocalIsoDate } from '@/lib/date';
import { getFileName } from '@/lib/path';
import { formatSessionAsCSV, formatSessionAsJSON, formatSessionAsTextSummary } from './formatters';

interface ExportDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'csv' | 'json' | 'text';
type TextDetailLevel = 'basic' | 'detailed';

const exportT = translations.runTracker.exportDialog;

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

const FORMAT_LABEL_KEYS: Record<ExportFormat, string> = {
  csv: exportT.formatCsv,
  json: exportT.formatJson,
  text: exportT.formatText,
};

const DETAIL_LEVEL_LABEL_KEYS: Record<TextDetailLevel, string> = {
  basic: exportT.detailBasic,
  detailed: exportT.detailDetailed,
};

/**
 * Builds translated select options from a value -> label key map. Base UI needs the options on the
 * `Select` itself so the trigger can show the selected option's label instead of its raw value.
 */
function toSelectOptions<T extends string>(
  labelKeys: Record<T, string>,
  t: (key: string) => string,
): SelectOption<T>[] {
  return (Object.keys(labelKeys) as T[]).map((value) => ({ value, label: t(labelKeys[value]) }));
}

interface ExportError {
  message: string;
  detail?: string;
}

/**
 * Extracts a human-readable detail message from an unknown error value.
 * @param {unknown} err - The caught error
 * @returns {string | undefined} The error detail, if any
 */
function getErrorDetail(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return undefined;
}

interface SessionExportData {
  session: Session;
  runs: Run[];
  items: RunItem[];
}

/**
 * Fetches everything needed for an export without touching component state, so callers can
 * commit the result atomically only when every request succeeded.
 * @param {string} sessionId - The session to load
 * @param {boolean} includeItems - Whether run items should be loaded too
 * @returns {Promise<SessionExportData | undefined>} The loaded data, or undefined if the session is missing
 */
async function fetchSessionExportData(
  sessionId: string,
  includeItems: boolean,
): Promise<SessionExportData | undefined> {
  const session = await window.electronAPI?.runTracker.getSessionById(sessionId);
  if (!session) return undefined;

  const runs = await window.electronAPI?.runTracker.getRunsBySession(sessionId);
  const items = includeItems
    ? await window.electronAPI?.runTracker.getSessionItems(sessionId)
    : undefined;

  return { session, runs: runs || [], items: items || [] };
}

/**
 * ExportDialog component for exporting session data in multiple formats
 */
export function ExportDialog({ sessionId, open, onOpenChange }: ExportDialogProps) {
  const { t } = useTranslation();

  // Generate unique IDs
  const formatId = useId();
  const detailLevelId = useId();
  const includeItemsId = useId();

  // State
  const [session, setSession] = useState<Session | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [items, setItems] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ExportError | undefined>(undefined);

  // Export options
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [textDetailLevel, setTextDetailLevel] = useState<TextDetailLevel>('basic');
  const [includeItems, setIncludeItems] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const formatOptions = useMemo(() => toSelectOptions(FORMAT_LABEL_KEYS, t), [t]);
  const detailLevelOptions = useMemo(() => toSelectOptions(DETAIL_LEVEL_LABEL_KEYS, t), [t]);

  // Export content
  const [exportContent, setExportContent] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Incremented for every load so a superseded request cannot overwrite newer state
  const loadRequestRef = useRef(0);

  const clearLoadedData = useCallback(() => {
    setSession(null);
    setRuns([]);
    setItems([]);
    setExportContent('');
  }, []);

  const loadSessionData = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const isStale = () => requestId !== loadRequestRef.current;

    setLoading(true);
    setError(undefined);
    // Drop any previously loaded data so a failed reload cannot export stale content
    clearLoadedData();

    try {
      const data = await fetchSessionExportData(sessionId, includeItems);
      if (isStale()) return;
      if (!data) {
        setError({ message: t(exportT.loadFailed) });
        return;
      }

      // Commit session, runs and items together only after every request succeeded
      setSession(data.session);
      setRuns(data.runs);
      setItems(data.items);
    } catch (err) {
      if (isStale()) return;
      setError({ message: t(exportT.loadFailed), detail: getErrorDetail(err) });
      console.error('[ExportDialog] Error loading session data:', err);
    } finally {
      if (!isStale()) {
        setLoading(false);
      }
    }
  }, [sessionId, includeItems, clearLoadedData, t]);

  const generateExportContent = useCallback(async () => {
    if (!session || runs.length === 0) return;

    try {
      let content = '';

      switch (format) {
        case 'csv':
          content = formatSessionAsCSV(session, runs, items, includeItems);
          break;
        case 'json':
          content = formatSessionAsJSON(session, runs, items, includeItems);
          break;
        case 'text':
          content = formatSessionAsTextSummary(session, runs, items, textDetailLevel, includeItems);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      setExportContent(content);
      // A previous generation failure no longer applies once content is produced again
      setError(undefined);
    } catch (err) {
      console.error('[ExportDialog] Error generating export content:', err);
      setExportContent('');
      setError({ message: t(exportT.generateFailed), detail: getErrorDetail(err) });
    }
  }, [session, runs, items, format, textDetailLevel, includeItems, t]);

  // Load session data when dialog opens. When it closes or loses its session, invalidate any
  // in-flight load and drop loaded data so nothing stale remains exportable.
  useEffect(() => {
    if (open && sessionId) {
      loadSessionData();
      return;
    }

    loadRequestRef.current += 1;
    clearLoadedData();
    setLoading(false);
  }, [open, sessionId, loadSessionData, clearLoadedData]);

  // Generate export content when options change
  useEffect(() => {
    if (session && runs.length > 0) {
      generateExportContent();
    }
  }, [session, runs, generateExportContent]);

  const handleSaveToFile = useCallback(async () => {
    if (!exportContent) return;

    setIsExporting(true);
    setError(undefined);

    try {
      // Show save dialog
      const result = await window.electronAPI?.dialog.showSaveDialog({
        title: t(exportT.title),
        defaultPath: `session-${sessionId.slice(0, 8)}-${toLocalIsoDate()}.${format}`,
        filters: [
          { name: t(exportT.fileFilter, { format: format.toUpperCase() }), extensions: [format] },
          { name: t(translations.common.allFiles), extensions: ['*'] },
        ],
      });

      if (result?.canceled || !result?.filePath) {
        return;
      }

      // Write file
      await window.electronAPI.dialog.writeFile(result.filePath, exportContent);

      toast.success(t(exportT.saveSuccess), {
        description: t(exportT.saveSuccessDescription, {
          filename: getFileName(result.filePath),
        }),
      });
      onOpenChange(false);
    } catch (err) {
      setError({ message: t(exportT.saveFailed), detail: getErrorDetail(err) });
      console.error('[ExportDialog] Error saving file:', err);
    } finally {
      setIsExporting(false);
    }
  }, [exportContent, sessionId, format, onOpenChange, t]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!exportContent) return;

    setIsExporting(true);
    setError(undefined);

    try {
      await navigator.clipboard.writeText(exportContent);
      toast.success(t(exportT.copySuccess));
    } catch (err) {
      setError({ message: t(exportT.copyFailed), detail: getErrorDetail(err) });
      console.error('[ExportDialog] Error copying to clipboard:', err);
    } finally {
      setIsExporting(false);
    }
  }, [exportContent, t]);

  // Changing includeItems changes loadSessionData, which makes the load effect reload the data.
  // The loaded data is cleared in the same batch so the content effect cannot regenerate an
  // export from data loaded with the previous option while the reload is in flight.
  const handleIncludeItemsChange = useCallback(
    (checked: boolean) => {
      clearLoadedData();
      setIncludeItems(checked);
    },
    [clearLoadedData],
  );

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t(exportT.title)}</DialogTitle>
            <DialogDescription>{t(exportT.loadingDescription)}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(exportT.title)}</DialogTitle>
          <DialogDescription>{t(exportT.description, { count: runs.length })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Options */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={formatId}>{t(exportT.format)}</Label>
              <Select
                items={formatOptions}
                value={format}
                onValueChange={(value) => value && setFormat(value as ExportFormat)}
              >
                <SelectTrigger id={formatId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {format === 'text' && (
              <div className="space-y-2">
                <Label htmlFor={detailLevelId}>{t(exportT.detailLevel)}</Label>
                <Select
                  items={detailLevelOptions}
                  value={textDetailLevel}
                  onValueChange={(value) => value && setTextDetailLevel(value as TextDetailLevel)}
                >
                  <SelectTrigger id={detailLevelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {detailLevelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id={includeItemsId}
                checked={includeItems}
                onCheckedChange={handleIncludeItemsChange}
              />
              <Label htmlFor={includeItemsId}>{t(exportT.includeItems)}</Label>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t(exportT.preview)}</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                {showPreview ? t(exportT.hidePreview) : t(exportT.showPreview)}
              </Button>
            </div>
            {showPreview && (
              <Textarea
                value={exportContent}
                readOnly
                className="min-h-[200px] font-mono text-xs"
                placeholder={t(exportT.previewPlaceholder)}
              />
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{error.message}</p>
              {error.detail && <p className="mt-1 text-destructive/80 text-xs">{error.detail}</p>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(translations.common.cancel)}
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            disabled={!exportContent || isExporting}
          >
            <CopyIcon className="h-4 w-4" />
            {t(exportT.copyToClipboard)}
          </Button>
          <Button onClick={handleSaveToFile} disabled={!exportContent || isExporting}>
            <DownloadIcon className="h-4 w-4" />
            {t(exportT.saveToFile)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
