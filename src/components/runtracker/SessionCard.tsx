import type { Session } from 'electron/types/grail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SessionCardProps {
  session: Session | null;
}

/**
 * SessionCard component that displays session information and statistics.
 * This is a placeholder component that will be fully implemented in a later user story.
 */
export function SessionCard({ session }: SessionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Card - Coming Soon</CardTitle>
      </CardHeader>
      <CardContent>
        {session ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              <strong>Session ID:</strong> {session.id}
            </p>
            <p className="text-muted-foreground text-sm">
              <strong>Start Time:</strong> {session.startTime.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-sm">
              <strong>Run Count:</strong> {session.runCount}
            </p>
            <p className="text-muted-foreground text-sm">
              <strong>Total Session Time:</strong> {Math.round(session.totalSessionTime / 1000)}s
            </p>
            <p className="text-muted-foreground text-sm">
              <strong>Total Run Time:</strong> {Math.round(session.totalRunTime / 1000)}s
            </p>
            {session.notes && (
              <p className="text-muted-foreground text-sm">
                <strong>Notes:</strong> {session.notes}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No session data available</p>
        )}
        <div className="mt-4 rounded-md bg-muted p-3">
          <p className="text-muted-foreground text-xs">
            This component will be fully implemented in a later user story with real-time session
            statistics, timer updates, and session management controls.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
