export const PAGE_PATHS = {
  jobs: '/',
  profile: '/profile',
} as const;

export function pathForPage(page: string, jobId: string | null | undefined): string {
  switch (page) {
    case 'jobs':
      return '/';
    case 'profile':
      return '/profile';
    case 'dashboard':
      return jobId ? `/jobs/${jobId}` : '/';
    case 'add-expense':
      return jobId ? `/jobs/${jobId}/expenses/new` : '/';
    case 'new-invoice':
      return jobId ? `/jobs/${jobId}/invoices` : '/';
    case 'history':
      return jobId ? `/jobs/${jobId}/history` : '/';
    case 'files':
      return jobId ? `/jobs/${jobId}/files` : '/';
    case 'cost-plan':
      return jobId ? `/jobs/${jobId}/cost-plan` : '/';
    case 'hia-contract':
      return jobId ? `/jobs/${jobId}/contracts` : '/';
    case 'client-manager':
      return jobId ? `/jobs/${jobId}/clients` : '/';
    default:
      return '/';
  }
}

export function pageFromPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'jobs';
  if (path === '/profile') return 'profile';
  // Pre-Phase 12 link. The route redirects onto the open job.
  if (path === '/clients') return 'client-manager';
  const match = path.match(/^\/jobs\/([^/]+)(?:\/(.*))?$/);
  if (!match) return 'not-found';
  const rest = match[2] || '';
  if (!rest) return 'dashboard';
  if (rest === 'expenses/new') return 'add-expense';
  if (rest === 'invoices') return 'new-invoice';
  if (rest === 'files') return 'files';
  if (rest === 'cost-plan') return 'cost-plan';
  if (rest === 'history') return 'history';
  // Budget tracking was retired in Phase 12; the route redirects to Cost plan.
  if (rest === 'budget') return 'cost-plan';
  if (rest === 'contracts') return 'hia-contract';
  if (rest === 'clients') return 'client-manager';
  return 'not-found';
}

export function jobIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/jobs\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Phone tab bar shows inside a job, never on Jobs home, Profile or a dead link. */
export function showsJobTabBar(page: string, jobId: string | null | undefined): boolean {
  if (!jobId) return false;
  return page !== 'jobs' && page !== 'profile' && page !== 'not-found';
}

export const JOB_TAB_BAR_ITEMS = [
  { key: 'dashboard', label: 'Overview' },
  { key: 'new-invoice', label: 'Invoices' },
  { key: 'add-expense', label: 'Add', primary: true },
  { key: 'files', label: 'Files' },
  { key: 'history', label: 'History' },
] as const;
