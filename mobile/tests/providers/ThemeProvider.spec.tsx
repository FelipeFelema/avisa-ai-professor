import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppProvider } from '@/providers/AppProvider';
import { useTheme } from '@/hooks/useTheme';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { loadThemePreference, saveThemePreference } from '@/storage/theme.storage';
import { darkTheme, lightTheme } from '@/theme';
import type { ThemePreference } from '@/contexts/ThemeContext';

const mounted = jest.fn();
const mockLoadThemePreference = jest.mocked(loadThemePreference);
const mockSaveThemePreference = jest.mocked(saveThemePreference);

jest.mock('@/storage/theme.storage', () => ({
  loadThemePreference: jest.fn(),
  saveThemePreference: jest.fn(),
}));

function ThemeConsumer() {
  const { phase, preference, palette, setTheme, persistenceWarning } = useTheme();
  const [count, setCount] = useState(0);

  useEffect(() => {
    mounted();
  }, []);

  return (
    <View>
      <Text testID="phase">{phase}</Text>
      <Text testID="preference">{preference}</Text>
      <Text testID="background">{palette.colors.background}</Text>
      <Text testID="count">{count}</Text>
      <Text testID="warning">{persistenceWarning ?? 'none'}</Text>
      <Pressable accessibilityRole="button" onPress={() => setTheme('light')}>
        <Text>Select light</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setTheme('dark')}>
        <Text>Select dark</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setCount((value) => value + 1)}>
        <Text>Increment</Text>
      </Pressable>
    </View>
  );
}

async function renderThemeConsumer() {
  const view = await render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>,
  );
  await waitFor(() => expect(view.getByTestId('phase').props.children).toBe('ready'));
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mounted.mockClear();
  mockLoadThemePreference.mockResolvedValue('light');
  mockSaveThemePreference.mockResolvedValue(undefined);
});

