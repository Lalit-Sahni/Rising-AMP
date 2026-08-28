import React, { createContext, useContext } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children, authUser, profile, setProfile }) {
  return (
    <AuthContext.Provider value={{ authUser, profile, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
