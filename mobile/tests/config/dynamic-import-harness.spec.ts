import { pushMocks } from '../helpers/push';

describe('dynamic imports in the Jest harness', () => {
  it('loads native SDK mocks through the same async boundary used by PushProvider', async () => {
    const notifications = await import('expo-notifications');

    expect(notifications.getPermissionsAsync).toBe(pushMocks.notifications.getPermissionsAsync);
    expect(notifications.addPushTokenListener).toBe(pushMocks.notifications.addPushTokenListener);
  });
});
