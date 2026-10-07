import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { getPushRuntimeConfig } from '@/config/push-config';
import { addConnectivityListener } from '@/lib/api';
import { getSessionGeneration, isSessionGenerationCurrent } from '@/lib/session-generation';
import { useAuth } from '@/hooks/useAuth';
import { reconcilePushNotifications } from '@/services/push/push-lifecycle';
import {
  handlePushTestNotification,
  isPushTestNotification,
  parsePushTestAttemptId,
} from '@/services/push/push-presentation';

export function PushProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !getPushRuntimeConfig().available) return;
    const generation = getSessionGeneration();
    let active = true;
    let cleanupNotifications: (() => void) | undefined;
    const reconcileCurrentSession = () => {
      if (!active || !isSessionGenerationCurrent(generation)) return;
      void reconcilePushNotifications(generation);
    };

    void (async () => {
      let notificationsSdk: typeof import('expo-notifications');
      try {
        notificationsSdk = await import('expo-notifications');
      } catch {
        return;
      }
      if (!active) return;

      notificationsSdk.setNotificationHandler({
        handleNotification: async (notification) => {
          const shouldPresent = isPushTestNotification(notification.request.content.data);
          return {
            shouldShowBanner: shouldPresent,
            shouldShowList: shouldPresent,
            shouldPlaySound: shouldPresent,
            shouldSetBadge: false,
          };
        },
      });

      const received = notificationsSdk.addNotificationReceivedListener((notification) => {
        handlePushTestNotification(notification.request.content.data);
      });
      const response = notificationsSdk.addNotificationResponseReceivedListener((event) => {
        const data = event.notification.request.content.data;
        if (!parsePushTestAttemptId(data)) return;
        handlePushTestNotification(data);
        router.push('/(app)/profile/notifications');
      });
      const pushToken = notificationsSdk.addPushTokenListener(() => {
        // The native token is never sent to the server; reconciliation reads a fresh Expo token.
        reconcileCurrentSession();
      });
      const removeConnectivityListener = addConnectivityListener(reconcileCurrentSession);
      let lastState: AppStateStatus = AppState.currentState;
      reconcileCurrentSession();

      const appState = AppState.addEventListener('change', (nextState) => {
        if (lastState !== 'active' && nextState === 'active') {
          reconcileCurrentSession();
        }
        lastState = nextState;
      });

      cleanupNotifications = () => {
        appState.remove();
        received.remove();
        response.remove();
        pushToken.remove();
        removeConnectivityListener();
      };
    })();

    return () => {
      active = false;
      cleanupNotifications?.();
    };
  }, [router, userId]);

  return children;
}
