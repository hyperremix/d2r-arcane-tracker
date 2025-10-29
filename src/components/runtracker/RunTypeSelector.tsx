import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

const PRESET_RUN_TYPES = [
  'Mephisto',
  'Chaos Sanctuary',
  'Cows',
  'Baal',
  'Diablo',
  'Pindle',
  'Ancient Tunnels',
  'Travincal',
  'Countess',
];

/**
 * RunTypeSelector component that provides a combobox interface for selecting or entering run types.
 * Supports preset run types, recent run types, and custom input with auto-complete functionality.
 */
export function RunTypeSelector() {
  const { activeRun, setRunType, recentRunTypes, loadRecentRunTypes, saveRunType } =
    useRunTrackerStore();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>('');

  // Load recent run types only when an active run exists and list is empty
  useEffect(() => {
    if (activeRun && (recentRunTypes?.length ?? 0) === 0) {
      loadRecentRunTypes();
    }
  }, [activeRun, recentRunTypes?.length, loadRecentRunTypes]);

  // Update value when active run changes
  useEffect(() => {
    if (activeRun?.runType) {
      setValue(activeRun.runType);
    } else {
      setValue('');
    }
  }, [activeRun?.runType]);

  // Filter preset and recent run types based on input
  const filteredPresets = PRESET_RUN_TYPES.filter((type) =>
    type.toLowerCase().includes(value.toLowerCase()),
  );

  const filteredRecents = (recentRunTypes || []).filter(
    (type) => type.toLowerCase().includes(value.toLowerCase()) && !PRESET_RUN_TYPES.includes(type),
  );

  const handleSelect = async (selectedValue: string) => {
    setValue(selectedValue === value ? '' : selectedValue);
    setOpen(false);

    if (selectedValue && selectedValue !== value) {
      // Update the run type in the store
      await setRunType(selectedValue);

      // Save to recent run types
      await saveRunType(selectedValue);
    }
  };

  // Validate run type name
  const isValidRunType = (type: string): boolean => {
    if (!type || type.trim().length === 0) return false;
    if (type.length > 50) return false;
    // Allow letters, numbers, spaces, and hyphens
    return /^[a-zA-Z0-9\s-]+$/.test(type);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && value && isValidRunType(value)) {
      e.preventDefault();
      await handleSelect(value.trim());
    }
  };

  // Combine all options for display
  const hasRecents = filteredRecents.length > 0;
  const hasPresets = filteredPresets.length > 0;
  const hasCustom =
    value &&
    !filteredPresets.includes(value) &&
    !filteredRecents.includes(value) &&
    isValidRunType(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {value || 'Select run type...'}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command onKeyDown={handleKeyDown}>
          <CommandInput placeholder="Search run types..." value={value} onValueChange={setValue} />
          <CommandList>
            <CommandEmpty>No run type found.</CommandEmpty>

            {/* Preset Run Types */}
            {hasPresets && (
              <CommandGroup heading="Presets">
                {filteredPresets.map((type) => (
                  <CommandItem key={type} value={type} onSelect={handleSelect}>
                    <CheckIcon
                      className={cn('mr-2 h-4 w-4', value === type ? 'opacity-100' : 'opacity-0')}
                    />
                    {type}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Recent Run Types */}
            {hasRecents && (
              <CommandGroup heading="Recent">
                {filteredRecents.map((type) => (
                  <CommandItem key={type} value={type} onSelect={handleSelect}>
                    <CheckIcon
                      className={cn('mr-2 h-4 w-4', value === type ? 'opacity-100' : 'opacity-0')}
                    />
                    {type}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Custom Run Type */}
            {hasCustom && (
              <CommandGroup heading="Custom">
                <CommandItem value={value.trim()} onSelect={handleSelect}>
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === value.trim() ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {value.trim()} (new)
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
