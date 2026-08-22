import React, { useState } from 'react';
import { HardHat, PlusCircle, LayoutDashboard, Clock, Menu, X, ChevronRight, Target, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';

const navMain = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'add-expense', label: 'Add Expense', icon: PlusCircle },
  { key: 'new-invoice', label: 'Invoices', icon: FileText },
  { key: 'history', label: 'History', icon: Clock },
  { key: 'budget-tracking', label: 'Budget Tracking', icon: Target },
];


export default function Sidebar() {
  const { currentPage, setCurrentPage, showToast } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const toggleDesktopSidebar = () => {
    setIsDesktopCollapsed(!isDesktopCollapsed);
  };

  const handleNavClick = (pageKey, label) => {
    setCurrentPage(pageKey);
    showToast(`Navigated to ${label}`, 'info');
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle Button - only on mobile, doesn't overlap page title on desktop */}
      <button
        onClick={toggleMobileSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-[#3b3b3b] rounded-xl text-white hover:bg-[#4a4a4a] transition-colors shadow-lg border border-[#2d2d2d]"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-60 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - off-canvas on mobile (fixed, out of flex flow); in-flow on md+ */}
      <aside 
        className={`sidebar bg-[#3b3b3b] border-r border-[#2d2d2d] flex flex-col min-h-screen transition-all duration-300 ease-in-out overflow-visible
          fixed inset-y-0 left-0 z-50 w-72 flex-shrink-0
          ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          md:translate-x-0 md:shadow-none md:z-auto
          ${isDesktopCollapsed
            ? 'md:relative md:w-14 md:min-w-[3.5rem]'
            : 'md:relative md:w-60'
          }`}
      >
        {/* Internal toggle: X at top when expanded, arrow in middle protruding when collapsed */}
        <button
          onClick={toggleDesktopSidebar}
          className={`hidden md:flex absolute z-20 items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 ease-out
            ${isDesktopCollapsed 
              ? 'top-1/2 right-0 -translate-y-1/2 translate-x-4 rounded-l-none rounded-r-lg shadow-lg bg-[#3b3b3b] border border-l-0 border-[#2d2d2d] text-white hover:bg-[#4a4a4a]' 
              : 'top-5 right-4 bg-[#4a4a4a]/60 hover:bg-[#4a4a4a] border border-[#2d2d2d] text-white/90 hover:text-white'
            }`}
          title={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className={`transition-all duration-300 ${isDesktopCollapsed ? 'rotate-0' : ''}`}>
            {isDesktopCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </span>
        </button>

        {/* Header - hidden when collapsed on desktop */}
        <div className={`sidebar-header px-6 py-6 border-b border-[#2d2d2d] flex items-center justify-between transition-opacity duration-300 ${
          isDesktopCollapsed ? 'md:opacity-0 md:pointer-events-none md:absolute md:w-0 md:overflow-hidden' : ''
        }`}>
          <div className="logo flex items-center gap-3 font-semibold text-lg">
            <span className="logo-icon bg-accent rounded-lg p-2 flex items-center justify-center shrink-0">
              <HardHat className="text-white w-6 h-6" />
            </span>
            <span>Opal Track</span>
          </div>
        </div>

        {/* Nav - hidden when collapsed on desktop */}
        <nav className={`nav-section py-4 flex-1 transition-opacity duration-300 ${
          isDesktopCollapsed ? 'md:opacity-0 md:pointer-events-none md:absolute md:w-0 md:overflow-hidden' : ''
        }`}>
          <div className="nav-title px-6 text-xs font-medium text-white/70 uppercase mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            Main
          </div>
          {navMain.map(item => (
            <button
              key={item.key}
              className={`nav-item sidebar-item flex items-center gap-3 px-6 py-3 text-sm rounded-lg mx-3 transition-all relative w-full text-left ${
                currentPage === item.key 
                  ? 'bg-[#4a4a4a]/60 text-white font-semibold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent before:rounded-r' 
                  : 'text-white/90 hover:text-white hover:bg-[#4a4a4a]/40'
              }`}
              onClick={() => handleNavClick(item.key, item.label)}
            >
              <item.icon className="nav-icon w-5 h-5 opacity-80 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
} 