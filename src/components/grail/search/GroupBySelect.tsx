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
import { type GroupMode, groupModeLabelKeys, groupModeValues } from './options';

interface GroupBySelectProps {
  groupMode: GroupMode;
  /** Whether grouping by ethereal status is offered (only if ethereal items are tracked). */
  showEthereal: boolean;
  onGroupModeChange: (groupMode: GroupMode) => void;
}

/**
 * Grouping select of the grail view options.
 */
export function GroupBySelect({ groupMode, showEthereal, onGroupModeChange }: GroupBySelectProps) {
  const { t } = useTranslation();
  const groupById = useId();
  // Base UI renders the trigger label from `items`; without it the raw value would be shown
  const groupOptions = groupModeValues
    .filter((value) => showEthereal || value !== 'ethereal')
    .map((value) => ({ value, label: t(groupModeLabelKeys[value]) }));

  return (
    <div className="grid gap-2">
      <Label htmlFor={groupById} className="text-muted-foreground text-xs">
        {t(translations.grail.advancedSearch.groupBy)}
      </Label>
      <Select
        items={groupOptions}
        value={groupMode}
        onValueChange={(value) => value && onGroupModeChange(value as GroupMode)}
      >
        <SelectTrigger id={groupById} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groupOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
