import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import {
  canonicalPartyName,
  isLiveDirectoryRow,
  namesMatch,
  uniqueByName,
} from './partyName';
import { getActiveOrgId } from './tenancy';

export const DIRECTORY = {
  CLIENTS: 'clients',
  SUPPLIERS: 'suppliers',
  SERVICE_PROVIDERS: 'serviceProviders',
  LABOUR: 'labour',
  TRADES: 'trades',
};

function colRef(projectId, name) {
  return collection(db, 'organizations', getActiveOrgId(), 'projects', projectId, name);
}

function rowRef(projectId, name, id) {
  return doc(db, 'organizations', getActiveOrgId(), 'projects', projectId, name, id);
}

function definedFields(data) {
  const out = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

async function listAll(projectId, name) {
  const snap = await getDocs(colRef(projectId, name));
  return snap.docs.map((row) => ({ id: row.id, ...row.data() }));
}

async function upsertDirectory(projectId, collectionName, data, getName, extra = {}) {
  const displayName = String(getName(data) || '').trim();
  const nameKey = canonicalPartyName(displayName);
  if (!nameKey) {
    return { success: false, error: 'A name is required.' };
  }

  try {
    const rows = await listAll(projectId, collectionName);
    const existing = rows.find((row) => namesMatch(getName(row), displayName));
    const payload = definedFields({
      ...data,
      ...extra,
      nameKey,
      status: 'active',
      jobId: projectId,
      updatedAt: serverTimestamp(),
    });

    if (existing) {
      await updateDoc(rowRef(projectId, collectionName, existing.id), payload);
      return {
        success: true,
        created: false,
        item: {
          ...existing,
          ...data,
          ...extra,
          id: existing.id,
          nameKey,
          status: 'active',
          jobId: projectId,
          updatedAt: new Date(),
        },
      };
    }

    const created = await addDoc(colRef(projectId, collectionName), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return {
      success: true,
      created: true,
      item: {
        id: created.id,
        ...data,
        ...extra,
        nameKey,
        status: 'active',
        jobId: projectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error(`Save ${collectionName} error:`, error);
    return { success: false, error: error.message };
  }
}

export async function saveClientInfo(projectId, clientData) {
  const result = await upsertDirectory(
    projectId,
    DIRECTORY.CLIENTS,
    clientData,
    (row) => row.name,
    { directoryKind: 'client' }
  );
  return result.success
    ? { success: true, created: result.created, client: result.item }
    : result;
}

export async function getClients(projectId) {
  try {
    const clients = uniqueByName(await listAll(projectId, DIRECTORY.CLIENTS), (row) => row.name);
    return { success: true, clients };
  } catch (error) {
    console.error('Get clients error:', error);
    return { success: false, error: error.message, clients: [] };
  }
}

export async function saveSupplierInfo(projectId, supplierData) {
  const result = await upsertDirectory(
    projectId,
    DIRECTORY.SUPPLIERS,
    supplierData,
    (row) => row.name,
    { directoryKind: 'supplier' }
  );
  return result.success
    ? { success: true, created: result.created, supplier: result.item }
    : result;
}

export async function getSuppliers(projectId) {
  try {
    const suppliers = uniqueByName(await listAll(projectId, DIRECTORY.SUPPLIERS), (row) => row.name);
    return { success: true, suppliers };
  } catch (error) {
    console.error('Get suppliers error:', error);
    return { success: false, error: error.message, suppliers: [] };
  }
}

export async function saveServiceProviderInfo(projectId, providerData) {
  const result = await upsertDirectory(
    projectId,
    DIRECTORY.SERVICE_PROVIDERS,
    providerData,
    (row) => row.name,
    { directoryKind: 'serviceProvider' }
  );
  return result.success
    ? { success: true, created: result.created, provider: result.item }
    : result;
}

export async function getServiceProviders(projectId) {
  try {
    const providers = uniqueByName(
      await listAll(projectId, DIRECTORY.SERVICE_PROVIDERS),
      (row) => row.name
    );
    return { success: true, providers };
  } catch (error) {
    console.error('Get service providers error:', error);
    return { success: false, error: error.message, providers: [] };
  }
}

export async function saveLabourInfo(projectId, labourData) {
  const result = await upsertDirectory(
    projectId,
    DIRECTORY.LABOUR,
    labourData,
    (row) => row.name
  );
  return result.success
    ? { success: true, created: result.created, labour: result.item }
    : result;
}

export async function getLabour(projectId) {
  try {
    const labour = uniqueByName(await listAll(projectId, DIRECTORY.LABOUR), (row) => row.name);
    return { success: true, labour };
  } catch (error) {
    console.error('Get labour error:', error);
    return { success: false, error: error.message, labour: [] };
  }
}

export async function saveTradeInfo(projectId, tradeData) {
  const result = await upsertDirectory(
    projectId,
    DIRECTORY.TRADES,
    tradeData,
    (row) => row.tradeName
  );
  return result.success
    ? { success: true, created: result.created, trade: result.item }
    : result;
}

export async function getTrades(projectId) {
  try {
    const trades = uniqueByName(await listAll(projectId, DIRECTORY.TRADES), (row) => row.tradeName);
    return { success: true, trades };
  } catch (error) {
    console.error('Get trades error:', error);
    return { success: false, error: error.message, trades: [] };
  }
}

export { isLiveDirectoryRow, uniqueByName };

export async function updateClient(jobId, clientId, clientData) {
  try {
    await updateDoc(rowRef(jobId, DIRECTORY.CLIENTS, clientId), definedFields({
      ...clientData,
      updatedAt: serverTimestamp(),
    }));
    return { success: true, client: { id: clientId, ...clientData } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function voidDirectoryRow(jobId, name, id) {
  try {
    await updateDoc(rowRef(jobId, name, id), {
      status: 'void',
      voidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteClient(jobId, clientId) {
  return voidDirectoryRow(jobId, DIRECTORY.CLIENTS, clientId);
}

