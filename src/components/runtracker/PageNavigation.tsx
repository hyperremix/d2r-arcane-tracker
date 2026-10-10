import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { getPageList } from '@/lib/pagination';

interface PageNavigationProps {
  /** The current page (1-based). */
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Previous/Next buttons and page buttons for a paginated list. The page buttons cover the first and
 * last page and a window around the current page, which is marked with `aria-current="page"`.
 */
export function PageNavigation({ currentPage, totalPages, onPageChange }: PageNavigationProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t(translations.common.paginationLabel)} className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t(translations.common.previous)}
      </Button>
      <div className="flex items-center gap-1">
        {getPageList(currentPage, totalPages).map((entry) => {
          if (typeof entry !== 'number') {
            return (
              <span key={entry} aria-hidden="true" className="px-1 text-muted-foreground text-sm">
                …
              </span>
            );
          }
          const isCurrentPage = entry === currentPage;
          return (
            <Button
              key={entry}
              variant={isCurrentPage ? 'default' : 'outline'}
              size="sm"
              className="h-8 min-w-8 px-2 tabular-nums"
              aria-current={isCurrentPage ? 'page' : undefined}
              aria-label={t(translations.common.pagination, { current: entry, total: totalPages })}
              onClick={() => onPageChange(entry)}
            >
              {entry}
            </Button>
          );
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        {t(translations.common.next)}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
