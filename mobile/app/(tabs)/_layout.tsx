import { Redirect, Tabs } from "expo-router";
import type { Href } from "expo-router";

import { useAuth } from "@/src/features/auth/auth-context";

export default function TabsLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href={"/login" as Href} />;
  }

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Comunicados" }} />
      <Tabs.Screen name="classrooms" options={{ title: "Turmas" }} />
    </Tabs>
  );
}
