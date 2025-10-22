import type { JSX } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getAllRunes, getTotalRuneCount } from '@/lib/runeword-calculator';
import { useRunewordStore } from '@/stores/runewordStore';
import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Rune Inventory component for tracking which runes the user has.
 */
export function RuneInventory(): JSX.Element {
  const { inventory, addRune, removeRune, setRuneQuantity, clearInventory } = useRunewordStore();
  const [runeImages, setRuneImages] = useState<Map<string, string>>(new Map());

  const allRunes = getAllRunes();
  const totalRunes = getTotalRuneCount(inventory);

  // Load rune images
  useEffect(() => {
    async function loadRuneImages() {
      const imageMap = new Map<string, string>();

      for (const rune of allRunes) {
        if (rune.imageFilename) {
          try {
            const iconUrl = await window.electronAPI?.icon.getByFilename(rune.imageFilename);
            if (iconUrl) {
              imageMap.set(rune.id, iconUrl);
            }
          } catch (error) {
            console.error(`Failed to load rune image for ${rune.id}:`, error);
          }
        }
      }

      setRuneImages(imageMap);
    }

    loadRuneImages();
  }, [allRunes]);

  const handleQuantityChange = (runeId: string, value: string) => {
    const quantity = Number.parseInt(value, 10);
    if (!Number.isNaN(quantity) && quantity >= 0) {
      setRuneQuantity(runeId, quantity);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header with stats and clear button */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Your Rune Collection</h2>
          <p className="text-muted-foreground text-sm">Total runes: {totalRunes}</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearInventory} disabled={totalRunes === 0}>
          <Trash2Icon className="mr-2 h-4 w-4" />
          Clear All
        </Button>
      </div>

      {/* Rune Grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 gap-2 pr-4 sm:grid-cols-2 lg:grid-cols-3">
          {allRunes.map((rune) => {
            const quantity = inventory[rune.id] || 0;
            const imageUrl = runeImages.get(rune.id);

            return (
              <div
                key={rune.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
              >
                {/* Rune Image */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={rune.name}
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-center text-muted-foreground text-xs">{rune.id}</div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{rune.name} Rune</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Rune Name */}
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`rune-${rune.id}`} className="cursor-pointer text-sm">
                    {rune.name}
                  </Label>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeRune(rune.id, 1)}
                    disabled={quantity === 0}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </Button>

                  <Input
                    id={`rune-${rune.id}`}
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(rune.id, e.target.value)}
                    className="h-8 w-16 text-center"
                  />

                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => addRune(rune.id, 1)}>
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
