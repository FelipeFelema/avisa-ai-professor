import { isAxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../features/auth/auth-context";
import type { Classroom } from "../features/classrooms/types";
import { findMyClassrooms } from "../features/classrooms/classrooms.service";

export function useClassrooms() {
  const { accessToken } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadClassrooms = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const data = await findMyClassrooms(accessToken);
      setClassrooms(data);
    } catch (err) {
      if (isAxiosError(err)) {
        setError(
          err.response?.data?.message ?? "Nao foi possivel buscar as turmas.",
        );
      } else {
        setError("Nao foi possivel buscar as turmas.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadClassrooms();
  }, [loadClassrooms]);

  return {
    classrooms,
    error,
    isLoading,
    reload: loadClassrooms,
  };
}
