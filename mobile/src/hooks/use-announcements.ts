import { isAxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import { findAllAnnouncements } from "../features/announcements/announcements.service";
import type { Announcement } from "../features/announcements/types";
import { useAuth } from "../features/auth/auth-context";

export function useAnnouncements() {
  const { accessToken } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnnouncements = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const data = await findAllAnnouncements(accessToken);
      setAnnouncements(data);
    } catch (err) {
      if (isAxiosError(err)) {
        setError(
          err.response?.data?.message ?? "Nao foi possivel buscar comunicados.",
        );
      } else {
        setError("Nao foi possivel buscar comunicados.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  return {
    announcements,
    error,
    isLoading,
    reload: loadAnnouncements,
  };
}
