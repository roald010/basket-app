import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Basket's data (lists, prices, staples) doesn't change out from under the user
      // between screens -- they're the only writer, and writes already invalidate their
      // own keys. A short staleTime lets tab-to-tab navigation reuse cached data instead
      // of firing a fresh request every mount, which is the difference between a screen
      // that pops in instantly and one that flashes a skeleton on every visit.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // One retry, not the default three: on a real outage, three sequential retries
      // just delay the error state the screens already handle gracefully.
      retry: 1,
      // Refetch when the app returns to the foreground (prices/savings may have moved),
      // but not on every JS-level window focus, which on native fires far too eagerly.
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
