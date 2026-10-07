import {
  parseAnnouncementPush,
  rememberAnnouncementReceipt,
  rememberAnnouncementTap,
  resetAnnouncementPushDedupe,
} from '@/services/push/announcement-push-presentation';
const payload = {
  version: 1,
  type: 'announcement-created',
  announcementId: '00000000-0000-4000-8000-000000000111',
  dispatchId: '00000000-0000-4000-8000-000000000112',
};
describe('closed announcement notification payload', () => {
  beforeEach(resetAnnouncementPushDedupe);
  it.each(['announcement-created', 'announcement-expiring'])(
    'accepts the closed %s payload',
    (type) => {
      expect(parseAnnouncementPush({ ...payload, type })).toEqual({ ...payload, type });
    },
  );
  it.each([
    null,
    {},
    { ...payload, url: 'https://example.test' },
    { ...payload, userId: 'private' },
    { ...payload, version: 2 },
    { ...payload, type: 'administrative-notice' },
    { ...payload, announcementId: '../../auth' },
    { ...payload, dispatchId: '00000000-0000-1000-8000-000000000112' },
  ])('ignores malformed or unimplemented notifications', (data) => {
    expect(parseAnnouncementPush(data)).toBeNull();
  });
  it('deduplicates receipt and tap independently with bounded history', () => {
    expect(rememberAnnouncementReceipt(payload.dispatchId)).toBe(true);
    expect(rememberAnnouncementReceipt(payload.dispatchId)).toBe(false);
    expect(rememberAnnouncementTap(payload.dispatchId)).toBe(true);
    expect(rememberAnnouncementTap(payload.dispatchId)).toBe(false);
    for (let i = 0; i < 128; i++) {
      const id = `00000000-0000-4000-8000-${String(i + 500).padStart(12, '0')}`;
      rememberAnnouncementReceipt(id);
      rememberAnnouncementTap(id);
    }
    expect(rememberAnnouncementReceipt(payload.dispatchId)).toBe(true);
    expect(rememberAnnouncementTap(payload.dispatchId)).toBe(true);
  });
});
