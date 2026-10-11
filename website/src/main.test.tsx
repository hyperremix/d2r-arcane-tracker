import { afterEach, describe, expect, it, vi } from 'vitest';

const hydrateRoot = vi.fn();
const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));

async function loadMain(): Promise<void> {
  vi.resetModules();
  vi.doMock('react-dom/client', () => ({ createRoot, hydrateRoot }));
  await import('./main');
}

describe('When the website starts in the browser', () => {
  afterEach(() => {
    vi.doUnmock('react-dom/client');
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('If the page was prerendered, then the root is hydrated', async () => {
    // Arrange
    document.body.innerHTML = '<div id="root"><main id="main"></main></div>';

    // Act
    await loadMain();

    // Assert
    expect(hydrateRoot).toHaveBeenCalledWith(document.getElementById('root'), expect.anything());
    expect(createRoot).not.toHaveBeenCalled();
  });

  it('If the page was not prerendered, then it is rendered on the client', async () => {
    // Arrange
    document.body.innerHTML = '<div id="root"><!--app-html--></div>';

    // Act
    await loadMain();

    // Assert
    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(render).toHaveBeenCalledOnce();
    expect(hydrateRoot).not.toHaveBeenCalled();
  });

  it('If the root element is missing, then starting fails', async () => {
    // Arrange
    document.body.innerHTML = '';

    // Act
    const start = loadMain();

    // Assert
    await expect(start).rejects.toThrow('Root element not found');
  });
});