describe('ThemeProvider in-memory foundation', () => {
  it('limits preferences to light and dark and starts in Claro', async () => {
    const preferences: ThemePreference[] = ['light', 'dark'];
    const view = await renderThemeConsumer();

    expect(preferences).toEqual(['light', 'dark']);
    expect(view.getByTestId('preference').props.children).toBe('light');
    expect(view.getByTestId('background').props.children).toBe(lightTheme.colors.background);
    expect(view.getByTestId('warning').props.children).toBe('none');
  });

  it('changes the active palette immediately in both directions', async () => {
    const view = await renderThemeConsumer();

    await fireEvent.press(view.getByText('Select dark'));
    expect(view.getByTestId('preference').props.children).toBe('dark');
    expect(view.getByTestId('background').props.children).toBe(darkTheme.colors.background);

    await fireEvent.press(view.getByText('Select light'));
    expect(view.getByTestId('preference').props.children).toBe('light');
    expect(view.getByTestId('background').props.children).toBe(lightTheme.colors.background);
  });

  it('keeps a mounted child and its local state when the theme changes', async () => {
    const view = await renderThemeConsumer();

    await fireEvent.press(view.getByText('Increment'));
    await fireEvent.press(view.getByText('Select dark'));

    expect(view.getByTestId('count').props.children).toBe(1);
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('makes selecting the current preference idempotent', async () => {
    const view = await renderThemeConsumer();
    const background = view.getByTestId('background').props.children;

    await fireEvent.press(view.getByText('Select light'));

    expect(view.getByTestId('preference').props.children).toBe('light');
    expect(view.getByTestId('background').props.children).toBe(background);
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('keeps the same theme source mounted around the app session tree', async () => {
    const view = await render(
      <AppProvider>
        <ThemeConsumer />
      </AppProvider>,
    );

    await fireEvent.press(view.getByText('Select dark'));

    expect(view.getByTestId('preference').props.children).toBe('dark');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('changes the active palette while the corresponding write is still pending', async () => {
    const write = deferred<void>();
    mockSaveThemePreference.mockReturnValueOnce(write.promise);
    const view = await renderThemeConsumer();

    await fireEvent.press(view.getByText('Select dark'));

    expect(view.getByTestId('preference').props.children).toBe('dark');
    expect(view.getByTestId('background').props.children).toBe(darkTheme.colors.background);
    expect(mockSaveThemePreference).toHaveBeenCalledWith('dark');

    await act(async () => {
      write.resolve();
      await write.promise;
    });
  });

  it('writes rapid selections in the order they were made', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    mockSaveThemePreference
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    const view = await renderThemeConsumer();

    await fireEvent.press(view.getByText('Select dark'));
    await fireEvent.press(view.getByText('Select light'));

    expect(view.getByTestId('preference').props.children).toBe('light');
    await waitFor(() => expect(mockSaveThemePreference).toHaveBeenCalledTimes(1));
    expect(mockSaveThemePreference).toHaveBeenNthCalledWith(1, 'dark');

    await act(async () => {
      firstWrite.resolve();
      await firstWrite.promise;
    });
    await waitFor(() => expect(mockSaveThemePreference).toHaveBeenCalledTimes(2));
    expect(mockSaveThemePreference).toHaveBeenNthCalledWith(2, 'light');

    await act(async () => {
      secondWrite.resolve();
      await secondWrite.promise;
    });
  });

  it('suppresses a stale write failure after a newer selection', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    mockSaveThemePreference
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    const view = await renderThemeConsumer();

    await fireEvent.press(view.getByText('Select dark'));
    await fireEvent.press(view.getByText('Select light'));

    await act(async () => {
      firstWrite.reject(new Error('stale failure'));
      await Promise.resolve();
    });
    await waitFor(() => expect(mockSaveThemePreference).toHaveBeenCalledTimes(2));

    expect(view.getByTestId('warning').props.children).toBe('none');
    expect(view.getByTestId('preference').props.children).toBe('light');

    await act(async () => {
      secondWrite.resolve();
      await secondWrite.promise;
    });
  });

  it('keeps the selected palette and shows a warning for the latest failed write', async () => {
    mockSaveThemePreference.mockRejectedValueOnce(new Error('storage unavailable'));
    const view = await renderThemeConsumer();

    await fireEvent.press(view.getByText('Select dark'));

    expect(view.getByTestId('preference').props.children).toBe('dark');
    expect(view.getByTestId('background').props.children).toBe(darkTheme.colors.background);
    await waitFor(() => {
      expect(view.getByTestId('warning').props.children).toBe(
        'A aparência mudou, mas a preferência pode não permanecer após fechar o aplicativo.',
      );
    });
  });

  it('clears a write warning after a later selection succeeds', async () => {
    mockSaveThemePreference
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const view = await renderThemeConsumer();

    await fireEvent.press(view.getByText('Select dark'));
    await waitFor(() => expect(view.getByTestId('warning').props.children).not.toBe('none'));

    await fireEvent.press(view.getByText('Select light'));

    expect(view.getByTestId('preference').props.children).toBe('light');
    expect(view.getByTestId('background').props.children).toBe(lightTheme.colors.background);
    await waitFor(() => expect(view.getByTestId('warning').props.children).toBe('none'));
  });

  it('keeps children unmounted until the one-time preference read resolves', async () => {
    const read = deferred<ThemePreference>();
    mockLoadThemePreference.mockReturnValueOnce(read.promise);

    const view = await render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(view.queryByTestId('phase')).toBeNull();
    expect(mounted).not.toHaveBeenCalled();
    expect(mockLoadThemePreference).toHaveBeenCalledTimes(1);

    await act(async () => {
      read.resolve('dark');
      await read.promise;
    });

    await waitFor(() => {
      expect(view.getByTestId('phase').props.children).toBe('ready');
      expect(view.getByTestId('preference').props.children).toBe('dark');
      expect(view.getByTestId('background').props.children).toBe(darkTheme.colors.background);
    });
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('settles to the safe Claro palette when the preference read rejects', async () => {
    mockLoadThemePreference.mockRejectedValueOnce(new Error('storage unavailable'));

    const view = await render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    await waitFor(() => expect(view.getByTestId('phase').props.children).toBe('ready'));
    expect(view.getByTestId('preference').props.children).toBe('light');
    expect(view.getByTestId('background').props.children).toBe(lightTheme.colors.background);
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('does not read again when session identity changes inside the stable provider', async () => {
    mockLoadThemePreference.mockResolvedValueOnce('dark');

    const sessionTree = (session: string) => (
      <ThemeProvider>
        <View>
          <Text testID="session">{session}</Text>
          <ThemeConsumer />
        </View>
      </ThemeProvider>
    );
    const view = await render(sessionTree('logged-out'));

    await waitFor(() => expect(view.getByTestId('preference').props.children).toBe('dark'));
    await view.rerender(sessionTree('account-b'));

    expect(view.getByTestId('session').props.children).toBe('account-b');
    expect(view.getByTestId('preference').props.children).toBe('dark');
    expect(mockLoadThemePreference).toHaveBeenCalledTimes(1);
    expect(mounted).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
