import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  Toaster: vi.fn(() => null),
}));

vi.mock('@/hooks/useTheme', () => ({
  useResolvedTheme: vi.fn(),
}));

import { Toaster as Sonner } from 'sonner';
import { useResolvedTheme } from '@/hooks/useTheme';
import type { Toaster as ToasterComponent } from './sonner';

// Test files share one module registry (isolate: false), so './sonner' may already be cached by
// another suite with the real dependencies. Load a separate instance so this suite's mocks apply.
const { Toaster } = (await import(/* @vite-ignore */ `${'./sonner'}?isolated`)) as {
  Toaster: typeof ToasterComponent;
};

describe('When the Toaster is rendered', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('If the app theme resolves to dark', () => {
    it('Then should pass the dark theme to sonner', () => {
      // Arrange
      vi.mocked(useResolvedTheme).mockReturnValue('dark');

      // Act
      render(<Toaster position="bottom-left" />);

      // Assert
      expect(vi.mocked(Sonner).mock.lastCall?.[0]).toMatchObject({
        theme: 'dark',
        position: 'bottom-left',
      });
    });
  });

  describe('If the app theme resolves to light', () => {
    it('Then should pass the light theme to sonner', () => {
      // Arrange
      vi.mocked(useResolvedTheme).mockReturnValue('light');

      // Act
      render(<Toaster />);

      // Assert
      expect(vi.mocked(Sonner).mock.lastCall?.[0]).toMatchObject({ theme: 'light' });
    });
  });
});
