import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';
import type { GroupMode } from './options';

interface GroupBySelectProps {
  groupMode: GroupMode;
  /** Whether grouping by ethereal status is offered (only if ethereal items are tracked). */
  showEthereal: boolean;
  onGroupModeChange: (groupMode: GroupMode) => void;
}

/**
 * Grouping select of the grail toolbar.
 */
export function GroupBySelect({ groupMode, showEthereal, onGroupModeChange }: GroupBySelectProps) {
  const { t } = useTranslation();
  const groupById = useId();

  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={groupById} className="text-muted-foreground text-xs">
        {t(translations.grail.advancedSearch.groupBy)}
      </Label>
      <Select value={groupMode} onValueChange={(value) => onGroupModeChange(value as GroupMode)}>
        <SelectTrigger id={groupById} className="h-9 min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t(translations.grail.advancedSearch.noGrouping)}</SelectItem>
          <SelectItem value="category">
            {t(translations.grail.advancedSearch.byCategory)}
          </SelectItem>
          <SelectItem value="type">{t(translations.grail.advancedSearch.byType)}</SelectItem>
          {showEthereal && (
            <SelectItem value="ethereal">
              {t(translations.grail.advancedSearch.byEthereal)}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
