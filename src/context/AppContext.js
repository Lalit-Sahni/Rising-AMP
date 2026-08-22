import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  addExpenseToFirestore,
  fetchExpensesFromFirestore,
  updateExpenseInFirestore,
  deleteExpenseFromFirestore,
  addProgressPayment,
  updateProgressPayment,
  deleteProgressPayment,
  fetchProgressPayments,
  addInvoiceToFirestore,
  fetchInvoicesFromFirestore,
  updateInvoiceInFirestore,
  deleteInvoiceFromFirestore,
  saveHIAContractToFirestore,
  fetchHIAContractsFromFirestore,
  updateHIAContractInFirestore,
  deleteHIAContractFromFirestore,
  saveUserBankDetailsToFirestore,
  fetchUserBankDetailsFromFirestore,
  savePayerToFirestore,
  fetchPayersFromFirestore
} from '../firebase/data';
import { 
  getLabour, 
  getTrades, 
  getClients, 
  getProjects,
  saveLabourInfo,
  saveTradeInfo,
  saveClientInfo,
  saveProjectInfo,
  deleteLabour,
  deleteTrade,
  deleteProject,
  deleteClient
} from '../firebase/firebaseService';
import logger from '../utils/logger';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children, projectId: jobListId, storageKey }) => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(0);
  const [savedLabour, setSavedLabour] = useState([]);
  const [savedTrades, setSavedTrades] = useState([]);
  const [clients, setClients] = useState([]);
  const [savedProjects, setSavedProjects] = useState([]);
  const [progressPayments, setProgressPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [hiaContracts, setHiaContracts] = useState([]);
  const [clientDetails, setClientDetails] = useState([]);
  const [userBankDetails, setUserBankDetails] = useState(null);
  const [savedPayers, setSavedPayers] = useState([]);

  // Load all data from Firestore when the selected job list changes
  useEffect(() => {
    if (jobListId) {
      logger.firebase('LOAD_DATA', 'Loading data for project:', jobListId);
      
      // Add a loading state to prevent multiple simultaneous loads
      let isMounted = true;
      
      // Load expenses and budget
      const loadExpensesAndBudget = async () => {
        try {
          const result = await fetchExpensesFromFirestore(jobListId);
          if (result.success && isMounted) {
            setExpenses(result.expenses);
            setBudget(result.budget || 0);
            logger.firebase('LOAD_EXPENSES', 'Loaded expenses:', result.expenses.length);
            logger.firebase('LOAD_BUDGET', 'Loaded budget:', result.budget);
          } else if (!isMounted) {
            logger.debug('Component unmounted, skipping expense load');
          } else {
            logger.error('Failed to load expenses and budget:', result.error);
          }
        } catch (error) {
          if (isMounted) {
            logger.error('Error loading expenses and budget:', error);
          }
        }
      };

      // Load saved labour
      const loadLabour = async () => {
        try {
          const result = await getLabour(jobListId);
          if (result.success) {
            const labourData = result.labour || [];
            setSavedLabour(Array.isArray(labourData) ? labourData : []);
            console.log('Loaded saved labour:', labourData.length);
          } else {
            console.error('Failed to load saved labour:', result.error);
            setSavedLabour([]);
          }
        } catch (error) {
          console.error('Error loading saved labour:', error);
          setSavedLabour([]);
        }
      };

      // Load saved trades
      const loadTrades = async () => {
        try {
          const result = await getTrades(jobListId);
          if (result.success) {
            const tradesData = result.trades || [];
            setSavedTrades(Array.isArray(tradesData) ? tradesData : []);
            console.log('Loaded saved trades:', tradesData.length);
          } else {
            console.error('Failed to load saved trades:', result.error);
            setSavedTrades([]);
          }
        } catch (error) {
          console.error('Error loading saved trades:', error);
          setSavedTrades([]);
        }
      };

      // Load saved companies
      const loadCompanies = async () => {
        try {
          const result = await getClients(jobListId);
          if (result.success) {
            const clientsData = result.clients || [];
            setClients(Array.isArray(clientsData) ? clientsData : []);
            console.log('Loaded clients:', clientsData.length);
          } else {
            console.error('Failed to load saved companies:', result.error);
            setClients([]);
          }
        } catch (error) {
          console.error('Error loading saved companies:', error);
          setClients([]);
        }
      };

      // Load saved projects
      const loadProjects = async () => {
        try {
          const result = await getProjects(jobListId);
          if (result.success) {
            const projectsData = result.projects || [];
            setSavedProjects(Array.isArray(projectsData) ? projectsData : []);
            console.log('Loaded saved projects:', projectsData.length);
          } else {
            console.error('Failed to load saved projects:', result.error);
            setSavedProjects([]);
          }
        } catch (error) {
          console.error('Error loading saved projects:', error);
          setSavedProjects([]);
        }
      };

      // Load progress payments
      const loadPayments = async () => {
        try {
          const result = await fetchProgressPayments(jobListId);
          if (result.success) {
            setProgressPayments(result.progressPayments);
            console.log('Loaded progress payments:', result.progressPayments.length);
          } else {
            console.error('Failed to load progress payments:', result.error);
          }
        } catch (error) {
          console.error('Error loading progress payments:', error);
        }
      };

      // Load invoices
      const loadInvoices = async () => {
        try {
          const result = await fetchInvoicesFromFirestore(jobListId);
          if (result.success) {
            setInvoices(result.invoices);
            console.log('Loaded invoices:', result.invoices.length);
          } else {
            console.error('Failed to load invoices:', result.error);
          }
        } catch (error) {
          console.error('Error loading invoices:', error);
        }
      };

      // Load HIA contracts
      const loadHIAContracts = async () => {
        try {
          const result = await fetchHIAContractsFromFirestore(jobListId);
          if (result.success) {
            setHiaContracts(result.hiaContracts);
            console.log('Loaded HIA contracts:', result.hiaContracts.length);
          } else {
            console.error('Failed to load HIA contracts:', result.error);
          }
        } catch (error) {
          console.error('Error loading HIA contracts:', error);
        }
      };

      // Load client details - using clients collection now
      const loadClientDetails = async () => {
        try {
          const result = await getClients(jobListId);
          if (result.success) {
            setClientDetails(result.clients);
            console.log('Loaded client details:', result.clients.length);
          } else {
            console.error('Failed to load client details:', result.error);
          }
        } catch (error) {
          console.error('Error loading client details:', error);
        }
      };

      // Load user bank details
      const loadUserBankDetails = async () => {
        try {
          const result = await fetchUserBankDetailsFromFirestore(jobListId);
          if (result.success) {
            setUserBankDetails(result.userBankDetails);
            console.log('Loaded user bank details:', result.userBankDetails);
          } else {
            console.error('Failed to load user bank details:', result.error);
          }
        } catch (error) {
          console.error('Error loading user bank details:', error);
        }
      };

      // Load payers
      const loadPayers = async () => {
        try {
          const result = await fetchPayersFromFirestore(jobListId);
          if (result.success) {
            setSavedPayers(result.payers || []);
          } else {
            setSavedPayers([]);
          }
        } catch (error) {
          console.error('Error loading payers:', error);
          setSavedPayers([]);
        }
      };

      // Load all data in parallel
      Promise.all([
        loadExpensesAndBudget(),
        loadLabour(),
        loadTrades(),
        loadCompanies(),
        loadProjects(),
        loadPayments(),
        loadInvoices(),
        loadHIAContracts(),
        loadClientDetails(),
        loadUserBankDetails(),
        loadPayers()
      ]).then(() => {
        if (isMounted) {
          console.log('All data loaded successfully');
        }
      }).catch((error) => {
        if (isMounted) {
          console.error('Error loading data:', error);
        }
      });

      // Cleanup function to prevent state updates on unmounted component
      return () => {
        isMounted = false;
      };
    }
  }, [jobListId]);

  // Toast notification function
  const showToast = (message, type = 'info') => {
    // For now, just log to console. We'll implement a proper toast system later
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Expense functions
  const addExpenseToFirebase = async (expenseData) => {
    try {
      const result = await addExpenseToFirestore(jobListId, expenseData);
      if (result.success) {
        setExpenses(prev => [...prev, result.expense]);
        showToast('Expense added successfully', 'success');
        return { success: true, expense: result.expense };
      } else {
        showToast('Failed to add expense', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      showToast('Error adding expense', 'error');
      return { success: false, error: error.message };
    }
  };

  const updateExpenseInFirebase = async (expenseId, expenseData) => {
    try {
      const result = await updateExpenseInFirestore(jobListId, expenseId, expenseData);
      if (result.success) {
        setExpenses(prev => prev.map(exp => exp.id === expenseId ? result.expense : exp));
        showToast('Expense updated successfully', 'success');
        return { success: true, expense: result.expense };
      } else {
        showToast('Failed to update expense', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      showToast('Error updating expense', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteExpenseFromFirebase = async (expenseId) => {
    try {
      console.log('🗑️ [DELETION v2.1] Starting deletion for expense:', expenseId);
      
      // Simple approach: Delete from Firebase first, then update UI
      const result = await deleteExpenseFromFirestore(jobListId, expenseId);
      
      if (result.success) {
        console.log('✅ [DELETION v2.1] Firebase deletion successful:', expenseId);
        
        // Update UI immediately after successful Firebase deletion
        setExpenses(prev => {
          const newExpenses = prev.filter(exp => exp.id !== expenseId);
          console.log('🔄 [DELETION v2.1] Updated UI, remaining expenses:', newExpenses.length);
          return newExpenses;
        });
        
        showToast('Expense permanently deleted!', 'success');
        return { success: true };
      } else {
        console.error('❌ [DELETION v2.1] Firebase deletion failed:', result.error);
        showToast(`Deletion failed: ${result.error}`, 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('💥 [DELETION v2.1] Deletion error:', error);
      showToast(`Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  };

  const updateBudgetInFirebase = async (newBudget) => {
    try {
      setBudget(newBudget);
      showToast('Budget updated successfully', 'success');
      return { success: true };
    } catch (error) {
      console.error('Error updating budget:', error);
      showToast('Error updating budget', 'error');
      return { success: false, error: error.message };
    }
  };

  // Saved data functions
  const saveLabourToFirebase = async (labourData) => {
    try {
      const result = await saveLabourInfo(jobListId, labourData);
      if (result.success) {
        const labourItem = result.labour || result.savedLabour;
        setSavedLabour(prev => [...prev, labourItem]);
        showToast('Labour saved successfully', 'success');
        return { success: true, savedLabour: labourItem };
      } else {
        showToast('Failed to save labour', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving labour:', error);
      showToast('Error saving labour', 'error');
      return { success: false, error: error.message };
    }
  };

  const saveTradeToFirebase = async (tradeData) => {
    try {
      const result = await saveTradeInfo(jobListId, tradeData);
      if (result.success) {
        const tradeItem = result.trade || result.savedTrade;
        setSavedTrades(prev => [...prev, tradeItem]);
        showToast('Trade saved successfully', 'success');
        return { success: true, savedTrade: tradeItem };
      } else {
        showToast('Failed to save trade', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving trade:', error);
      showToast('Error saving trade', 'error');
      return { success: false, error: error.message };
    }
  };

  const loadSavedLabour = async () => {
    try {
      const result = await getLabour(jobListId);
      if (result.success) {
        const labourData = result.labour || [];
        setSavedLabour(labourData);
        return { success: true, savedLabour: labourData };
      } else {
        setSavedLabour([]);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading saved labour:', error);
      setSavedLabour([]);
      return { success: false, error: error.message };
    }
  };

  const loadSavedTrades = async () => {
    try {
      const result = await getTrades(jobListId);
      if (result.success) {
        const tradesData = result.trades || [];
        setSavedTrades(tradesData);
        return { success: true, savedTrades: tradesData };
      } else {
        setSavedTrades([]);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading saved trades:', error);
      setSavedTrades([]);
      return { success: false, error: error.message };
    }
  };

  // Progress payment functions
  const addProgressPaymentToFirebase = async (paymentData) => {
    try {
      const result = await addProgressPayment(jobListId, paymentData);
      if (result.success) {
        setProgressPayments(prev => [...prev, result.progressPayment]);
        showToast('Progress payment added successfully', 'success');
        return { success: true, progressPayment: result.progressPayment };
      } else {
        showToast('Failed to add progress payment', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error adding progress payment:', error);
      showToast('Error adding progress payment', 'error');
      return { success: false, error: error.message };
    }
  };

  const updateProgressPaymentInFirebase = async (paymentId, paymentData) => {
    try {
      const result = await updateProgressPayment(jobListId, paymentId, paymentData);
      if (result.success) {
        setProgressPayments(prev => prev.map(payment => payment.id === paymentId ? result.progressPayment : payment));
        showToast('Progress payment updated successfully', 'success');
        return { success: true, progressPayment: result.progressPayment };
      } else {
        showToast('Failed to update progress payment', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating progress payment:', error);
      showToast('Error updating progress payment', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteProgressPaymentFromFirebase = async (paymentId) => {
    try {
      const result = await deleteProgressPayment(jobListId, paymentId);
      if (result.success) {
        setProgressPayments(prev => prev.filter(payment => payment.id !== paymentId));
        showToast('Progress payment deleted successfully', 'success');
        return { success: true };
      } else {
        showToast('Failed to delete progress payment', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting progress payment:', error);
      showToast('Error deleting progress payment', 'error');
      return { success: false, error: error.message };
    }
  };

  const loadProgressPayments = async () => {
    try {
      const result = await fetchProgressPayments(jobListId);
      if (result.success) {
        setProgressPayments(result.progressPayments);
        return { success: true, progressPayments: result.progressPayments };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading progress payments:', error);
      return { success: false, error: error.message };
    }
  };

  // Invoice functions
  const addInvoiceToFirebase = async (invoiceData) => {
    try {
      const result = await addInvoiceToFirestore(jobListId, invoiceData);
      if (result.success) {
        setInvoices(prev => [...prev, result.invoice]);
        showToast('Invoice added successfully', 'success');
        return { success: true, invoice: result.invoice };
      } else {
        showToast('Failed to add invoice', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error adding invoice:', error);
      showToast('Error adding invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  const updateInvoiceInFirebase = async (invoiceId, invoiceData) => {
    try {
      const result = await updateInvoiceInFirestore(jobListId, invoiceId, invoiceData);
      if (result.success) {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? result.invoice : inv));
        showToast('Invoice updated successfully', 'success');
        return { success: true, invoice: result.invoice };
      } else {
        showToast('Failed to update invoice', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      showToast('Error updating invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  const updateInvoiceStatus = async (invoiceId, status) => {
    try {
      const result = await updateInvoiceInFirestore(jobListId, invoiceId, { status });
      if (result.success) {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status } : inv));
        showToast('Invoice status updated successfully', 'success');
        return { success: true, invoice: result.invoice };
      } else {
        showToast('Failed to update invoice status', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating invoice status:', error);
      showToast('Error updating invoice status', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteInvoiceFromFirebase = async (invoiceId) => {
    try {
      const result = await deleteInvoiceFromFirestore(jobListId, invoiceId);
      if (result.success) {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
        showToast('Invoice deleted successfully', 'success');
        return { success: true };
      } else {
        showToast('Failed to delete invoice', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showToast('Error deleting invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  const loadInvoices = async () => {
    try {
      const result = await fetchInvoicesFromFirestore(jobListId);
      if (result.success) {
        setInvoices(result.invoices);
        return { success: true, invoices: result.invoices };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      return { success: false, error: error.message };
    }
  };

  // Company and Project functions
  const saveCompanyToFirebase = async (companyData) => {
    try {
      const result = await saveClientInfo(jobListId, companyData);
      if (result.success) {
        setClients(prev => [...prev, result.client]);
        showToast('Client saved successfully', 'success');
        return { success: true, client: result.client };
      } else {
        showToast('Failed to save company', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving company:', error);
      showToast('Error saving company', 'error');
      return { success: false, error: error.message };
    }
  };

  const saveProjectToFirebase = async (projectData) => {
    try {
      const result = await saveProjectInfo(jobListId, projectData);
      if (result.success) {
        setSavedProjects(prev => [...prev, result.project]);
        showToast('Project saved successfully', 'success');
        return { success: true, savedProject: result.project };
      } else {
        showToast('Failed to save project', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving project:', error);
      showToast('Error saving project', 'error');
      return { success: false, error: error.message };
    }
  };

  // Delete functions
  const deleteLabourFromFirebase = async (labourId) => {
    try {
      const result = await deleteLabour(jobListId, labourId);
      if (result.success) {
        setSavedLabour(prev => prev.filter(labour => labour.id !== labourId));
        showToast('Labour deleted successfully', 'success');
        return { success: true };
      } else {
        showToast('Failed to delete labour', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting labour:', error);
      showToast('Error deleting labour', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteTradeFromFirebase = async (tradeId) => {
    try {
      const result = await deleteTrade(jobListId, tradeId);
      if (result.success) {
        setSavedTrades(prev => prev.filter(trade => trade.id !== tradeId));
        showToast('Trade deleted successfully', 'success');
        return { success: true };
      } else {
        showToast('Failed to delete trade', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting trade:', error);
      showToast('Error deleting trade', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteProjectFromFirebase = async (projectId) => {
    try {
      const result = await deleteProject(jobListId, projectId);
      if (result.success) {
        setSavedProjects(prev => prev.filter(project => project.id !== projectId));
        showToast('Project deleted successfully', 'success');
        return { success: true };
      } else {
        showToast('Failed to delete project', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      showToast('Error deleting project', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteClientFromFirebase = async (clientId) => {
    try {
      const result = await deleteClient(jobListId, clientId);
      if (result.success) {
        setClients(prev => prev.filter(client => client.id !== clientId));
        showToast('Client deleted successfully', 'success');
        return { success: true };
      } else {
        showToast('Failed to delete client', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      showToast('Error deleting client', 'error');
      return { success: false, error: error.message };
    }
  };

  const loadCompanies = async () => {
    try {
      const result = await getClients(jobListId);
      if (result.success) {
        setClients(result.clients);
        return { success: true, clients: result.clients };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      return { success: false, error: error.message };
    }
  };

  const loadProjects = async () => {
    try {
      const result = await getProjects(jobListId);
      if (result.success) {
        setSavedProjects(result.projects);
        return { success: true, savedProjects: result.projects };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      return { success: false, error: error.message };
    }
  };

  // HIA Contract functions
  const addHIAContractToFirebase = async (contractData) => {
    try {
      const result = await saveHIAContractToFirestore(jobListId, contractData);
      if (result.success) {
        setHiaContracts(prev => [...prev, result.hiaContract]);
        showToast('HIA Contract saved successfully', 'success');
        return { success: true, hiaContract: result.hiaContract };
      } else {
        showToast('Failed to save HIA Contract', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving HIA Contract:', error);
      showToast('Error saving HIA Contract', 'error');
      return { success: false, error: error.message };
    }
  };

  const updateHIAContractInFirebase = async (contractId, updates) => {
    try {
      const result = await updateHIAContractInFirestore(jobListId, contractId, updates);
      if (result.success) {
        setHiaContracts(prev => prev.map(contract => contract.id === contractId ? result.hiaContract : contract));
        showToast('HIA Contract updated successfully', 'success');
        return { success: true, hiaContract: result.hiaContract };
      } else {
        showToast('Failed to update HIA Contract', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating HIA Contract:', error);
      showToast('Error updating HIA Contract', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteHIAContractFromFirebase = async (contractId) => {
    try {
      const result = await deleteHIAContractFromFirestore(jobListId, contractId);
      if (result.success) {
        setHiaContracts(prev => prev.filter(contract => contract.id !== contractId));
        showToast('HIA Contract deleted successfully', 'success');
        return { success: true };
      } else {
        showToast('Failed to delete HIA Contract', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting HIA Contract:', error);
      showToast('Error deleting HIA Contract', 'error');
      return { success: false, error: error.message };
    }
  };

  const loadHIAContracts = async () => {
    try {
      const result = await fetchHIAContractsFromFirestore(jobListId);
      if (result.success) {
        setHiaContracts(result.hiaContracts);
        return { success: true, hiaContracts: result.hiaContracts };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading HIA Contracts:', error);
      return { success: false, error: error.message };
    }
  };

  // Client Details functions - now using unified clients collection
  const saveClientDetailsToFirebase = async (projectId, clientData) => {
    try {
      // Add projectId to client data for backward compatibility
      const clientWithProject = { ...clientData, projectId };
      const result = await saveClientInfo(jobListId, clientWithProject);
      if (result.success) {
        setClientDetails(prev => [...prev, result.client]);
        showToast('Client details saved successfully', 'success');
        return { success: true, clientDetails: result.client };
      } else {
        showToast('Failed to save client details', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving client details:', error);
      showToast('Error saving client details', 'error');
      return { success: false, error: error.message };
    }
  };

  const loadClientDetails = async (projectId = null) => {
    try {
      const result = await getClients(jobListId);
      if (result.success) {
        // Filter by projectId if provided for backward compatibility
        const filteredClients = projectId 
          ? result.clients.filter(client => client.projectId === projectId)
          : result.clients;
        setClientDetails(filteredClients);
        return { success: true, clientDetails: filteredClients };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading client details:', error);
      return { success: false, error: error.message };
    }
  };

  // User Bank Details functions
  const saveUserBankDetailsToFirebase = async (bankData) => {
    try {
      const result = await saveUserBankDetailsToFirestore(jobListId, bankData);
      if (result.success) {
        setUserBankDetails(result.userBankDetails);
        showToast('Bank details saved successfully', 'success');
        return { success: true, userBankDetails: result.userBankDetails };
      } else {
        showToast('Failed to save bank details', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving bank details:', error);
      showToast('Error saving bank details', 'error');
      return { success: false, error: error.message };
    }
  };

  const loadUserBankDetails = async () => {
    try {
      const result = await fetchUserBankDetailsFromFirestore(jobListId);
      if (result.success) {
        setUserBankDetails(result.userBankDetails);
        return { success: true, userBankDetails: result.userBankDetails };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading user bank details:', error);
      return { success: false, error: error.message };
    }
  };

  // Payer functions
  const savePayerToFirebase = async (payerName) => {
    if (!payerName || !payerName.trim()) return;
    try {
      const result = await savePayerToFirestore(jobListId, payerName.trim());
      if (result.success) {
        setSavedPayers(prev => {
          const exists = prev.some(p => p.name === payerName.trim());
          return exists ? prev : [...prev, result.payer];
        });
      }
    } catch (error) {
      console.error('Error saving payer:', error);
    }
  };

  const value = {
    accessCode: jobListId,
    storageKey,
    currentPage,
    setCurrentPage,
    expenses,
    budget,
    savedLabour,
    savedTrades,
    clients,
    savedCompanies: clients, // Alias for compatibility
    savedProjects,
    progressPayments,
    invoices,
    hiaContracts,
    clientDetails,
    userBankDetails,
    showToast,
    addExpenseToFirebase,
    updateExpenseInFirebase,
    deleteExpenseFromFirebase,
    updateBudgetInFirebase,
    saveLabourToFirebase,
    saveTradeToFirebase,
    loadSavedLabour,
    loadSavedTrades,
    addProgressPaymentToFirebase,
    updateProgressPaymentInFirebase,
    deleteProgressPaymentFromFirebase,
    loadProgressPayments,
    addInvoiceToFirebase,
    updateInvoiceInFirebase,
    deleteInvoiceFromFirebase,
    loadInvoices,
    updateInvoiceStatus,
    saveCompanyToFirebase,
    saveProjectToFirebase,
    deleteLabourFromFirebase,
    deleteTradeFromFirebase,
    deleteProjectFromFirebase,
    deleteClientFromFirebase,
    loadCompanies,
    loadProjects,
    addHIAContractToFirebase,
    updateHIAContractInFirebase,
    deleteHIAContractFromFirebase,
    loadHIAContracts,
    saveClientDetailsToFirebase,
    loadClientDetails,
    saveUserBankDetailsToFirebase,
    loadUserBankDetails,
    savedPayers,
    savePayerToFirebase
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}; 