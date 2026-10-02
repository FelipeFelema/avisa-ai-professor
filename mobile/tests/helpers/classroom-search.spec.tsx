import {
  CLASSROOM_SEARCH_STALE_TIME,
  cacheAvailableClassroomVariants,
  cleanupClassroomSearchState,
  createClassroomSearchQueryClient,
  createControlledAvailableClassroomService,
  observeAvailableClassroomVariants,
} from './classroom-search';

describe('classroom search test helpers', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses production-like freshness with retries disabled', () => {
    const queryClient = createClassroomSearchQueryClient();

    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(CLASSROOM_SEARCH_STALE_TIME);
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);

    queryClient.clear();
  });

  it('controls requests for active and inactive available variants and captures abort signals', async () => {
    const queryClient = createClassroomSearchQueryClient();
    const service = createControlledAvailableClassroomService();
    const variants = observeAvailableClassroomVariants(
      queryClient,
      [{ search: '', active: true }, { search: 'matemática' }],
      service.getAvailableClassrooms,
    );

    expect(service.requests).toHaveLength(1);
    expect(service.requests[0]?.search).toBe('');
    expect(service.requests[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(variants.observers[1]?.observer.getCurrentResult().fetchStatus).toBe('idle');

    const result = [
      {
        id: 'classroom-1',
        name: 'Matemática 6º A',
        ownerId: 'owner-1',
        teacher: { id: 'owner-1', name: 'Professor' },
        lastAnnouncement: null,
      },
    ];
    service.requests[0]?.deferred.resolve(result);
    await service.requests[0]?.deferred.promise;
    await Promise.resolve();

    expect(variants.observers[0]?.observer.getCurrentResult().data).toEqual(result);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(2);

    await variants.dispose();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('seeds multiple cached terms and clears observers, pending requests, clients, and fake timers', async () => {
    jest.useFakeTimers();
    const queryClient = createClassroomSearchQueryClient();
    const service = createControlledAvailableClassroomService();
    const variants = observeAvailableClassroomVariants(
      queryClient,
      [{ search: 'matemática', active: true }],
      service.getAvailableClassrooms,
    );
    await Promise.resolve();
    const signal = service.requests[0]?.signal;
    const timer = setTimeout(() => undefined, 1_000);
    const cachedClassroom = {
      id: 'cached-classroom',
      name: 'História',
      ownerId: 'owner-1',
      teacher: { id: 'owner-1', name: 'Professor' },
      lastAnnouncement: null,
    };

    cacheAvailableClassroomVariants(queryClient, [
      { search: 'matemática', data: [cachedClassroom] },
      { search: 'história', data: [cachedClassroom] },
    ]);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(2);

    clearTimeout(timer);
    await variants.dispose(jest.clearAllTimers);

    expect(signal?.aborted).toBe(true);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('allows callers to clean an otherwise standalone client and timers', async () => {
    jest.useFakeTimers();
    const queryClient = createClassroomSearchQueryClient();
    setTimeout(() => undefined, 1_000);

    await cleanupClassroomSearchState(queryClient, [], jest.clearAllTimers);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
