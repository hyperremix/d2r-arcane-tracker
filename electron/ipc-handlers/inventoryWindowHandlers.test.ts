import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn(),
  openInventorySnapshotWindowMock: vi.fn(),
  getAllWindowsMock: vi.fn(),
  snapshotWindowSendMock: vi.fn(),
  snapshotWindowOnceMock: vi.fn(),
  snapshotWindowIsDestroyedMock: vi.fn(),
  snapshotWindowIsLoadingMainFrameMock: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.handleMock,
    on: mocks.onMock,
  },
  BrowserWindow: {
    getAllWindows: mocks.getAllWindowsMock,
  },
}));

vi.mock('../window/inventorySnapshotWindow', () => ({
  openInventorySnapshotWindow: mocks.openInventorySnapshotWindowMock,
}));

import { initializeInventoryWindowHandlers } from './inventoryWindowHandlers';

describe('When inventory window IPC handlers are initialized', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.snapshotWindowIsDestroyedMock.mockReturnValue(false);
    mocks.snapshotWindowIsLoadingMainFrameMock.mockReturnValue(false);
    mocks.openInventorySnapshotWindowMock.mockReturnValue({
      webContents: {
        send: mocks.snapshotWindowSendMock,
        once: mocks.snapshotWindowOnceMock,
        isDestroyed: mocks.snapshotWindowIsDestroyedMock,
        isLoadingMainFrame: mocks.snapshotWindowIsLoadingMainFrameMock,
      },
    });
  });

  describe('If initializeInventoryWindowHandlers is called', () => {
    it('Then inventory snapshot window channel is registered', () => {
      // Arrange

      // Act
      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');

      // Assert
      expect(mocks.handleMock).toHaveBeenCalledWith(
        'inventory:openSnapshotWindow',
        expect.any(Function),
      );
      expect(mocks.handleMock).toHaveBeenCalledWith(
        'inventory:getActiveDragState',
        expect.any(Function),
      );
      expect(mocks.onMock).toHaveBeenCalledWith('inventory:vault-drag-state', expect.any(Function));
      expect(mocks.onMock).toHaveBeenCalledWith('inventory:item-drag-state', expect.any(Function));
    });
  });

  describe('If inventory:openSnapshotWindow is invoked with valid target', () => {
    it('Then it opens or focuses the requested snapshot window', async () => {
      // Arrange
      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:openSnapshotWindow',
      )?.[1];

      // Act
      const result = await handler?.(null, {
        sourceFilePath: '/tmp/sorc.d2s',
        sourceFileType: 'd2s',
        characterName: 'Sorc',
      });

      // Assert
      expect(mocks.openInventorySnapshotWindowMock).toHaveBeenCalledWith(
        {
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('If inventory:openSnapshotWindow receives invalid target', () => {
    it('Then it rejects the request', async () => {
      // Arrange
      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:openSnapshotWindow',
      )?.[1];

      // Act
      const promise = handler?.(null, {
        sourceFilePath: '/tmp/sorc.d2s',
        sourceFileType: 'zip',
        characterName: 'Sorc',
      });

      // Assert
      await expect(promise).rejects.toThrow('sourceFileType must be one of: d2s, sss, d2x, d2i');
    });
  });

  describe('If inventory:vault-drag-state is emitted with a valid payload', () => {
    it('Then the payload is relayed to all other renderer windows', () => {
      // Arrange
      const senderWindow = {
        webContents: {
          id: 101,
          isDestroyed: () => false,
          send: vi.fn(),
        },
      };
      const receiverSend = vi.fn();
      const receiverWindow = {
        webContents: {
          id: 202,
          isDestroyed: () => false,
          send: receiverSend,
        },
      };
      mocks.getAllWindowsMock.mockReturnValue([senderWindow, receiverWindow]);

      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');
      const listener = mocks.onMock.mock.calls.find(
        (call) => call[0] === 'inventory:vault-drag-state',
      )?.[1];
      const payload = {
        active: true,
        id: 'vault-1',
        gridWidth: 2,
        gridHeight: 3,
      };

      // Act
      listener?.(
        {
          sender: {
            id: 101,
          },
        },
        payload,
      );

      // Assert
      expect(receiverSend).toHaveBeenCalledWith('inventory:vault-drag-state', payload);
      expect(senderWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('If inventory:getActiveDragState is invoked', () => {
    it('Then it returns the latest active drag payload', async () => {
      // Arrange
      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');
      const vaultDragListener = mocks.onMock.mock.calls.find(
        (call) => call[0] === 'inventory:vault-drag-state',
      )?.[1];
      const getActiveDragStateHandler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:getActiveDragState',
      )?.[1];
      const payload = {
        active: true,
        id: 'vault-active-1',
        gridWidth: 2,
        gridHeight: 3,
      };

      // Act
      vaultDragListener?.(
        {
          sender: {
            id: 101,
          },
        },
        payload,
      );
      const result = await getActiveDragStateHandler?.();

      // Assert
      expect(result).toEqual({
        vault: payload,
      });
    });
  });

  describe('If inventory:openSnapshotWindow is invoked while drag state is active', () => {
    it('Then current drag state is sent to the opened snapshot window', async () => {
      // Arrange
      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');
      const vaultDragListener = mocks.onMock.mock.calls.find(
        (call) => call[0] === 'inventory:vault-drag-state',
      )?.[1];
      const openSnapshotWindowHandler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:openSnapshotWindow',
      )?.[1];
      const payload = {
        active: true,
        id: 'vault-active-2',
        gridWidth: 2,
        gridHeight: 2,
      };

      vaultDragListener?.(
        {
          sender: {
            id: 101,
          },
        },
        payload,
      );

      // Act
      await openSnapshotWindowHandler?.(null, {
        sourceFilePath: '/tmp/sorc.d2s',
        sourceFileType: 'd2s',
        characterName: 'Sorc',
      });

      // Assert
      expect(mocks.snapshotWindowSendMock).toHaveBeenCalledWith(
        'inventory:vault-drag-state',
        payload,
      );
    });
  });

  describe('If inventory:vault-drag-state is emitted with an invalid payload', () => {
    it('Then no payload is relayed to renderer windows', () => {
      // Arrange
      const receiverSend = vi.fn();
      mocks.getAllWindowsMock.mockReturnValue([
        {
          webContents: {
            id: 202,
            isDestroyed: () => false,
            send: receiverSend,
          },
        },
      ]);

      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');
      const listener = mocks.onMock.mock.calls.find(
        (call) => call[0] === 'inventory:vault-drag-state',
      )?.[1];

      // Act
      listener?.(
        {
          sender: {
            id: 101,
          },
        },
        {
          active: true,
          id: '',
        },
      );

      // Assert
      expect(receiverSend).not.toHaveBeenCalled();
    });
  });

  describe('If inventory:item-drag-state is emitted with a valid payload', () => {
    it('Then the payload is relayed to all other renderer windows', () => {
      // Arrange
      const senderWindow = {
        webContents: {
          id: 101,
          isDestroyed: () => false,
          send: vi.fn(),
        },
      };
      const receiverSend = vi.fn();
      const receiverWindow = {
        webContents: {
          id: 202,
          isDestroyed: () => false,
          send: receiverSend,
        },
      };
      mocks.getAllWindowsMock.mockReturnValue([senderWindow, receiverWindow]);

      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');
      const listener = mocks.onMock.mock.calls.find(
        (call) => call[0] === 'inventory:item-drag-state',
      )?.[1];
      const payload = {
        active: true,
        fingerprint: 'fp-1',
        sourceFilePath: '/tmp/sorc.d2s',
        sourceFileType: 'd2s',
        sourceLocationContext: 'inventory',
        rawItemJson: '{"id":42}',
        sourceGridX: 1,
        sourceGridY: 2,
        gridWidth: 2,
        gridHeight: 3,
      };

      // Act
      listener?.(
        {
          sender: {
            id: 101,
          },
        },
        payload,
      );

      // Assert
      expect(receiverSend).toHaveBeenCalledWith('inventory:item-drag-state', payload);
      expect(senderWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('If inventory:item-drag-state is emitted with an invalid payload', () => {
    it('Then no payload is relayed to renderer windows', () => {
      // Arrange
      const receiverSend = vi.fn();
      mocks.getAllWindowsMock.mockReturnValue([
        {
          webContents: {
            id: 202,
            isDestroyed: () => false,
            send: receiverSend,
          },
        },
      ]);

      initializeInventoryWindowHandlers('/tmp/main', 'http://localhost:5173', '/tmp/renderer');
      const listener = mocks.onMock.mock.calls.find(
        (call) => call[0] === 'inventory:item-drag-state',
      )?.[1];

      // Act
      listener?.(
        {
          sender: {
            id: 101,
          },
        },
        {
          active: true,
          fingerprint: '',
        },
      );

      // Assert
      expect(receiverSend).not.toHaveBeenCalled();
    });
  });
});
