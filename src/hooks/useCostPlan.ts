import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../query/client';

export function useCostPlan(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.costPlan(orgId || '', jobId || ''),
    queryFn: async () => {
      const { fetchCostPlan } = await import('../firebase/costPlan');
      return fetchCostPlan(jobId || '');
    },
    enabled: Boolean(orgId && jobId),
  });
}

export function useTradeList(orgId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.tradeList(orgId || ''),
    queryFn: async () => {
      const { fetchTradeList } = await import('../firebase/tradeList');
      return fetchTradeList();
    },
    enabled: Boolean(orgId),
  });
}

export function useCostPlanQuotes(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.costPlanQuotes(orgId || '', jobId || ''),
    queryFn: async () => {
      const { fetchQuotes } = await import('../firebase/quotes');
      return fetchQuotes(jobId || '');
    },
    enabled: Boolean(orgId && jobId && enabled),
  });
}
