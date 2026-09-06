import React from 'react';
import { useApp } from '../../context/AppContext';
import ClientManager from '../ui/ClientManager';

const ClientManagerPage = () => {
  const { jobId, setCurrentPage } = useApp();

  if (!jobId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <div className="eyebrow">Directory</div>
        <h1 className="text-[25px] font-extrabold tracking-tight mt-1">Clients</h1>
        <p className="text-[13.5px] text-slate-600 mt-2">Open a job first so clients are saved on the right list.</p>
        <button
          type="button"
          onClick={() => setCurrentPage('jobs')}
          className="mt-4 inline-flex items-center bg-accent hover:bg-accent-600 text-white text-[13px] font-bold px-[15px] py-[9px] rounded-[9px]"
        >
          Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <ClientManager embedded />
    </div>
  );
};

export default ClientManagerPage;
