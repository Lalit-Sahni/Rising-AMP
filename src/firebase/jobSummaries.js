import { fetchExpensesFromFirestore, fetchInvoicesFromFirestore } from './data';
import { getClients } from './directories';
import { listInvitedProjects } from './projectCatalog';
import { deriveJobMetrics, jobSubtitle } from '../utils/jobMetrics';
import { uniqueByName } from './partyName';

export async function loadInvitedJobSummaries(email, options = {}) {
  const projects = options.projects || (await listInvitedProjects(email));
  const now = options.now || new Date();

  const rows = await Promise.all(
    projects.map(async (project) => {
      const [expenseResult, invoiceResult, clientResult] = await Promise.all([
        fetchExpensesFromFirestore(project.projectId),
        fetchInvoicesFromFirestore(project.projectId),
        getClients(project.projectId),
      ]);
      const expenses = (expenseResult && expenseResult.success && expenseResult.expenses) || [];
      const invoices = (invoiceResult && invoiceResult.success && invoiceResult.invoices) || [];
      const clients = uniqueByName(
        (clientResult && clientResult.success && clientResult.clients) || [],
        (row) => row.name || row.clientName
      );
      const metrics = deriveJobMetrics({ expenses, invoices }, { now });
      return {
        ...project,
        expenseCount: expenses.length,
        invoiceCount: invoices.length,
        metrics,
        subtitle: jobSubtitle({ clients, invoices, metrics }),
      };
    })
  );

  return rows.sort(
    (a, b) =>
      (b.metrics.cash.paid || 0) - (a.metrics.cash.paid || 0) ||
      (b.expenseCount || 0) - (a.expenseCount || 0)
  );
}
