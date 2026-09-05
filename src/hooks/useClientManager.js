import { useState, useCallback } from 'react';
import { saveClientInfo, updateClient, deleteClient } from '../data';
import { queryClient, queryKeys } from '../query/client';
import { patchNamedList, useJobClients } from './useJobDirectories';

export const useClientManager = (jobId, showToast, orgId, enabled = true) => {
  const query = useJobClients(orgId, jobId, enabled);
  const clients = query.data || [];
  const loading = query.isLoading;
  const [submitting, setSubmitting] = useState(false);
  const clientsKey = queryKeys.clients(orgId || '', jobId || '');

  const loadClients = useCallback(async () => {
    if (!orgId || !jobId) return;
    try {
      await query.refetch();
    } catch (error) {
      console.error('Error loading clients:', error);
      showToast?.('Failed to load clients', 'error');
    }
  }, [orgId, jobId, query, showToast]);

  const saveClient = useCallback(async (clientData) => {
    if (!jobId || !clientData.name?.trim()) {
      showToast?.('Client name is required', 'error');
      return { success: false, error: 'Client name is required' };
    }

    try {
      setSubmitting(true);
      const result = await saveClientInfo(jobId, clientData);

      if (result.success) {
        patchNamedList(clientsKey, result.client, (row) => row.name);
        showToast?.('Client saved successfully', 'success');
        return result;
      }
      showToast?.(result.error || 'Failed to save client', 'error');
      return result;
    } catch (error) {
      console.error('Error saving client:', error);
      showToast?.('Failed to save client', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [jobId, showToast, clientsKey]);

  const updateClientData = useCallback(async (clientId, clientData) => {
    if (!jobId || !clientId || !clientData.name?.trim()) {
      showToast?.('Client ID and name are required', 'error');
      return { success: false, error: 'Client ID and name are required' };
    }

    try {
      setSubmitting(true);
      const result = await updateClient(jobId, clientId, clientData);

      if (result.success) {
        patchNamedList(clientsKey, result.client, (row) => row.name);
        showToast?.('Client updated successfully', 'success');
        return result;
      }
      showToast?.(result.error || 'Failed to update client', 'error');
      return result;
    } catch (error) {
      console.error('Error updating client:', error);
      showToast?.('Failed to update client', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [jobId, showToast, clientsKey]);

  const removeClient = useCallback(async (clientId) => {
    if (!jobId || !clientId) {
      showToast?.('Client ID is required', 'error');
      return { success: false, error: 'Client ID is required' };
    }

    try {
      const result = await deleteClient(jobId, clientId);

      if (result.success) {
        queryClient.setQueryData(clientsKey, (prev) => (
          (Array.isArray(prev) ? prev : []).filter((client) => client.id !== clientId)
        ));
        showToast?.('Client removed from this job', 'success');
        return result;
      }
      showToast?.(result.error || 'Failed to delete client', 'error');
      return result;
    } catch (error) {
      console.error('Error deleting client:', error);
      showToast?.('Failed to delete client', 'error');
      return { success: false, error: error.message };
    }
  }, [jobId, showToast, clientsKey]);

  const searchClients = useCallback((searchTerm) => {
    if (!searchTerm?.trim()) return clients;

    const term = searchTerm.toLowerCase();
    return clients.filter((client) =>
      client.name?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.company?.toLowerCase().includes(term) ||
      client.phone?.toLowerCase().includes(term)
    );
  }, [clients]);

  return {
    clients,
    loading,
    submitting,
    loadClients,
    saveClient,
    updateClient: updateClientData,
    removeClient,
    searchClients,
  };
};
