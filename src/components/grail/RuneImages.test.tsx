import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
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
});
