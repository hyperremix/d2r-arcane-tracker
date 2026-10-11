import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShortcutRecorder } from './ShortcutRecorder';

const originalElectronAPI = window.electronAPI;

function setPlatform(platform: string) {
  window.electronAPI = { platform } as unknown as typeof window.electronAPI;
}

describe('When ShortcutRecorder shows a shortcut', () => {
  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('If the app runs on macOS, Then the value and placeholder use the Command key', () => {
    // Arrange
    setPlatform('darwin');

    // Act
    render(
      <>
        <ShortcutRecorder id="value" label="Value" value="Ctrl+Shift+E" onChange={vi.fn()} />
        <ShortcutRecorder
          id="placeholder"
          label="Placeholder"
          value=""
          placeholder="Ctrl+R"
          onChange={vi.fn()}
        />
      </>,
    );

    // Assert
    expect(screen.getByLabelText('Value')).toHaveValue('⇧⌘E');
    expect(screen.getByLabelText('Placeholder')).toHaveAttribute('placeholder', '⌘R');
  });

  it('If the app runs on Windows, Then the value and placeholder keep Ctrl', () => {
    // Arrange
    setPlatform('win32');

    // Act
    render(
      <>
        <ShortcutRecorder id="value" label="Value" value="Ctrl+Shift+E" onChange={vi.fn()} />
        <ShortcutRecorder
          id="placeholder"
          label="Placeholder"
          value=""
          placeholder="Ctrl+R"
          onChange={vi.fn()}
        />
      </>,
    );

    // Assert
    expect(screen.getByLabelText('Value')).toHaveValue('Ctrl+Shift+E');
    expect(screen.getByLabelText('Placeholder')).toHaveAttribute('placeholder', 'Ctrl+R');
  });

  it('When Command+R is recorded on macOS, Then the stored Ctrl+R form is reported', () => {
    // Arrange
    setPlatform('darwin');
    const onChange = vi.fn();
    render(<ShortcutRecorder id="value" label="Value" value="Ctrl+E" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    // Act
    fireEvent.keyDown(window, { key: 'r', metaKey: true });

    // Assert
    expect(onChange).toHaveBeenCalledWith('Ctrl+R');
  });
});
