"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Client-side fetching is the exception here, not the default: server
// components and server actions handle data, and this provider exists for
// the few interactive islands (the editor canvas, analytics) whose data is
// deliberately client-owned. It is not mounted globally — a consumer wraps
// itself, and should be able to justify the tradeoff first.
//
// Module-singleton QueryClient (not per-render): every consumer shares one
// client, so a page mounting more than one island still shares cache/dedup.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
