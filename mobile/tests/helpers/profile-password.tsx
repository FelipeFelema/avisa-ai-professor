import type { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { RenderOptions } from '@testing-library/react-native';
import { createTestQueryClient, renderWithProviders } from './render';

export function createDeferredRequest<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

export function createDeferredNavigation() {
  const transition = createDeferredRequest<void>();
  const router = {
    canGoBack: jest.fn(() => true),
    back: jest.fn(() => transition.promise),
    replace: jest.fn(() => transition.promise),
    push: jest.fn(() => transition.promise),
  };

  return { router, transition };
}

export async function renderWithProfilePasswordSupport(
  element: ReactElement,
  options: RenderOptions & { queryClient?: QueryClient } = {},
) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const rendered = await renderWithProviders(element, { ...options, queryClient });

  return Object.assign(rendered, {
    queryClient,
    async dispose() {
      await rendered.unmount();
      await queryClient.cancelQueries();
      queryClient.clear();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  });
}
