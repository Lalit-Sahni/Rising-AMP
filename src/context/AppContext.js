import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  addExpenseToFirestore,
  fetchExpensesFromFirestore,
  updateExpenseInFirestore,
  deleteExpenseFromFirestore,
  restoreExpenseInFirestore,
  purgeExpenseFromFirestore,
  addProgressPayment,
  updateProgressPayment,
  deleteProgressPayment,
  fetchProgressPayments,
  addInvoiceToFirestore,
  fetchInvoicesFromFirestore,
  updateInvoiceInFirestore,
  voidInvoiceInFirestore,
  restoreInvoiceInFirestore,
  purgeInvoiceFromFirestore,
  saveHIAContractToFirestore,
  fetchHIAContractsFromFirestore,
  updateHIAContractInFirestore,
  deleteHIAContractFromFirestore,
  saveUserBankDetailsToFirestore,
  fetchUserBankDetailsFromFirestore,
  savePayerToFirestore,
  fetchPayersFromFirestore
} from '../data';
import { 
  getLabour, 
  getTrades, 
  getClients,
  getSuppliers,
  getServiceProviders,
  saveLabourInfo,
  saveTradeInfo,
  saveClientInfo,
  saveSupplierInfo,
  saveServiceProviderInfo,
  deleteClient
} from '../data';
import { upsertNamedRow } from '../firebase/partyName';
import logger from '../utils/logger';
import { isPermissionDenied } from '../firebase/tenancy';
import { AuthProvider, useAuth } from './AuthContext';
import { OrgProvider, useOrg } from './OrgContext';
import { UIProvider, useUI } from './UIContext';
import { queryClient } from '../query/client';

const AppDataContext = createContext();

export const useApp = () => {
  const auth = useAuth();
  const org = useOrg();
  const ui = useUI();
  const data = useContext(AppDataContext);
  if (!data) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return { ...auth, ...org, ...ui, ...data };
};

export const AppProvider = (props) => {
  const {
    children,
    projectId,
    storageKey,
    projectName,
    membership,
    onOpenJob,
    onJobAccessLost,
    jobStatus,
    authUser,
    profile,
    setProfile,
    jobInvitedEmails,
    jobKind,
    onJobKindChange,
  } = props;
  return (
    <AuthProvider authUser={authUser} profile={profile} setProfile={setProfile}>
      <OrgProvider
        membership={membership}
        jobId={projectId}
        storageKey={storageKey}
        projectName={projectName}
        jobStatus={jobStatus}
        jobInvitedEmails={jobInvitedEmails}
        jobKind={jobKind}
        onJobKindChange={onJobKindChange}
        onOpenJob={onOpenJob}
        onJobAccessLost={onJobAccessLost}
      >
        <UIProvider jobId={projectId}>
          <AppDataProvider
            projectId={projectId}
            storageKey={storageKey}
            projectName={projectName}
            membership={membership}
            onOpenJob={onOpenJob}
            onJobAccessLost={onJobAccessLost}
            jobStatus={jobStatus}
            jobInvitedEmails={jobInvitedEmails}
            jobKind={jobKind}
            onJobKindChange={onJobKindChange}
          >
            {children}
          </AppDataProvider>
        </UIProvider>
      </OrgProvider>
    </AuthProvider>
  );
};

