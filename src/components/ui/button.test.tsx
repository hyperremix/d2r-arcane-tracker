import { Popover } from '@base-ui/react';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('When Button is given a ref', () => {
  it('Then the ref points at the rendered button element', () => {
    // Arrange
    const ref = createRef<HTMLElement>();

    // Act
    render(<Button ref={ref}>Save</Button>);

    // Assert
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Save' }));
  });

  it('If it is rendered as a popover trigger, Then the trigger ref reaches the button element', () => {
    // Arrange
    const ref = createRef<HTMLButtonElement>();

    // Act
    render(
      <Popover.Root>
        <Popover.Trigger ref={ref} render={<Button variant="outline" />}>
          View
        </Popover.Trigger>
      </Popover.Root>,
    );

    // Assert
    expect(ref.current).toBe(screen.getByRole('button', { name: 'View' }));
  });
});

describe('When Button uses the link variant', () => {
  it('Then it uses the shared link style instead of the accent', () => {
    // Arrange
    const name = 'Show details';

    // Act
    render(<Button variant="link">{name}</Button>);

    // Assert
    const button = screen.getByRole('button', { name });
    expect(button).toHaveClass(
      'text-foreground',
      'underline',
      'decoration-muted-foreground',
      'underline-offset-4',
      'hover:decoration-foreground',
    );
    expect(button).not.toHaveClass('text-primary');
  });
});
