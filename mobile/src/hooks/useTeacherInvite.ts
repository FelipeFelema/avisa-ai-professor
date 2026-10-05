import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { getSessionGeneration, isSessionGenerationCurrent } from '@/lib/session-generation';
import { getProfile } from '@/services/auth';
import { createTeacherInvite, TeacherInviteError } from '@/services/admin/teacher-invite.service';
import type { TeacherInviteFeedback, TeacherInviteViewState } from '@/types/teacher-invite';

const initial: TeacherInviteViewState = {
  access: 'checking',
  operation: 'idle',
  feedback: { kind: 'none' },
};

export function useTeacherInvite() {
  const { user, isLoading, applyProfileUpdate, expireSession } = useAuth();
  const [state, setState] = useState<TeacherInviteViewState>(initial);
  const stateRef = useRef(state);
  const mounted = useRef(false);
  const focused = useRef(false);
  const foreground = useRef(AppState.currentState === 'active');
  const visitEpoch = useRef(0);
  const operationEpoch = useRef(0);
  const generateLock = useRef(false);
  const copyLock = useRef<number | undefined>(undefined);
  const verifyController = useRef<AbortController | undefined>(undefined);
  const postController = useRef<AbortController | undefined>(undefined);
  const identity = useRef({ id: user?.id, role: user?.role });

  const update = useCallback((next: TeacherInviteViewState) => {
    stateRef.current = next;
    if (mounted.current) setState(next);
  }, []);

  const clear = useCallback(() => {
    visitEpoch.current += 1;
    operationEpoch.current += 1;
    generateLock.current = false;
    copyLock.current = undefined;
    verifyController.current?.abort();
    postController.current?.abort();
    verifyController.current = undefined;
    postController.current = undefined;
    update({ access: 'checking', operation: 'idle', feedback: { kind: 'none' } });
  }, [update]);

  const verify = useCallback(
    async (visit: number) => {
      const generation = getSessionGeneration();
      const who = identity.current;
      const controller = new AbortController();
      verifyController.current?.abort();
      verifyController.current = controller;
      update({ access: 'checking', operation: 'idle', feedback: { kind: 'none' } });
      try {
        const profile = await getProfile({
          signal: controller.signal,
          noAuthReplay: true,
          sessionGeneration: generation,
        } as never);
        if (
          !mounted.current ||
          !focused.current ||
          !foreground.current ||
          visitEpoch.current !== visit ||
          !isSessionGenerationCurrent(generation)
        )
          return;
        if (
          who.id !== identity.current.id ||
          who.role !== identity.current.role ||
          profile.id !== who.id
        )
          return;
        applyProfileUpdate(profile, generation);
        update({
          access: profile.role === 'ADMIN' ? 'authorized' : 'invalid',
          operation: 'idle',
          feedback: { kind: 'none' },
        });
      } catch (error) {
        if (
          !mounted.current ||
          !focused.current ||
          visitEpoch.current !== visit ||
          controller.signal.aborted ||
          !isSessionGenerationCurrent(generation)
        )
          return;
        if (isAxiosError(error) && error.response?.status === 401) {
          update({ access: 'invalid', operation: 'idle', feedback: { kind: 'none' } });
          await expireSession(generation);
        } else {
          update({ access: 'indeterminate', operation: 'idle', feedback: { kind: 'none' } });
        }
      } finally {
        if (verifyController.current === controller) verifyController.current = undefined;
      }
    },
    [applyProfileUpdate, expireSession, update],
  );

  const reconcileForbidden = useCallback(
    async (visit: number, generation: number) => {
      const controller = new AbortController();
      verifyController.current?.abort();
      verifyController.current = controller;
      try {
        const profile = await getProfile({
          signal: controller.signal,
          noAuthReplay: true,
          sessionGeneration: generation,
        } as never);
        if (
          !mounted.current ||
          !focused.current ||
          visitEpoch.current !== visit ||
          !isSessionGenerationCurrent(generation)
        )
          return;
        applyProfileUpdate(profile, generation);
        update({
          access: profile.role === 'ADMIN' ? 'indeterminate' : 'invalid',
          operation: 'idle',
          feedback: { kind: 'error', category: 'forbidden' },
        });
      } catch (error) {
        if (!mounted.current || visitEpoch.current !== visit || controller.signal.aborted) return;
        if (isAxiosError(error) && error.response?.status === 401) await expireSession(generation);
        update({
          access: 'indeterminate',
          operation: 'idle',
          feedback: { kind: 'error', category: 'forbidden' },
        });
      } finally {
        if (verifyController.current === controller) verifyController.current = undefined;
      }
    },
    [applyProfileUpdate, expireSession, update],
  );

  const generate = useCallback(async () => {
    if (
      generateLock.current ||
      stateRef.current.operation !== 'idle' ||
      stateRef.current.access !== 'authorized' ||
      !focused.current ||
      !foreground.current ||
      !user ||
      user.role !== 'ADMIN'
    )
      return;
    generateLock.current = true;
    const generation = getSessionGeneration();
    const visit = visitEpoch.current;
    const op = ++operationEpoch.current;
    const controller = new AbortController();
    postController.current = controller;
    update({ ...stateRef.current, operation: 'generating', feedback: { kind: 'none' } });
    try {
      const result = await createTeacherInvite({
        signal: controller.signal,
        sessionGeneration: generation,
      });
      if (
        !mounted.current ||
        !focused.current ||
        !foreground.current ||
        visitEpoch.current !== visit ||
        operationEpoch.current !== op ||
        !isSessionGenerationCurrent(generation) ||
        identity.current.id !== user.id ||
        identity.current.role !== user.role
      )
        return;
      update({
        access: 'authorized',
        operation: 'idle',
        result,
        feedback: { kind: 'success', category: 'generated' },
      });
    } catch (error) {
      if (
        !mounted.current ||
        !focused.current ||
        visitEpoch.current !== visit ||
        operationEpoch.current !== op ||
        !isSessionGenerationCurrent(generation)
      )
        return;
      const typed = error instanceof TeacherInviteError ? error : undefined;
      if (typed?.status === 401) {
        update({ access: 'invalid', operation: 'idle', feedback: { kind: 'none' } });
        await expireSession(generation);
      } else if (typed?.status === 403) {
        update({
          access: 'checking',
          operation: 'idle',
          feedback: { kind: 'error', category: 'forbidden' },
        });
        await reconcileForbidden(visit, generation);
      } else {
        const feedback: TeacherInviteFeedback = typed?.uncertain
          ? { kind: 'uncertain', category: 'delivery-unconfirmed' }
          : {
              kind: 'error',
              category: typed?.category === 'invalid' ? 'invalid-response' : 'unavailable',
            };
        update({ ...stateRef.current, operation: 'idle', feedback });
      }
    } finally {
      if (postController.current === controller) postController.current = undefined;
      generateLock.current = false;
    }
  }, [expireSession, reconcileForbidden, update, user]);

  const copy = useCallback(async () => {
    const current = stateRef.current;
    const result = current.result;
    if (
      copyLock.current !== undefined ||
      current.operation !== 'idle' ||
      current.access !== 'authorized' ||
      !result ||
      Date.parse(result.expiresAt) <= Date.now() ||
      !focused.current ||
      !foreground.current ||
      !user ||
      user.role !== 'ADMIN'
    )
      return;

    const generation = getSessionGeneration();
    const visit = visitEpoch.current;
    const op = ++operationEpoch.current;
    const code = result.code;
    copyLock.current = op;
    update({ ...current, operation: 'copying', feedback: { kind: 'none' } });
    try {
      const copied = await setStringAsync(code);
      if (
        !mounted.current ||
        !focused.current ||
        !foreground.current ||
        visitEpoch.current !== visit ||
        operationEpoch.current !== op ||
        !isSessionGenerationCurrent(generation) ||
        identity.current.id !== user.id ||
        identity.current.role !== user.role ||
        stateRef.current.result?.id !== result.id
      )
        return;
      update({
        ...stateRef.current,
        operation: 'idle',
        feedback:
          copied === true
            ? { kind: 'success', category: 'copied' }
            : { kind: 'error', category: 'copy-failed' },
      });
    } catch {
      if (
        !mounted.current ||
        !focused.current ||
        !foreground.current ||
        visitEpoch.current !== visit ||
        operationEpoch.current !== op ||
        !isSessionGenerationCurrent(generation) ||
        identity.current.id !== user.id ||
        identity.current.role !== user.role ||
        stateRef.current.result?.id !== result.id
      )
        return;
      update({
        ...stateRef.current,
        operation: 'idle',
        feedback: { kind: 'error', category: 'copy-failed' },
      });
    } finally {
      if (copyLock.current === op) copyLock.current = undefined;
    }
  }, [update, user]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      focused.current = false;
      visitEpoch.current += 1;
      operationEpoch.current += 1;
      generateLock.current = false;
      copyLock.current = undefined;
      verifyController.current?.abort();
      postController.current?.abort();
    };
  }, []);

  useEffect(() => {
    const changed = identity.current.id !== user?.id || identity.current.role !== user?.role;
    identity.current = { id: user?.id, role: user?.role };
    if (changed) clear();
    if (isLoading) update(initial);
    else if (!identity.current.id)
      update({ access: 'invalid', operation: 'idle', feedback: { kind: 'none' } });
  }, [clear, isLoading, update, user?.id, user?.role]);

  useEffect(() => {
    const onState = (next: AppStateStatus) => {
      const wasForeground = foreground.current;
      foreground.current = next === 'active';
      if (!foreground.current) clear();
      else if (!wasForeground && focused.current) void verify(visitEpoch.current);
    };
    const listener = AppState.addEventListener('change', onState);
    return () => listener.remove();
  }, [clear, verify]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const visit = ++visitEpoch.current;
      const currentUserId = user?.id;
      const currentRole = user?.role;
      if (
        foreground.current &&
        !isLoading &&
        currentUserId &&
        identity.current.id === currentUserId &&
        identity.current.role === currentRole
      )
        void verify(visit);
      else
        update({
          access: isLoading ? 'checking' : 'invalid',
          operation: 'idle',
          feedback: { kind: 'none' },
        });
      return () => {
        focused.current = false;
        visitEpoch.current += 1;
        operationEpoch.current += 1;
        generateLock.current = false;
        copyLock.current = undefined;
        verifyController.current?.abort();
        postController.current?.abort();
        update(initial);
      };
    }, [isLoading, update, user?.id, user?.role, verify]),
  );

  return { state, generate, copy, clear };
}
