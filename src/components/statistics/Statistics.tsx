import { StatsDashboard } from '@/components/grail/StatsDashboard';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Statistics component that serves as the main statistics page.
 * Displays comprehensive Holy Grail statistics and analytics.
 * @returns {JSX.Element} The main statistics interface with dashboard
 */
export function Statistics() {
  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          <StatsDashboard />
        </div>
      </div>
    </TooltipProvider>
  );
}
