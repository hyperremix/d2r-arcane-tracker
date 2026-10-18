import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TerrorZoneIcon } from './TerrorZoneIcon';

describe('When TerrorZoneIcon is rendered', () => {
  it('Then it renders a decorative svg that inherits the text color', () => {
    // Arrange & Act
    const { container } = render(<TerrorZoneIcon />);

    // Assert
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '12 12 198 208');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.querySelector('path')).toHaveAttribute('fill-rule', 'evenodd');
  });

  it('If a className is passed, then it is forwarded to the svg', () => {
    // Arrange & Act
    const { container } = render(<TerrorZoneIcon className="h-4 w-4 shrink-0" />);

    // Assert
    expect(container.querySelector('svg')).toHaveClass('h-4', 'w-4', 'shrink-0');
  });
});
