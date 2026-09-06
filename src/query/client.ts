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

export function invalidateKeys(...keys: Array<readonly unknown[]>) {
  keys.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
}

export const queryKeys = {
  jobs: (orgId: string, email: string) => ['jobs', orgId, email] as const,
  expenses: (orgId: string, jobId: string) => ['expenses', orgId, jobId] as const,
  invoices: (orgId: string, jobId: string) => ['invoices', orgId, jobId] as const,
  clients: (orgId: string, jobId: string) => ['clients', orgId, jobId] as const,
  labour: (orgId: string, jobId: string) => ['labour', orgId, jobId] as const,
  trades: (orgId: string, jobId: string) => ['trades', orgId, jobId] as const,
  suppliers: (orgId: string, jobId: string) => ['suppliers', orgId, jobId] as const,
  serviceProviders: (orgId: string, jobId: string) => ['service-providers', orgId, jobId] as const,
  payers: (orgId: string, jobId: string) => ['payers', orgId, jobId] as const,
  progressPayments: (orgId: string, jobId: string) => ['progress-payments', orgId, jobId] as const,
  hiaContracts: (orgId: string, jobId: string) => ['hia-contracts', orgId, jobId] as const,
  bankDetails: (orgId: string, jobId: string) => ['bank-details', orgId, jobId] as const,
  costPlan: (orgId: string, jobId: string) => ['cost-plan', orgId, jobId] as const,
  costPlanQuotes: (orgId: string, jobId: string) => ['cost-plan-quotes', orgId, jobId] as const,
  tradeList: (orgId: string) => ['trade-list', orgId] as const,
};
