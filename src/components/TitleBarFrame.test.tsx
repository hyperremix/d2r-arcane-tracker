import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TitleBarFrame } from './TitleBarFrame';

describe('When TitleBarFrame is rendered', () => {
  const originalElectronAPI = window.electronAPI;

  const setPlatform = (platform: 'darwin' | 'win32' | 'linux') => {
    Object.defineProperty(window, 'electronAPI', {
      value: { platform },
      configurable: true,
      writable: true,
    });
  };

  const renderFrame = (centered?: boolean) => {
    render(
      <TitleBarFrame centered={centered} className="gap-2">
        <span>content</span>
      </TitleBarFrame>,
    );
    const frame = screen.getByRole('banner');
    return { frame, children: Array.from(frame.children) };
  };

  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('Then it is a title bar landmark with the drag region class and the given classes', () => {
    // Arrange
    setPlatform('darwin');

    // Act
    const { frame } = renderFrame();

    // Assert
    expect(frame).toHaveClass('titlebar', 'gap-2');
  });

  it('If the platform is macOS, Then space for the traffic lights is reserved on the first render', () => {
    // Arrange
    setPlatform('darwin');

    // Act
    const { children } = renderFrame();

    // Assert
    expect(children).toHaveLength(2);
    expect(children[0]).toHaveClass('w-20');
    expect(children[1]).toHaveTextContent('content');
  });

  it('If the platform is Windows, Then space for the native controls overlay is reserved on the right', () => {
    // Arrange
    setPlatform('win32');

    // Act
    const { children } = renderFrame();

    // Assert
    expect(children).toHaveLength(2);
    expect(children[0]).toHaveTextContent('content');
    expect(children[1]).toHaveClass('w-36');
  });

  it('If the content is centered on macOS, Then the traffic light space is mirrored on the right', () => {
    // Arrange
    setPlatform('darwin');

    // Act
    const { children } = renderFrame(true);

    // Assert
    expect(children).toHaveLength(3);
    expect(children[0]).toHaveClass('w-20');
    expect(children[2]).toHaveClass('w-20');
  });

  it('If the content is centered on Windows, Then space is reserved on both sides', () => {
    // Arrange
    setPlatform('win32');

    // Act
    const { children } = renderFrame(true);

    // Assert
    expect(children).toHaveLength(3);
    expect(children[0]).toHaveClass('w-8');
    expect(children[2]).toHaveClass('w-36');
  });
});
