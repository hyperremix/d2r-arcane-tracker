import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { TooltipProvider } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';
import { ItemGrid } from './ItemGrid';
import { ProgressSummary } from './ProgressSummary';

/**
 * GrailTracker component that serves as the main Holy Grail tracking interface.
 * Displays the grail statistics and the item tracking interface.
 * @returns {JSX.Element} The main grail tracker interface with statistics and item grid
 */
export function GrailTracker() {
  const { t } = useTranslation();
  // Narrow selector so unrelated store updates (filters, view mode, ...) don't re-render the page.
  // The grail data itself is loaded and kept in sync by initGrailData, started from App.
  const grailEthereal = useGrailStore((state) => state.settings.grailEthereal);

  const statistics = useGrailStatistics();

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col gap-4 p-6">
        {/* Page heading for assistive technology; the dense toolbar provides the visual context */}
        <PageHeader title={t(translations.grail.title)} visuallyHidden />

        {/* Progress summary */}
        {statistics && (
          <ProgressSummary statistics={statistics} showEtherealBreakdown={grailEthereal} />
        )}

        {/* Toolbar: search, filters, sorting, grouping and view mode */}
        <AdvancedSearch />

        {/* Item Grid - full content width. This wrapper only bounds the height; the grid's own
            container is the scroll element so its virtualization can measure the viewport. */}
        <div className="-mx-4 flex min-h-0 min-w-0 flex-1 flex-col">
          <ItemGrid />
        </div>
      </div>
    </TooltipProvider>
  );
}
