import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushLifecycleSnapshot,
  reconcilePushNotifications,
  sendPushTestNotification,
  subscribePushLifecycle,
  type PushUiStatus,
} from '@/services/push/push-lifecycle';
import { getSessionGeneration, isSessionGenerationCurrent } from '@/lib/session-generation';
import { subscribePushTestPresentation } from '@/services/push/push-presentation';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushUiStatus>('LOADING');
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isTestBusy, setIsTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testAvailableAt, setTestAvailableAt] = useState<string | null>(null);
  const [testCooldownActive, setTestCooldownActive] = useState(false);
  const activationRef = useRef<Promise<void> | null>(null);
  const testRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    const generation = getSessionGeneration();
    const result = await reconcilePushNotifications(generation);
    if (!isSessionGenerationCurrent(generation)) return;
    setStatus(result.status);
    setMessage(result.message);
    if (result.status !== 'ACTIVE') {
      setTestAvailableAt(null);
      setTestCooldownActive(false);
    } else if (result.testAvailableAt) {
      setTestAvailableAt(result.testAvailableAt);
      setTestCooldownActive(Date.parse(result.testAvailableAt) > Date.now());
    } else {
      setTestAvailableAt(null);
      setTestCooldownActive(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const generation = getSessionGeneration();
    const removeLifecycleListener = subscribePushLifecycle((result, operationGeneration) => {
      if (
        !active ||
        operationGeneration !== generation ||
        !isSessionGenerationCurrent(generation)
      ) {
        return;
      }
      if (!active) return;
      setStatus(result.status);
      setMessage(result.message);
      if (result.status !== 'ACTIVE') {
        setTestAvailableAt(null);
        setTestCooldownActive(false);
      } else if (result.testAvailableAt) {
        setTestAvailableAt(result.testAvailableAt);
        setTestCooldownActive(Date.parse(result.testAvailableAt) > Date.now());
      } else {
        setTestAvailableAt(null);
        setTestCooldownActive(false);
      }
    });
    void getPushLifecycleSnapshot(generation).then((result) => {
      if (!active || !isSessionGenerationCurrent(generation)) return;
      setStatus(result.status);
      setMessage(result.message);
      if (result.status !== 'ACTIVE') {
        setTestAvailableAt(null);
        setTestCooldownActive(false);
      } else if (result.testAvailableAt) {
        setTestAvailableAt(result.testAvailableAt);
        setTestCooldownActive(Date.parse(result.testAvailableAt) > Date.now());
      } else {
        setTestAvailableAt(null);
        setTestCooldownActive(false);
      }
    });
    return () => {
      active = false;
      removeLifecycleListener();
    };
  }, []);

  useEffect(() => {
    const generation = getSessionGeneration();
    return subscribePushTestPresentation(() => {
      if (!isSessionGenerationCurrent(generation)) return;
      setTestMessage('Notificação de teste recebida neste dispositivo.');
    });
  }, []);

  useEffect(() => {
    if (!testAvailableAt) return;
    const delay = Math.max(0, Date.parse(testAvailableAt) - Date.now());
    if (!testCooldownActive || delay === 0) return;
    const timer = setTimeout(() => setTestCooldownActive(false), delay);
    return () => clearTimeout(timer);
  }, [testAvailableAt, testCooldownActive]);

  const activate = useCallback(() => {
    if (activationRef.current) return activationRef.current;
    setIsBusy(true);
    const operation = enablePushNotifications()
      .then((result) => {
        setStatus(result.status);
        setMessage(result.message);
      })
      .finally(() => {
        activationRef.current = null;
        setIsBusy(false);
      });
    activationRef.current = operation;
    return operation;
  }, []);

  const deactivate = useCallback(async () => {
    setIsBusy(true);
    try {
      const result = await disablePushNotifications();
      setStatus(result.status);
      setMessage(result.message);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const sendTest = useCallback(() => {
    if (testRef.current) return testRef.current;
    if (status !== 'ACTIVE') {
      setTestMessage('Ative as notificações neste dispositivo antes de enviar um teste.');
      return Promise.resolve();
    }
    if (isBusy) return Promise.resolve();
    if (testAvailableAt && Date.parse(testAvailableAt) > Date.now()) {
      setTestMessage('Aguarde o prazo indicado antes de enviar outro teste.');
      return Promise.resolve();
    }

    const generation = getSessionGeneration();
    setIsTestBusy(true);
    setTestMessage(null);
    const operation = sendPushTestNotification(generation)
      .then((result) => {
        if (!isSessionGenerationCurrent(generation)) return;
        setTestMessage(result.message);
        setTestAvailableAt(result.nextTestAvailableAt);
        setTestCooldownActive(
          result.nextTestAvailableAt !== null &&
            Date.parse(result.nextTestAvailableAt) > Date.now(),
        );
      })
      .finally(() => {
        testRef.current = null;
        setIsTestBusy(false);
      });
    testRef.current = operation;
    return operation;
  }, [isBusy, status, testAvailableAt]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      setMessage('Abra as configurações do dispositivo para permitir notificações.');
    }
  }, []);

  return {
    status,
    message,
    isBusy,
    isTestBusy,
    testMessage,
    testAvailableAt,
    testCooldownActive,
    refresh,
    activate,
    deactivate,
    sendTest,
    openSettings,
  };
}
