import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  createBoardCellIndexes,
  type GridSize,
  getGridHeight,
  getGridWidth,
  type SpatialItemLike,
} from './spatialLayout';

const BOARD_GAP_PX = 1;
const BOARD_PADDING_PX = 8;

interface BoardSurfaceProps {
  gridSize: GridSize;
  children?: ReactNode;
  testId?: string;
  className?: string;
  showBaseGrid?: boolean;
}

interface GridPlacementOrigin {
  x?: number;
  y?: number;
}

function getBoardStyle(gridSize: GridSize): CSSProperties {
  const boardWidth = `calc(${gridSize.columns} * var(--inv-cell-size) + ${(gridSize.columns - 1) * BOARD_GAP_PX}px + ${BOARD_PADDING_PX * 2}px)`;
  const boardHeight = `calc(${gridSize.rows} * var(--inv-cell-size) + ${(gridSize.rows - 1) * BOARD_GAP_PX}px + ${BOARD_PADDING_PX * 2}px)`;

  return {
    gridTemplateColumns: `repeat(${gridSize.columns}, var(--inv-cell-size))`,
    gridTemplateRows: `repeat(${gridSize.rows}, var(--inv-cell-size))`,
    width: boardWidth,
    minWidth: boardWidth,
    maxWidth: boardWidth,
    height: boardHeight,
    minHeight: boardHeight,
    maxHeight: boardHeight,
  };
}

export function getItemGridPlacement(
  item: SpatialItemLike,
  origin: GridPlacementOrigin = {},
): CSSProperties {
  const originX = origin.x ?? 0;
  const originY = origin.y ?? 0;
  const gridX = (item.gridX ?? 0) - originX;
  const gridY = (item.gridY ?? 0) - originY;

  return {
    gridColumn: `${gridX + 1} / span ${getGridWidth(item)}`,
    gridRow: `${gridY + 1} / span ${getGridHeight(item)}`,
  };
}

export function BoardSurface({
  gridSize,
  children,
  testId,
  className,
  showBaseGrid = true,
}: BoardSurfaceProps) {
  const cells = showBaseGrid ? createBoardCellIndexes(gridSize) : [];

  return (
    <div className="overflow-x-auto pb-1">
      <div
        data-testid={testId}
        className={cn(
          'relative inline-grid gap-[1px] overflow-hidden rounded-md border border-border/70 bg-black/40 p-2 [--inv-cell-size:28px] sm:[--inv-cell-size:34px]',
          className,
        )}
        style={getBoardStyle(gridSize)}
      >
        {cells.map((cellIndex) => (
          <div
            key={cellIndex}
            data-testid={testId ? `${testId}-cell` : undefined}
            className="h-[var(--inv-cell-size)] w-[var(--inv-cell-size)] rounded-[2px] border border-border/40 bg-black/35"
          />
        ))}
        {children}
      </div>
    </div>
  );
}
