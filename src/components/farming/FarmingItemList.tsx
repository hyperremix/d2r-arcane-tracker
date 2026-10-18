import type { Item } from 'electron/types/grail';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getItemQualityTextClass } from '@/components/grail/ItemCard/styles';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

interface FarmingItemListProps {
  /** Text of the toggle, e.g. "Hell: 12 items" */
  label: string;
  items: Item[];
  onSelectItem: (itemId: string) => void;
}

/**
 * A toggle that shows a list of items; each item opens its details.
 */
export function FarmingItemList({ label, items, onSelectItem }: FarmingItemListProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={listId}
        disabled={items.length === 0}
        onClick={() => setOpen((value) => !value)}
        className="-ml-2"
      >
        <Icon aria-hidden="true" />
        <span>{label}</span>
        <span className="sr-only">
          {t(open ? translations.farming.hideItems : translations.farming.showItems)}
        </span>
      </Button>
      {open && (
        <ul id={listId} className="flex flex-wrap gap-x-3 gap-y-1 pl-6">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelectItem(item.id)}
                className={cn(
                  'rounded-sm text-sm underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  getItemQualityTextClass(item.type),
                )}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
