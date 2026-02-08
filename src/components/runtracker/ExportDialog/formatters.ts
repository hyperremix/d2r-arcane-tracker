import type { Run, RunItem, Session } from 'electron/types/grail';
import { formatDate, formatDuration } from '@/lib/utils';

export function formatSessionAsCSV(
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

export function formatSessionAsJSON(
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

export function formatSessionAsTextSummary(
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
  lines.push(`Start Time: ${formatDate(session.startTime)}`);
  lines.push(`End Time: ${session.endTime ? formatDate(session.endTime) : 'N/A'}`);
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
      lines.push(`   Start: ${formatDate(run.startTime)}`);
      lines.push(`   End: ${run.endTime ? formatDate(run.endTime) : 'N/A'}`);
      lines.push(`   Duration: ${run.duration ? formatDuration(run.duration) : 'N/A'}`);

      // Show items for this run (if requested)
      if (includeItems && items) {
        const runItems = items.filter((item) => item.runId === run.id);
        if (runItems.length > 0) {
          lines.push(`   Items Found: ${runItems.length}`);
          runItems.forEach((item) => {
            lines.push(`     - Item found at ${formatDate(item.foundTime)}`);
          });
        }
      }
      lines.push('');
    });
  }

  // Footer
  lines.push('='.repeat(60));
  lines.push(`Export generated on ${formatDate(new Date())}`);
  lines.push('='.repeat(60));

  return lines.join('\n');
}
