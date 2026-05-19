import { api } from "@/src/api/api";

import type { LoginRequest, LoginResponse } from "./types";

export async function loginRequest(data: LoginRequest) {
  const response = await api.post<LoginResponse>("/auth/login", data);

  return response.data;
}
