import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { changePassword, getChangePasswordFeedback } from '@/services/auth';
import type { ChangePasswordFeedback, ChangePasswordRequest } from '@/types/auth';

export function useChangePassword() {
  const { user, expireSession } = useAuth();
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const account = useRef(user?.id);
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<ChangePasswordFeedback>();
  const clearFeedback = useCallback(() => {
    generation.current += 1;
    if (mounted.current) setFeedback(undefined);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  useEffect(() => {
    account.current = user?.id;
    clearFeedback();
  }, [user?.id, clearFeedback]);

  const submit = async (data: ChangePasswordRequest): Promise<'success' | 'error' | 'ignored'> => {
    if (inFlight.current || !account.current || !mounted.current) return 'ignored';
    inFlight.current = true;
    const entry = generation.current;
    let transient: ChangePasswordRequest | undefined = data;
    setIsPending(true);
    setFeedback(undefined);
    try {
      await changePassword(transient);
      if (!mounted.current || entry !== generation.current || !account.current) return 'ignored';
      return 'success';
    } catch (error) {
      const safe = getChangePasswordFeedback(error);
      if (!mounted.current || entry !== generation.current || !account.current) return 'ignored';
      if (safe.status === 401) {
        await expireSession();
        return 'ignored';
      }
      setFeedback(safe);
      return 'error';
    } finally {
      transient = undefined;
      inFlight.current = false;
      if (mounted.current) setIsPending(false);
    }
  };

  return { submit, isPending, feedback, clearFeedback };
}
