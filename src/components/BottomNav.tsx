import React, { useEffect } from 'react';
import { Clock, FileText, Files, LayoutDashboard, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { JOB_TAB_BAR_ITEMS, showsJobTabBar } from '../navigation';

const ICONS: Record<string, typeof Clock> = {
  dashboard: LayoutDashboard,
  'new-invoice': FileText,
  'add-expense': Plus,
  files: Files,
  history: Clock,
};

/**
 * Phone tab bar for the job you have open. Desktop keeps the sidebar.
 * Toggles `html.has-tabbar` so the scroll column and toasts clear it.
 */
export default function BottomNav() {
  const { currentPage, setCurrentPage, jobId, mobileMenuOpen } = useApp();
  const visible = showsJobTabBar(currentPage, jobId);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.classList.toggle('has-tabbar', visible);
    return () => {
      document.documentElement.classList.remove('has-tabbar');
    };
  }, [visible]);

  if (!visible || mobileMenuOpen) return null;

  return (
    <nav
      className="job-tabbar md:hidden fixed inset-x-0 bottom-0 z-40 bg-surface border-t border-hairline"
      style={{ paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
      aria-label="Job"
    >
      <div className="flex items-stretch" style={{ height: 'var(--tabbar-height)' }}>
        {JOB_TAB_BAR_ITEMS.map((item) => {
          const Icon = ICONS[item.key] || Clock;
          const active = currentPage === item.key;
          const primary = 'primary' in item && item.primary;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setCurrentPage(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-[3px] text-[10.5px] font-bold tracking-[0.01em] ${
                active ? 'text-ink' : 'text-slate-400'
              }`}
            >
              {primary ? (
                <span className="grid h-[42px] w-[42px] place-items-center rounded-full bg-accent text-white shadow-[0_6px_16px_rgba(232,93,26,0.35)] -translate-y-[3px]">
                  <Icon className="h-5 w-5" strokeWidth={2.4} />
                </span>
              ) : (
                <>
                  {active ? (
                    <span className="absolute top-0 h-[3px] w-8 rounded-b bg-accent" />
                  ) : null}
                  <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2 : 1.7} />
                  <span>{item.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
