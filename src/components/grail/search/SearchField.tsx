import { Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';

interface SearchFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Clears the search; called on Escape while the field has text. */
  onClear: () => void;
}

/**
 * Search input of the grail toolbar. Fuzzy matching is switched on in the filters popover.
 * Escape clears the search; Escape on an empty field leaves the field.
 */
export function SearchField({ id, value, onChange, onClear }: SearchFieldProps) {
  const { t } = useTranslation();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    if (value) {
      event.preventDefault();
      onClear();
    } else {
      event.currentTarget.blur();
    }
  };

  return (
    <div className="relative min-w-48 flex-1 basis-64">
      <Label htmlFor={id} className="sr-only">
        {t(translations.grail.advancedSearch.searchLabel)}
      </Label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        placeholder={t(translations.grail.advancedSearch.searchPlaceholder)}
        aria-keyshortcuts="/ Control+F Meta+F"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-9 pl-8"
      />
    </div>
  );
}
