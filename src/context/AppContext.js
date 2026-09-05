import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  addExpenseToFirestore,
  updateExpenseInFirestore,
  voidExpenseInFirestore,
  restoreExpenseInFirestore,
  purgeExpenseFromFirestore,
  addProgressPayment,
  addInvoiceToFirestore,
  updateInvoiceInFirestore,
  voidInvoiceInFirestore,
  restoreInvoiceInFirestore,
  purgeInvoiceFromFirestore,
  saveHIAContractToFirestore,
  saveUserBankDetailsToFirestore,
  savePayerToFirestore
} from '../data';
import { listenJobExpenses, listenJobInvoices } from '../firebase/ledgerListen';
import {
  saveLabourInfo,
  saveTradeInfo,
  saveClientInfo,
  saveSupplierInfo,
  saveServiceProviderInfo,
} from '../data';
import logger from '../utils/logger';
import { isPermissionDenied } from '../firebase/tenancy';
import { AuthProvider, useAuth } from './AuthContext';
import { OrgProvider, useOrg } from './OrgContext';
import { UIProvider, useUI } from './UIContext';
import { invalidateKeys, queryClient, queryKeys } from '../query/client';
import { patchNamedList, setBankDetails } from '../hooks/useJobDirectories';

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
    allowedJobs,
    onOpenJob,
    onJobAccessLost,
    jobStatus,
    authUser,
    profile,
    setProfile,
    onSignOut,
    jobInvitedEmails,
    jobKind,
    onJobKindChange,
  } = props;
  return (
    <AuthProvider authUser={authUser} profile={profile} setProfile={setProfile} onSignOut={onSignOut}>
      <OrgProvider
        membership={membership}
        allowedJobs={allowedJobs}
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
  const orgId = (membership && membership.orgId) || '';
  const [expenses, setExpenses] = useState([]);
  const [expensesCapped, setExpensesCapped] = useState(false);
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [invoices, setInvoices] = useState([]);

  const labourKey = queryKeys.labour(orgId, jobListId || '');
  const tradesKey = queryKeys.trades(orgId, jobListId || '');
  const clientsKey = queryKeys.clients(orgId, jobListId || '');
  const suppliersKey = queryKeys.suppliers(orgId, jobListId || '');
  const serviceProvidersKey = queryKeys.serviceProviders(orgId, jobListId || '');
  const payersKey = queryKeys.payers(orgId, jobListId || '');
  const progressPaymentsKey = queryKeys.progressPayments(orgId, jobListId || '');
  const hiaContractsKey = queryKeys.hiaContracts(orgId, jobListId || '');
  const bankDetailsKey = queryKeys.bankDetails(orgId, jobListId || '');

  // Listen to expenses and invoices when the selected job changes.
  // Directories and invoice/contract extras load on the screen that uses them.
  useEffect(() => {
    if (!jobListId) return undefined;
    logger.firebase('LOAD_DATA', 'Loading job data');
    setExpensesLoaded(false);
    setExpenses([]);
    setExpensesCapped(false);
    setInvoices([]);

    let isMounted = true;

    const unsubExpenses = listenJobExpenses(
      jobListId,
      (result) => {
        if (!isMounted) return;
        setExpenses(result.expenses);
        setExpensesCapped(Boolean(result.expensesCapped));
        setExpensesLoaded(true);
      },
      (error) => {
        if (!isMounted) return;
        if (isPermissionDenied(error) && onJobAccessLost) {
          onJobAccessLost();
        } else {
          logger.error('Error loading expenses:', error);
        }
        setExpensesLoaded(true);
      },
    );

    const unsubInvoices = listenJobInvoices(
      jobListId,
      (result) => {
        if (!isMounted) return;
        setInvoices(result.invoices);
      },
      (error) => {
        if (!isMounted) return;
        if (isPermissionDenied(error) && onJobAccessLost) {
          onJobAccessLost();
        } else {
          logger.error('Error loading invoices:', error);
        }
      },
    );

    return () => {
      isMounted = false;
      unsubExpenses();
      unsubInvoices();
    };
  }, [jobListId]);

  const invalidateExpenseQueries = () => {
    invalidateKeys(queryKeys.expenses(orgId, jobListId || ''));
  };

  const invalidateInvoiceQueries = () => {
    invalidateKeys(queryKeys.invoices(orgId, jobListId || ''));
  };

  // Expense functions
  const addExpenseToFirebase = async (expenseData) => {
    try {
      const result = await addExpenseToFirestore(jobListId, expenseData);
      if (result.success) {
        setExpenses(prev => [...prev, result.expense]);
        invalidateExpenseQueries();
        showToast('Expense added', 'success');
        return { success: true, expense: result.expense };
      } else {
        showToast('Could not add that expense', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      showToast('Could not add that expense', 'error');
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
        invalidateExpenseQueries();
        showToast('Expense saved', 'success');
        return { success: true, expense: result.expense };
      } else {
        showToast('Could not save that expense', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      showToast('Could not save that expense', 'error');
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
      invalidateExpenseQueries();
      return { success: true };
    } catch (error) {
      console.error('Error coding expense:', error);
      showToast(error.message || 'Could not code that expense', 'error');
      return { success: false, error: error.message };
    }
  };

  const codeExpenseCategory = async (expenseId, category) => {
    try {
      const { setExpenseCategory } = await import('../firebase/expenseTrade');
      const { tradeIdAfterCategoryChange, normalizeExpenseCategory } = await import('../domain/expenseCategory');
      const nextCategory = normalizeExpenseCategory(category);
      if (!nextCategory) throw new Error('Choose a category.');
      const current = (expenses || []).find((exp) => exp.id === expenseId);
      const tradeId = tradeIdAfterCategoryChange(nextCategory, current?.tradeId);
      await setExpenseCategory(jobListId, expenseId, nextCategory, tradeId);
      setExpenses((prev) => prev.map((exp) => (
        exp.id === expenseId ? { ...exp, category: nextCategory, tradeId } : exp
      )));
      invalidateExpenseQueries();
      return { success: true };
    } catch (error) {
      console.error('Error changing expense category:', error);
      showToast(error.message || 'Could not change that category', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteExpenseFromFirebase = async (expenseId) => {
    try {
      const result = await voidExpenseInFirestore(jobListId, expenseId);

      if (result.success) {
        setExpenses((prev) => prev.map((exp) => (
          exp.id === expenseId ? { ...exp, status: 'void', voidedAt: new Date() } : exp
        )));
        invalidateExpenseQueries();
        showToast('Moved to Recently deleted', 'success');
        return { success: true };
      } else {
        console.error('Firebase void failed:', result.error);
        showToast(`Could not move that expense: ${result.error}`, 'error');
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
        invalidateExpenseQueries();
        showToast('Expense restored', 'success');
        return { success: true };
      }
      showToast(`Could not restore that expense: ${result.error}`, 'error');
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
        invalidateExpenseQueries();
        showToast('Expense removed for good', 'success');
        return { success: true };
      }
      showToast(`Could not remove that expense: ${result.error}`, 'error');
      return { success: false, error: result.error };
    } catch (error) {
      showToast(`Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  };

  // Saved data functions
  const saveLabourToFirebase = async (labourData, options = {}) => {
    try {
      const result = await saveLabourInfo(jobListId, labourData);
      if (result.success) {
        const labourItem = result.labour || result.savedLabour;
        patchNamedList(labourKey, labourItem, (row) => row.name);
        if (!options.quiet && result.created) {
          showToast('Labour saved', 'success');
        }
        return { success: true, savedLabour: labourItem };
      } else {
        if (!options.quiet) showToast('Could not save that labour entry', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving labour:', error);
      if (!options.quiet) showToast('Could not save that labour entry', 'error');
      return { success: false, error: error.message };
    }
  };

  const saveTradeToFirebase = async (tradeData, options = {}) => {
    try {
      const result = await saveTradeInfo(jobListId, tradeData);
      if (result.success) {
        const tradeItem = result.trade || result.savedTrade;
        patchNamedList(tradesKey, tradeItem, (row) => row.tradeName);
        if (!options.quiet && result.created) {
          showToast('Trade saved', 'success');
        }
        return { success: true, savedTrade: tradeItem };
      } else {
        if (!options.quiet) showToast('Could not save that trade', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving trade:', error);
      if (!options.quiet) showToast('Could not save that trade', 'error');
      return { success: false, error: error.message };
    }
  };

  // Progress payment functions
  const addProgressPaymentToFirebase = async (paymentData) => {
    try {
      const result = await addProgressPayment(jobListId, paymentData);
      if (result.success) {
        queryClient.setQueryData(progressPaymentsKey, (prev) => (
          [...(Array.isArray(prev) ? prev : []), result.progressPayment]
        ));
        return { success: true, progressPayment: result.progressPayment };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error adding progress payment:', error);
      return { success: false, error: error.message };
    }
  };

  // Invoice functions
  const addInvoiceToFirebase = async (invoiceData) => {
    try {
      const result = await addInvoiceToFirestore(jobListId, invoiceData);
      if (result.success) {
        setInvoices(prev => [...prev, result.invoice]);
        return { success: true, invoice: result.invoice };
      } else {
        showToast('Could not save that invoice', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error adding invoice:', error);
      showToast('Could not save that invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  const updateInvoiceStatus = async (invoiceId, status) => {
    try {
      const result = await updateInvoiceInFirestore(jobListId, invoiceId, { status });
      if (result.success) {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status } : inv));
        showToast(`Invoice marked ${status}`, 'success');
        return { success: true, invoice: result.invoice };
      } else {
        showToast('Could not update that invoice', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating invoice status:', error);
      showToast('Could not update that invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  const deleteInvoiceFromFirebase = async (invoiceId) => {
    try {
      const result = await voidInvoiceInFirestore(jobListId, invoiceId);
      if (result.success) {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'void', voidedAt: new Date() } : inv));
        showToast('Moved to Recently deleted. The number is kept until you remove it for good.', 'success');
        invalidateInvoiceQueries();
        return { success: true };
      } else {
        showToast('Could not move that invoice', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error voiding invoice:', error);
      showToast('Could not move that invoice', 'error');
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
        invalidateInvoiceQueries();
        return { success: true };
      }
      showToast('Could not restore that invoice', 'error');
      return { success: false, error: result.error };
    } catch (error) {
      showToast('Could not restore that invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  const purgeInvoiceFromFirebase = async (invoiceId) => {
    try {
      const result = await purgeInvoiceFromFirestore(jobListId, invoiceId);
      if (result.success) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
        showToast('Invoice removed for good', 'success');
        invalidateInvoiceQueries();
        return { success: true };
      }
      showToast('Could not remove that invoice', 'error');
      return { success: false, error: result.error };
    } catch (error) {
      showToast('Could not remove that invoice', 'error');
      return { success: false, error: error.message };
    }
  };

  // Company and Project functions
  const saveCompanyToFirebase = async (companyData, options = {}) => {
    try {
      const result = await saveSupplierInfo(jobListId, companyData);
      if (result.success) {
        patchNamedList(suppliersKey, result.supplier, (row) => row.name);
        if (!options.quiet && result.created) {
          showToast('Supplier saved', 'success');
        }
        return { success: true, supplier: result.supplier };
      } else {
        if (!options.quiet) showToast('Could not save that supplier', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      if (!options.quiet) showToast('Could not save that supplier', 'error');
      return { success: false, error: error.message };
    }
  };

  const saveServiceProviderToFirebase = async (providerData, options = {}) => {
    try {
      const result = await saveServiceProviderInfo(jobListId, providerData);
      if (result.success) {
        patchNamedList(serviceProvidersKey, result.provider, (row) => row.name);
        if (!options.quiet && result.created) {
          showToast('Service provider saved', 'success');
        }
        return { success: true, provider: result.provider };
      } else {
        if (!options.quiet) showToast('Could not save that service provider', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving service provider:', error);
      if (!options.quiet) showToast('Could not save that service provider', 'error');
      return { success: false, error: error.message };
    }
  };

  const saveClientToFirebase = async (clientData, options = {}) => {
    try {
      const result = await saveClientInfo(jobListId, clientData);
      if (result.success) {
        patchNamedList(clientsKey, result.client, (row) => row.name);
        if (!options.quiet && result.created) {
          showToast('Client saved', 'success');
        }
        return { success: true, client: result.client };
      }
      if (!options.quiet) showToast('Could not save that client', 'error');
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Error saving client:', error);
      if (!options.quiet) showToast('Could not save that client', 'error');
      return { success: false, error: error.message };
    }
  };

  // HIA contracts save the client onto the job's clients directory.
  const saveClientDetailsToFirebase = async (projectId, clientData) => {
    const result = await saveClientToFirebase({ ...clientData, projectId }, { quiet: true });
    if (result.success) return { success: true, clientDetails: result.client };
    return result;
  };

  // HIA Contract functions
  const addHIAContractToFirebase = async (contractData) => {
    try {
      const result = await saveHIAContractToFirestore(jobListId, contractData);
      if (result.success) {
        queryClient.setQueryData(hiaContractsKey, (prev) => (
          [...(Array.isArray(prev) ? prev : []), result.hiaContract]
        ));
        showToast('Contract saved', 'success');
        return { success: true, hiaContract: result.hiaContract };
      } else {
        showToast('Could not save that contract', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving HIA Contract:', error);
      showToast('Could not save that contract', 'error');
      return { success: false, error: error.message };
    }
  };

  // User Bank Details functions
  const saveUserBankDetailsToFirebase = async (bankData, options = {}) => {
    try {
      const result = await saveUserBankDetailsToFirestore(jobListId, bankData);
      if (result.success) {
        setBankDetails(bankDetailsKey, result.userBankDetails);
        if (!options.quiet) showToast('Bank details saved', 'success');
        return { success: true, userBankDetails: result.userBankDetails };
      } else {
        if (!options.quiet) showToast('Could not save those bank details', 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving bank details:', error);
      if (!options.quiet) showToast('Could not save those bank details', 'error');
      return { success: false, error: error.message };
    }
  };

  // Payer functions
  const savePayerToFirebase = async (payerName) => {
    if (!payerName || !payerName.trim()) return;
    try {
      const result = await savePayerToFirestore(jobListId, payerName.trim());
      if (result.success) {
        patchNamedList(payersKey, result.payer, (row) => row.name);
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
    invoices,
    addExpenseToFirebase,
    updateExpenseInFirebase,
    codeExpenseTrade,
    codeExpenseCategory,
    deleteExpenseFromFirebase,
    restoreExpenseFromFirebase,
    purgeExpenseFromFirebase,
    saveLabourToFirebase,
    saveTradeToFirebase,
    addProgressPaymentToFirebase,
    addInvoiceToFirebase,
    deleteInvoiceFromFirebase,
    restoreInvoiceFromFirebase,
    purgeInvoiceFromFirebase,
    updateInvoiceStatus,
    saveCompanyToFirebase,
    saveServiceProviderToFirebase,
    saveClientToFirebase,
    addHIAContractToFirebase,
    saveClientDetailsToFirebase,
    saveUserBankDetailsToFirebase,
    savePayerToFirebase
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};
