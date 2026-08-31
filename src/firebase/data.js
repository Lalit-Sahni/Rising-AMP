import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  where,
  serverTimestamp,
  limit,
  writeBatch,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from './config';
import { getActiveOrgId } from './tenancy';
import { parseAtBoundary, expenseSchema, invoiceSchema } from '../domain/schemas';
import { getExpenseFaceTotalCents } from '../utils/jobMetrics';

function definedFields(data) {
  const out = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

const projectRootRef = async (projectId) => {
  if (!projectId) {
    throw new Error('Missing job list');
  }
  const projectRef = doc(db, 'organizations', getActiveOrgId(), 'projects', projectId);
  const projectDoc = await getDoc(projectRef);
  if (!projectDoc.exists()) {
    throw new Error('Job list not found');
  }
  return projectRef;
};

// Sync local expenses to Firestore (migrate from array to subcollection)
export const syncExpensesToFirestore = async (jobId, expenses) => {
  try {
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
    
    return { success: true };
  } catch (error) {
    console.error('Sync to Firestore error:', error);
    return { success: false, error: error.message };
  }
};

// Fetch expenses from Firestore (using subcollections)
export const fetchExpensesFromFirestore = async (jobId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const expensesCollectionRef = collection(userDocRef, 'expenses');
    
    // Query expenses ordered by timestamp with a page-size cap.
    // Compare to the server count so a job with exactly 1,000 is not
    // treated as truncated, and a job past 1,000 is.
    const expensesQuery = query(
      expensesCollectionRef,
      orderBy('timestamp', 'desc'),
      limit(1000)
    );
    const [expensesSnapshot, countSnap] = await Promise.all([
      getDocs(expensesQuery),
      getCountFromServer(expensesCollectionRef),
    ]);
    const totalOnServer = countSnap.data().count || 0;
    
    const expenses = [];
    expensesSnapshot.forEach((row) => {
      const data = row.data();
      const parsed = parseAtBoundary(expenseSchema, { id: row.id, ...data });
      const body = parsed.ok ? parsed.data : parsed.data;
      const totalCents = getExpenseFaceTotalCents(body);
      expenses.push({
        ...body,
        id: row.id,
        totalCents,
        _invalid: parsed.ok ? false : true,
        timestamp: data.timestamp?.toDate?.() || data.timestamp || new Date()
      });
    });
    
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    
    return { 
      success: true, 
      expenses,
      expensesCapped: totalOnServer > expenses.length,
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
    
    const userDocRef = await projectRootRef(jobId);
    const expenseDocRef = doc(userDocRef, 'expenses', expense.id);
    
    // Use setDoc with the expense's ID as the document ID
    await setDoc(expenseDocRef, definedFields({
      ...expense,
      jobId: jobId,
      timestamp: serverTimestamp()
    }));
    
    const newExpense = {
      ...expense,
      timestamp: new Date()
    };
    
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
    
    await updateDoc(expenseDocRef, definedFields({
      ...updatedExpense,
      updatedAt: serverTimestamp()
    }));
    
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

async function voidSubdoc(jobId, collectionName, id, label, fallbackStatus = 'active') {
  if (!jobId) {
    return { success: false, error: 'Job ID is required' };
  }
  if (!id) {
    return { success: false, error: `${label} ID is required` };
  }
  try {
    const userDocRef = await projectRootRef(jobId);
    const itemRef = doc(userDocRef, collectionName, id);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) {
      return { success: false, error: `${label} not found in Firebase` };
    }
    const current = String(snap.data().status || fallbackStatus);
    const statusBeforeVoid = current.toLowerCase() === 'void' ? fallbackStatus : current;
    await updateDoc(itemRef, {
      status: 'void',
      statusBeforeVoid,
      voidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error(`Void ${label.toLowerCase()} error:`, error);
    if (error.code === 'permission-denied') {
      return { success: false, error: 'Permission denied - check Firebase rules' };
    }
    if (error.code === 'unavailable') {
      return { success: false, error: 'Firebase is temporarily unavailable' };
    }
    return { success: false, error: `Firebase error: ${error.message}` };
  }
}

export const voidExpenseInFirestore = async (jobId, expenseId) => {
  return voidSubdoc(jobId, 'expenses', expenseId, 'Expense', 'active');
};

/** @deprecated Use voidExpenseInFirestore. First step is void, not a hard delete. */
export const deleteExpenseFromFirestore = async (jobId, expenseId) => {
  return voidExpenseInFirestore(jobId, expenseId);
};

async function restoreSubdoc(jobId, collectionName, id, label, fallbackStatus) {
  if (!jobId || !id) {
    return { success: false, error: `${label} ID is required` };
  }
  try {
    const userDocRef = await projectRootRef(jobId);
    const itemRef = doc(userDocRef, collectionName, id);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) {
      return { success: false, error: `${label} not found in Firebase` };
    }
    const previous = String(snap.data().statusBeforeVoid || fallbackStatus || 'active');
    const restoredStatus = previous.toLowerCase() === 'void' ? fallbackStatus : previous;
    await updateDoc(itemRef, {
      status: restoredStatus,
      statusBeforeVoid: deleteField(),
      voidedAt: deleteField(),
      restoredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, status: restoredStatus };
  } catch (error) {
    console.error(`Restore ${label.toLowerCase()} error:`, error);
    return { success: false, error: error.message };
  }
}

async function purgeVoidedSubdoc(jobId, collectionName, id, label) {
  if (!jobId || !id) {
    return { success: false, error: `${label} ID is required` };
  }
  try {
    const userDocRef = await projectRootRef(jobId);
    const itemRef = doc(userDocRef, collectionName, id);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) {
      return { success: false, error: `${label} not found in Firebase` };
    }
    if (String(snap.data().status || '').toLowerCase() !== 'void') {
      return { success: false, error: 'Only recently deleted records can be removed for good' };
    }
    await deleteDoc(itemRef);
    return { success: true };
  } catch (error) {
    console.error(`Purge ${label.toLowerCase()} error:`, error);
    if (error.code === 'permission-denied') {
      return { success: false, error: 'Permission denied - check Firebase rules' };
    }
    return { success: false, error: error.message };
  }
}

export const restoreExpenseInFirestore = async (jobId, expenseId) => {
  return restoreSubdoc(jobId, 'expenses', expenseId, 'Expense', 'active');
};

export const purgeExpenseFromFirestore = async (jobId, expenseId) => {
  return purgeVoidedSubdoc(jobId, 'expenses', expenseId, 'Expense');
};

export const batchDeleteExpenses = async (jobId, expenseIds) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const batch = writeBatch(db);
    for (const expenseId of expenseIds) {
      const expenseDocRef = doc(userDocRef, 'expenses', expenseId);
      batch.update(expenseDocRef, {
        status: 'void',
        voidedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Batch void expenses error:', error);
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

export const voidProgressPayment = async (jobId, paymentId) => {
  return voidSubdoc(jobId, 'progressPayments', paymentId, 'Progress payment');
};

/** @deprecated Use voidProgressPayment. Progress payments cannot be hard-deleted. */
export const deleteProgressPayment = async (jobId, paymentId) => {
  return voidProgressPayment(jobId, paymentId);
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
    invoicesSnapshot.forEach((row) => {
      const data = row.data();
      const parsed = parseAtBoundary(invoiceSchema, { id: row.id, ...data });
      const body = parsed.ok ? parsed.data : parsed.data;
      invoices.push({
        ...body,
        id: row.id,
        _invalid: parsed.ok ? false : true,
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

export const voidInvoiceInFirestore = async (jobId, invoiceId) => {
  return voidSubdoc(jobId, 'invoices', invoiceId, 'Invoice', 'draft');
};

/** @deprecated Use voidInvoiceInFirestore. First step is void, not a hard delete. */
export const deleteInvoiceFromFirestore = async (jobId, invoiceId) => {
  return voidInvoiceInFirestore(jobId, invoiceId);
};

export const restoreInvoiceInFirestore = async (jobId, invoiceId) => {
  return restoreSubdoc(jobId, 'invoices', invoiceId, 'Invoice', 'draft');
};

export const purgeInvoiceFromFirestore = async (jobId, invoiceId) => {
  return purgeVoidedSubdoc(jobId, 'invoices', invoiceId, 'Invoice');
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

export const voidHIAContractInFirestore = async (jobId, contractId) => {
  return voidSubdoc(jobId, 'hiaContracts', contractId, 'HIA contract');
};

/** @deprecated Use voidHIAContractInFirestore. HIA contracts cannot be hard-deleted. */
export const deleteHIAContractFromFirestore = async (jobId, contractId) => {
  return voidHIAContractInFirestore(jobId, contractId);
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

export const deleteClientInfo = async (jobId, clientId) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const clientDocRef = doc(userDocRef, 'clients', clientId);
    
    await updateDoc(clientDocRef, {
      status: 'void',
      voidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
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