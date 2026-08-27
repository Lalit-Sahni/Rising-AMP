import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import { FAMILY_ORG_ID } from './tenancy';

const projectRootRef = async (projectId) => {
  if (!projectId) {
    throw new Error('Missing job list');
  }
  const projectRef = doc(db, 'organizations', FAMILY_ORG_ID, 'projects', projectId);
  const projectDoc = await getDoc(projectRef);
  if (!projectDoc.exists()) {
    throw new Error('Job list not found');
  }
  return projectRef;
};

// Sync local expenses to Firestore (migrate from array to subcollection)
export const syncExpensesToFirestore = async (jobId, expenses) => {
  try {
    console.log('Syncing expenses to Firestore with consistent IDs');
    const userDocRef = await projectRootRef(jobId);
    
    // Add each expense as a separate document using expense ID as document ID
    for (const expense of expenses) {
      // Ensure expense has an ID, generate one if missing
      const expenseId = expense.id || `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expenseWithId = { ...expense, id: expenseId };
      
      const expenseDocRef = doc(userDocRef, 'expenses', expenseId);
      await setDoc(expenseDocRef, {
        ...expenseWithId,
        timestamp: serverTimestamp()
      });
    }
    
    console.log('Successfully synced', expenses.length, 'expenses to Firestore');
    return { success: true };
  } catch (error) {
    console.error('Sync to Firestore error:', error);
    return { success: false, error: error.message };
  }
};

// Fetch expenses from Firestore (using subcollections)
export const fetchExpensesFromFirestore = async (jobId) => {
  try {
    console.log('Attempting to fetch data for access code:', jobId);
    const userDocRef = await projectRootRef(jobId);
    const expensesCollectionRef = collection(userDocRef, 'expenses');
    
    // Query expenses ordered by timestamp with limit for performance
    const expensesQuery = query(
      expensesCollectionRef, 
      orderBy('timestamp', 'desc'),
      limit(1000) // Limit to prevent excessive data loading
    );
    const expensesSnapshot = await getDocs(expensesQuery);
    
    const expenses = [];
    expensesSnapshot.forEach((doc) => {
      const data = doc.data();
      expenses.push({
        id: doc.id,
        ...data,
        // Ensure timestamp is properly converted
        timestamp: data.timestamp?.toDate?.() || data.timestamp || new Date()
      });
    });
    
    console.log('Fetched expenses:', expenses.length);
    
    // Get user document for budget
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    
    return { 
      success: true, 
      expenses: expenses,
      budget: userData?.budget || 0
    };
  } catch (error) {
    console.error('Fetch from Firestore error:', error);
    return { success: false, error: error.message, code: error.code };
  }
};

// Update budget in Firestore
export const updateBudgetInFirestore = async (jobId, budget) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    await updateDoc(userDocRef, {
      budget: budget,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Update budget error:', error);
    return { success: false, error: error.message };
  }
};

// Add single expense to Firestore (using subcollection)
export const addExpenseToFirestore = async (jobId, expense) => {
  try {
    console.log('Adding expense with ID:', expense.id, 'to Firebase');
    
    const userDocRef = await projectRootRef(jobId);
    const expenseDocRef = doc(userDocRef, 'expenses', expense.id);
    
    // Use setDoc with the expense's ID as the document ID
    await setDoc(expenseDocRef, {
      ...expense,
      jobId: jobId,
      timestamp: serverTimestamp()
    });
    
    const newExpense = {
      ...expense,
      timestamp: new Date()
    };
    
    console.log('Successfully added expense to Firebase with ID:', expense.id);
    return { success: true, expense: newExpense };
  } catch (error) {
    console.error('Add expense error:', error);
    return { success: false, error: error.message };
  }
};

// Update expense in Firestore
export const updateExpenseInFirestore = async (jobId, expenseId, updatedExpense) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const expenseDocRef = doc(userDocRef, 'expenses', expenseId);
    
    await updateDoc(expenseDocRef, {
      ...updatedExpense,
      updatedAt: serverTimestamp()
    });
    
    const updatedExpenseWithId = {
      id: expenseId,
      ...updatedExpense,
      updatedAt: new Date()
    };
    
    return { success: true, expense: updatedExpenseWithId };
  } catch (error) {
    console.error('Update expense error:', error);
    return { success: false, error: error.message };
  }
};

// Delete expense from Firestore
export const deleteExpenseFromFirestore = async (jobId, expenseId) => {
  try {
    console.log('Deleting expense:', expenseId, 'for access code:', jobId);
    
    if (!jobId) {
      console.error('No access code provided for deletion');
      return { success: false, error: 'Access code is required' };
    }
    
    if (!expenseId) {
      console.error('No expense ID provided for deletion');
      return { success: false, error: 'Expense ID is required' };
    }
    
    const userDocRef = await projectRootRef(jobId);
    const expenseDocRef = doc(userDocRef, 'expenses', expenseId);
    
    // Verify the document exists before deleting
    const docSnapshot = await getDoc(expenseDocRef);
    if (!docSnapshot.exists()) {
      console.warn('Expense document does not exist:', expenseId);
      return { success: false, error: 'Expense not found in Firebase' };
    }
    
    console.log('Document exists, proceeding with deletion...');
    
    // Delete the document directly (more reliable than batch for single operations)
    await deleteDoc(expenseDocRef);
    
    // Verify deletion by checking if document still exists
    const verificationSnapshot = await getDoc(expenseDocRef);
    if (verificationSnapshot.exists()) {
      console.error('Document still exists after deletion attempt');
      return { success: false, error: 'Failed to delete document from Firebase' };
    }
    
    console.log('Successfully deleted expense from Firebase:', expenseId);
    
    return { success: true };
  } catch (error) {
    console.error('Delete expense error:', error);
    
    // Provide more detailed error messages
    if (error.code === 'permission-denied') {
      return { success: false, error: 'Permission denied - check Firebase rules' };
    } else if (error.code === 'unavailable') {
      return { success: false, error: 'Firebase is temporarily unavailable' };
    } else {
      return { success: false, error: `Firebase error: ${error.message}` };
    }
  }
};

// Batch delete multiple expenses (for future use)
export const batchDeleteExpenses = async (jobId, expenseIds) => {
  try {
    console.log('Batch deleting expenses:', expenseIds, 'for access code:', jobId);
    
    const userDocRef = await projectRootRef(jobId);
    const batch = writeBatch(db);
    
    for (const expenseId of expenseIds) {
      const expenseDocRef = doc(userDocRef, 'expenses', expenseId);
      batch.delete(expenseDocRef);
    }
    
    await batch.commit();
    console.log('Successfully batch deleted expenses:', expenseIds);
    
    return { success: true };
  } catch (error) {
    console.error('Batch delete expenses error:', error);
    return { success: false, error: error.message };
  }
};

// Save labour information (updated to use unified structure)
export const saveLabourInfo = async (jobId, labourData) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const labourCollectionRef = collection(userDocRef, 'labour');
    
    // Check if labour with same name and role already exists
    if (labourData.name && labourData.role) {
      const existingQuery = query(
        labourCollectionRef,
        where('name', '==', labourData.name),
        where('role', '==', labourData.role)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // Update existing record
        const existingDoc = existingSnapshot.docs[0];
        await updateDoc(existingDoc.ref, {
          ...labourData,
          updatedAt: serverTimestamp()
        });
        
        const updatedLabour = {
          id: existingDoc.id,
          ...labourData,
          updatedAt: new Date()
        };
        
        return { success: true, labour: updatedLabour };
      }
    }
    
    // Add new record
    const docRef = await addDoc(labourCollectionRef, {
      ...labourData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    const newLabour = {
      id: docRef.id,
      ...labourData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return { success: true, labour: newLabour };
  } catch (error) {
    console.error('Save labour error:', error);
    return { success: false, error: error.message };
  }
};

// Save trade information (updated to use unified structure)
export const saveTradeInfo = async (jobId, tradeData) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const tradeCollectionRef = collection(userDocRef, 'trades');
    
    // Check if trade with same name and category already exists
    if (tradeData.tradeName && tradeData.tradeCategory) {
      const existingQuery = query(
        tradeCollectionRef,
        where('tradeName', '==', tradeData.tradeName),
        where('tradeCategory', '==', tradeData.tradeCategory)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // Update existing record
        const existingDoc = existingSnapshot.docs[0];
        await updateDoc(existingDoc.ref, {
          ...tradeData,
          updatedAt: serverTimestamp()
        });
        
        const updatedTrade = {
          id: existingDoc.id,
          ...tradeData,
          updatedAt: new Date()
        };
        
        return { success: true, trade: updatedTrade };
      }
    }
    
    // Add new record
    const docRef = await addDoc(tradeCollectionRef, {
      ...tradeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    const newTrade = {
      id: docRef.id,
      ...tradeData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return { success: true, trade: newTrade };
  } catch (error) {
    console.error('Save trade error:', error);
    return { success: false, error: error.message };
  }
};

// Fetch labour (updated to use unified structure)
export const fetchLabour = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const labourCollectionRef = collection(userDocRef, 'labour');
    const labourQuery = query(labourCollectionRef, orderBy('createdAt', 'desc'));
    const labourSnapshot = await getDocs(labourQuery);
    
    const labour = [];
    labourSnapshot.forEach((doc) => {
      labour.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, labour };
  } catch (error) {
    console.error('Fetch labour error:', error);
    return { success: false, error: error.message };
  }
};

// Legacy function for backward compatibility
export const fetchSavedLabour = async (jobId) => {
  return await fetchLabour(jobId);
};

// Fetch trades (updated to use unified structure)
export const fetchTrades = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const tradeCollectionRef = collection(userDocRef, 'trades');
    const tradeQuery = query(tradeCollectionRef, orderBy('createdAt', 'desc'));
    const tradeSnapshot = await getDocs(tradeQuery);
    
    const trades = [];
    tradeSnapshot.forEach((doc) => {
      trades.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, trades };
  } catch (error) {
    console.error('Fetch trades error:', error);
    return { success: false, error: error.message };
  }
};

// Legacy function for backward compatibility
export const fetchSavedTrades = async (jobId) => {
  return await fetchTrades(jobId);
};

// Save client information (replaces saveCompanyInfo)
export const saveClientInfo = async (jobId, clientData) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const clientCollectionRef = collection(userDocRef, 'clients');
    
    // Check if client with same email already exists (if email provided)
    if (clientData.email) {
      const existingQuery = query(
        clientCollectionRef,
        where('email', '==', clientData.email)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // Update existing record
        const existingDoc = existingSnapshot.docs[0];
        await updateDoc(existingDoc.ref, {
          ...clientData,
          updatedAt: serverTimestamp()
        });
        
        const updatedClient = {
          id: existingDoc.id,
          ...clientData,
          updatedAt: new Date()
        };
        
        return { success: true, client: updatedClient };
      }
    }
    
    // Add new record
    const docRef = await addDoc(clientCollectionRef, {
      ...clientData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    const newClient = {
      id: docRef.id,
      ...clientData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return { success: true, client: newClient };
  } catch (error) {
    console.error('Save client error:', error);
    return { success: false, error: error.message };
  }
};

// Fetch clients (replaces fetchSavedCompanies)
export const fetchClients = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const clientCollectionRef = collection(userDocRef, 'clients');
    const clientQuery = query(clientCollectionRef, orderBy('createdAt', 'desc'));
    const clientSnapshot = await getDocs(clientQuery);
    
    const clients = [];
    clientSnapshot.forEach((doc) => {
      clients.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, clients };
  } catch (error) {
    console.error('Fetch clients error:', error);
    return { success: false, error: error.message };
  }
};

// Progress payment functions
export const addProgressPayment = async (jobId, paymentData) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const paymentsCollectionRef = collection(userDocRef, 'progressPayments');
    
    const docRef = await addDoc(paymentsCollectionRef, {
      ...paymentData,
      timestamp: serverTimestamp()
    });
    
    const newPayment = {
      id: docRef.id,
      ...paymentData,
      timestamp: new Date()
    };
    
    return { success: true, progressPayment: newPayment };
  } catch (error) {
    console.error('Add progress payment error:', error);
    return { success: false, error: error.message };
  }
};

export const fetchProgressPayments = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const paymentsCollectionRef = collection(userDocRef, 'progressPayments');
    const paymentsQuery = query(paymentsCollectionRef, orderBy('timestamp', 'desc'));
    const paymentsSnapshot = await getDocs(paymentsQuery);
    
    const progressPayments = [];
    paymentsSnapshot.forEach((doc) => {
      progressPayments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, progressPayments };
  } catch (error) {
    console.error('Fetch progress payments error:', error);
    return { success: false, error: error.message };
  }
};

export const updateProgressPayment = async (jobId, paymentId, updatedPayment) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const paymentDocRef = doc(userDocRef, 'progressPayments', paymentId);
    
    await updateDoc(paymentDocRef, {
      ...updatedPayment,
      updatedAt: serverTimestamp()
    });
    
    const updatedPaymentWithId = {
      id: paymentId,
      ...updatedPayment,
      updatedAt: new Date()
    };
    
    return { success: true, progressPayment: updatedPaymentWithId };
  } catch (error) {
    console.error('Update progress payment error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteProgressPayment = async (jobId, paymentId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const paymentDocRef = doc(userDocRef, 'progressPayments', paymentId);
    
    await deleteDoc(paymentDocRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete progress payment error:', error);
    return { success: false, error: error.message };
  }
};

// Invoice functions
export const addInvoiceToFirestore = async (jobId, invoice) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const invoicesCollectionRef = collection(userDocRef, 'invoices');
    
    const docRef = await addDoc(invoicesCollectionRef, {
      ...invoice,
      jobId: jobId,
      timestamp: serverTimestamp()
    });
    
    const newInvoice = {
      id: docRef.id,
      ...invoice,
      timestamp: new Date()
    };
    
    return { success: true, invoice: newInvoice };
  } catch (error) {
    console.error('Add invoice error:', error);
    return { success: false, error: error.message };
  }
};

export const fetchInvoicesFromFirestore = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const invoicesCollectionRef = collection(userDocRef, 'invoices');
    const invoicesQuery = query(invoicesCollectionRef, orderBy('timestamp', 'desc'));
    const invoicesSnapshot = await getDocs(invoicesQuery);
    
    const invoices = [];
    invoicesSnapshot.forEach((doc) => {
      invoices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, invoices };
  } catch (error) {
    console.error('Fetch invoices error:', error);
    return { success: false, error: error.message, code: error.code };
  }
};

export const updateInvoiceInFirestore = async (jobId, invoiceId, updatedInvoice) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const invoiceDocRef = doc(userDocRef, 'invoices', invoiceId);
    
    await updateDoc(invoiceDocRef, {
      ...updatedInvoice,
      updatedAt: serverTimestamp()
    });
    
    const updatedInvoiceWithId = {
      id: invoiceId,
      ...updatedInvoice,
      updatedAt: new Date()
    };
    
    return { success: true, invoice: updatedInvoiceWithId };
  } catch (error) {
    console.error('Update invoice error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteInvoiceFromFirestore = async (jobId, invoiceId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const invoiceDocRef = doc(userDocRef, 'invoices', invoiceId);
    
    await deleteDoc(invoiceDocRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete invoice error:', error);
    return { success: false, error: error.message };
  }
};

// HIA Contract functions
export const saveHIAContractToFirestore = async (jobId, contractData) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const contractsCollectionRef = collection(userDocRef, 'hiaContracts');
    
    const docRef = await addDoc(contractsCollectionRef, {
      ...contractData,
      jobId: jobId,
      timestamp: serverTimestamp()
    });
    
    const newContract = {
      id: docRef.id,
      ...contractData,
      timestamp: new Date()
    };
    
    return { success: true, hiaContract: newContract };
  } catch (error) {
    console.error('Save HIA contract error:', error);
    return { success: false, error: error.message };
  }
};

export const fetchHIAContractsFromFirestore = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const contractsCollectionRef = collection(userDocRef, 'hiaContracts');
    const contractsQuery = query(contractsCollectionRef, orderBy('timestamp', 'desc'));
    const contractsSnapshot = await getDocs(contractsQuery);
    
    const hiaContracts = [];
    contractsSnapshot.forEach((doc) => {
      hiaContracts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, hiaContracts };
  } catch (error) {
    console.error('Fetch HIA contracts error:', error);
    return { success: false, error: error.message };
  }
};

export const updateHIAContractInFirestore = async (jobId, contractId, updates) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const contractDocRef = doc(userDocRef, 'hiaContracts', contractId);
    
    await updateDoc(contractDocRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    const updatedContract = {
      id: contractId,
      ...updates,
      updatedAt: new Date()
    };
    
    return { success: true, hiaContract: updatedContract };
  } catch (error) {
    console.error('Update HIA contract error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteHIAContractFromFirestore = async (jobId, contractId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const contractDocRef = doc(userDocRef, 'hiaContracts', contractId);
    
    await deleteDoc(contractDocRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete HIA contract error:', error);
    return { success: false, error: error.message };
  }
};

// Update client information
export const updateClientInfo = async (jobId, clientId, clientData) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const clientDocRef = doc(userDocRef, 'clients', clientId);
    
    await updateDoc(clientDocRef, {
      ...clientData,
      updatedAt: serverTimestamp()
    });
    
    const updatedClient = {
      id: clientId,
      ...clientData,
      updatedAt: new Date()
    };
    
    return { success: true, client: updatedClient };
  } catch (error) {
    console.error('Update client error:', error);
    return { success: false, error: error.message };
  }
};

// Delete client information
export const deleteClientInfo = async (jobId, clientId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const clientDocRef = doc(userDocRef, 'clients', clientId);
    
    await deleteDoc(clientDocRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete client error:', error);
    return { success: false, error: error.message };
  }
};

// User Bank Details functions
export const saveUserBankDetailsToFirestore = async (jobId, bankData) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const bankDetailsCollectionRef = collection(userDocRef, 'bankDetails');
    
    // Check if bank details already exist
    const existingQuery = query(bankDetailsCollectionRef, limit(1));
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      // Update existing record
      const existingDoc = existingSnapshot.docs[0];
      await updateDoc(existingDoc.ref, {
        ...bankData,
        updatedAt: serverTimestamp()
      });
      
      const updatedBankDetails = {
        id: existingDoc.id,
        ...bankData,
        updatedAt: new Date()
      };
      
      return { success: true, userBankDetails: updatedBankDetails };
    } else {
      // Add new record
      const docRef = await addDoc(bankDetailsCollectionRef, {
        ...bankData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newBankDetails = {
        id: docRef.id,
        ...bankData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      return { success: true, userBankDetails: newBankDetails };
    }
  } catch (error) {
    console.error('Save user bank details error:', error);
    return { success: false, error: error.message };
  }
};

export const fetchUserBankDetailsFromFirestore = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const bankDetailsCollectionRef = collection(userDocRef, 'bankDetails');
    const bankDetailsQuery = query(bankDetailsCollectionRef, limit(1));
    const bankDetailsSnapshot = await getDocs(bankDetailsQuery);
    
    if (!bankDetailsSnapshot.empty) {
      const doc = bankDetailsSnapshot.docs[0];
      const userBankDetails = {
        id: doc.id,
        ...doc.data()
      };
      
      return { success: true, userBankDetails };
    } else {
      return { success: true, userBankDetails: null };
    }
  } catch (error) {
    console.error('Fetch user bank details error:', error);
    return { success: false, error: error.message };
  }
};

// Payer functions
export const savePayerToFirestore = async (jobId, payerName) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const payersCollectionRef = collection(userDocRef, 'payers');

    const existingQuery = query(payersCollectionRef, where('name', '==', payerName));
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      return { success: true, payer: { id: existingSnapshot.docs[0].id, name: payerName } };
    }

    const docRef = await addDoc(payersCollectionRef, {
      name: payerName,
      createdAt: serverTimestamp()
    });

    return { success: true, payer: { id: docRef.id, name: payerName } };
  } catch (error) {
    console.error('Save payer error:', error);
    return { success: false, error: error.message };
  }
};

export const fetchPayersFromFirestore = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const payersCollectionRef = collection(userDocRef, 'payers');
    const payersQuery = query(payersCollectionRef, orderBy('createdAt', 'asc'));
    const payersSnapshot = await getDocs(payersQuery);

    const payers = [];
    payersSnapshot.forEach((d) => {
      payers.push({ id: d.id, ...d.data() });
    });

    return { success: true, payers };
  } catch (error) {
    console.error('Fetch payers error:', error);
    return { success: false, error: error.message };
  }
}; 