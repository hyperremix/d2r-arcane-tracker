import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardSurface, getItemGridPlacement } from './boardPrimitives';

describe('When BoardSurface is rendered', () => {
  describe('If showBaseGrid is not provided', () => {
    it('Then it renders the canonical board cell layer', () => {
      // Arrange & Act
      render(
        <BoardSurface gridSize={{ columns: 3, rows: 2 }} testId="board-default">
          <div data-testid="board-default-child" />
        </BoardSurface>,
      );

      // Assert
      const board = screen.getByTestId('board-default');
      expect(within(board).getAllByTestId('board-default-cell')).toHaveLength(6);
      expect(screen.getByTestId('board-default-child')).toBeInTheDocument();
    });

    it('Then it applies strict board dimensions and clips visual overflow', () => {
      // Arrange & Act
      render(<BoardSurface gridSize={{ columns: 10, rows: 4 }} testId="board-bounds" />);

      // Assert
      const board = screen.getByTestId('board-bounds');
      expect(board.className).toContain('overflow-hidden');
      expect(board.style.width).toBe('calc(10 * var(--inv-cell-size) + 9px + 16px)');
      expect(board.style.minWidth).toBe('calc(10 * var(--inv-cell-size) + 9px + 16px)');
      expect(board.style.maxWidth).toBe('calc(10 * var(--inv-cell-size) + 9px + 16px)');
      expect(board.style.height).toBe('calc(4 * var(--inv-cell-size) + 3px + 16px)');
      expect(board.style.minHeight).toBe('calc(4 * var(--inv-cell-size) + 3px + 16px)');
      expect(board.style.maxHeight).toBe('calc(4 * var(--inv-cell-size) + 3px + 16px)');
    });
  });

  describe('If showBaseGrid is false', () => {
    it('Then it hides base cells and still renders children', () => {
      // Arrange & Act
      render(
        <BoardSurface
          gridSize={{ columns: 3, rows: 2 }}
          testId="board-no-grid"
          showBaseGrid={false}
        >
          <div data-testid="board-no-grid-child" />
        </BoardSurface>,
      );

      // Assert
      const board = screen.getByTestId('board-no-grid');
      expect(within(board).queryAllByTestId('board-no-grid-cell')).toHaveLength(0);
      expect(screen.getByTestId('board-no-grid-child')).toBeInTheDocument();
    });
  });

  describe('If placement is calculated with a board origin offset', () => {
    it('Then grid placement is rebased to the overflow board origin', () => {
      // Arrange
      const item = {
        locationContext: 'inventory' as const,
        gridX: 12,
        gridY: 1,
        gridWidth: 2,
        gridHeight: 2,
      };

      // Act
      const style = getItemGridPlacement(item, { x: 12, y: 1 });

      // Assert
      expect(style).toEqual({
        gridColumn: '1 / span 2',
        gridRow: '1 / span 2',
      });
    });
  });
});
