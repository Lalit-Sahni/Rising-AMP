import React, { useState } from 'react';
import { HardHat, PlusCircle, LayoutDashboard, Clock, Menu, X, Target, FileText, ClipboardList } from 'lucide-react';
import { useApp } from '../context/AppContext';

const navMain = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'add-expense', label: 'Add Expense', icon: PlusCircle },
  { key: 'new-invoice', label: 'Invoices', icon: FileText },
  { key: 'history', label: 'History', icon: Clock },
  { key: 'budget-tracking', label: 'Budget Tracking', icon: Target },
  { key: 'site-log', label: 'Site Log', icon: ClipboardList },
];


export default function Sidebar() {
  const { currentPage, setCurrentPage, showToast } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleNavClick = (pageKey, label) => {
    setCurrentPage(pageKey);
    showToast(`Navigated to ${label}`, 'info');
    // Close mobile sidebar after navigation
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleMobileSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-gray-800 rounded-xl text-white hover:bg-gray-700 transition-colors shadow-lg"
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

      {/* Sidebar */}
      <aside className={`sidebar bg-gray-900 border-r border-white/10 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
        isMobileOpen 
          ? 'fixed left-0 top-0 w-72 z-50 transform translate-x-0 shadow-2xl' 
          : 'md:relative md:translate-x-0 md:w-60 md:block fixed left-0 top-0 w-72 z-50 transform -translate-x-full'
      }`}>
        <div className="sidebar-header px-6 py-6 border-b border-white/10">
          <div className="logo flex items-center gap-3 font-semibold text-lg">
            <span className="logo-icon bg-blue-600 rounded-lg p-2 flex items-center justify-center">
              <HardHat className="text-white w-6 h-6" />
            </span>
            <span>BuildTrack</span>
          </div>
        </div>
        <nav className="nav-section py-4">
          <div className="nav-title px-6 text-xs font-medium text-white/40 uppercase mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            Main
          </div>
          {navMain.map(item => (
            <button
              key={item.key}
              className={`nav-item sidebar-item flex items-center gap-3 px-6 py-3 text-sm rounded-lg mx-3 transition-all relative w-full text-left ${
                currentPage === item.key 
                  ? 'bg-white/10 text-white font-semibold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-500 before:rounded-r' 
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => handleNavClick(item.key, item.label)}
            >
              <item.icon className="nav-icon w-5 h-5 opacity-80" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
} 