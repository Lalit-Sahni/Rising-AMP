import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./config";
import { FAMILY_ORG_ID } from "./tenancy";

// Collection names
const COLLECTIONS = {
  EXPENSES: 'expenses',
  PURCHASE_ORDERS: 'purchaseOrders',
  WORKER_HISTORY: 'workerHistory',
  CLIENTS: 'clients',
  LABOUR: 'labour',
  TRADES: 'trades',
  PROJECTS: 'projects',
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
export const saveClientInfo = async (accessCode, clientData) => {
  try {
    const clientsCollectionRef = collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.CLIENTS}`);
    
    // Check if client with same email already exists (if email provided)
    if (clientData.email) {
      const existingQuery = query(
        clientsCollectionRef,
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
        
        return {
          success: true,
          client: {
            id: existingDoc.id,
            ...clientData,
            updatedAt: new Date()
          }
        };
      }
    }
    
    // Add new record
    const docRef = await addDoc(clientsCollectionRef, {
      ...clientData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      client: {
        id: docRef.id,
        ...clientData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Save client error:', error);
    return { success: false, error: error.message };
  }
};

export const getClients = async (accessCode) => {
  try {
    const q = query(
      collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.CLIENTS}`),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const clients = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, clients };
  } catch (error) {
    console.error('Get clients error:', error);
    return { success: false, error: error.message, clients: [] };
  }
};

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

// ===== LABOUR =====
export const saveLabourInfo = async (accessCode, labourData) => {
  try {
    const labourCollectionRef = collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.LABOUR}`);
    
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
        
        return {
          success: true,
          labour: {
            id: existingDoc.id,
            ...labourData,
            updatedAt: new Date()
          }
        };
      }
    }
    
    // Add new record
    const docRef = await addDoc(labourCollectionRef, {
      ...labourData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      labour: {
        id: docRef.id,
        ...labourData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Save labour error:', error);
    return { success: false, error: error.message };
  }
};

export const getLabour = async (accessCode) => {
  try {
    const q = query(
      collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.LABOUR}`),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const labour = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, labour };
  } catch (error) {
    console.error('Get labour error:', error);
    return { success: false, error: error.message, labour: [] };
  }
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

// ===== TRADES =====
export const saveTradeInfo = async (accessCode, tradeData) => {
  try {
    const tradesCollectionRef = collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.TRADES}`);
    
    // Check if trade with same name and category already exists
    if (tradeData.tradeName && tradeData.tradeCategory) {
      const existingQuery = query(
        tradesCollectionRef,
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
        
        return {
          success: true,
          trade: {
            id: existingDoc.id,
            ...tradeData,
            updatedAt: new Date()
          }
        };
      }
    }
    
    // Add new record
    const docRef = await addDoc(tradesCollectionRef, {
      ...tradeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      trade: {
        id: docRef.id,
        ...tradeData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Save trade error:', error);
    return { success: false, error: error.message };
  }
};

export const getTrades = async (accessCode) => {
  try {
    const q = query(
      collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.TRADES}`),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const trades = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, trades };
  } catch (error) {
    console.error('Get trades error:', error);
    return { success: false, error: error.message, trades: [] };
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

// ===== PROJECTS =====
export const saveProjectInfo = async (accessCode, projectData) => {
  try {
    const projectsCollectionRef = collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PROJECTS}`);
    
    // Check if project with same name already exists
    if (projectData.name) {
      const existingQuery = query(
        projectsCollectionRef,
        where('name', '==', projectData.name)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // Update existing record
        const existingDoc = existingSnapshot.docs[0];
        await updateDoc(existingDoc.ref, {
          ...projectData,
          updatedAt: serverTimestamp()
        });
        
        return {
          success: true,
          project: {
            id: existingDoc.id,
            ...projectData,
            updatedAt: new Date()
          }
        };
      }
    }
    
    // Add new record
    const docRef = await addDoc(projectsCollectionRef, {
      ...projectData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      project: {
        id: docRef.id,
        ...projectData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Save project error:', error);
    return { success: false, error: error.message };
  }
};

export const getProjects = async (accessCode) => {
  try {
    const q = query(
      collection(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PROJECTS}`),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const projects = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, projects };
  } catch (error) {
    console.error('Get projects error:', error);
    return { success: false, error: error.message, projects: [] };
  }
};

export const updateProject = async (accessCode, projectId, projectData) => {
  try {
    const projectRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PROJECTS}`, projectId);
    await updateDoc(projectRef, {
      ...projectData,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      project: {
        id: projectId,
        ...projectData,
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Update project error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteProject = async (accessCode, projectId) => {
  try {
    const projectRef = doc(db, `organizations/${FAMILY_ORG_ID}/projects/${accessCode}/${COLLECTIONS.PROJECTS}`, projectId);
    await deleteDoc(projectRef);
    
    return { success: true };
  } catch (error) {
    console.error('Delete project error:', error);
    return { success: false, error: error.message };
  }
}; 