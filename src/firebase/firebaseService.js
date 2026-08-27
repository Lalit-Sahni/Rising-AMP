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
  PURCHASE_ORDERS: 'purchaseOrders',
  WORKER_HISTORY: 'workerHistory',
  CLIENTS: 'clients',
  LABOUR: 'labour',
  TRADES: 'trades',
  SITE_NAMES: 'siteNames',
  PROJECT_PHASES: 'projectPhases'
};

// ===== EXPENSES =====
export const addExpense = async (accessCode, expenseData) => {
  const docRef = await addDoc(collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.EXPENSES}`), {
    ...expenseData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: docRef.id, ...expenseData };
};

export const getExpenses = async (accessCode) => {
  const q = query(
    collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.EXPENSES}`),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const updateExpense = async (accessCode, expenseId, expenseData) => {
  const expenseRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.EXPENSES}`, expenseId);
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

export const deleteExpense = async (accessCode, expenseId) => {
  const expenseRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.EXPENSES}`, expenseId);
  await deleteDoc(expenseRef);
  
  // Also delete associated receipt image if it exists
  try {
    const { deleteReceiptImage } = await import('./storage');
    await deleteReceiptImage(accessCode, expenseId);
  } catch (error) {
    console.warn('Error deleting receipt image:', error);
    // Don't throw error here as expense deletion should still succeed
  }
};

// ===== PURCHASE ORDERS =====
export const addPurchaseOrder = async (accessCode, poData) => {
  const docRef = await addDoc(collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PURCHASE_ORDERS}`), {
    ...poData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: docRef.id, ...poData };
};

export const getPurchaseOrders = async (accessCode) => {
  const q = query(
    collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PURCHASE_ORDERS}`),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const updatePurchaseOrder = async (accessCode, poId, poData) => {
  const poRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PURCHASE_ORDERS}`, poId);
  await updateDoc(poRef, {
    ...poData,
    updatedAt: serverTimestamp()
  });
};

export const deletePurchaseOrder = async (accessCode, poId) => {
  const poRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PURCHASE_ORDERS}`, poId);
  await deleteDoc(poRef);
};

// ===== WORKER HISTORY =====
export const addWorkerToHistory = async (accessCode, workerData) => {
  const docRef = await addDoc(collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.WORKER_HISTORY}`), {
    ...workerData,
    createdAt: serverTimestamp()
  });
  return { id: docRef.id, ...workerData };
};

export const getWorkerHistory = async (accessCode) => {
  const q = query(
    collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.WORKER_HISTORY}`),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// ===== SITE NAMES =====
export const addSiteName = async (accessCode, siteName) => {
  const docRef = await addDoc(collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.SITE_NAMES}`), {
    name: siteName,
    createdAt: serverTimestamp()
  });
  return { id: docRef.id, name: siteName };
};

export const getSiteNames = async (accessCode) => {
  const q = query(
    collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.SITE_NAMES}`),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// ===== PROJECT PHASES =====
export const addProjectPhase = async (accessCode, phaseName) => {
  const docRef = await addDoc(collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PROJECT_PHASES}`), {
    name: phaseName,
    createdAt: serverTimestamp()
  });
  return { id: docRef.id, name: phaseName };
};

export const getProjectPhases = async (accessCode) => {
  const q = query(
    collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PROJECT_PHASES}`),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// ===== CLIENTS =====
export const updateClient = async (accessCode, clientId, clientData) => {
  try {
    const clientRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.CLIENTS}`, clientId);
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

export const deleteClient = async (accessCode, clientId) => {
  try {
    const clientRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.CLIENTS}`, clientId);
    await deleteDoc(clientRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete client error:', error);
    return { success: false, error: error.message };
  }
};

// Legacy function names for backward compatibility
export const addClient = async (accessCode, clientData) => {
  return await saveClientInfo(accessCode, clientData);
};

export const updateLabour = async (accessCode, labourId, labourData) => {
  try {
    const labourRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.LABOUR}`, labourId);
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

export const deleteLabour = async (accessCode, labourId) => {
  try {
    const labourRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.LABOUR}`, labourId);
    await deleteDoc(labourRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete labour error:', error);
    return { success: false, error: error.message };
  }
};

export const updateTrade = async (accessCode, tradeId, tradeData) => {
  try {
    const tradeRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.TRADES}`, tradeId);
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

export const deleteTrade = async (accessCode, tradeId) => {
  try {
    const tradeRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.TRADES}`, tradeId);
    await deleteDoc(tradeRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete trade error:', error);
    return { success: false, error: error.message };
  }
};
 