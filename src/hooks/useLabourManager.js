import { useState, useCallback } from 'react';
import { saveLabourInfo, getLabour, updateLabour, deleteLabour } from '../firebase/firebaseService';

export const useLabourManager = (accessCode, showToast) => {
  const [labour, setLabour] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadLabour = useCallback(async () => {
    if (!accessCode) return;
    
    try {
      setLoading(true);
      const result = await getLabour(accessCode);
      
      if (result.success) {
        setLabour(result.labour);
      } else {
        console.error('Failed to load labour:', result.error);
        showToast?.(result.error || 'Failed to load labour', 'error');
        setLabour([]);
      }
    } catch (error) {
      console.error('Error loading labour:', error);
      showToast?.('Failed to load labour', 'error');
      setLabour([]);
    } finally {
      setLoading(false);
    }
  }, [accessCode, showToast]);

  const saveLabour = useCallback(async (labourData) => {
    if (!accessCode || !labourData.name?.trim()) {
      showToast?.('Labour name is required', 'error');
      return { success: false, error: 'Labour name is required' };
    }

    try {
      setSubmitting(true);
      const result = await saveLabourInfo(accessCode, labourData);
      
      if (result.success) {
        showToast?.('Labour saved successfully', 'success');
        await loadLabour(); // Reload labour after save
        return result;
      } else {
        showToast?.(result.error || 'Failed to save labour', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error saving labour:', error);
      showToast?.('Failed to save labour', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [accessCode, showToast, loadLabour]);

  const updateLabourData = useCallback(async (labourId, labourData) => {
    if (!accessCode || !labourId || !labourData.name?.trim()) {
      showToast?.('Labour ID and name are required', 'error');
      return { success: false, error: 'Labour ID and name are required' };
    }

    try {
      setSubmitting(true);
      const result = await updateLabour(accessCode, labourId, labourData);
      
      if (result.success) {
        showToast?.('Labour updated successfully', 'success');
        await loadLabour(); // Reload labour after update
        return result;
      } else {
        showToast?.(result.error || 'Failed to update labour', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error updating labour:', error);
      showToast?.('Failed to update labour', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [accessCode, showToast, loadLabour]);

  const removeLabour = useCallback(async (labourId) => {
    if (!accessCode || !labourId) {
      showToast?.('Labour ID is required', 'error');
      return { success: false, error: 'Labour ID is required' };
    }

    try {
      const result = await deleteLabour(accessCode, labourId);
      
      if (result.success) {
        showToast?.('Labour deleted successfully', 'success');
        await loadLabour(); // Reload labour after delete
        return result;
      } else {
        showToast?.(result.error || 'Failed to delete labour', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error deleting labour:', error);
      showToast?.('Failed to delete labour', 'error');
      return { success: false, error: error.message };
    }
  }, [accessCode, showToast, loadLabour]);

  const searchLabour = useCallback((searchTerm) => {
    if (!searchTerm?.trim()) return labour;
    
    const term = searchTerm.toLowerCase();
    return labour.filter(item =>
      item.name?.toLowerCase().includes(term) ||
      item.role?.toLowerCase().includes(term) ||
      item.company?.toLowerCase().includes(term) ||
      item.phone?.toLowerCase().includes(term)
    );
  }, [labour]);

  return {
    labour,
    loading,
    submitting,
    loadLabour,
    saveLabour,
    updateLabour: updateLabourData,
    removeLabour,
    searchLabour
  };
};