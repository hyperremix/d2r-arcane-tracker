import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D2RInstallationSettings } from './D2RInstallationSettings';

const originalElectronAPI = window.electronAPI;

describe('When D2RInstallationSettings is rendered', () => {
  beforeEach(() => {
    window.electronAPI = {
      platform: 'darwin',
      icon: {
        getD2RPath: vi.fn().mockResolvedValue('/games/d2r'),
        setD2RPath: vi.fn().mockResolvedValue(undefined),
      },
      dialog: { showOpenDialog: vi.fn() },
    } as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('Then the icon-only browse button has an accessible name', async () => {
    // Arrange & Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByDisplayValue('/games/d2r')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse for directory' })).toBeInTheDocument();
  });
});
