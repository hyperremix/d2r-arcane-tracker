import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { D2RFolderPrompt } from './D2RFolderPrompt';

const SUGGESTED_PATH = 'C:\\Program Files (x86)\\Diablo II Resurrected';
const originalElectronAPI = window.electronAPI;
const originalSettings = useGrailStore.getState().settings;

function setupIconApi({
  suggestion,
  suggestionFails = false,
  saveFails = false,
}: {
  suggestion?: string;
  suggestionFails?: boolean;
  saveFails?: boolean;
} = {}) {
  const icon = {
    getSuggestedD2RPath: suggestionFails
      ? vi.fn().mockRejectedValue(new Error('ipc failed'))
      : vi.fn().mockResolvedValue(suggestion),
    setD2RPath: saveFails
      ? vi.fn().mockRejectedValue(new Error('write failed'))
      : vi.fn().mockResolvedValue(undefined),
  };
  window.electronAPI = { icon } as unknown as typeof window.electronAPI;
  return icon;
}

function renderPrompt(layout: 'page' | 'inline', onFolderSet = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <D2RFolderPrompt
              layout={layout}
              description="Set it to see drop rates."
              onFolderSet={onFolderSet}
            />
          }
        />
        <Route path="/settings" element={<div>Settings page</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return onFolderSet;
}

describe('When the D2RFolderPrompt is shown', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.electronAPI = originalElectronAPI;
    useGrailStore.setState({ settings: originalSettings });
  });

  describe('If the layout is page', () => {
    it('Then the title is a heading with the description and the button is the primary action', async () => {
      // Arrange
      const icon = setupIconApi();

      // Act
      renderPrompt('page');

      // Assert
      expect(
        screen.getByRole('heading', { level: 2, name: 'Set your D2R installation folder' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Set it to see drop rates.')).toBeInTheDocument();
      expect(screen.getByTestId('d2r-folder-prompt')).toHaveClass('text-center');
      expect(screen.getByRole('button', { name: 'Open D2R installation settings' })).toHaveClass(
        'bg-primary',
      );
      await waitFor(() => expect(icon.getSuggestedD2RPath).toHaveBeenCalledTimes(1));
    });
  });

  describe('If the layout is inline', () => {
    it('Then it is one line with the description and no heading', async () => {
      // Arrange
      const icon = setupIconApi();

      // Act
      renderPrompt('inline');

      // Assert
      expect(screen.getByText('Set it to see drop rates.')).toBeInTheDocument();
      expect(screen.queryByText('Set your D2R installation folder')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.getByTestId('d2r-folder-prompt')).toHaveClass('flex-wrap', 'items-center');
      await waitFor(() => expect(icon.getSuggestedD2RPath).toHaveBeenCalledTimes(1));
    });
  });

  describe('If the settings button is clicked', () => {
    it('Then the settings page opens', async () => {
      // Arrange
      setupIconApi();
      renderPrompt('inline');

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Open D2R installation settings' }));

      // Assert
      expect(await screen.findByText('Settings page')).toBeInTheDocument();
    });
  });

  describe('If an installation was found', () => {
    it('Then it is offered with one click next to the settings button', async () => {
      // Arrange
      setupIconApi({ suggestion: SUGGESTED_PATH });

      // Act
      renderPrompt('page');

      // Assert
      expect(
        await screen.findByRole('button', { name: `Use ${SUGGESTED_PATH}` }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open D2R installation settings' })).toHaveClass(
        'border-border',
      );
    });

    it('Then the button shows the full folder as its title in case the label is truncated', async () => {
      // Arrange
      setupIconApi({ suggestion: SUGGESTED_PATH });

      // Act
      renderPrompt('page');

      // Assert
      expect(await screen.findByRole('button', { name: `Use ${SUGGESTED_PATH}` })).toHaveAttribute(
        'title',
        SUGGESTED_PATH,
      );
    });

    it('Then nothing is saved until the user clicks it', async () => {
      // Arrange
      const icon = setupIconApi({ suggestion: SUGGESTED_PATH });

      // Act
      renderPrompt('inline');
      await screen.findByRole('button', { name: `Use ${SUGGESTED_PATH}` });

      // Assert
      expect(icon.setD2RPath).not.toHaveBeenCalled();
      expect(useGrailStore.getState().settings.d2rInstallPath).toBe(
        originalSettings.d2rInstallPath,
      );
    });

    it('Then clicking it saves the folder and tells the surface', async () => {
      // Arrange
      const icon = setupIconApi({ suggestion: SUGGESTED_PATH });
      const onFolderSet = renderPrompt('inline');

      // Act
      fireEvent.click(await screen.findByRole('button', { name: `Use ${SUGGESTED_PATH}` }));

      // Assert
      await waitFor(() => expect(onFolderSet).toHaveBeenCalledTimes(1));
      expect(icon.setD2RPath).toHaveBeenCalledWith(SUGGESTED_PATH);
      expect(useGrailStore.getState().settings.d2rInstallPath).toBe(SUGGESTED_PATH);
    });

    it('Then a failed save says so and leaves the folder unset', async () => {
      // Arrange
      setupIconApi({ suggestion: SUGGESTED_PATH, saveFails: true });
      const onFolderSet = renderPrompt('inline');

      // Act
      fireEvent.click(await screen.findByRole('button', { name: `Use ${SUGGESTED_PATH}` }));

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not save the installation path. Please try again.',
      );
      expect(onFolderSet).not.toHaveBeenCalled();
      expect(useGrailStore.getState().settings.d2rInstallPath).toBe(
        originalSettings.d2rInstallPath,
      );
    });
  });

  describe('If looking for an installation fails', () => {
    it('Then only the settings button is offered', async () => {
      // Arrange
      const icon = setupIconApi({ suggestionFails: true });

      // Act
      renderPrompt('page');

      // Assert
      await waitFor(() => expect(console.error).toHaveBeenCalled());
      expect(icon.getSuggestedD2RPath).toHaveBeenCalledTimes(1);
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Open D2R installation settings' }),
      ).toBeInTheDocument();
    });
  });
});
