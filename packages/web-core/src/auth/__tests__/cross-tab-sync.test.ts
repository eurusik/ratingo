/**
 * Tests for cross-tab token synchronization.
 */

import {
  initCrossTabSync,
  broadcastRefreshStart,
  broadcastRefreshSuccess,
  broadcastRefreshFailed,
  broadcastLogout,
  destroyCrossTabSync,
} from '../cross-tab-sync';
import { tokenStorage } from '../token-storage';

// Mock token storage
jest.mock('../token-storage', () => ({
  tokenStorage: {
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

// Mock BroadcastChannel
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    if (this.closed) return;
    // Simulate broadcast to other instances with same name
    MockBroadcastChannel.instances
      .filter((instance) => instance !== this && instance.name === this.name && !instance.closed)
      .forEach((instance) => {
        if (instance.onmessage) {
          instance.onmessage(new MessageEvent('message', { data: message }));
        }
      });
  }

  close() {
    this.closed = true;
    const index = MockBroadcastChannel.instances.indexOf(this);
    if (index > -1) {
      MockBroadcastChannel.instances.splice(index, 1);
    }
  }

  static reset() {
    MockBroadcastChannel.instances = [];
  }
}

describe('Cross-Tab Sync', () => {
  const originalBroadcastChannel = global.BroadcastChannel;

  beforeAll(() => {
    // @ts-expect-error - Mock BroadcastChannel
    global.BroadcastChannel = MockBroadcastChannel;
  });

  afterAll(() => {
    global.BroadcastChannel = originalBroadcastChannel;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    MockBroadcastChannel.reset();
    destroyCrossTabSync();
  });

  afterEach(() => {
    destroyCrossTabSync();
  });

  describe('initCrossTabSync', () => {
    it('should create BroadcastChannel', () => {
      initCrossTabSync({});

      expect(MockBroadcastChannel.instances).toHaveLength(1);
      expect(MockBroadcastChannel.instances[0].name).toBe('ratingo-auth-sync');
    });

    it('should handle REFRESH_SUCCESS from another tab', () => {
      const onTokensUpdated = jest.fn();
      initCrossTabSync({ onTokensUpdated });

      // Simulate another tab
      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      otherTab.postMessage({
        type: 'REFRESH_SUCCESS',
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      expect(mockTokenStorage.setTokens).toHaveBeenCalledWith('new-access', 'new-refresh');
      expect(onTokensUpdated).toHaveBeenCalled();
    });

    it('should handle LOGOUT from another tab', () => {
      const onLogout = jest.fn();
      initCrossTabSync({ onLogout });

      // Simulate another tab
      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      otherTab.postMessage({ type: 'LOGOUT' });

      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
      expect(onLogout).toHaveBeenCalled();
    });

    it('should ignore REFRESH_START messages', () => {
      const onTokensUpdated = jest.fn();
      initCrossTabSync({ onTokensUpdated });

      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      otherTab.postMessage({ type: 'REFRESH_START' });

      expect(mockTokenStorage.setTokens).not.toHaveBeenCalled();
      expect(onTokensUpdated).not.toHaveBeenCalled();
    });

    it('should ignore REFRESH_FAILED messages', () => {
      const onTokensUpdated = jest.fn();
      initCrossTabSync({ onTokensUpdated });

      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      otherTab.postMessage({ type: 'REFRESH_FAILED' });

      expect(mockTokenStorage.setTokens).not.toHaveBeenCalled();
      expect(onTokensUpdated).not.toHaveBeenCalled();
    });
  });

  describe('broadcastRefreshStart', () => {
    it('should broadcast REFRESH_START to other tabs', () => {
      initCrossTabSync({});

      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      const receivedMessages: unknown[] = [];
      otherTab.onmessage = (event) => receivedMessages.push(event.data);

      broadcastRefreshStart();

      expect(receivedMessages).toContainEqual({ type: 'REFRESH_START' });
    });

    it('should not throw when channel not initialized', () => {
      expect(() => broadcastRefreshStart()).not.toThrow();
    });
  });

  describe('broadcastRefreshSuccess', () => {
    it('should broadcast tokens to other tabs', () => {
      initCrossTabSync({});

      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      const receivedMessages: unknown[] = [];
      otherTab.onmessage = (event) => receivedMessages.push(event.data);

      broadcastRefreshSuccess('access-123', 'refresh-456');

      expect(receivedMessages).toContainEqual({
        type: 'REFRESH_SUCCESS',
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      });
    });
  });

  describe('broadcastRefreshFailed', () => {
    it('should broadcast REFRESH_FAILED to other tabs', () => {
      initCrossTabSync({});

      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      const receivedMessages: unknown[] = [];
      otherTab.onmessage = (event) => receivedMessages.push(event.data);

      broadcastRefreshFailed();

      expect(receivedMessages).toContainEqual({ type: 'REFRESH_FAILED' });
    });
  });

  describe('broadcastLogout', () => {
    it('should broadcast LOGOUT to other tabs', () => {
      initCrossTabSync({});

      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      const receivedMessages: unknown[] = [];
      otherTab.onmessage = (event) => receivedMessages.push(event.data);

      broadcastLogout();

      expect(receivedMessages).toContainEqual({ type: 'LOGOUT' });
    });
  });

  describe('destroyCrossTabSync', () => {
    it('should close the channel', () => {
      initCrossTabSync({});
      expect(MockBroadcastChannel.instances).toHaveLength(1);

      destroyCrossTabSync();

      // Channel should be closed (removed from instances in our mock)
      expect(MockBroadcastChannel.instances.every((i) => i.closed)).toBe(true);
    });

    it('should be safe to call multiple times', () => {
      initCrossTabSync({});

      expect(() => {
        destroyCrossTabSync();
        destroyCrossTabSync();
        destroyCrossTabSync();
      }).not.toThrow();
    });

    it('should stop receiving messages after destroy', () => {
      const onLogout = jest.fn();
      initCrossTabSync({ onLogout });

      destroyCrossTabSync();

      // Create new channel to simulate another tab
      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      otherTab.postMessage({ type: 'LOGOUT' });

      expect(onLogout).not.toHaveBeenCalled();
    });
  });

  describe('multi-tab scenarios', () => {
    it('should sync tokens across multiple tabs', () => {
      const tab1Callbacks = { onTokensUpdated: jest.fn(), onLogout: jest.fn() };
      const tab2Callbacks = { onTokensUpdated: jest.fn(), onLogout: jest.fn() };

      // Initialize two tabs
      initCrossTabSync(tab1Callbacks);

      // Simulate second tab
      const tab2Channel = new MockBroadcastChannel('ratingo-auth-sync');
      tab2Channel.onmessage = (event) => {
        const message = event.data;
        if (message.type === 'REFRESH_SUCCESS') {
          mockTokenStorage.setTokens(message.accessToken, message.refreshToken);
          tab2Callbacks.onTokensUpdated();
        } else if (message.type === 'LOGOUT') {
          mockTokenStorage.clearTokens();
          tab2Callbacks.onLogout();
        }
      };

      // Tab 1 refreshes tokens
      broadcastRefreshSuccess('new-access', 'new-refresh');

      // Tab 2 should receive the update
      expect(mockTokenStorage.setTokens).toHaveBeenCalledWith('new-access', 'new-refresh');
      expect(tab2Callbacks.onTokensUpdated).toHaveBeenCalled();
    });

    it('should propagate logout to all tabs', () => {
      const callbacks = { onLogout: jest.fn() };
      initCrossTabSync(callbacks);

      // Simulate another tab logging out
      const otherTab = new MockBroadcastChannel('ratingo-auth-sync');
      otherTab.postMessage({ type: 'LOGOUT' });

      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
      expect(callbacks.onLogout).toHaveBeenCalled();
    });
  });
});
