import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./config";
import { FAMILY_ORG_ID } from "./tenancy";
import { saveClientInfo } from "./directories";

export {
  getClients,
  getLabour,
  getServiceProviders,
  getSuppliers,
  getTrades,
  saveClientInfo,
  saveLabourInfo,
  saveServiceProviderInfo,
  saveSupplierInfo,
  saveTradeInfo,
} from "./directories";

// Collection names
const COLLECTIONS = {
  EXPENSES: 'expenses',
  CLIENTS: 'clients',
  LABOUR: 'labour',
  TRADES: 'trades'
};

// ===== EXPENSES =====
export const addExpense = async (jobId, expenseData) => {
  const docRef = await addDoc(collection(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.EXPENSES}`), {
    ...expenseData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: docRef.id, ...expenseData };
};

export const getExpenses = async (jobId) => {
  const q = query(
    collection(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.EXPENSES}`),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const updateExpense = async (jobId, expenseId, expenseData) => {
  const expenseRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.EXPENSES}`, expenseId);
  await updateDoc(expenseRef, {
    ...expenseData,
    updatedAt: serverTimestamp()
  });
  
  // Handle receipt image updates if provided
  if (expenseData.receiptImageUrl || expenseData.receiptImagePath) {
    // Receipt image was updated, no additional action needed
    // The new image URL/path is already in the expenseData
  }
};

export const deleteExpense = async (jobId, expenseId) => {
  const expenseRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.EXPENSES}`, expenseId);
  await deleteDoc(expenseRef);
  
  // Also delete associated receipt image if it exists
  try {
    const { deleteReceiptImage } = await import('./storage');
    await deleteReceiptImage(jobId, expenseId);
  } catch (error) {
    console.warn('Error deleting receipt image:', error);
    // Don't throw error here as expense deletion should still succeed
  }
};

// ===== CLIENTS =====
export const updateClient = async (jobId, clientId, clientData) => {
  try {
    const clientRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.CLIENTS}`, clientId);
    await updateDoc(clientRef, {
      ...clientData,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      client: {
        id: clientId,
        ...clientData,
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Update client error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteClient = async (jobId, clientId) => {
  try {
    const clientRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.CLIENTS}`, clientId);
    await deleteDoc(clientRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete client error:', error);
    return { success: false, error: error.message };
  }
};

// Legacy function names for backward compatibility
export const addClient = async (jobId, clientData) => {
  return await saveClientInfo(jobId, clientData);
};

export const updateLabour = async (jobId, labourId, labourData) => {
  try {
    const labourRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.LABOUR}`, labourId);
    await updateDoc(labourRef, {
      ...labourData,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      labour: {
        id: labourId,
        ...labourData,
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Update labour error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteLabour = async (jobId, labourId) => {
  try {
    const labourRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.LABOUR}`, labourId);
    await deleteDoc(labourRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete labour error:', error);
    return { success: false, error: error.message };
  }
};

export const updateTrade = async (jobId, tradeId, tradeData) => {
  try {
    const tradeRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.TRADES}`, tradeId);
    await updateDoc(tradeRef, {
      ...tradeData,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      trade: {
        id: tradeId,
        ...tradeData,
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Update trade error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteTrade = async (jobId, tradeId) => {
  try {
    const tradeRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${jobId}/${COLLECTIONS.TRADES}`, tradeId);
    await deleteDoc(tradeRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete trade error:', error);
    return { success: false, error: error.message };
  }
};
