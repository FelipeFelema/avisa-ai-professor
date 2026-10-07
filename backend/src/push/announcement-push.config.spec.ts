import { createAnnouncementPushConfig } from './announcement-push.config';

describe('announcement push configuration', () => {
  it('defaults business notifications and reminders to disabled', () => {
    expect(createAnnouncementPushConfig({})).toEqual({
      enabled: false,
      remindersEnabled: false,
    });
  });

  it('requires available authenticated foundation transport', () => {
    expect(
      createAnnouncementPushConfig({ ANNOUNCEMENT_PUSH_ENABLED: 'true' }),
    ).toEqual({ enabled: false, remindersEnabled: false });
    expect(
      createAnnouncementPushConfig({
        ANNOUNCEMENT_PUSH_ENABLED: 'true',
        EXPO_PUSH_ENABLED: 'true',
        EXPO_PUSH_ACCESS_TOKEN: 'synthetic-test-only-private-token',
      }),
    ).toEqual({ enabled: true, remindersEnabled: false });
  });

  it('fails closed for invalid booleans and does not include secrets', () => {
    const config = createAnnouncementPushConfig({
      ANNOUNCEMENT_PUSH_ENABLED: 'yes',
      ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'true',
      EXPO_PUSH_ENABLED: 'true',
      EXPO_PUSH_ACCESS_TOKEN: 'synthetic-test-only-private-token',
    });
    expect(config).toEqual({ enabled: false, remindersEnabled: false });
    expect(JSON.stringify(config)).not.toContain('private-token');
  });

  it('keeps optional reminder flag independent and inert without business push', () => {
    expect(
      createAnnouncementPushConfig({
        ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'true',
      }),
    ).toEqual({ enabled: false, remindersEnabled: false });
  });
});
