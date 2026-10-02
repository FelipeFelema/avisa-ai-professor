import { useCallback, useEffect, useRef, useState } from 'react';

import { classroomSearchSchema } from '@/validations/classroomSearch.schema';

export const CLASSROOM_SEARCH_DEBOUNCE_MS = 300;

type ClassroomSearchState = {
  rawText: string;
  normalizedTerm: string;
  validationError: string | null;
  settledTerm: string;
  waiting: boolean;
};

const initialState: ClassroomSearchState = {
  rawText: '',
  normalizedTerm: '',
  validationError: null,
  settledTerm: '',
  waiting: false,
};

export function useClassroomSearch() {
  const [state, setState] = useState(initialState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setRawText = useCallback((rawText: string) => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    const parsed = classroomSearchSchema.safeParse(rawText);
    const normalizedTerm = rawText.trim();

    if (!parsed.success) {
      setState((current) => ({
        ...current,
        rawText,
        normalizedTerm,
        validationError: parsed.error.issues[0]?.message ?? 'Use até 80 caracteres na pesquisa',
        waiting: false,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      rawText,
      normalizedTerm: parsed.data,
      validationError: null,
      waiting: true,
    }));

    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      setState((current) => ({
        ...current,
        settledTerm: parsed.data,
        waiting: false,
      }));
    }, CLASSROOM_SEARCH_DEBOUNCE_MS);
  }, []);

  const clear = useCallback(() => setRawText(''), [setRawText]);

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const canRetry =
    state.validationError === null && !state.waiting && state.normalizedTerm === state.settledTerm;

  return {
    ...state,
    canRetry,
    setRawText,
    clear,
  };
}
