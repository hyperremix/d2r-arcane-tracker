import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RunAnalytics } from './RunAnalytics';
import { StatsDashboard } from './StatsDashboard';

/**
 * Statistics component that serves as the main statistics page.
 * Displays comprehensive Holy Grail statistics and run analytics with tab navigation.
 * @returns {JSX.Element} The main statistics interface with dashboard and analytics
 */
export function Statistics() {
  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="grail" className="h-full">
          <div className="px-6 pt-6">
            <TabsList>
              <TabsTrigger value="grail">Grail Statistics</TabsTrigger>
              <TabsTrigger value="runs">Run Statistics</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="grail" className="m-0">
            <div className="space-y-6 p-6">
              <StatsDashboard />
            </div>
          </TabsContent>
          <TabsContent value="runs" className="m-0">
            <RunAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
