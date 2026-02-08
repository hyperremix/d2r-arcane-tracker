import type { Character, GrailProgress, Item, Run, RunItem } from 'electron/types/grail';
import { ItemCard } from '@/components/grail/ItemCard';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/utils';

export interface RunDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: Run | null;
  runItems: RunItem[];
  loading: boolean;
  formatTimestamp: (date: Date) => string;
  getItemInfo: (runItem: RunItem) => { name: string; isNewGrail: boolean };
  getItemCardData: (runItem: RunItem) => {
    item: Item | undefined;
    normalProgress: GrailProgress[];
    etherealProgress: GrailProgress[];
  };
  characters: Character[];
}

export function RunDetailsDialog({
  open,
  onOpenChange,
  run,
  runItems,
  loading,
  formatTimestamp,
  getItemInfo,
  getItemCardData,
  characters,
}: RunDetailsDialogProps) {
  if (!run) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">Select a run to view details.</DialogContent>
      </Dialog>
    );
  }

  const itemsCount = runItems.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run #{run.runNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Start Time</p>
              <p className="font-mono text-sm">{formatTimestamp(run.startTime)}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Duration</p>
              <p className="font-mono text-sm">
                {run.duration ? formatDuration(run.duration) : 'In progress'}
              </p>
            </div>
            {run.endTime && (
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">End Time</p>
                <p className="font-mono text-sm">{formatTimestamp(run.endTime)}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Items Found</p>
              <Badge variant="secondary" className="text-xs">
                {itemsCount}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Items Found</h4>
              <Badge variant="outline" className="text-xs">
                {itemsCount} items
              </Badge>
            </div>

            {loading ? (
              <div className="space-y-2">
                {['one', 'two', 'three'].map((placeholder) => (
                  <div key={`dialog-loading-${placeholder}`} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : runItems.length > 0 ? (
              <div className="space-y-2">
                {runItems.map((runItem) => {
                  const { item, normalProgress, etherealProgress } = getItemCardData(runItem);
                  if (!item) {
                    // Fallback to simple display if item not found
                    const itemInfo = getItemInfo(runItem);
                    return (
                      <div key={runItem.id} className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-primary/20" />
                        <span className="text-sm">{itemInfo.name}</span>
                        {itemInfo.isNewGrail && (
                          <Badge variant="secondary" className="text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                    );
                  }
                  return (
                    <ItemCard
                      key={runItem.id}
                      item={item}
                      normalProgress={normalProgress}
                      etherealProgress={etherealProgress}
                      characters={characters}
                      viewMode="list"
                      withoutStatusIndicators
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No items found in this run.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
