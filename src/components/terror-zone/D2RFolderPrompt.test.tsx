import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { D2RFolderPrompt } from './D2RFolderPrompt';

function renderPrompt(layout: 'page' | 'inline', note?: string) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={<D2RFolderPrompt layout={layout}>{note && <p>{note}</p>}</D2RFolderPrompt>}
        />
        <Route path="/settings" element={<div>Settings page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('When the D2RFolderPrompt is shown', () => {
  afterEach(() => {
    cleanup();
  });

  describe('If the layout is page', () => {
    it('Then the title is a heading and the button is the primary action', () => {
      // Arrange & Act
      renderPrompt('page');

      // Assert
      expect(
        screen.getByRole('heading', { level: 2, name: 'Set your D2R installation folder' }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('d2r-folder-prompt')).toHaveClass('text-center');
    });
  });

  describe('If the layout is inline', () => {
    it('Then the title is plain text in a box', () => {
      // Arrange & Act
      renderPrompt('inline');

      // Assert
      expect(screen.getByText('Set your D2R installation folder')).toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.getByTestId('d2r-folder-prompt')).toHaveClass('border');
    });
  });

  describe('If the button is clicked', () => {
    it('Then the settings page opens', async () => {
      // Arrange
      renderPrompt('inline');

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Open D2R installation settings' }));

      // Assert
      expect(await screen.findByText('Settings page')).toBeInTheDocument();
    });
  });

  describe('If children are given', () => {
    it('Then they are shown inside the prompt', () => {
      // Arrange & Act
      renderPrompt('inline', 'A note');

      // Assert
      expect(screen.getByTestId('d2r-folder-prompt')).toContainElement(screen.getByText('A note'));
    });
  });
});
