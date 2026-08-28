import { getActiveOrgId } from './tenancy';
import { callFunction } from './callable';

export async function allocateInvoiceNumber(orgId = getActiveOrgId()) {
  const data = await callFunction('allocateInvoiceNumber', { orgId });
  if (!data || !data.invoiceNumber) {
    throw new Error('Could not allocate an invoice number.');
  }
  return data.invoiceNumber;
}
