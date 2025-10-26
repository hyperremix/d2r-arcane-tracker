import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * SessionControls component that provides controls for managing run tracking.
 * This is a placeholder component that will be fully implemented in a later user story.
 */
export function SessionControls() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Controls - Coming Soon</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled>
            Start Run
          </Button>
          <Button variant="outline" disabled>
            Pause Run
          </Button>
          <Button variant="outline" disabled>
            Resume Run
          </Button>
          <Button variant="outline" disabled>
            End Run
          </Button>
          <Button variant="outline" disabled>
            End Session
          </Button>
        </div>
        <div className="mt-4 rounded-md bg-muted p-3">
          <p className="text-muted-foreground text-xs">
            This component will be fully implemented in a later user story with functional controls,
            keyboard shortcuts, visual state indicators, and confirmation dialogs.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
