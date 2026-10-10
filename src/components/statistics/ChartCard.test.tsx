import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InteractiveChart } from '@/components/statistics/ChartCard';

interface ChartProps {
  count: number;
}

function Chart({ count }: ChartProps) {
  const points = Array.from({ length: count }, (_, index) => ({ x: 20 + index * 40, y: 50 }));
  return (
    <InteractiveChart
      containerRef={() => undefined}
      width={200}
      height={100}
      label="Test chart"
      points={points}
      getTooltip={(index) => {
        // Reading a missing position is what used to throw in the charts
        if (index >= count) throw new Error(`index ${index} is out of range`);
        return { heading: `Point ${index}`, rows: [{ label: 'Value', value: String(index) }] };
      }}
      table={null}
    >
      {(activeIndex) => <text>{activeIndex === undefined ? 'none' : `active ${activeIndex}`}</text>}
    </InteractiveChart>
  );
}

describe('When an InteractiveChart is used', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('If the data shrinks while the last position is active, Then the active position moves to the new last one', () => {
    // Arrange
    const { rerender } = render(<Chart count={4} />);
    const chart = screen.getByRole('img', { name: 'Test chart' });
    fireEvent.focus(chart);
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 3');

    // Act
    rerender(<Chart count={2} />);

    // Assert
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 1');
    expect(screen.getByText('active 1')).toBeInTheDocument();
  });

  it('If the data becomes empty while a position is active, Then no tooltip is shown and it recovers when data returns', () => {
    // Arrange
    const { rerender } = render(<Chart count={3} />);
    fireEvent.focus(screen.getByRole('img', { name: 'Test chart' }));

    // Act
    rerender(<Chart count={0} />);

    // Assert
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
    rerender(<Chart count={3} />);
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 2');
  });

  it('If the chart is focusable, Then it is described by the keyboard hint', () => {
    // Arrange & Act
    render(<Chart count={3} />);

    // Assert
    const chart = screen.getByRole('img', { name: 'Test chart' });
    expect(chart).toHaveAccessibleDescription(/arrow keys, Home and End/);
  });

  it('If the pointer moves over the chart, Then the tooltip is not announced until the keyboard is used', () => {
    // Arrange
    const { container } = render(<Chart count={3} />);
    const chart = screen.getByRole('img', { name: 'Test chart' });
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
    } as DOMRect);
    const liveRegion = () => container.querySelector('[aria-live]');

    // Act & Assert
    fireEvent.pointerMove(chart, { clientX: 100 });
    expect(liveRegion()).toHaveAttribute('aria-live', 'off');
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 2');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 1');
  });
});
