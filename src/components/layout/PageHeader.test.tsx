import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('When PageHeader is rendered', () => {
  it('If only a title is given, Then it renders the title as the single level-one heading', () => {
    // Arrange & Act
    const { container } = render(<PageHeader title="Statistics" />);

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Statistics' })).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('If a description and actions are given, Then both are rendered next to the title', () => {
    // Arrange & Act
    render(
      <PageHeader
        title="Run Tracker"
        description="Track your sessions"
        actions={<button type="button">Export</button>}
      />,
    );

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Run Tracker' })).toBeInTheDocument();
    expect(screen.getByText('Track your sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('If it is visually hidden, Then the heading stays accessible but the header is screen-reader only', () => {
    // Arrange & Act
    const { container } = render(<PageHeader title="Holy Grail" visuallyHidden />);

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Holy Grail' })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('sr-only');
  });

  it('If it is not visually hidden, Then the header is not screen-reader only', () => {
    // Arrange & Act
    const { container } = render(<PageHeader title="Settings" />);

    // Assert
    expect(container.firstElementChild).not.toHaveClass('sr-only');
  });
});
