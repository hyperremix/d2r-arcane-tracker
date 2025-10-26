import type { Run } from 'electron/types/grail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RunListProps {
  runs: Run[] | undefined;
}

/**
 * RunList component that displays a list of runs with their details.
 * This is a placeholder component that will be fully implemented in a later user story.
 */
export function RunList({ runs }: RunListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Run List - Coming Soon</CardTitle>
      </CardHeader>
      <CardContent>
        {runs && runs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              <strong>Total Runs:</strong> {runs.length}
            </p>
            <div className="space-y-1">
              {runs.slice(0, 3).map((run) => (
                <div key={run.id} className="rounded bg-muted p-2 text-xs">
                  <p>
                    <strong>Run #{run.runNumber}</strong>
                  </p>
                  <p>Start: {run.startTime.toLocaleString()}</p>
                  {run.endTime && <p>End: {run.endTime.toLocaleString()}</p>}
                  {run.duration && <p>Duration: {Math.round(run.duration / 1000)}s</p>}
                  {run.runType && <p>Type: {run.runType}</p>}
                </div>
              ))}
              {runs.length > 3 && (
                <p className="text-muted-foreground text-xs">... and {runs.length - 3} more runs</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No runs available</p>
        )}
        <div className="mt-4 rounded-md bg-muted p-3">
          <p className="text-muted-foreground text-xs">
            This component will be fully implemented in a later user story with pagination,
            filtering, sorting, expandable details, and visual indicators for runs with items.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
