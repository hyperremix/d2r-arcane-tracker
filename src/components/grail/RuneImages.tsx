import { useEffect, useMemo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { RunewordCompletionStatus } from '@/lib/runeword-utils';
import { cn } from '@/lib/utils';
import placeholderUrl from '/images/placeholder-item.png';
import { runes } from '../../../electron/items/runes';

interface RuneImagesProps {
  runeIds: string[];
  viewMode?: 'grid' | 'list';
  className?: string;
  showRuneNames?: boolean;
  completionStatus?: RunewordCompletionStatus;
}

/**
 * Component to display rune images for a runeword.
 * @param runeIds - Array of rune IDs (e.g., ['tal', 'eth'])
 * @param viewMode - Display mode: 'grid' (3-column grid) or 'list' (single row)
 * @param showRuneNames - Whether to show the name of each rune
 * @param className - Optional additional CSS classes
 */
export function RuneImages({
  runeIds,
  viewMode = 'grid',
  showRuneNames = false,
  completionStatus,
  className,
}: RuneImagesProps) {
  const [runeImages, setRuneImages] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Create a map tracking which specific indices in runeIds are missing
  const missingRuneIndices = useMemo(() => {
    if (!completionStatus) {
      return new Set<number>();
    }

    const missingSet = new Set<number>();
    const missingCounts: Record<string, number> = {};

    // Count how many of each rune type is missing
    for (const runeId of completionStatus.missingRunes) {
      missingCounts[runeId] = (missingCounts[runeId] || 0) + 1;
    }

    // Track which indices should be marked as missing
    // We mark the last N instances of each rune type as missing
    const runeCounts: Record<string, number> = {};
    for (let i = runeIds.length - 1; i >= 0; i--) {
      const runeId = runeIds[i];
      runeCounts[runeId] = (runeCounts[runeId] || 0) + 1;

      const missingCount = missingCounts[runeId] || 0;
      if (runeCounts[runeId] <= missingCount) {
        missingSet.add(i);
      }
    }

    return missingSet;
  }, [completionStatus, runeIds]);

  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Image loading with error handling requires complexity
    async function loadRuneImages() {
      const imageMap = new Map<string, string>();

      for (const runeId of runeIds) {
        const rune = runes.find((r) => r.id === runeId);
        if (rune?.imageFilename) {
          try {
            const iconUrl = await window.electronAPI?.icon.getByFilename(rune.imageFilename);
            if (iconUrl) {
              imageMap.set(runeId, iconUrl);
            }
          } catch (error) {
            console.error(`Failed to load rune image for ${runeId}:`, error);
          }
        }
      }

      setRuneImages(imageMap);
      setIsLoading(false);
    }

    loadRuneImages();
  }, [runeIds]);

  // Get rune name by ID
  const getRuneName = (runeId: string): string => {
    const rune = runes.find((r) => r.id === runeId);
    return rune?.name || runeId;
  };

  // Map rune count to grid columns for list mode (Tailwind requires static classes)
  const getListGridCols = (count: number): string => {
    switch (count) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-3';
      case 4:
        return 'grid-cols-4';
      case 5:
        return 'grid-cols-5';
      case 6:
        return 'grid-cols-6';
      default:
        return 'grid-cols-6';
    }
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          'grid gap-1',
          viewMode === 'grid' && 'grid-cols-3',
          viewMode === 'list' && getListGridCols(runeIds.length),
          className,
        )}
      >
        {runeIds.map((runeId, index) => {
          return (
            <RuneImage
              key={`${runeId}-${
                // biome-ignore lint/suspicious/noArrayIndexKey: Using index is necessary here to handle duplicate runes
                index
              }`}
              imageUrl={runeImages.get(runeId)}
              runeName={getRuneName(runeId)}
              isLoading={isLoading}
              showRuneName={showRuneNames}
              isMissing={missingRuneIndices.has(index)}
            />
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/**
 * Individual rune image component
 */
interface RuneImageProps {
  imageUrl?: string;
  runeName: string;
  isLoading: boolean;
  showRuneName?: boolean;
  isMissing?: boolean;
}

function RuneImage({
  imageUrl,
  runeName,
  isLoading,
  showRuneName = false,
  isMissing = false,
}: RuneImageProps) {
  return (
    <Tooltip>
      <TooltipTrigger className="relative flex items-center justify-center">
        {isLoading ? (
          <div className="absolute inset-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ) : imageUrl ? (
          <div className={cn('relative', isMissing && 'rounded-lg bg-red-400 p-1 dark:bg-red-900')}>
            <div className="flex flex-col items-center justify-center">
              <img
                src={imageUrl}
                alt={runeName}
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  e.currentTarget.src = placeholderUrl;
                }}
              />
              {showRuneName && <div className="text-center text-xs">{runeName}</div>}
            </div>
          </div>
        ) : (
          <div className={cn(isMissing && 'rounded-lg bg-red-400 p-1 dark:bg-red-900')}>
            <div className="text-center text-xs">{runeName}</div>
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{runeName}</p>
      </TooltipContent>
    </Tooltip>
  );
}
