import React, { useState } from 'react';
import ClientManager from '../ui/ClientManager';

const ClientManagerPage = () => {
  const [showClientManager, setShowClientManager] = useState(true);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      <ClientManager
        isOpen={showClientManager}
        onClose={() => setShowClientManager(false)}
        onClientSelect={() => {}}
      />
    </div>
  );
};

export default ClientManagerPage; 