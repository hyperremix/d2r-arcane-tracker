import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toLocalDayIndex, type WeeklyFinds } from '@/components/statistics/chartData';
import { WeeklyFindsChart } from '@/components/statistics/WeeklyFindsChart';

const firstDay = toLocalDayIndex(new Date(2026, 9, 4));

function buildWeeks(counts: number[]): WeeklyFinds[] {
  return counts.map((count, index) => ({
    startDay: firstDay + index * 7,
    endDay: firstDay + index * 7 + 6,
    count,
  }));
}

function renderChart(counts: number[]) {
  render(<WeeklyFindsChart weeks={buildWeeks(counts)} />);
  return screen.getByRole('img', { name: /^Finds per week/ });
}

describe('When the finds per week chart is rendered', () => {
  it('If weeks have finds, Then the data table lists every week with its finds', () => {
    // Arrange & Act
    renderChart([2, 0, 1_500]);

    // Assert
    const table = screen.getByRole('table', { name: 'Finds per Week' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('Oct 4, 2026 – Oct 10, 2026');
    expect(rows[3]).toHaveTextContent('Oct 18, 2026 – Oct 24, 2026');
    expect(rows[3]).toHaveTextContent('1,500');
  });

  it('If the user moves through the chart with the keyboard, Then the tooltip follows Home, End, ArrowLeft, ArrowRight and Escape', () => {
    // Arrange
    const chart = renderChart([2, 0, 5]);
    const tooltip = () => screen.getByTestId('chart-tooltip');

    // Act & Assert
    fireEvent.focus(chart);
    expect(tooltip()).toHaveTextContent('Oct 18, 2026 – Oct 24, 2026');
    expect(tooltip()).toHaveTextContent('Finds5');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(tooltip()).toHaveTextContent('Oct 11, 2026 – Oct 17, 2026');
    expect(tooltip()).toHaveTextContent('Finds0');
    fireEvent.keyDown(chart, { key: 'Home' });
    expect(tooltip()).toHaveTextContent('Oct 4, 2026 – Oct 10, 2026');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(tooltip()).toHaveTextContent('Oct 4, 2026 – Oct 10, 2026');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(tooltip()).toHaveTextContent('Oct 11, 2026 – Oct 17, 2026');
    fireEvent.keyDown(chart, { key: 'End' });
    expect(tooltip()).toHaveTextContent('Finds5');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(tooltip()).toHaveTextContent('Finds5');
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
  });
});
