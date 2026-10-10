import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type CumulativeFindsPoint, toLocalDayIndex } from '@/components/statistics/chartData';
import { GrailProgressChart } from '@/components/statistics/GrailProgressChart';

const today = toLocalDayIndex(new Date(2026, 9, 10));

function buildPoints(totals: number[]): CumulativeFindsPoint[] {
  return totals.map((total, index) => ({ day: today - totals.length + index + 1, total }));
}

describe('When the grail progress chart is rendered', () => {
  it('If a total has thousands, Then the data table digits are localized like the tooltip', () => {
    // Arrange & Act
    render(
      <GrailProgressChart points={buildPoints([1_000, 1_234])} today={today} totalItems={2_000} />,
    );

    // Assert
    const table = screen.getByRole('table', { name: 'Grail Progress Over Time' });
    const lastRow = within(table).getAllByRole('row')[2];
    expect(
      within(lastRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Oct 10, 2026', '1,234', '234']);
  });

  it('If the points shrink while the latest one is focused, Then the chart keeps working with the remaining points', () => {
    // Arrange
    const { rerender } = render(
      <GrailProgressChart points={buildPoints([1, 2, 3])} today={today} totalItems={10} />,
    );
    const chart = screen.getByRole('img', { name: /^Grail progress over time/ });
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: 'End' });

    // Act
    rerender(<GrailProgressChart points={buildPoints([1])} today={today} totalItems={10} />);

    // Assert
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Found1');
  });
});
