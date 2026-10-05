import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings } from './Settings';

vi.mock('./SaveFileMonitor', () => ({ SaveFileMonitor: () => <div>SaveFileMonitorCard</div> }));
vi.mock('./D2RInstallationSettings', () => ({
  D2RInstallationSettings: () => <div>D2RInstallationCard</div>,
}));
vi.mock('./GameModeSettings', () => ({ GameModeSettings: () => <div>GameModeCard</div> }));
vi.mock('./GameVersionSettings', () => ({ GameVersionSettings: () => <div>GameVersionCard</div> }));
vi.mock('./GrailSettings', () => ({ GrailSettings: () => <div>GrailCard</div> }));
vi.mock('./RunTrackerSettings', () => ({ RunTrackerSettings: () => <div>RunTrackerCard</div> }));
vi.mock('./ThemeSettings', () => ({ ThemeSettings: () => <div>ThemeCard</div> }));
vi.mock('./ItemIconSettings', () => ({ ItemIconSettings: () => <div>ItemIconCard</div> }));
vi.mock('./WidgetSettings', () => ({ WidgetSettings: () => <div>WidgetCard</div> }));
vi.mock('./NotificationSettings', () => ({
  NotificationSettings: () => <div>NotificationCard</div>,
}));
vi.mock('./Database', () => ({ DatabaseCard: () => <div>DatabaseCard</div> }));
vi.mock('./UpdateSettings', () => ({ UpdateSettings: () => <div>UpdateCard</div> }));
vi.mock('./ReportIssues', () => ({ ReportIssues: () => <div>ReportIssuesCard</div> }));

const sectionNames = ['General', 'Tracking', 'Display', 'Data', 'About'];

/**
 * Mocks the vertical position of each section relative to the scroll container top (0).
 */
function mockSectionPositions(positions: Record<string, number>) {
  for (const [id, top] of Object.entries(positions)) {
    const element = document.getElementById(`settings-section-${id}`);
    if (element) {
      element.getBoundingClientRect = () => ({ top }) as DOMRect;
    }
  }
}

describe('Settings', () => {
  const scrollIntoViewMock = vi.fn();
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    scrollIntoViewMock.mockClear();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Runs animation frames through (fake) timers so scroll-spy updates can be flushed.
   */
  function mockAnimationFrames() {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0) as unknown as number,
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => clearTimeout(id));
  }

  it('When the page renders, Then it shows a navigation entry and a headed section per group', () => {
    // Arrange & Act
    render(<Settings />);

    // Assert
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    const navButtons = within(nav).getAllByRole('button');
    expect(navButtons.map((button) => button.textContent)).toEqual(sectionNames);
    for (const name of sectionNames) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it('When the page renders, Then the cards are grouped into their sections', () => {
    // Arrange & Act
    render(<Settings />);

    // Assert
    const general = screen.getByRole('region', { name: 'General' });
    expect(within(general).getByText('SaveFileMonitorCard')).toBeInTheDocument();
    expect(within(general).getByText('D2RInstallationCard')).toBeInTheDocument();
    expect(within(general).getByText('GameModeCard')).toBeInTheDocument();
    expect(within(general).getByText('GameVersionCard')).toBeInTheDocument();

    const tracking = screen.getByRole('region', { name: 'Tracking' });
    expect(within(tracking).getByText('GrailCard')).toBeInTheDocument();
    expect(within(tracking).getByText('RunTrackerCard')).toBeInTheDocument();

    const display = screen.getByRole('region', { name: 'Display' });
    expect(within(display).getByText('ThemeCard')).toBeInTheDocument();
    expect(within(display).getByText('ItemIconCard')).toBeInTheDocument();
    expect(within(display).getByText('WidgetCard')).toBeInTheDocument();
    expect(within(display).getByText('NotificationCard')).toBeInTheDocument();

    const data = screen.getByRole('region', { name: 'Data' });
    expect(within(data).getByText('DatabaseCard')).toBeInTheDocument();
    expect(within(data).getByRole('button', { name: 'Run Setup Wizard' })).toBeInTheDocument();

    const about = screen.getByRole('region', { name: 'About' });
    expect(within(about).getByText('UpdateCard')).toBeInTheDocument();
    expect(within(about).getByText('ReportIssuesCard')).toBeInTheDocument();
  });

  it('When the page renders, Then the first section is marked as current', () => {
    // Arrange & Act
    render(<Settings />);

    // Assert
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(nav).getByRole('button', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getByRole('button', { name: 'Display' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('When a navigation entry is clicked, Then it scrolls to the section, marks it current and focuses its heading', () => {
    // Arrange
    render(<Settings />);
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    const displayButton = within(nav).getByRole('button', { name: 'Display' });

    // Act
    fireEvent.click(displayButton);

    // Assert
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock.mock.contexts[0]).toBe(
      document.getElementById('settings-section-display'),
    );
    expect(displayButton).toHaveAttribute('aria-current', 'location');
    expect(within(nav).getByRole('button', { name: 'General' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Display' })).toHaveFocus();
  });

  it('If the user scrolls the content, Then the section at the top becomes current', async () => {
    // Arrange
    mockAnimationFrames();
    render(<Settings />);
    const container = screen.getByTestId('settings-scroll-container');
    container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 5000 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 800 });
    container.scrollTop = 1200;
    mockSectionPositions({ general: -1200, tracking: -400, display: 20, data: 900, about: 1600 });

    // Act
    fireEvent.scroll(container);
    await act(async () => {
      vi.runAllTimers();
    });

    // Assert
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(nav).getByRole('button', { name: 'Display' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });

  it('If the user scrolls to the bottom, Then the last section becomes current', async () => {
    // Arrange
    mockAnimationFrames();
    render(<Settings />);
    const container = screen.getByTestId('settings-scroll-container');
    container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 5000 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 800 });
    container.scrollTop = 4200;
    mockSectionPositions({
      general: -4200,
      tracking: -3000,
      display: -2000,
      data: 300,
      about: 600,
    });

    // Act
    fireEvent.scroll(container);
    await act(async () => {
      vi.runAllTimers();
    });

    // Assert
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(nav).getByRole('button', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });
});
