import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './dialog';

function renderDialog(showCloseButton?: boolean) {
  render(
    <Dialog open>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
      </DialogContent>
    </Dialog>,
  );
}

describe('When DialogContent is rendered', () => {
  it('Then the icon-only close button has the translated accessible name "Close"', () => {
    // Arrange & Act
    renderDialog();

    // Assert
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('If the close button is disabled via showCloseButton, Then no close button is rendered', () => {
    // Arrange & Act
    renderDialog(false);

    // Assert
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});

describe('When DialogFooter is rendered with showCloseButton', () => {
  it('Then the footer close button is labelled with the translated text', () => {
    // Arrange & Act
    render(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    );

    // Assert
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
