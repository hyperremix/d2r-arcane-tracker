import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: 'Change Directory' })).toBeDisabled();
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
