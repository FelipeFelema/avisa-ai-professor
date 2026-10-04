import { useCallback } from 'react';
import { useMutation, type MutateOptions } from '@tanstack/react-query';

import {
  getSessionGeneration,
  isSessionGenerationChangedError,
  isSessionGenerationCurrent,
} from '@/lib/session-generation';

type Operation<TVariables> = {
  variables: TVariables;
  generation: number;
};

type Lifecycle<TData, TError, TVariables> = {
  onSuccess?: (data: TData, variables: TVariables, generation: number) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables, generation: number) => void | Promise<void>;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    generation: number,
  ) => void | Promise<void>;
  onSettledAny?: () => void;
};

export function useSessionMutation<TData, TError = Error, TVariables = void>(
  mutationFn: (variables: TVariables, generation: number) => Promise<TData>,
  lifecycle: Lifecycle<TData, TError, TVariables> = {},
) {
  const {
    mutate: runMutation,
    mutateAsync: runMutationAsync,
    ...mutationState
  } = useMutation<TData, TError, Operation<TVariables>, unknown>({
    retry: false,
    mutationFn: async ({ variables, generation }) => {
      try {
        return await mutationFn(variables, generation);
      } catch (error) {
        if (!isSessionGenerationCurrent(generation) || isSessionGenerationChangedError(error)) {
          return undefined as TData;
        }
        throw error;
      }
    },
    onSuccess: async (data, operation) => {
      if (isSessionGenerationCurrent(operation.generation)) {
        await lifecycle.onSuccess?.(data, operation.variables, operation.generation);
      }
    },
    onError: async (error, operation) => {
      if (isSessionGenerationCurrent(operation.generation)) {
        await lifecycle.onError?.(error, operation.variables, operation.generation);
      }
    },
    onSettled: async (data, error, operation) => {
      lifecycle.onSettledAny?.();
      if (isSessionGenerationCurrent(operation.generation)) {
        await lifecycle.onSettled?.(data, error, operation.variables, operation.generation);
      }
    },
  });

  const mapOptions = useCallback(
    (
      operation: Operation<TVariables>,
      options?: MutateOptions<TData, TError, TVariables, unknown>,
    ): MutateOptions<TData, TError, Operation<TVariables>, unknown> | undefined => {
      if (!options) return undefined;
      return {
        onSuccess: (data, _operation, result, context) => {
          if (isSessionGenerationCurrent(operation.generation)) {
            options.onSuccess?.(data, operation.variables, result, context);
          }
        },
        onError: (error, _operation, result, context) => {
          if (isSessionGenerationCurrent(operation.generation)) {
            options.onError?.(error, operation.variables, result, context);
          }
        },
        onSettled: (data, error, _operation, result, context) => {
          if (isSessionGenerationCurrent(operation.generation)) {
            options.onSettled?.(data, error, operation.variables, result, context);
          }
        },
      };
    },
    [],
  );

  const mutate = useCallback(
    (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, unknown>) => {
      const operation = { variables, generation: getSessionGeneration() };
      runMutation(operation, mapOptions(operation, options));
    },
    [mapOptions, runMutation],
  );

  const mutateAsync = useCallback(
    async (
      variables: TVariables,
      options?: MutateOptions<TData, TError, TVariables, unknown>,
    ): Promise<TData | undefined> => {
      const operation = { variables, generation: getSessionGeneration() };
      try {
        const result = await runMutationAsync(operation, mapOptions(operation, options));
        return isSessionGenerationCurrent(operation.generation) ? result : undefined;
      } catch (error) {
        if (
          !isSessionGenerationCurrent(operation.generation) ||
          isSessionGenerationChangedError(error)
        ) {
          return undefined;
        }
        throw error;
      }
    },
    [mapOptions, runMutationAsync],
  );

  return {
    ...mutationState,
    variables: mutationState.variables?.variables,
    mutate,
    mutateAsync,
  };
}
