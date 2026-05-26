import { api } from "@/src/api/api";

import type { Announcement } from "./types";

export async function findAllAnnouncements(accessToken: string) {
  const response = await api.get<Announcement[]>("/announcements", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}
