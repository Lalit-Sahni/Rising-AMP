import React, { useState, useEffect } from 'react';
import { onAuthChange, signOut } from './firebase/auth';
import { syncExpensesToFirestore } from './firebase/data';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';

import CommandPalette from './components/CommandPalette';
import LoginScreen from './components/LoginScreen';
import './styles/premium-animations.css';

function App() {
  const [accessCode, setAccessCode] = useState(localStorage.getItem('accessCode'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for Firebase auth state changes
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        const savedAccessCode = localStorage.getItem('accessCode');
        if (savedAccessCode) {
          setIsAuthenticated(true);
          setAccessCode(savedAccessCode);
        }
      } else {
        setIsAuthenticated(false);
        setAccessCode(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (code) => {
    setAccessCode(code);
    setIsAuthenticated(true);
    
    // Sync any existing local data to Firestore
    try {
      const existingExpenses = JSON.parse(localStorage.getItem('expenses') || '[]');
      if (existingExpenses.length > 0) {
        await syncExpensesToFirestore(code, existingExpenses);
        // Clear local storage after successful sync
        localStorage.removeItem('expenses');
      }
    } catch (error) {
      console.error('Error syncing local data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const result = await signOut();
      if (result.success) {
        setIsAuthenticated(false);
        setAccessCode(null);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated || !accessCode) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Show main app if authenticated
  return (
    <AppProvider accessCode={accessCode}>
      <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col w-full">
          <Header onLogout={handleLogout} />
          <MainContent />
        </div>

        <CommandPalette />
      </div>
    </AppProvider>
  );
}

export default App; 