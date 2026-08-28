import React from 'react';
import { useApp } from '../context/AppContext';
import { Menu, Search, LogOut, X } from 'lucide-react';

const PAGE_TITLES = {
  jobs: 'Jobs',
  profile: 'Profile',
  dashboard: 'Overview',
  'add-expense': 'Add expense',
  history: 'History',
  'new-invoice': 'Invoices',
  'budget-tracking': 'Budget tracking',
  'hia-contract': 'HIA contracts',
  'client-manager': 'Clients',
};

const Header = ({ onLogout, projectName }) => {
  const {
    currentPage,
    setCurrentPage,
    setCommandPaletteOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useApp();
  const title = PAGE_TITLES[currentPage] || 'RisingAMP';
  const showJobCrumb = currentPage !== 'jobs' && currentPage !== 'profile' && projectName;

  return (
    <header className="bg-surface border-b border-hairline px-4 md:px-[26px] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden shrink-0 w-8 h-8 grid place-items-center bg-surface border border-hairline rounded-ot-sm text-slate-600 hover:text-ink"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div className="text-[13px] flex items-center gap-2 font-semibold min-w-0">
          {showJobCrumb ? (
            <>
              <button
                type="button"
                onClick={() => setCurrentPage('jobs')}
                className="text-slate-400 font-medium hover:text-ink shrink-0"
              >
                Jobs
              </button>
              <span className="text-slate-400 font-medium shrink-0">/</span>
              <b className="text-ink truncate">{currentPage === 'dashboard' ? projectName : title}</b>
            </>
          ) : (
            <b className="text-ink truncate">{title}</b>
          )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {projectName && currentPage !== 'jobs' && (
            <button
              type="button"
              onClick={() => setCurrentPage('jobs')}
              className="pressable hidden sm:inline-flex items-center gap-2 max-w-[14rem] px-3 py-1.5 text-[12.5px] font-medium text-ink border border-hairline rounded-full"
              title="All jobs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <span className="truncate">{projectName}</span>
            </button>
          )}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="pressable w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm bg-surface text-slate-600 hover:text-ink"
            title="Search (Ctrl+K)"
          >
            <Search className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button
            onClick={onLogout}
            className="pressable w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm bg-surface text-slate-600 hover:text-neg"
            title="Log out"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
