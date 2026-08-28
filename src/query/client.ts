import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  jobs: (orgId: string, email: string) => ['jobs', orgId, email] as const,
  expenses: (orgId: string, jobId: string) => ['expenses', orgId, jobId] as const,
  invoices: (orgId: string, jobId: string) => ['invoices', orgId, jobId] as const,
  clients: (orgId: string, jobId: string) => ['clients', orgId, jobId] as const,
  labour: (orgId: string, jobId: string) => ['labour', orgId, jobId] as const,
  trades: (orgId: string, jobId: string) => ['trades', orgId, jobId] as const,
  suppliers: (orgId: string, jobId: string) => ['suppliers', orgId, jobId] as const,
};
