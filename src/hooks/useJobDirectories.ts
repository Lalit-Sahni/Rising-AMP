import { useQuery } from '@tanstack/react-query';
import { upsertNamedRow } from '../firebase/partyName';
import {
  fetchHIAContractsFromFirestore,
  fetchPayersFromFirestore,
  fetchProgressPayments,
  fetchUserBankDetailsFromFirestore,
  getClients,
  getLabour,
  getServiceProviders,
  getSuppliers,
  getTrades,
} from '../data';
import { queryClient, queryKeys } from '../query/client';

export const DIRECTORY_STALE_TIME = 30 * 60 * 1000;

type NamedRow = { id?: string; [key: string]: unknown };

function asList(value: unknown): NamedRow[] {
  return Array.isArray(value) ? value : [];
}

async function listFrom(
  result: { success?: boolean; [key: string]: unknown } | null | undefined,
  key: string,
): Promise<NamedRow[]> {
  if (!result || result.success === false) return [];
  return asList(result[key]);
}

export function patchNamedList(
  queryKey: readonly unknown[],
  item: unknown,
  getName: (row: NamedRow) => unknown,
) {
  queryClient.setQueryData(queryKey, (prev: unknown) => (
    upsertNamedRow(asList(prev), item, getName)
  ));
}

export function setList(queryKey: readonly unknown[], list: unknown) {
  queryClient.setQueryData(queryKey, asList(list));
}

export function setBankDetails(queryKey: readonly unknown[], details: unknown) {
  queryClient.setQueryData(queryKey, details ?? null);
}

function useDirectoryQuery(
  queryKey: readonly unknown[],
  queryFn: () => Promise<NamedRow[]>,
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
  staleTime?: number,
) {
  return useQuery({
    queryKey,
    queryFn,
    enabled: Boolean(orgId && jobId && extraEnabled),
    ...(staleTime != null ? { staleTime } : {}),
  });
}

export function useJobLabour(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useDirectoryQuery(
    queryKeys.labour(orgId || '', jobId || ''),
    async () => listFrom(await getLabour(jobId || ''), 'labour'),
    orgId,
    jobId,
    extraEnabled,
    DIRECTORY_STALE_TIME,
  );
}

export function useJobTrades(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useDirectoryQuery(
    queryKeys.trades(orgId || '', jobId || ''),
    async () => listFrom(await getTrades(jobId || ''), 'trades'),
    orgId,
    jobId,
    extraEnabled,
    DIRECTORY_STALE_TIME,
  );
}

export function useJobClients(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useDirectoryQuery(
    queryKeys.clients(orgId || '', jobId || ''),
    async () => listFrom(await getClients(jobId || ''), 'clients'),
    orgId,
    jobId,
    extraEnabled,
    DIRECTORY_STALE_TIME,
  );
}

export function useJobSuppliers(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useDirectoryQuery(
    queryKeys.suppliers(orgId || '', jobId || ''),
    async () => listFrom(await getSuppliers(jobId || ''), 'suppliers'),
    orgId,
    jobId,
    extraEnabled,
    DIRECTORY_STALE_TIME,
  );
}

export function useJobServiceProviders(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useDirectoryQuery(
    queryKeys.serviceProviders(orgId || '', jobId || ''),
    async () => listFrom(await getServiceProviders(jobId || ''), 'providers'),
    orgId,
    jobId,
    extraEnabled,
    DIRECTORY_STALE_TIME,
  );
}

export function useJobPayers(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useDirectoryQuery(
    queryKeys.payers(orgId || '', jobId || ''),
    async () => listFrom(await fetchPayersFromFirestore(jobId || ''), 'payers'),
    orgId,
    jobId,
    extraEnabled,
    DIRECTORY_STALE_TIME,
  );
}

export function useJobProgressPayments(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useDirectoryQuery(
    queryKeys.progressPayments(orgId || '', jobId || ''),
    async () => listFrom(await fetchProgressPayments(jobId || ''), 'progressPayments'),
    orgId,
    jobId,
    extraEnabled,
  );
}

export function useJobHiaContracts(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useDirectoryQuery(
    queryKeys.hiaContracts(orgId || '', jobId || ''),
    async () => listFrom(await fetchHIAContractsFromFirestore(jobId || ''), 'hiaContracts'),
    orgId,
    jobId,
    extraEnabled,
  );
}

export function useJobBankDetails(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
  extraEnabled = true,
) {
  return useQuery({
    queryKey: queryKeys.bankDetails(orgId || '', jobId || ''),
    queryFn: async () => {
      const result = await fetchUserBankDetailsFromFirestore(jobId || '');
      if (!result.success) return null;
      return result.userBankDetails ?? null;
    },
    enabled: Boolean(orgId && jobId && extraEnabled),
  });
}
