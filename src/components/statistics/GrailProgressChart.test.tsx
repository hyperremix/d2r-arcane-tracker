import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type CumulativeFindsPoint, toLocalDayIndex } from '@/components/statistics/chartData';
import { GrailProgressChart } from '@/components/statistics/GrailProgressChart';

const today = toLocalDayIndex(new Date(2026, 9, 10));

function buildPoints(totals: number[]): CumulativeFindsPoint[] {
  return totals.map((total, index) => ({ day: today - totals.length + index + 1, total }));
}

describe('When the grail progress chart is rendered', () => {
  it('If no item was found yet, Then the empty text replaces the chart', () => {
    // Arrange & Act
    render(<GrailProgressChart points={[]} today={today} totalItems={10} />);

    // Assert
    expect(screen.getByText('No items found yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /^Grail progress over time/ }),
    ).not.toBeInTheDocument();
  });

  it('If the totals have thousands, Then the chart summary uses localized numbers', () => {
    // Arrange & Act
    render(
      <GrailProgressChart points={buildPoints([1_000, 1_234])} today={today} totalItems={2_000} />,
    );

    // Assert
    expect(screen.getByRole('img', { name: /^Grail progress over time/ })).toHaveAccessibleName(
      /1,234 of 2,000 found since/,
    );
  });

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

  it('If the user moves through the chart with the keyboard, Then the tooltip follows Home, End, ArrowLeft, ArrowRight and Escape', () => {
    // Arrange
    render(<GrailProgressChart points={buildPoints([1, 3, 6])} today={today} totalItems={10} />);
    const chart = screen.getByRole('img', { name: /^Grail progress over time/ });
    const tooltip = () => screen.getByTestId('chart-tooltip');

    // Act & Assert
    fireEvent.focus(chart);
    expect(tooltip()).toHaveTextContent('Found6');
    fireEvent.keyDown(chart, { key: 'Home' });
    expect(tooltip()).toHaveTextContent('Found1');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(tooltip()).toHaveTextContent('Found3');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(tooltip()).toHaveTextContent('Found1');
    fireEvent.keyDown(chart, { key: 'End' });
    expect(tooltip()).toHaveTextContent('Found6');
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
  });

  it('If the first save scan found items, Then the chart notes them and its axis starts near them', () => {
    // Arrange
    const points = buildPoints([190, 192, 195]);
    const baseline = { day: points[0].day, count: 190 };

    // Act
    render(
      <GrailProgressChart points={points} baseline={baseline} today={today} totalItems={500} />,
    );

    // Assert
    const chart = screen.getByRole('img', { name: /^Grail progress over time/ });
    expect(chart).toHaveAccessibleName(
      'Grail progress over time: 195 of 500 found, 190 of them by the first scan that found items, on Oct 8, 2026',
    );
    expect(
      screen.getByText('190 items were found by the first scan that found items, on Oct 8, 2026'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('grail-progress-baseline')).toHaveAttribute('aria-hidden', 'true');
    const chartTexts = [...chart.querySelectorAll('text')].map((text) => text.textContent);
    expect(chartTexts).toContain('190');
    expect(chartTexts).not.toContain('0');
  });

  it('If the first save scan found one item, Then the note uses the singular', () => {
    // Arrange
    const points = buildPoints([1, 2]);

    // Act
    render(
      <GrailProgressChart
        points={points}
        baseline={{ day: points[0].day, count: 1 }}
        today={today}
        totalItems={10}
      />,
    );

    // Assert
    expect(
      screen.getByText('1 item was found by the first scan that found items, on Oct 9, 2026'),
    ).toBeInTheDocument();
  });

  it('If there is no baseline, Then there is no note', () => {
    // Arrange & Act
    render(<GrailProgressChart points={buildPoints([1, 2])} today={today} totalItems={10} />);

    // Assert
    expect(screen.queryByText(/by the first scan/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('grail-progress-baseline')).not.toBeInTheDocument();
  });

  it('If no item was found since the first scan, Then the axis is not collapsed onto the baseline', () => {
    // Arrange
    const points = buildPoints([190]);

    // Act
    render(
      <GrailProgressChart
        points={points}
        baseline={{ day: points[0].day, count: 190 }}
        today={today}
        totalItems={500}
      />,
    );

    // Assert
    const chart = screen.getByRole('img', { name: /^Grail progress over time/ });
    const chartTexts = [...chart.querySelectorAll('text')].map((text) => text.textContent);
    expect(chartTexts).toEqual(expect.arrayContaining(['189', '190', '191', '192', '193', '194']));
  });
});
