import { api } from "@/src/api/api";

import type { Classroom } from "./types";

export async function findMyClassrooms(accessToken: string) {
  const response = await api.get<Classroom[]>("/classrooms/my", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}
