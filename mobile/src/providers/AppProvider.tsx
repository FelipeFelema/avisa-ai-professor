import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren } from "react";

import { queryClient } from "../config/query-client";

type AppProviderProps = PropsWithChildren;

export function AppProvider({ children }: AppProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
