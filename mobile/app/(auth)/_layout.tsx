import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/src/features/auth/auth-context";

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
