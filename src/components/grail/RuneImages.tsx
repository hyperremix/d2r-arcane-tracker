import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { runes } from '../../../electron/items/runes';

interface RuneImagesProps {
  runeIds: string[];
  viewMode?: 'grid' | 'list';
  className?: string;
}

/**
 * Component to display rune images for a runeword.
 * @param runeIds - Array of rune IDs (e.g., ['tal', 'eth'])
 * @param viewMode - Display mode: 'grid' (3-column grid) or 'list' (single row)
 * @param className - Optional additional CSS classes
 */
export function RuneImages({ runeIds, viewMode = 'grid', className }: RuneImagesProps) {
  const [runeImages, setRuneImages] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

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
              runeId={runeId}
              imageUrl={runeImages.get(runeId)}
              runeName={getRuneName(runeId)}
              isLoading={isLoading}
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
  runeId: string;
  imageUrl?: string;
  runeName: string;
  isLoading: boolean;
}

function RuneImage({ runeId, imageUrl, runeName, isLoading }: RuneImageProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative flex h-8 w-8 items-center justify-center">
          {isLoading ? (
            <div className="absolute inset-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={runeName}
              className="h-full w-full object-contain"
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                e.currentTarget.src = '/images/placeholder-item.png';
              }}
            />
          ) : (
            <div className="text-center text-gray-500 text-xs dark:text-gray-400">{runeId}</div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{runeName}</p>
      </TooltipContent>
    </Tooltip>
  );
}