const AppDataProvider = ({
  children,
  projectId: jobListId,
  storageKey,
  projectName = '',
  membership = null,
  onOpenJob = null,
  onJobAccessLost = null,
  jobStatus = 'active',
  jobInvitedEmails = [],
  jobKind = 'client',
  onJobKindChange = null,
}) => {
  const { showToast } = useUI();
  const [expenses, setExpenses] = useState([]);
  const [expensesCapped, setExpensesCapped] = useState(false);
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [budget, setBudget] = useState(0);
  const [savedLabour, setSavedLabour] = useState([]);
  const [savedTrades, setSavedTrades] = useState([]);
  const [clients, setClients] = useState([]);
  const [savedSuppliers, setSavedSuppliers] = useState([]);
  const [savedServiceProviders, setSavedServiceProviders] = useState([]);
  const [progressPayments, setProgressPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [hiaContracts, setHiaContracts] = useState([]);
  const [clientDetails, setClientDetails] = useState([]);
  const [userBankDetails, setUserBankDetails] = useState(null);
  const [savedPayers, setSavedPayers] = useState([]);

  // Load all data from Firestore when the selected job list changes
  useEffect(() => {
    if (jobListId) {
      logger.firebase('LOAD_DATA', 'Loading job data');
      setExpensesLoaded(false);
      setExpenses([]);
      setExpensesCapped(false);
      
      // Add a loading state to prevent multiple simultaneous loads
      let isMounted = true;
      
      // Load expenses and budget
      const loadExpensesAndBudget = async () => {
        try {
          const result = await fetchExpensesFromFirestore(jobListId);
          if (result.success && isMounted) {
            setExpenses(result.expenses);
            setExpensesCapped(Boolean(result.expensesCapped));
            setBudget(result.budget || 0);
          } else if (!isMounted) {
            logger.debug('Component unmounted, skipping expense load');
          } else if (isPermissionDenied({ code: result.code, message: result.error }) && onJobAccessLost) {
            onJobAccessLost();
          } else {
            logger.error('Failed to load expenses and budget:', result.error);
          }
        } catch (error) {
          if (isMounted && isPermissionDenied(error) && onJobAccessLost) {
            onJobAccessLost();
          } else if (isMounted) {
            logger.error('Error loading expenses and budget:', error);
          }
        } finally {
          if (isMounted) setExpensesLoaded(true);
        }
      };

      // Load saved labour
      const loadLabour = async () => {
        try {
          const result = await getLabour(jobListId);
          if (result.success) {
            const labourData = result.labour || [];
            setSavedLabour(Array.isArray(labourData) ? labourData : []);
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
          } else {
            console.error('Failed to load saved companies:', result.error);
            setClients([]);
          }
        } catch (error) {
          console.error('Error loading saved companies:', error);
          setClients([]);
        }
      };

      const loadSuppliers = async () => {
        try {
          const result = await getSuppliers(jobListId);
          if (result.success) {
            setSavedSuppliers(Array.isArray(result.suppliers) ? result.suppliers : []);
          } else {
            setSavedSuppliers([]);
          }
        } catch (error) {
          console.error('Error loading suppliers:', error);
          setSavedSuppliers([]);
        }
      };

      const loadServiceProviders = async () => {
        try {
          const result = await getServiceProviders(jobListId);
          if (result.success) {
            setSavedServiceProviders(Array.isArray(result.providers) ? result.providers : []);
          } else {
            setSavedServiceProviders([]);
          }
        } catch (error) {
          console.error('Error loading service providers:', error);
          setSavedServiceProviders([]);
        }
      };

      // Load progress payments
      const loadPayments = async () => {
        try {
          const result = await fetchProgressPayments(jobListId);
          if (result.success) {
            setProgressPayments(result.progressPayments);
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
        loadSuppliers(),
        loadServiceProviders(),
        loadPayments(),
        loadInvoices(),
        loadHIAContracts(),
        loadClientDetails(),
        loadUserBankDetails(),
        loadPayers()
      ]).catch((error) => {
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

  const invalidateJobQueries = () => {
    queryClient.invalidateQueries();
  };

  // Toast notifications live in UIContext.

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
        setExpenses(prev => prev.map(exp => (
          exp.id === expenseId ? { ...exp, ...result.expense } : exp
        )));
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

  const codeExpenseTrade = async (expenseId, tradeId) => {
    try {
      const { setExpenseTradeId } = await import('../firebase/expenseTrade');
      await setExpenseTradeId(jobListId, expenseId, tradeId);
      setExpenses((prev) => prev.map((exp) => (
        exp.id === expenseId ? { ...exp, tradeId } : exp
      )));
      return { success: true };
    } catch (error) {
      console.error('Error coding expense:', error);
      showToast(error.message || 'Could not code that expense', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteExpenseFromFirebase = async (expenseId) => {
    try {
      const result = await deleteExpenseFromFirestore(jobListId, expenseId);

      if (result.success) {
        setExpenses((prev) => prev.map((exp) => (
          exp.id === expenseId ? { ...exp, status: 'void', voidedAt: new Date() } : exp
        )));
        showToast('Moved to Recently deleted', 'success');
        return { success: true };
      } else {
        console.error('Firebase void failed:', result.error);
        showToast(`Could not void expense: ${result.error}`, 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Deletion error:', error);
      showToast(`Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  };

  const restoreExpenseFromFirebase = async (expenseId) => {
    try {
      const result = await restoreExpenseInFirestore(jobListId, expenseId);
      if (result.success) {
        setExpenses((prev) => prev.map((exp) => (
          exp.id === expenseId
            ? { ...exp, status: result.status || 'active', voidedAt: null }
            : exp
        )));
        showToast('Expense restored', 'success');
        return { success: true };
      }
      showToast(`Could not restore expense: ${result.error}`, 'error');
      return { success: false, error: result.error };
    } catch (error) {
      showToast(`Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  };

  const purgeExpenseFromFirebase = async (expenseId) => {
    try {
      const result = await purgeExpenseFromFirestore(jobListId, expenseId);
      if (result.success) {
        setExpenses((prev) => prev.filter((exp) => exp.id !== expenseId));
        showToast('Expense removed for good', 'success');
        return { success: true };
      }
      showToast(`Could not remove expense: ${result.error}`, 'error');
      return { success: false, error: result.error };
    } catch (error) {
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
  const saveLabourToFirebase = async (labourData, options = {}) => {
    try {
      const result = await saveLabourInfo(jobListId, labourData);
      if (result.success) {
        const labourItem = result.labour || result.savedLabour;
        setSavedLabour((prev) => upsertNamedRow(prev, labourItem, (row) => row.name));
        if (!options.quiet && result.created) {
          showToast('Labour saved successfully', 'success');
        }
        return { success: true, savedLabour: labourItem };
      } else {
        if (!options.quiet) showToast('Failed to save labour', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving labour:', error);
      if (!options.quiet) showToast('Error saving labour', 'error');
      return { success: false, error: error.message };
    }
  };

  const saveTradeToFirebase = async (tradeData, options = {}) => {
    try {
      const result = await saveTradeInfo(jobListId, tradeData);
      if (result.success) {
        const tradeItem = result.trade || result.savedTrade;
        setSavedTrades((prev) => upsertNamedRow(prev, tradeItem, (row) => row.tradeName));
        if (!options.quiet && result.created) {
          showToast('Trade saved successfully', 'success');
        }
        return { success: true, savedTrade: tradeItem };
      } else {
        if (!options.quiet) showToast('Failed to save trade', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving trade:', error);
      if (!options.quiet) showToast('Error saving trade', 'error');
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
        setProgressPayments((prev) => prev.map((payment) => (
          payment.id === paymentId ? { ...payment, status: 'void' } : payment
        )));
        showToast('Progress payment voided', 'success');
        return { success: true };
      } else {
        showToast('Failed to void progress payment', 'error');
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
      const result = await voidInvoiceInFirestore(jobListId, invoiceId);
      if (result.success) {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'void', voidedAt: new Date() } : inv));
        showToast('Moved to Recently deleted. The number is kept until you remove it for good.', 'success');
        invalidateJobQueries();
        return { success: true };
      } else {
        showToast('Failed to void invoice', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error voiding invoice:', error);
      showToast('Error voiding invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  const restoreInvoiceFromFirebase = async (invoiceId) => {
    try {
      const result = await restoreInvoiceInFirestore(jobListId, invoiceId);
      if (result.success) {
        setInvoices((prev) => prev.map((inv) => (
          inv.id === invoiceId
            ? { ...inv, status: result.status || 'draft', voidedAt: null }
            : inv
        )));
        showToast('Invoice restored', 'success');
        invalidateJobQueries();
        return { success: true };
      }
      showToast('Failed to restore invoice', 'error');
      return { success: false, error: result.error };
    } catch (error) {
      showToast('Error restoring invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  const purgeInvoiceFromFirebase = async (invoiceId) => {
    try {
      const result = await purgeInvoiceFromFirestore(jobListId, invoiceId);
      if (result.success) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
        showToast('Invoice removed for good', 'success');
        invalidateJobQueries();
        return { success: true };
      }
      showToast('Failed to remove invoice', 'error');
      return { success: false, error: result.error };
    } catch (error) {
      showToast('Error removing invoice', 'error');
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
  const saveCompanyToFirebase = async (companyData, options = {}) => {
    try {
      const result = await saveSupplierInfo(jobListId, companyData);
      if (result.success) {
        setSavedSuppliers((prev) => upsertNamedRow(prev, result.supplier, (row) => row.name));
        if (!options.quiet && result.created) {
          showToast('Supplier saved', 'success');
        }
        return { success: true, supplier: result.supplier };
      } else {
        if (!options.quiet) showToast('Failed to save supplier', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      if (!options.quiet) showToast('Error saving supplier', 'error');
      return { success: false, error: error.message };
    }
  };

  const saveServiceProviderToFirebase = async (providerData, options = {}) => {
    try {
      const result = await saveServiceProviderInfo(jobListId, providerData);
      if (result.success) {
        setSavedServiceProviders((prev) => upsertNamedRow(prev, result.provider, (row) => row.name));
        if (!options.quiet && result.created) {
          showToast('Service provider saved', 'success');
        }
        return { success: true, provider: result.provider };
      } else {
        if (!options.quiet) showToast('Failed to save service provider', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving service provider:', error);
      if (!options.quiet) showToast('Error saving service provider', 'error');
      return { success: false, error: error.message };
    }
  };

  const saveClientToFirebase = async (clientData, options = {}) => {
    try {
      const result = await saveClientInfo(jobListId, clientData);
      if (result.success) {
        setClients((prev) => upsertNamedRow(prev, result.client, (row) => row.name));
        if (!options.quiet && result.created) {
          showToast('Client saved', 'success');
        }
        return { success: true, client: result.client };
      }
      if (!options.quiet) showToast('Failed to save client', 'error');
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Error saving client:', error);
      if (!options.quiet) showToast('Error saving client', 'error');
      return { success: false, error: error.message };
    }
  };

  // Delete functions
  const deleteClientFromFirebase = async (clientId) => {
    try {
      const result = await deleteClient(jobListId, clientId);
      if (result.success) {
        setClients(prev => prev.filter(client => client.id !== clientId));
        showToast('Client removed from this job', 'success');
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
        setHiaContracts((prev) => prev.map((contract) => (
          contract.id === contractId ? { ...contract, status: 'void' } : contract
        )));
        showToast('HIA contract voided', 'success');
        return { success: true };
      } else {
        showToast('Failed to void HIA contract', 'error');
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
        setClientDetails((prev) => upsertNamedRow(prev, result.client, (row) => row.name));
        setClients((prev) => upsertNamedRow(prev, result.client, (row) => row.name));
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
    jobId: jobListId,
    storageKey,
    projectName,
    jobStatus,
    membership,
    onOpenJob,
    jobInvitedEmails,
    jobKind,
    onJobKindChange,
    expenses,
    expensesCapped,
    expensesLoaded,
    budget,
    savedLabour,
    savedTrades,
    clients,
    savedCompanies: savedSuppliers,
    savedSuppliers,
    savedServiceProviders,
    progressPayments,
    invoices,
    hiaContracts,
    clientDetails,
    userBankDetails,
    addExpenseToFirebase,
    updateExpenseInFirebase,
    codeExpenseTrade,
    deleteExpenseFromFirebase,
    restoreExpenseFromFirebase,
    purgeExpenseFromFirebase,
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
    restoreInvoiceFromFirebase,
    purgeInvoiceFromFirebase,
    loadInvoices,
    updateInvoiceStatus,
    saveCompanyToFirebase,
    saveServiceProviderToFirebase,
    saveClientToFirebase,
    deleteClientFromFirebase,
    loadCompanies,
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
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}; 