export const PAGE_PATHS = {
  jobs: '/',
  profile: '/profile',
  'client-manager': '/clients',
} as const;

export function pathForPage(page: string, jobId: string | null | undefined): string {
  switch (page) {
    case 'jobs':
      return '/';
    case 'profile':
      return '/profile';
    case 'client-manager':
      return '/clients';
    case 'dashboard':
      return jobId ? `/jobs/${jobId}` : '/';
    case 'add-expense':
      return jobId ? `/jobs/${jobId}/expenses/new` : '/';
    case 'new-invoice':
      return jobId ? `/jobs/${jobId}/invoices` : '/';
    case 'history':
      return jobId ? `/jobs/${jobId}/history` : '/';
    case 'budget-tracking':
      return jobId ? `/jobs/${jobId}/budget` : '/';
    case 'hia-contract':
      return jobId ? `/jobs/${jobId}/contracts` : '/';
    default:
      return '/';
  }
}

export function pageFromPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'jobs';
  if (path === '/profile') return 'profile';
  if (path === '/clients') return 'client-manager';
  const match = path.match(/^\/jobs\/([^/]+)(?:\/(.*))?$/);
  if (!match) return 'not-found';
  const rest = match[2] || '';
  if (!rest) return 'dashboard';
  if (rest === 'expenses/new') return 'add-expense';
  if (rest === 'invoices') return 'new-invoice';
  if (rest === 'history') return 'history';
  if (rest === 'budget') return 'budget-tracking';
  if (rest === 'contracts') return 'hia-contract';
  return 'not-found';
}

export function jobIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/jobs\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
