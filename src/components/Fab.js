import React from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Fab = () => {
  const { setCurrentPage, currentPage } = useApp();

  const handleClick = () => {
    setCurrentPage('add-expense');
  };

  // Hide FAB on site-log page since it has its own Add New button
  if (currentPage === 'site-log') {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      data-action="add-expense"
      className="fab-button fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-2xl hover:shadow-blue-500/25 transition-all duration-300 hover:scale-110 flex items-center justify-center text-white z-50"
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(147, 51, 234, 0.9))',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: `
          0 8px 32px rgba(59, 130, 246, 0.3),
          0 4px 16px rgba(147, 51, 234, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `
      }}
    >
      <Plus size={24} />
    </button>
  );
};

export default Fab; 