import { useState, useCallback } from 'react';
import { saveTradeInfo, getTrades, updateTrade, deleteTrade } from '../firebase/firebaseService';

export const useTradeManager = (accessCode, showToast) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadTrades = useCallback(async () => {
    if (!accessCode) return;
    
    try {
      setLoading(true);
      const result = await getTrades(accessCode);
      
      if (result.success) {
        setTrades(result.trades);
      } else {
        console.error('Failed to load trades:', result.error);
        showToast?.(result.error || 'Failed to load trades', 'error');
        setTrades([]);
      }
    } catch (error) {
      console.error('Error loading trades:', error);
      showToast?.('Failed to load trades', 'error');
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [accessCode, showToast]);

  const saveTrade = useCallback(async (tradeData) => {
    if (!accessCode || !tradeData.tradeName?.trim()) {
      showToast?.('Trade name is required', 'error');
      return { success: false, error: 'Trade name is required' };
    }

    try {
      setSubmitting(true);
      const result = await saveTradeInfo(accessCode, tradeData);
      
      if (result.success) {
        showToast?.('Trade saved successfully', 'success');
        await loadTrades(); // Reload trades after save
        return result;
      } else {
        showToast?.(result.error || 'Failed to save trade', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error saving trade:', error);
      showToast?.('Failed to save trade', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [accessCode, showToast, loadTrades]);

  const updateTradeData = useCallback(async (tradeId, tradeData) => {
    if (!accessCode || !tradeId || !tradeData.tradeName?.trim()) {
      showToast?.('Trade ID and name are required', 'error');
      return { success: false, error: 'Trade ID and name are required' };
    }

    try {
      setSubmitting(true);
      const result = await updateTrade(accessCode, tradeId, tradeData);
      
      if (result.success) {
        showToast?.('Trade updated successfully', 'success');
        await loadTrades(); // Reload trades after update
        return result;
      } else {
        showToast?.(result.error || 'Failed to update trade', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error updating trade:', error);
      showToast?.('Failed to update trade', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [accessCode, showToast, loadTrades]);

  const removeTrade = useCallback(async (tradeId) => {
    if (!accessCode || !tradeId) {
      showToast?.('Trade ID is required', 'error');
      return { success: false, error: 'Trade ID is required' };
    }

    try {
      const result = await deleteTrade(accessCode, tradeId);
      
      if (result.success) {
        showToast?.('Trade deleted successfully', 'success');
        await loadTrades(); // Reload trades after delete
        return result;
      } else {
        showToast?.(result.error || 'Failed to delete trade', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error deleting trade:', error);
      showToast?.('Failed to delete trade', 'error');
      return { success: false, error: error.message };
    }
  }, [accessCode, showToast, loadTrades]);

  const searchTrades = useCallback((searchTerm) => {
    if (!searchTerm?.trim()) return trades;
    
    const term = searchTerm.toLowerCase();
    return trades.filter(trade =>
      trade.tradeName?.toLowerCase().includes(term) ||
      trade.tradeCategory?.toLowerCase().includes(term) ||
      trade.company?.toLowerCase().includes(term) ||
      trade.description?.toLowerCase().includes(term)
    );
  }, [trades]);

  return {
    trades,
    loading,
    submitting,
    loadTrades,
    saveTrade,
    updateTrade: updateTradeData,
    removeTrade,
    searchTrades
  };
};