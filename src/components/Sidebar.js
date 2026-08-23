import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  LayoutDashboard,
  Clock,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Target,
  FileText,
  Users,
  FileCheck,
  Briefcase,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import BrandMark from './BrandMark';

const navMain = [
  { key: 'jobs', label: 'Jobs', icon: Briefcase, needsJob: false },
  { key: 'dashboard', label: 'Overview', icon: LayoutDashboard, needsJob: true, jobOnly: true },
  { key: 'add-expense', label: 'Add expense', icon: PlusCircle, needsJob: true },
  { key: 'new-invoice', label: 'Invoices', icon: FileText, needsJob: true },
  { key: 'history', label: 'History', icon: Clock, needsJob: true },
];

const navMore = [
  { key: 'budget-tracking', label: 'Budget tracking', icon: Target },
  { key: 'hia-contract', label: 'HIA contracts', icon: FileCheck },
  { key: 'client-manager', label: 'Clients', icon: Users },
];

function initials(name, email) {
  const source = (name || email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 1).toUpperCase();
}

export default function Sidebar({ user, projectName, onSwitchProject }) {
  const { currentPage, setCurrentPage, showToast, projectId, profile } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(
    () => navMore.some((item) => item.key === currentPage)
  );

  useEffect(() => {
    if (navMore.some((item) => item.key === currentPage)) {
      setMoreOpen(true);
    }
  }, [currentPage]);

  const email = user?.email || '';
  const displayName = (profile && profile.displayName) || user?.displayName || 'RisingAMP';
  const company = (profile && profile.businessName) || '';
  const onJobsHome = currentPage === 'jobs' || !projectId;
  const visibleMain = navMain.filter((item) => {
    if (item.key === 'jobs') return onJobsHome;
    if (item.jobOnly) return !onJobsHome;
    return true;
  });

  const handleNavClick = (pageKey, needsJob) => {
    if (needsJob && !projectId) {
      showToast('Open a job first.', 'info');
      setCurrentPage('jobs');
      setIsMobileOpen(false);
      return;
    }
    setCurrentPage(pageKey);
    setIsMobileOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 w-8 h-8 grid place-items-center bg-surface border border-hairline rounded-ot-sm text-slate-600 hover:text-ink shadow-whisper"
        aria-label="Open menu"
      >
        {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-steel-900/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar bg-steel-900 text-[#C9CDD4] flex flex-col min-h-screen transition-all duration-300 ease-in-out overflow-visible
          fixed inset-y-0 left-0 z-50 w-[210px] flex-shrink-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:z-auto
          ${isDesktopCollapsed
            ? 'md:relative md:w-14 md:min-w-[3.5rem]'
            : 'md:relative md:w-[210px]'
          }`}
      >
        <button
          onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
          className={`hidden md:flex absolute z-20 items-center justify-center w-8 h-8 rounded-ot-sm transition-all duration-300
            ${isDesktopCollapsed
              ? 'top-1/2 right-0 -translate-y-1/2 translate-x-4 rounded-l-none rounded-r-ot-sm bg-steel-900 border border-l-0 border-steel-700 text-[#C9CDD4] hover:bg-steel-800'
              : 'top-4 right-3 bg-steel-800 hover:bg-steel-700 text-[#C9CDD4] hover:text-white'
            }`}
          title={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isDesktopCollapsed ? <ChevronRight className="w-4 h-4" /> : <X className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('jobs', false)}
          className={`flex items-center gap-2.5 px-3 pt-4 pb-5 text-left ${isDesktopCollapsed ? 'md:hidden' : ''}`}
        >
          <BrandMark size={32} icon={17} />
          <b className="text-[14.5px] font-extrabold text-white tracking-tight">RisingAMP</b>
        </button>

        <nav className={`flex-1 px-3 pb-4 ${isDesktopCollapsed ? 'md:hidden' : ''}`}>
          <div className="text-[10px] tracking-[0.16em] uppercase text-[#5B606A] px-2 pt-2.5 pb-2 font-bold">
            {onJobsHome ? 'Main' : (projectName || 'Job')}
          </div>
          {visibleMain.map((item) => {
            const active = currentPage === item.key || (item.key === 'jobs' && currentPage === 'jobs');
            return (
              <button
                key={item.key}
                className={`relative flex items-center gap-2.5 w-full text-left px-2.5 py-2 mb-0.5 rounded-ot-sm text-[13px] font-medium transition-colors transition-transform active:scale-[0.98]
                  ${active
                    ? 'bg-steel-800 text-white'
                    : 'text-[#B4B9C1] hover:bg-steel-800 hover:text-[#EDEFF2]'
                  }`}
                onClick={() => handleNavClick(item.key, item.needsJob)}
              >
                {active && (
                  <span className="absolute left-[-12px] top-[7px] bottom-[7px] w-[3px] rounded-r bg-accent" />
                )}
                <item.icon className="w-4 h-4 shrink-0 opacity-90" strokeWidth={1.6} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="flex items-center justify-between w-full px-2.5 py-2 mt-3 text-[10px] tracking-[0.16em] uppercase text-[#5B606A] font-bold"
          >
            More
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? '' : '-rotate-90'}`} />
          </button>
          {moreOpen && navMore.map((item) => {
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                className={`relative flex items-center gap-2.5 w-full text-left px-2.5 py-2 mb-0.5 rounded-ot-sm text-[13px] font-medium
                  ${active
                    ? 'bg-steel-800 text-white'
                    : 'text-[#B4B9C1] hover:bg-steel-800 hover:text-[#EDEFF2]'
                  }`}
                onClick={() => handleNavClick(item.key, true)}
              >
                {active && (
                  <span className="absolute left-[-12px] top-[7px] bottom-[7px] w-[3px] rounded-r bg-accent" />
                )}
                <item.icon className="w-4 h-4 shrink-0 opacity-90" strokeWidth={1.6} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={`mt-auto mx-3 mb-3 pt-3 border-t border-steel-700 ${isDesktopCollapsed ? 'md:hidden' : ''}`}>
          <button
            type="button"
            onClick={() => handleNavClick('profile', false)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-ot-sm hover:bg-steel-800 text-left transition-transform active:scale-[0.98]"
            title="Profile"
          >
            {profile && profile.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-6 h-6 rounded-full bg-steel-700 grid place-items-center text-[10px] font-semibold text-[#C9CDD4] shrink-0">
                {initials(displayName, email)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <b className="block text-xs font-medium text-[#E5E7EA] truncate">{displayName}</b>
              <small className="block text-[10.5px] text-[#767B84] truncate">{company || email}</small>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#767B84] shrink-0" strokeWidth={1.7} />
          </button>
        </div>
      </aside>
    </>
  );
}
