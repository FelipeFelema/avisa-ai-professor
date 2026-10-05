import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { classroomKeys } from '@/config';
import type { ClassroomSummary } from '@/types/classroom';

export const CLASSROOM_SEARCH_STALE_TIME = 5 * 60 * 1000;

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

export function createClassroomSearchQueryClient(
  staleTime = CLASSROOM_SEARCH_STALE_TIME,
): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime,
      },
      mutations: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

export function createClassroomSearchQueryWrapper(queryClient: QueryClient) {
  return function ClassroomSearchQueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

export type ControlledAvailableClassroomRequest = {
  search: string | undefined;
  signal: AbortSignal | undefined;
  deferred: Deferred<ClassroomSummary[]>;
};

export function createControlledAvailableClassroomService() {
  const requests: ControlledAvailableClassroomRequest[] = [];

  function getAvailableClassrooms(
    search?: string,
    signal?: AbortSignal,
  ): Promise<ClassroomSummary[]> {
    const deferred = createDeferred<ClassroomSummary[]>();
    requests.push({ search, signal, deferred });
    return deferred.promise;
  }

  return { requests, getAvailableClassrooms };
}

export type AvailableClassroomVariant = {
  search?: string;
  active?: boolean;
};

export type AvailableClassroomSearchService = (
  search: string | undefined,
  signal: AbortSignal,
) => Promise<ClassroomSummary[]>;

export type ControlledMyClassroomRequest = {
  signal: AbortSignal;
  deferred: Deferred<ClassroomSummary[]>;
};

export type MyClassroomSearchService = (signal: AbortSignal) => Promise<ClassroomSummary[]>;

export function createControlledMyClassroomService() {
  const requests: ControlledMyClassroomRequest[] = [];

  function getMyClassrooms(signal: AbortSignal): Promise<ClassroomSummary[]> {
    const deferred = createDeferred<ClassroomSummary[]>();
    requests.push({ signal, deferred });
    return deferred.promise;
  }

  return { requests, getMyClassrooms };
}

export type DisposableClassroomSearchObserver = {
  dispose: () => void;
};

export async function cleanupClassroomSearchState(
  queryClient: QueryClient,
  observers: readonly DisposableClassroomSearchObserver[] = [],
  clearTimers: () => void = () => undefined,
) {
  observers.forEach(({ dispose }) => dispose());
  await queryClient.cancelQueries();
  // MutationCache.clear() removes entries but does not destroy their GC timers.
  // Pending controlled mutations otherwise keep rescheduling even after cleanup.
  queryClient
    .getMutationCache()
    .getAll()
    .forEach((mutation) => mutation.destroy());
  queryClient.clear();
  clearTimers();
}

export function observeAvailableClassroomVariant(
  queryClient: QueryClient,
  search: string | undefined,
  service: AvailableClassroomSearchService,
  options: { active?: boolean; staleTime?: number } = {},
) {
  const observer = new QueryObserver(queryClient, {
    queryKey: classroomKeys.available(search),
    queryFn: ({ signal }) => service(search, signal),
    retry: false,
    staleTime: options.staleTime ?? CLASSROOM_SEARCH_STALE_TIME,
  });

  let unsubscribe: (() => void) | undefined;

  function activate() {
    if (!unsubscribe) {
      unsubscribe = observer.subscribe(() => undefined);
    }
  }

  function deactivate() {
    unsubscribe?.();
    unsubscribe = undefined;
  }

  if (options.active) {
    activate();
  }

  return {
    observer,
    activate,
    deactivate,
    dispose: deactivate,
  };
}

export function observeMyClassrooms(
  queryClient: QueryClient,
  service: MyClassroomSearchService,
  options: { active?: boolean; staleTime?: number } = {},
) {
  const observer = new QueryObserver(queryClient, {
    queryKey: classroomKeys.my(),
    queryFn: ({ signal }) => service(signal),
    retry: false,
    staleTime: options.staleTime ?? CLASSROOM_SEARCH_STALE_TIME,
  });

  let unsubscribe: (() => void) | undefined;

  function activate() {
    if (!unsubscribe) {
      unsubscribe = observer.subscribe(() => undefined);
    }
  }

  function deactivate() {
    unsubscribe?.();
    unsubscribe = undefined;
  }

  if (options.active) {
    activate();
  }

  return { observer, activate, deactivate, dispose: deactivate };
}

export function observeAvailableClassroomVariants(
  queryClient: QueryClient,
  variants: readonly AvailableClassroomVariant[],
  service: AvailableClassroomSearchService,
  options: { staleTime?: number } = {},
) {
  const observers = variants.map(({ search, active = false }) =>
    observeAvailableClassroomVariant(queryClient, search, service, {
      active,
      staleTime: options.staleTime,
    }),
  );

  return {
    observers,
    async dispose(clearTimers?: () => void) {
      await cleanupClassroomSearchState(queryClient, observers, clearTimers);
    },
  };
}

export function cacheAvailableClassroomVariants(
  queryClient: QueryClient,
  variants: readonly {
    search?: string;
    data: ClassroomSummary[];
    updatedAt?: number;
  }[],
) {
  variants.forEach(({ search, data, updatedAt }) => {
    queryClient.setQueryData(classroomKeys.available(search), data, {
      updatedAt,
    });
  });
}
