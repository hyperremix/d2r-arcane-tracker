import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  SaveDirectoryChangeDialog,
  type SaveDirectoryChangeDialogProps,
} from './SaveDirectoryChangeDialog';

function renderDialog(props: Partial<SaveDirectoryChangeDialogProps> = {}) {
  return render(
    <SaveDirectoryChangeDialog
      open
      onOpenChange={vi.fn()}
      action="change"
      isProcessing={false}
      onConfirm={vi.fn()}
      {...props}
    />,
  );
}

describe('SaveDirectoryChangeDialog', () => {
  it('When current and new directories are provided, then both paths are part of the accessible description', () => {
    // Arrange & Act
    renderDialog({ currentDirectory: '/saves/current', newDirectory: '/saves/new' });

    // Assert
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAccessibleDescription(/\/saves\/current/);
    expect(dialog).toHaveAccessibleDescription(/\/saves\/new/);
  });

  it('If the current directory is undefined but a new one is given, then the no directory selected text is shown', () => {
    // Arrange & Act
    renderDialog({ newDirectory: '/saves/new' });

    // Assert
    expect(screen.getByText('Current folder')).toBeInTheDocument();
    expect(screen.getByText('No directory selected')).toBeInTheDocument();
  });

  it('If no directories are provided, then no path list is rendered', () => {
    // Arrange & Act
    renderDialog();

    // Assert
    expect(screen.queryByText('Current folder')).not.toBeInTheDocument();
    expect(screen.queryByText('New folder')).not.toBeInTheDocument();
  });

  it('If onBackup is not provided, then the Back up first button is not rendered', () => {
    // Arrange & Act
    renderDialog();

    // Assert
    expect(screen.queryByRole('button', { name: 'Back up first' })).not.toBeInTheDocument();
  });

  it('When Back up first is clicked, then onBackup is called', () => {
    // Arrange
    const onBackup = vi.fn();
    renderDialog({ onBackup });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Back up first' }));

    // Assert
    expect(onBackup).toHaveBeenCalledTimes(1);
  });

  it('If a backup is in progress, then the confirm, cancel and backup actions are disabled', () => {
    // Arrange & Act
    renderDialog({ onBackup: vi.fn(), isBackingUp: true });

    // Assert
    expect(screen.getByRole('button', { name: 'Creating Backup...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete progress and switch folder' }),
    ).toBeDisabled();
  });

  it('When the change is confirmed, Then the destructive action names what it does', () => {
    // Arrange
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Delete progress and switch folder' }));

    // Assert
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('If the default directory is restored, Then the destructive action names the default folder', () => {
    // Arrange & Act
    renderDialog({ action: 'restore' });

    // Assert
    expect(
      screen.getByRole('button', { name: 'Delete progress and use default folder' }),
    ).toBeInTheDocument();
  });

  it('If the existing data is known, Then the warning states how many characters and finds are deleted', () => {
    // Arrange & Act
    renderDialog({ existingData: { characters: 3, progress: 1 } });

    // Assert
    expect(
      screen.getByText(
        'This permanently deletes 3 characters and 1 recorded grail find from the app.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('This action will permanently delete all characters and progress data.'),
    ).not.toBeInTheDocument();
  });

  it('If the existing data is unknown, Then the generic delete warning is shown', () => {
    // Arrange & Act
    renderDialog();

    // Assert
    expect(
      screen.getByText('This action will permanently delete all characters and progress data.'),
    ).toBeInTheDocument();
  });

  it('If a backup can be made, Then Back up first is focused when the dialog opens', async () => {
    // Arrange & Act
    renderDialog({ onBackup: vi.fn() });

    // Assert
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back up first' })).toHaveFocus(),
    );
  });

  it('If a backup was created, Then Back up first is a secondary action instead of the primary one', () => {
    // Arrange & Act
    const { unmount } = renderDialog({ onBackup: vi.fn() });

    // Assert
    expect(screen.getByRole('button', { name: 'Back up first' })).toHaveClass('bg-primary');

    // Act
    unmount();
    renderDialog({ onBackup: vi.fn(), hasBackedUp: true });

    // Assert
    expect(screen.getByRole('button', { name: 'Back up first' })).not.toHaveClass('bg-primary');
  });

  it('If a backup was created, then the success note is shown', () => {
    // Arrange & Act
    renderDialog({ onBackup: vi.fn(), hasBackedUp: true });

    // Assert
    expect(
      screen.getByText('Backup created. You can now continue with the directory change.'),
    ).toBeInTheDocument();
  });
});
