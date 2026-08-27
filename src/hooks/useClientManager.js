import { useState, useCallback } from 'react';
import { saveClientInfo, getClients, updateClient, deleteClient } from '../firebase/firebaseService';

export const useClientManager = (jobId, showToast) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadClients = useCallback(async () => {
    if (!jobId) return;
    
    try {
      setLoading(true);
      const result = await getClients(jobId);
      
      if (result.success) {
        setClients(result.clients);
      } else {
        console.error('Failed to load clients:', result.error);
        showToast?.(result.error || 'Failed to load clients', 'error');
        setClients([]);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      showToast?.('Failed to load clients', 'error');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [jobId, showToast]);

  const saveClient = useCallback(async (clientData) => {
    if (!jobId || !clientData.name?.trim()) {
      showToast?.('Client name is required', 'error');
      return { success: false, error: 'Client name is required' };
    }

    try {
      setSubmitting(true);
      const result = await saveClientInfo(jobId, clientData);
      
      if (result.success) {
        showToast?.('Client saved successfully', 'success');
        await loadClients(); // Reload clients after save
        return result;
      } else {
        showToast?.(result.error || 'Failed to save client', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error saving client:', error);
      showToast?.('Failed to save client', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [jobId, showToast, loadClients]);

  const updateClientData = useCallback(async (clientId, clientData) => {
    if (!jobId || !clientId || !clientData.name?.trim()) {
      showToast?.('Client ID and name are required', 'error');
      return { success: false, error: 'Client ID and name are required' };
    }

    try {
      setSubmitting(true);
      const result = await updateClient(jobId, clientId, clientData);
      
      if (result.success) {
        showToast?.('Client updated successfully', 'success');
        await loadClients(); // Reload clients after update
        return result;
      } else {
        showToast?.(result.error || 'Failed to update client', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error updating client:', error);
      showToast?.('Failed to update client', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [jobId, showToast, loadClients]);

  const removeClient = useCallback(async (clientId) => {
    if (!jobId || !clientId) {
      showToast?.('Client ID is required', 'error');
      return { success: false, error: 'Client ID is required' };
    }

    try {
      const result = await deleteClient(jobId, clientId);
      
      if (result.success) {
        showToast?.('Client deleted successfully', 'success');
        await loadClients(); // Reload clients after delete
        return result;
      } else {
        showToast?.(result.error || 'Failed to delete client', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      showToast?.('Failed to delete client', 'error');
      return { success: false, error: error.message };
    }
  }, [jobId, showToast, loadClients]);

  const searchClients = useCallback((searchTerm) => {
    if (!searchTerm?.trim()) return clients;
    
    const term = searchTerm.toLowerCase();
    return clients.filter(client =>
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
    searchClients
  };
};