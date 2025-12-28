/**
 * Test Setup
 * Mock React Native dependencies for testing
 */

import { vi, beforeEach } from 'vitest';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      return Promise.resolve();
    }),
  },
}));

// Mock Expo modules
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

vi.mock('expo-image', () => ({
  Image: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  },
  useLocalSearchParams: vi.fn(() => ({})),
  useFocusEffect: vi.fn(),
}));

// Clear mock storage before each test
beforeEach(() => {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
});
