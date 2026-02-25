import { type CSSProperties, type DragEvent, type ReactNode, useRef } from 'react';
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
  onDragOverCell?: (event: DragEvent<HTMLDivElement>, x: number, y: number) => void;
  onDragLeaveBoard?: () => void;
  onDropOnBoard?: (event: DragEvent<HTMLDivElement>, x: number, y: number) => void;
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

function getCellCoords(
  event: DragEvent<HTMLDivElement>,
  el: HTMLDivElement,
): {
  x: number;
  y: number;
} {
  const rect = el.getBoundingClientRect();
  const parsedCellSize = Number.parseFloat(
    getComputedStyle(el).getPropertyValue('--inv-cell-size'),
  );
  const cellSize = Number.isFinite(parsedCellSize) && parsedCellSize > 0 ? parsedCellSize : 22;
  const clientX =
    Number.isFinite(event.clientX) && Number.isFinite(rect.left)
      ? event.clientX
      : rect.left + BOARD_PADDING_PX;
  const clientY =
    Number.isFinite(event.clientY) && Number.isFinite(rect.top)
      ? event.clientY
      : rect.top + BOARD_PADDING_PX;
  const cellSpan = cellSize + BOARD_GAP_PX;
  const rawX = (clientX - rect.left - BOARD_PADDING_PX) / cellSpan;
  const rawY = (clientY - rect.top - BOARD_PADDING_PX) / cellSpan;

  return {
    x: Number.isFinite(rawX) ? Math.max(0, Math.floor(rawX)) : 0,
    y: Number.isFinite(rawY) ? Math.max(0, Math.floor(rawY)) : 0,
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
  onDragOverCell,
  onDragLeaveBoard,
  onDropOnBoard,
}: BoardSurfaceProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cells = showBaseGrid ? createBoardCellIndexes(gridSize) : [];

  return (
    <div className="overflow-x-auto pb-1">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: board surfaces intentionally handle drag-drop targeting without click/keyboard interaction. */}
      <div
        ref={boardRef}
        data-testid={testId}
        className={cn(
          'relative inline-grid gap-[1px] overflow-hidden rounded-md border border-border/70 bg-black/40 p-2 [--inv-cell-size:22px] sm:[--inv-cell-size:28px]',
          className,
        )}
        style={getBoardStyle(gridSize)}
        onDragOver={(event) => {
          event.preventDefault();

          if (onDragOverCell && boardRef.current) {
            const { x, y } = getCellCoords(event, boardRef.current);
            onDragOverCell(event, x, y);
          }
        }}
        onDragLeave={(event) => {
          if (!onDragLeaveBoard || !boardRef.current) {
            return;
          }

          const relatedTarget = event.relatedTarget;
          if (relatedTarget instanceof Node && boardRef.current.contains(relatedTarget)) {
            return;
          }

          onDragLeaveBoard();
        }}
        onDrop={(event) => {
          event.preventDefault();

          if (onDropOnBoard && boardRef.current) {
            const { x, y } = getCellCoords(event, boardRef.current);
            onDropOnBoard(event, x, y);
          }
        }}
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
