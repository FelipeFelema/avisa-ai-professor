import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useRootNavigationState, useRouter } from 'expo-router';
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
import { AnnouncementPushFeedback } from '@/components/announcements/AnnouncementPushFeedback';
import {
  bindAnnouncementPushSession,
  consumeAnnouncementPush,
} from '@/services/push/announcement-push-navigation';
import {
  parseAnnouncementPush,
  rememberAnnouncementReceipt,
} from '@/services/push/announcement-push-presentation';

export function PushProvider({ children }: PropsWithChildren) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const navigation = useRootNavigationState();
  const navigationReady = !!navigation?.key;
  const userId = user?.id;

  useEffect(() => {
    if (isLoading || !navigationReady || !getPushRuntimeConfig().available) return;
    bindAnnouncementPushSession(userId ?? null, getSessionGeneration(), (path) =>
      router.push(path),
    );
    const generation = getSessionGeneration();
    let active = true;
    let cleanupNotifications: (() => void) | undefined;
    const reconcileCurrentSession = () => {
      if (!userId || !active || !isSessionGenerationCurrent(generation)) return;
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
          const data = notification.request.content.data;
          const business = parseAnnouncementPush(data);
          const shouldPresent =
            active &&
            isSessionGenerationCurrent(generation) &&
            (isPushTestNotification(data) ||
              (!!business && rememberAnnouncementReceipt(business.dispatchId)));
          return {
            shouldShowBanner: shouldPresent,
            shouldShowList: shouldPresent,
            shouldPlaySound: shouldPresent,
            shouldSetBadge: false,
          };
        },
      });

      const received = notificationsSdk.addNotificationReceivedListener((notification) => {
        if (!active || !isSessionGenerationCurrent(generation)) return;
        handlePushTestNotification(notification.request.content.data);
      });
      const handleResponse = (event: import('expo-notifications').NotificationResponse) => {
        if (!active || !isSessionGenerationCurrent(generation)) return;
        const data = event.notification.request.content.data;
        if (consumeAnnouncementPush(data)) return;
        if (!parsePushTestAttemptId(data)) return;
        handlePushTestNotification(data);
        router.push('/(app)/profile/notifications');
      };
      const clearLast = () => {
        void notificationsSdk.clearLastNotificationResponseAsync().catch(() => undefined);
      };
      const response = notificationsSdk.addNotificationResponseReceivedListener((event) => {
        handleResponse(event);
        clearLast();
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
      try {
        const last = await notificationsSdk.getLastNotificationResponseAsync();
        if (last && active && isSessionGenerationCurrent(generation)) {
          handleResponse(last);
          clearLast();
        }
      } catch {
        /* native response unavailable */
      }
    })();

    return () => {
      active = false;
      cleanupNotifications?.();
    };
  }, [isLoading, navigationReady, router, userId]);

  return (
    <>
      {children}
      <AnnouncementPushFeedback />
    </>
  );
}
