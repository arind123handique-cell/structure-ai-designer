import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/features/theme/themeStore';

describe('App Theme Store', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
  });

  it('defaults to light theme', () => {
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('toggles between light and dark themes', () => {
    const store = useThemeStore.getState();
    store.toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');

    store.toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('sets explicit theme', () => {
    const store = useThemeStore.getState();
    store.setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');

    store.setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
  });
});
