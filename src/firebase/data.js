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
} from 'firebase/firestore';
import { db } from './config';
import { getActiveOrgId } from './tenancy';

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

/** First step is void (Recently deleted), never a hard delete. */
export const voidExpenseInFirestore = async (jobId, expenseId) => {
  return voidSubdoc(jobId, 'expenses', expenseId, 'Expense', 'active');
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

// Progress payment functions
export const addProgressPayment = async (jobId, paymentData) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const paymentsCollectionRef = collection(userDocRef, 'progressPayments');

    const docRef = await addDoc(paymentsCollectionRef, definedFields({
      ...paymentData,
      timestamp: serverTimestamp()
    }));

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

// Invoice functions
export const addInvoiceToFirestore = async (jobId, invoice) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const invoicesCollectionRef = collection(userDocRef, 'invoices');

    const docRef = await addDoc(invoicesCollectionRef, definedFields({
      ...invoice,
      jobId: jobId,
      timestamp: serverTimestamp()
    }));

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

export const updateInvoiceInFirestore = async (jobId, invoiceId, updatedInvoice) => {
  try {
    const userDocRef = await projectRootRef(jobId);
    const invoiceDocRef = doc(userDocRef, 'invoices', invoiceId);

    await updateDoc(invoiceDocRef, definedFields({
      ...updatedInvoice,
      updatedAt: serverTimestamp()
    }));

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

    const docRef = await addDoc(contractsCollectionRef, definedFields({
      ...contractData,
      jobId: jobId,
      timestamp: serverTimestamp()
    }));

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
      await updateDoc(existingDoc.ref, definedFields({
        ...bankData,
        updatedAt: serverTimestamp()
      }));

      const updatedBankDetails = {
        id: existingDoc.id,
        ...bankData,
        updatedAt: new Date()
      };

      return { success: true, userBankDetails: updatedBankDetails };
    } else {
      // Add new record
      const docRef = await addDoc(bankDetailsCollectionRef, definedFields({
        ...bankData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));

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
