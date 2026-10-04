import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import {
  deleteOwnAccount,
  getAccountDeletionFeedback,
  getAccountDeletionImpact,
  verifyAccountDeletionSession,
} from '@/services/auth';
import type {
  AccountDeletionFeedback,
  AccountDeletionImpact,
  AuthUser,
  DeleteAccountRequest,
} from '@/types/auth';
import {
  getSessionGeneration,
  isSessionGenerationChangedError,
  isSessionGenerationCurrent,
} from '@/lib/session-generation';
import { setSessionNotice } from '@/lib/session-notice';

export type AccountDeletionFlowState =
  | 'ready'
  | 'blocked'
  | 'pending'
  | 'conflict'
  | 'indeterminate'
  | 'verification'
  | 'session-ended'
  | 'deleted';

export type AccountDeletionSubmitResult =
  'confirmed' | 'field-error' | 'conflict' | 'session-ended' | 'indeterminate' | 'ignored';

type ImpactState = {
  owner: AuthUser | null;
  loading: boolean;
  impact?: AccountDeletionImpact;
  feedback?: AccountDeletionFeedback;
};

export function useDeleteAccount() {
  const { user, expireSession } = useAuth();
  const identity = useRef(user);
  const mounted = useRef(false);
  const focused = useRef(false);
  const requestSequence = useRef(0);
  const request = useRef<AbortController | undefined>(undefined);
  const submissionInFlight = useRef(false);
  const verificationInFlight = useRef(false);
  const [state, setState] = useState<ImpactState>({ owner: user, loading: true });
  const [flowState, setFlowState] = useState<AccountDeletionFlowState>('ready');

  const cancelRead = useCallback(() => {
    requestSequence.current += 1;
    request.current?.abort();
    request.current = undefined;
  }, []);

  const reload = useCallback(async (): Promise<boolean> => {
    cancelRead();
    const account = user;
    const sessionGeneration = getSessionGeneration();
    if (!account || !mounted.current || !focused.current) return false;
    const sequence = requestSequence.current;
    const controller = new AbortController();
    request.current = controller;
    setState({ owner: account, loading: true });
    const isCurrent = () =>
      mounted.current &&
      focused.current &&
      sequence === requestSequence.current &&
      identity.current === account &&
      isSessionGenerationCurrent(sessionGeneration);

    try {
      const fresh = await getAccountDeletionImpact(controller.signal, sessionGeneration);
      if (!isCurrent()) return false;
      setState({ owner: account, loading: false, impact: fresh });
      setFlowState(fresh.canDelete ? 'ready' : 'blocked');
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      const safe = getAccountDeletionFeedback(error);
      setState({ owner: account, loading: false, feedback: safe });
      if (safe.status === 401) {
        setFlowState('session-ended');
        setSessionNotice('session-ended');
        try {
          await expireSession(sessionGeneration);
        } catch {
          // Session state is closed before secure storage recovery is attempted.
        }
      }
      return false;
    } finally {
      if (sequence === requestSequence.current) request.current = undefined;
    }
  }, [user, cancelRead, expireSession]);

  const verifySession = useCallback(async (): Promise<
    'valid' | 'invalid' | 'indeterminate' | 'ignored'
  > => {
    if (verificationInFlight.current || !user || !mounted.current || !focused.current) {
      return 'ignored';
    }

    verificationInFlight.current = true;
    const account = user;
    const sessionGeneration = getSessionGeneration();
    setFlowState('verification');
    try {
      const result = await verifyAccountDeletionSession(sessionGeneration);
      if (
        !mounted.current ||
        identity.current !== account ||
        !isSessionGenerationCurrent(sessionGeneration)
      ) {
        return 'ignored';
      }
      if (result === 'invalid') {
        setFlowState('session-ended');
        setSessionNotice('session-ended');
        await expireSession(sessionGeneration);
        return 'invalid';
      }
      if (result === 'indeterminate') {
        setFlowState('indeterminate');
        setState((current) => ({
          ...current,
          loading: false,
          feedback: {
            message:
              'Ainda não foi possível confirmar o estado da sessão. Verifique novamente quando a conexão estiver estável.',
            indeterminate: true,
          },
        }));
        return 'indeterminate';
      }

      setState((current) => ({ ...current, feedback: undefined }));
      const refreshed = await reload();
      if (!refreshed) {
        setFlowState('indeterminate');
        return 'indeterminate';
      }
      setState((current) => ({
        ...current,
        feedback: {
          message:
            'A sessão continua válida. O resultado da solicitação não foi confirmado. Revise o resumo e confirme manualmente antes de enviar outra solicitação.',
        },
      }));
      return 'valid';
    } catch (error) {
      if (isSessionGenerationChangedError(error)) return 'ignored';
      setFlowState('indeterminate');
      setState((current) => ({
        ...current,
        loading: false,
        feedback: { message: 'Ainda não foi possível verificar a sessão.', indeterminate: true },
      }));
      return 'indeterminate';
    } finally {
      verificationInFlight.current = false;
    }
  }, [user, expireSession, reload]);

  const submit = useCallback(
    async (data: DeleteAccountRequest): Promise<AccountDeletionSubmitResult> => {
      if (
        submissionInFlight.current ||
        !mounted.current ||
        !focused.current ||
        !user ||
        !state.impact?.canDelete ||
        state.loading
      ) {
        return 'ignored';
      }

      // The ref closes the duplicate-tap window before React renders pending state.
      submissionInFlight.current = true;
      cancelRead();
      const account = user;
      const sessionGeneration = getSessionGeneration();
      let requestBody: DeleteAccountRequest | undefined = {
        currentPassword: data.currentPassword,
        confirmationPhrase: data.confirmationPhrase,
      };
      setFlowState('pending');
      setState((current) => ({ ...current, feedback: undefined }));

      try {
        await deleteOwnAccount(requestBody, sessionGeneration);
        if (
          !mounted.current ||
          identity.current !== account ||
          !isSessionGenerationCurrent(sessionGeneration)
        ) {
          return 'ignored';
        }

        setFlowState('deleted');
        setSessionNotice('account-deleted');
        await expireSession(sessionGeneration);
        return 'confirmed';
      } catch (error) {
        if (
          isSessionGenerationChangedError(error) ||
          !mounted.current ||
          identity.current !== account ||
          !isSessionGenerationCurrent(sessionGeneration)
        ) {
          return 'ignored';
        }

        const safe = getAccountDeletionFeedback(error);
        if (safe.status === 400) {
          setFlowState('ready');
          setState((current) => ({ ...current, feedback: safe }));
          return 'field-error';
        }
        if (safe.status === 409) {
          setFlowState('conflict');
          setState((current) => ({ ...current, feedback: safe }));
          await reload();
          if (isSessionGenerationCurrent(sessionGeneration)) {
            setState((current) => ({ ...current, feedback: safe }));
          }
          return 'conflict';
        }

        setFlowState('indeterminate');
        setState((current) => ({ ...current, feedback: safe }));
        const verified = await verifySession();
        if (verified === 'invalid') return 'session-ended';
        if (verified === 'valid') return 'conflict';
        return 'indeterminate';
      } finally {
        requestBody = undefined;
        submissionInFlight.current = false;
        if (
          mounted.current &&
          identity.current === account &&
          isSessionGenerationCurrent(sessionGeneration)
        ) {
          setFlowState((current) => (current === 'pending' ? 'ready' : current));
        }
      }
    },
    [user, state.impact, state.loading, cancelRead, expireSession, reload, verifySession],
  );

  const clearTransientFeedback = useCallback(() => {
    setState((current) => ({ ...current, feedback: undefined }));
    setFlowState((current) =>
      current === 'conflict' || current === 'indeterminate' ? 'ready' : current,
    );
  }, []);

  // Update the account guard at commit, before passive effects or late responses.
  useLayoutEffect(() => {
    identity.current = user;
    cancelRead();
  }, [user, cancelRead]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelRead();
    };
  }, [cancelRead]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void reload();
      return () => {
        focused.current = false;
        cancelRead();
      };
    }, [cancelRead, reload]),
  );

  useEffect(() => {
    const listener = AppState.addEventListener('change', (appState) => {
      if (appState === 'active' && focused.current) void reload();
      else {
        cancelRead();
        setState({ owner: user, loading: true });
      }
    });
    return () => listener.remove();
  }, [user, cancelRead, reload]);

  const currentState: ImpactState =
    state.owner === user ? state : { owner: user, loading: Boolean(user) };

  return {
    impact: currentState.impact,
    isLoading: currentState.loading,
    feedback: currentState.feedback,
    flowState: !user ? 'session-ended' : state.owner === user ? flowState : 'ready',
    isPending:
      user !== null &&
      state.owner === user &&
      (flowState === 'pending' || flowState === 'verification'),
    reload,
    submit,
    verifySession,
    clearTransientFeedback,
  };
}
