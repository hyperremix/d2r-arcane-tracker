import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { useSpriteIcon } from '@/hooks/useSpriteIcon';

export interface StackPickupCursorState {
  count: number;
  iconFileName: string;
  itemName: string;
  gridWidth: number;
  gridHeight: number;
}

interface StackPickupCursorProps {
  pickupState: StackPickupCursorState;
}

const CELL_SIZE_PX = 28;
const CURSOR_OFFSET_X = 12;
const CURSOR_OFFSET_Y = 12;

function CursorContent({ pickupState }: StackPickupCursorProps) {
  const { iconUrl } = useSpriteIcon(pickupState.iconFileName, { forceEnabled: true });
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (rafRef.current !== null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setPos({ x: event.clientX, y: event.clientY });
      });
    };

    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const width = pickupState.gridWidth * CELL_SIZE_PX;
  const height = pickupState.gridHeight * CELL_SIZE_PX;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50"
      style={{
        left: pos.x + CURSOR_OFFSET_X,
        top: pos.y + CURSOR_OFFSET_Y,
        width,
        height,
      }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[2px] border border-primary/70 bg-card/90 opacity-90 shadow-lg">
        <img
          src={iconUrl}
          alt={pickupState.itemName}
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
        />
        {pickupState.count > 1 && (
          <Badge
            variant="secondary"
            className="absolute right-0.5 bottom-0.5 h-4 min-w-4 justify-center px-1 text-[10px] leading-none"
          >
            {pickupState.count}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function StackPickupCursor({ pickupState }: StackPickupCursorProps) {
  return createPortal(<CursorContent pickupState={pickupState} />, document.body);
}
