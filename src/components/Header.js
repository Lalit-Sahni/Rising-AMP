import React from 'react';
import { useApp } from '../context/AppContext';
import { Search, LogOut } from 'lucide-react';

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
  const { currentPage, setCurrentPage, setCommandPaletteOpen } = useApp();
  const title = PAGE_TITLES[currentPage] || 'RisingAMP';
  const showJobCrumb = currentPage !== 'jobs' && currentPage !== 'profile' && projectName;

  return (
    <header className="bg-surface border-b border-hairline px-4 md:px-[26px] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] md:ml-0 ml-10 flex items-center gap-2 font-semibold">
          {showJobCrumb ? (
            <>
              <button
                type="button"
                onClick={() => setCurrentPage('jobs')}
                className="text-slate-400 font-medium hover:text-ink"
              >
                Jobs
              </button>
              <span className="text-slate-400 font-medium">/</span>
              <b className="text-ink">{currentPage === 'dashboard' ? projectName : title}</b>
            </>
          ) : (
            <b className="text-ink">{title}</b>
          )}
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
