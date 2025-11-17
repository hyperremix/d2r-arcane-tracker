import type { Run, RunItem, Session } from 'electron/types/grail';
import { CopyIcon, DownloadIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
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
import { formatDuration } from '@/lib/utils';

interface ExportDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'csv' | 'json' | 'text';
type TextDetailLevel = 'basic' | 'detailed';

/**
 * ExportDialog component for exporting session data in multiple formats
 */
export function ExportDialog({ sessionId, open, onOpenChange }: ExportDialogProps) {
  // Generate unique IDs
  const formatId = useId();
  const detailLevelId = useId();
  const includeItemsId = useId();

  // State
  const [session, setSession] = useState<Session | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [items, setItems] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export options
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [textDetailLevel, setTextDetailLevel] = useState<TextDetailLevel>('basic');
  const [includeItems, setIncludeItems] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Export content
  const [exportContent, setExportContent] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const loadSessionData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load session
      const sessionData = await window.electronAPI?.runTracker.getSessionById(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }
      setSession(sessionData);

      // Load runs
      const runsData = await window.electronAPI?.runTracker.getRunsBySession(sessionId);
      setRuns(runsData || []);

      // Load items if requested
      if (includeItems) {
        const itemsData = await window.electronAPI?.runTracker.getSessionItems(sessionId);
        setItems(itemsData || []);
      } else {
        setItems([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session data';
      setError(errorMessage);
      console.error('[ExportDialog] Error loading session data:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, includeItems]);

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
    } catch (err) {
      console.error('[ExportDialog] Error generating export content:', err);
      setError('Failed to generate export content');
    }
  }, [session, runs, items, format, textDetailLevel, includeItems]);

  // Load session data when dialog opens
  useEffect(() => {
    if (open && sessionId) {
      loadSessionData();
    }
  }, [open, sessionId, loadSessionData]);

  // Generate export content when options change
  useEffect(() => {
    if (session && runs.length > 0) {
      generateExportContent();
    }
  }, [session, runs, generateExportContent]);

  const handleSaveToFile = useCallback(async () => {
    if (!exportContent) return;

    setIsExporting(true);
    setError(null);

    try {
      // Show save dialog
      const result = await window.electronAPI?.dialog.showSaveDialog({
        title: 'Export Session Data',
        defaultPath: `session-${sessionId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.${format}`,
        filters: [
          { name: `${format.toUpperCase()} Files`, extensions: [format] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result?.canceled || !result?.filePath) {
        return;
      }

      // Write file
      await window.electronAPI?.dialog.writeFile(result.filePath, exportContent);

      console.log('Export saved successfully to:', result.filePath);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save file';
      setError(errorMessage);
      console.error('[ExportDialog] Error saving file:', err);
    } finally {
      setIsExporting(false);
    }
  }, [exportContent, sessionId, format]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!exportContent) return;

    setIsExporting(true);
    setError(null);

    try {
      await navigator.clipboard.writeText(exportContent);
      console.log('Export copied to clipboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy to clipboard';
      setError(errorMessage);
      console.error('[ExportDialog] Error copying to clipboard:', err);
    } finally {
      setIsExporting(false);
    }
  }, [exportContent]);

  const handleIncludeItemsChange = useCallback(
    (checked: boolean) => {
      setIncludeItems(checked);
      if (checked) {
        // Reload data with items
        loadSessionData();
      } else {
        setItems([]);
      }
    },
    [loadSessionData],
  );

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Session Data</DialogTitle>
            <DialogDescription>Loading session data...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Session Data</DialogTitle>
            <DialogDescription>Error loading session data</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Session Data</DialogTitle>
          <DialogDescription>
            Export session data in your preferred format. Session has {runs.length} runs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Options */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={formatId}>Export Format</Label>
              <Select value={format} onValueChange={(value: ExportFormat) => setFormat(value)}>
                <SelectTrigger id={formatId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                  <SelectItem value="json">JSON (Structured Data)</SelectItem>
                  <SelectItem value="text">Text Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {format === 'text' && (
              <div className="space-y-2">
                <Label htmlFor={detailLevelId}>Detail Level</Label>
                <Select
                  value={textDetailLevel}
                  onValueChange={(value: TextDetailLevel) => setTextDetailLevel(value)}
                >
                  <SelectTrigger id={detailLevelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic Summary</SelectItem>
                    <SelectItem value="detailed">Detailed Summary</SelectItem>
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
              <Label htmlFor={includeItemsId}>Include items found during runs</Label>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
            </div>
            {showPreview && (
              <Textarea
                value={exportContent}
                readOnly
                className="min-h-[200px] font-mono text-xs"
                placeholder="Export content will appear here..."
              />
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            disabled={!exportContent || isExporting}
          >
            <CopyIcon className="h-4 w-4" />
            Copy to Clipboard
          </Button>
          <Button onClick={handleSaveToFile} disabled={!exportContent || isExporting}>
            <DownloadIcon className="h-4 w-4" />
            Save to File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline export functions to avoid dynamic import issues in tests
function formatSessionAsCSV(
  session: Session,
  runs: Run[],
  items?: RunItem[],
  includeItems: boolean = false,
): string {
  const rows: string[][] = [];

  // Session header
  rows.push(['Session Information']);
  rows.push(['Session ID', session.id]);
  rows.push(['Start Time', session.startTime.toISOString()]);
  rows.push(['End Time', session.endTime?.toISOString() || 'N/A']);
  rows.push(['Total Run Time (ms)', session.totalRunTime.toString()]);
  rows.push(['Total Session Time (ms)', session.totalSessionTime.toString()]);
  rows.push(['Run Count', session.runCount.toString()]);
  rows.push(['Archived', session.archived ? 'Yes' : 'No']);
  rows.push(['Notes', session.notes || '']);
  rows.push(['']); // Empty row separator

  // Runs header
  rows.push(['Runs']);
  rows.push(['Run ID', 'Run Number', 'Start Time', 'End Time', 'Duration (ms)']);

  // Runs data
  runs.forEach((run) => {
    rows.push([
      run.id,
      run.runNumber.toString(),
      run.startTime.toISOString(),
      run.endTime?.toISOString() || 'N/A',
      run.duration?.toString() || 'N/A',
    ]);
  });

  // Items section (if requested)
  if (includeItems && items && items.length > 0) {
    rows.push(['']); // Empty row separator
    rows.push(['Items Found']);
    rows.push(['Item ID', 'Run ID', 'Grail Progress ID', 'Name', 'Found Time']);

    items.forEach((item) => {
      rows.push([
        item.id,
        item.runId,
        item.grailProgressId || '',
        item.name || '',
        item.foundTime.toISOString(),
      ]);
    });
  }

  // Convert to CSV string with proper escaping
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(','),
    )
    .join('\n');
}

function formatSessionAsJSON(
  session: Session,
  runs: Run[],
  items?: RunItem[],
  includeItems: boolean = false,
): string {
  const exportData = {
    session: {
      id: session.id,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString(),
      totalRunTime: session.totalRunTime,
      totalSessionTime: session.totalSessionTime,
      runCount: session.runCount,
      archived: session.archived,
      notes: session.notes,
      created: session.created.toISOString(),
      lastUpdated: session.lastUpdated.toISOString(),
    },
    runs: runs.map((run) => ({
      id: run.id,
      sessionId: run.sessionId,
      characterId: run.characterId,
      runNumber: run.runNumber,
      startTime: run.startTime.toISOString(),
      endTime: run.endTime?.toISOString(),
      duration: run.duration,
      created: run.created.toISOString(),
      lastUpdated: run.lastUpdated.toISOString(),
    })),
    ...(includeItems && items
      ? {
          items: items.map((item) => ({
            id: item.id,
            runId: item.runId,
            grailProgressId: item.grailProgressId,
            name: item.name,
            foundTime: item.foundTime.toISOString(),
            created: item.created.toISOString(),
          })),
        }
      : {}),
  };

  return JSON.stringify(exportData, null, 2);
}

function formatSessionAsTextSummary(
  session: Session,
  runs: Run[],
  items?: RunItem[],
  detailLevel: 'basic' | 'detailed' = 'basic',
  includeItems: boolean = false,
): string {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(60));
  lines.push('RUN TRACKER SESSION EXPORT');
  lines.push('='.repeat(60));
  lines.push('');

  // Session information
  lines.push('SESSION INFORMATION');
  lines.push('-'.repeat(20));
  lines.push(`Session ID: ${session.id}`);
  lines.push(`Start Time: ${session.startTime.toLocaleString()}`);
  lines.push(`End Time: ${session.endTime?.toLocaleString() || 'N/A'}`);
  lines.push(`Total Run Time: ${formatDuration(session.totalRunTime)}`);
  lines.push(`Total Session Time: ${formatDuration(session.totalSessionTime)}`);
  lines.push(`Run Count: ${session.runCount}`);
  lines.push(`Archived: ${session.archived ? 'Yes' : 'No'}`);
  if (session.notes) {
    lines.push(`Notes: ${session.notes}`);
  }
  lines.push('');

  // Summary statistics
  const completedRuns = runs.filter((run) => run.endTime);
  const averageRunDuration =
    completedRuns.length > 0
      ? completedRuns.reduce((sum, run) => sum + (run.duration || 0), 0) / completedRuns.length
      : 0;

  lines.push('SUMMARY STATISTICS');
  lines.push('-'.repeat(20));
  lines.push(`Total Runs: ${runs.length}`);
  lines.push(`Completed Runs: ${completedRuns.length}`);
  lines.push(`Average Run Duration: ${formatDuration(averageRunDuration)}`);

  if (includeItems && items) {
    lines.push(`Items Found: ${items.length}`);
  }
  lines.push('');

  // Detailed run information (if requested)
  if (detailLevel === 'detailed') {
    lines.push('DETAILED RUN INFORMATION');
    lines.push('-'.repeat(30));

    runs.forEach((run, index) => {
      lines.push(`${index + 1}. Run #${run.runNumber}`);
      lines.push(`   ID: ${run.id}`);
      lines.push(`   Start: ${run.startTime.toLocaleString()}`);
      lines.push(`   End: ${run.endTime?.toLocaleString() || 'N/A'}`);
      lines.push(`   Duration: ${run.duration ? formatDuration(run.duration) : 'N/A'}`);

      // Show items for this run (if requested)
      if (includeItems && items) {
        const runItems = items.filter((item) => item.runId === run.id);
        if (runItems.length > 0) {
          lines.push(`   Items Found: ${runItems.length}`);
          runItems.forEach((item) => {
            lines.push(`     - Item found at ${item.foundTime.toLocaleString()}`);
          });
        }
      }
      lines.push('');
    });
  }

  // Footer
  lines.push('='.repeat(60));
  lines.push(`Export generated on ${new Date().toLocaleString()}`);
  lines.push('='.repeat(60));

  return lines.join('\n');
}
