import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuneImages } from './RuneImages';

// Other suites define a non-configurable `window.electronAPI` (vitest runs with isolate: false),
// so it is replaced by assignment rather than vi.stubGlobal, and restored after each test.
const windowGlobals = window as unknown as Record<string, unknown>;
let originalElectronAPI: PropertyDescriptor | undefined;

describe('RuneImages', () => {
  beforeEach(() => {
    originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI');
    windowGlobals.electronAPI = {
      icon: { getByFilename: vi.fn().mockResolvedValue('data:image/png;base64,') },
    };
  });

  afterEach(() => {
    if (originalElectronAPI && 'value' in originalElectronAPI) {
      windowGlobals.electronAPI = originalElectronAPI.value;
    } else {
      delete windowGlobals.electronAPI;
    }
  });

  it('When a completion status marks runes as missing, then only those runes get a non-color missing marker', async () => {
    // Arrange
    const completionStatus = {
      complete: false,
      missingRunes: ['ber'],
      availableCount: 3,
      totalCount: 4,
    };

    // Act
    render(
      <RuneImages
        runeIds={['ber', 'mal', 'ber', 'ist']}
        showRuneNames
        completionStatus={completionStatus}
      />,
    );

    // Assert
    await waitFor(() => expect(screen.getAllByAltText('Ber')).toHaveLength(2));
    expect(screen.getAllByTestId('missing-rune-marker')).toHaveLength(1);
    expect(screen.getAllByText('Missing')).toHaveLength(1);
    expect(screen.getAllByText('Missing')[0]).toHaveClass('sr-only');
  });

  it('If no completion status is provided, then no missing markers are rendered', async () => {
    // Arrange / Act
    render(<RuneImages runeIds={['tal', 'eth']} />);

    // Assert
    await waitFor(() => expect(screen.getByAltText('Tal')).toBeInTheDocument());
    expect(screen.queryByTestId('missing-rune-marker')).not.toBeInTheDocument();
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  });

  it('When a rune is missing, then its image is grayscale, its name is struck through and its tooltip says missing', async () => {
    // Arrange
    const completionStatus = {
      complete: false,
      missingRunes: ['mal'],
      availableCount: 1,
      totalCount: 2,
    };
    render(
      <RuneImages runeIds={['tal', 'mal']} showRuneNames completionStatus={completionStatus} />,
    );
    await waitFor(() => expect(screen.getByAltText('Mal')).toBeInTheDocument());

    // Act
    fireEvent.focus(screen.getByAltText('Mal').closest('button') as HTMLElement);

    // Assert
    expect(screen.getByAltText('Mal')).toHaveClass('grayscale');
    expect(screen.getByText('Mal')).toHaveClass('line-through');
    expect(await screen.findByText('Mal (missing)')).toBeInTheDocument();
    expect(screen.getByAltText('Tal')).not.toHaveClass('grayscale');
    expect(screen.getByText('Tal')).not.toHaveClass('line-through');
  });

  it('If a rune is not missing, then its tooltip shows only the rune name', async () => {
    // Arrange
    const completionStatus = {
      complete: true,
      missingRunes: [],
      availableCount: 1,
      totalCount: 1,
    };
    render(<RuneImages runeIds={['tal']} showRuneNames completionStatus={completionStatus} />);
    await waitFor(() => expect(screen.getByAltText('Tal')).toBeInTheDocument());

    // Act
    fireEvent.focus(screen.getByAltText('Tal').closest('button') as HTMLElement);

    // Assert
    await waitFor(() => expect(screen.getAllByText('Tal').length).toBeGreaterThan(1));
    expect(screen.queryByText('Tal (missing)')).not.toBeInTheDocument();
    expect(screen.getByAltText('Tal')).not.toHaveClass('grayscale');
    expect(screen.getByText('Tal', { selector: 'div' })).not.toHaveClass('line-through');
  });

  it('While rune images are loading, then a missing rune still exposes the Missing text', () => {
    // Arrange
    windowGlobals.electronAPI = {
      icon: { getByFilename: vi.fn().mockReturnValue(new Promise(() => undefined)) },
    };
    const completionStatus = {
      complete: false,
      missingRunes: ['tal'],
      availableCount: 0,
      totalCount: 1,
    };

    // Act
    render(<RuneImages runeIds={['tal']} completionStatus={completionStatus} />);

    // Assert
    expect(screen.getByText('Missing')).toHaveClass('sr-only');
  });
});
