import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { AxiosError } from 'axios';

import { announcementKeys } from '@/config';
import * as announcementsService from '@/services/announcements';
import {
  getAnnouncementPushState,
  retryAnnouncementPush,
  subscribeAnnouncementPush,
} from '@/services/push/announcement-push-navigation';
import { isSessionGenerationCurrent } from '@/lib/session-generation';

export function useAnnouncement(id: string) {
  const tap = useSyncExternalStore(
    subscribeAnnouncementPush,
    getAnnouncementPushState,
    getAnnouncementPushState,
  );
  const blocked =
    tap.announcementId === id &&
    (tap.status !== 'authorized' ||
      tap.generation === undefined ||
      !isSessionGenerationCurrent(tap.generation));
  const query = useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: ({ signal }) => announcementsService.findOne(id, { signal }),
    enabled: !!id && !blocked,
  });
  if (!blocked) return query;
  const unavailable = tap.status === 'unavailable';
  const failed = unavailable || tap.status === 'error';
  const error = new AxiosError('Comunicado indisponível', undefined, undefined, undefined, {
    status: unavailable ? 404 : 503,
  } as never);
  return {
    ...query,
    data: undefined,
    isLoading: !failed,
    isError: failed,
    error: failed ? error : null,
    refetch: retryAnnouncementPush,
  };
}
