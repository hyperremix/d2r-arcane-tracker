import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { RunAnalytics } from '@/components/statistics/RunAnalytics';
import { StatsDashboard } from '@/components/statistics/StatsDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';

/**
 * Tabs available on the statistics page.
 */
const STATISTICS_TABS = ['grail', 'runs'] as const;

/**
 * Identifier of a statistics page tab.
 */
type StatisticsTab = (typeof STATISTICS_TABS)[number];

/**
 * Search parameter that stores the active statistics tab.
 */
const STATISTICS_TAB_PARAM = 'tab';

const DEFAULT_STATISTICS_TAB: StatisticsTab = 'grail';

/**
 * Returns whether a value is a known statistics tab.
 * @param {unknown} value - The value to check (e.g. a URL search parameter)
 * @returns {boolean} True when the value is a valid statistics tab
 */
const isStatisticsTab = (value: unknown): value is StatisticsTab =>
  typeof value === 'string' && (STATISTICS_TABS as readonly string[]).includes(value);

/**
 * Statistics component that serves as the main statistics page.
 * Displays comprehensive Holy Grail statistics and run analytics with tab navigation.
 * The active tab is stored in the `tab` URL search parameter so it survives
 * back/forward navigation.
 * @returns {JSX.Element} The main statistics interface with dashboard and analytics
 */
export function Statistics() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get(STATISTICS_TAB_PARAM);
  const activeTab = isStatisticsTab(tabParam) ? tabParam : DEFAULT_STATISTICS_TAB;

  const handleTabChange = (value: unknown) => {
    if (!isStatisticsTab(value) || value === activeTab) {
      return;
    }
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === DEFAULT_STATISTICS_TAB) {
          next.delete(STATISTICS_TAB_PARAM);
        } else {
          next.set(STATISTICS_TAB_PARAM, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  return (
    <TooltipProvider>
      <PageShell padded={false}>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="space-y-6 px-6 pt-6">
            <PageHeader
              title={t(translations.titleBar.statistics)}
              description={t(translations.statistics.description)}
            />
            <TabsList>
              <TabsTrigger value="grail">{t(translations.statistics.grailStatistics)}</TabsTrigger>
              <TabsTrigger value="runs">{t(translations.statistics.runStatistics)}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="grail" className="m-0">
            <div className="p-6">
              <StatsDashboard />
            </div>
          </TabsContent>
          <TabsContent value="runs" className="m-0">
            {/* The loading, error, empty and loaded states all get this padding */}
            <div className="p-6">
              <RunAnalytics />
            </div>
          </TabsContent>
        </Tabs>
      </PageShell>
    </TooltipProvider>
  );
}
