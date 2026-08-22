import React from 'react';
import { useApp } from '../context/AppContext';
import { Download, Search, LogOut } from 'lucide-react';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  'add-expense': 'Add expense',
  history: 'History',
  'new-invoice': 'Invoices',
  'budget-tracking': 'Budget tracking',
  'hia-contract': 'HIA contracts',
  'client-manager': 'Clients',
};

const Header = ({ onLogout, onSwitchProject, projectName }) => {
  const { currentPage, setCommandPaletteOpen } = useApp();
  const title = PAGE_TITLES[currentPage] || 'Opal Track';

  return (
    <header className="bg-surface border-b border-hairline px-4 md:px-[26px] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] text-slate-600 md:ml-0 ml-10">
          <b className="text-ink font-semibold">{title}</b>
        </div>

        <div className="flex items-center gap-2">
          {projectName && onSwitchProject && (
            <button
              onClick={onSwitchProject}
              className="pressable hidden sm:inline-flex items-center gap-2 max-w-[14rem] px-3 py-1.5 text-[12.5px] font-medium text-ink border border-hairline rounded-full"
              title="Change job list"
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
            onClick={() => console.log('Exporting to Excel...')}
            className="pressable w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm bg-surface text-slate-600 hover:text-ink"
            title="Export to Excel"
          >
            <Download className="w-4 h-4" strokeWidth={1.6} />
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
