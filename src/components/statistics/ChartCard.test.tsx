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

  it('If the data becomes empty while a position is active, Then no tooltip is shown and the keyboard works again when data returns', () => {
    // Arrange
    const { rerender } = render(<Chart count={3} />);
    fireEvent.focus(screen.getByRole('img', { name: 'Test chart' }));

    // Act
    rerender(<Chart count={0} />);

    // Assert
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
    rerender(<Chart count={3} />);
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('img', { name: 'Test chart' }), { key: 'End' });
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 2');
  });

  it('If the chart receives focus while it has no points, Then no position is stored for when data arrives', () => {
    // Arrange
    const { rerender } = render(<Chart count={0} />);
    fireEvent.focus(screen.getByRole('img', { name: 'Test chart' }));

    // Act
    rerender(<Chart count={3} />);

    // Assert
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
  });

  it('If the data shrinks and later grows again, Then the active position does not jump back to the old one', () => {
    // Arrange
    const { rerender } = render(<Chart count={4} />);
    fireEvent.focus(screen.getByRole('img', { name: 'Test chart' }));
    rerender(<Chart count={2} />);

    // Act
    rerender(<Chart count={4} />);

    // Assert
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 1');
  });

  it('If the chart is focusable, Then it is described by the keyboard hint', () => {
    // Arrange & Act
    render(<Chart count={3} />);

    // Assert
    const chart = screen.getByRole('img', { name: 'Test chart' });
    expect(chart).toHaveAccessibleDescription(/arrow keys, Home and End/);
  });

  it('If the pointer moves over the chart, Then nothing is announced until the keyboard changes the position', () => {
    // Arrange
    render(<Chart count={3} />);
    const chart = screen.getByRole('img', { name: 'Test chart' });
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
    } as DOMRect);
    const liveRegion = screen.getByTestId('chart-announcement');

    // Act & Assert
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    fireEvent.pointerMove(chart, { clientX: 100 });
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 2');
    expect(liveRegion).toBeEmptyDOMElement();
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 1');
    expect(liveRegion).toHaveTextContent('Point 1: 1 Value');
    fireEvent.pointerMove(chart, { clientX: 20 });
    expect(liveRegion).toBeEmptyDOMElement();
  });

  it('If the user presses Escape or moves focus away after a keyboard change, Then the announcement is cleared', () => {
    // Arrange
    render(<Chart count={3} />);
    const chart = screen.getByRole('img', { name: 'Test chart' });
    const liveRegion = screen.getByTestId('chart-announcement');
    fireEvent.keyDown(chart, { key: 'Home' });
    expect(liveRegion).toHaveTextContent('Point 0: 0 Value');

    // Act
    fireEvent.keyDown(chart, { key: 'Escape' });

    // Assert
    expect(liveRegion).toBeEmptyDOMElement();
    fireEvent.keyDown(chart, { key: 'End' });
    expect(liveRegion).toHaveTextContent('Point 2: 2 Value');
    fireEvent.blur(chart);
    expect(liveRegion).toBeEmptyDOMElement();
  });

  it('If the pointer leaves the chart while it has keyboard focus, Then the keyboard position stays active', () => {
    // Arrange
    render(<Chart count={3} />);
    const chart = screen.getByRole('img', { name: 'Test chart' });
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
    } as DOMRect);
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: 'Home' });
    fireEvent.pointerMove(chart, { clientX: 100 });
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 2');

    // Act
    fireEvent.pointerLeave(chart);

    // Assert
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Point 0');
  });

  it('If the pointer leaves a chart without keyboard focus, Then the tooltip disappears', () => {
    // Arrange
    render(<Chart count={3} />);
    const chart = screen.getByRole('img', { name: 'Test chart' });
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
    } as DOMRect);
    fireEvent.pointerMove(chart, { clientX: 100 });

    // Act
    fireEvent.pointerLeave(chart);

    // Assert
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
  });
});
