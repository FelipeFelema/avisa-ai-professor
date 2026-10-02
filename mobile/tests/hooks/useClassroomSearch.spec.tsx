import { act, renderHook } from '@testing-library/react-native';

import { useClassroomSearch } from '@/hooks/useClassroomSearch';

describe('useClassroomSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps raw input immediate and settles only after a full 300 ms pause', async () => {
    const { result } = await renderHook(() => useClassroomSearch());

    await act(async () => result.current.setRawText('  mat  '));

    expect(result.current.rawText).toBe('  mat  ');
    expect(result.current.normalizedTerm).toBe('mat');
    expect(result.current.settledTerm).toBe('');
    expect(result.current.waiting).toBe(true);

    await act(async () => jest.advanceTimersByTime(299));
    expect(result.current.settledTerm).toBe('');
    expect(result.current.waiting).toBe(true);

    await act(async () => jest.advanceTimersByTime(1));
    expect(result.current.settledTerm).toBe('mat');
    expect(result.current.waiting).toBe(false);
    expect(result.current.canRetry).toBe(true);
  });

  it('restarts the pause for continuous edits and cleans the timer on unmount', async () => {
    const { result, unmount } = await renderHook(() => useClassroomSearch());
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await act(async () => result.current.setRawText('mat'));
    await act(async () => jest.advanceTimersByTime(200));
    await act(async () => result.current.setRawText('matemática'));
    await act(async () => jest.advanceTimersByTime(299));

    expect(result.current.settledTerm).toBe('');
    expect(result.current.waiting).toBe(true);

    await act(async () => jest.advanceTimersByTime(1));
    expect(result.current.settledTerm).toBe('matemática');

    await act(async () => result.current.setRawText('história'));
    const clearCallsBeforeUnmount = clearTimeoutSpy.mock.calls.length;
    await act(async () => unmount());
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(clearCallsBeforeUnmount);
    clearTimeoutSpy.mockRestore();
  });

  it('keeps trim-equivalent criteria stable without changing the settled term', async () => {
    const { result } = await renderHook(() => useClassroomSearch());

    await act(async () => result.current.setRawText('mat'));
    await act(async () => jest.advanceTimersByTime(300));
    expect(result.current.settledTerm).toBe('mat');

    await act(async () => result.current.setRawText('  mat  '));
    expect(result.current.rawText).toBe('  mat  ');
    expect(result.current.normalizedTerm).toBe('mat');
    expect(result.current.settledTerm).toBe('mat');
    expect(result.current.waiting).toBe(true);

    await act(async () => jest.advanceTimersByTime(300));
    expect(result.current.settledTerm).toBe('mat');
    expect(result.current.waiting).toBe(false);
  });

  it('blocks invalid input, replaces retry eligibility, and permits retry after correction settles', async () => {
    const { result } = await renderHook(() => useClassroomSearch());

    await act(async () => result.current.setRawText('mat'));
    await act(async () => jest.advanceTimersByTime(300));
    expect(result.current.canRetry).toBe(true);

    await act(async () => result.current.setRawText('m'.repeat(81)));
    expect(result.current.rawText).toBe('m'.repeat(81));
    expect(result.current.validationError).toBe('Use até 80 caracteres na pesquisa');
    expect(result.current.waiting).toBe(false);
    expect(result.current.canRetry).toBe(false);

    await act(async () => result.current.setRawText(' matemática '));
    expect(result.current.validationError).toBeNull();
    expect(result.current.normalizedTerm).toBe('matemática');
    expect(result.current.canRetry).toBe(false);
    await act(async () => jest.advanceTimersByTime(300));
    expect(result.current.settledTerm).toBe('matemática');
    expect(result.current.canRetry).toBe(true);
  });

  it('clears old criteria immediately while delaying the unfiltered query until the pause ends', async () => {
    const { result } = await renderHook(() => useClassroomSearch());

    await act(async () => result.current.setRawText('mat'));
    await act(async () => jest.advanceTimersByTime(300));
    await act(async () => result.current.clear());

    expect(result.current.rawText).toBe('');
    expect(result.current.normalizedTerm).toBe('');
    expect(result.current.validationError).toBeNull();
    expect(result.current.settledTerm).toBe('mat');
    expect(result.current.waiting).toBe(true);
    expect(result.current.canRetry).toBe(false);

    await act(async () => jest.advanceTimersByTime(299));
    expect(result.current.settledTerm).toBe('mat');
    await act(async () => jest.advanceTimersByTime(1));
    expect(result.current.settledTerm).toBe('');
    expect(result.current.waiting).toBe(false);
    expect(result.current.canRetry).toBe(true);
  });

  it('starts with the initial unfiltered query eligible without a prior edit', async () => {
    const { result } = await renderHook(() => useClassroomSearch());

    expect(result.current).toMatchObject({
      rawText: '',
      normalizedTerm: '',
      validationError: null,
      settledTerm: '',
      waiting: false,
      canRetry: true,
    });
  });
});
