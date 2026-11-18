"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { ApiError } from "@/lib/api/client";
import { LocaleProvider } from "@/lib/locale";
import { QUERY_CACHE } from "@/lib/query-cache";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_CACHE.defaultStaleTime,
        gcTime: QUERY_CACHE.gcTime,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          // Never retry auth/permission failures — they will not fix themselves.
          if (error instanceof ApiError && [401, 403, 404, 422].includes(error.status)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ className: "text-sm" }}
        />
      </LocaleProvider>
    </QueryClientProvider>
  );
}
