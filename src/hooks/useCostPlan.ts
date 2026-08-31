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
