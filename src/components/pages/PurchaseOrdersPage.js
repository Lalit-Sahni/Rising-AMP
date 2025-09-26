import React from 'react';
import { FileText } from 'lucide-react';

export default function PurchaseOrdersPage() {
  return (
    <div className="glass-card max-w-xl mx-auto mt-16 p-10 rounded-2xl shadow-lg text-center animate-fadeIn">
      <FileText className="mx-auto mb-4 w-12 h-12 text-green-400 animate-pulse" />
      <h2 className="text-2xl font-bold mb-2 gradient-text">Purchase Orders</h2>
      <p className="text-white/70 mb-4">Create and manage your purchase orders here. PDF export and PO history coming soon!</p>
      <div className="skeleton h-12 w-full rounded mb-2"></div>
      <div className="skeleton h-12 w-2/3 mx-auto rounded"></div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fadeIn { animation: fadeIn 0.3s; }`}</style>
    </div>
  );
} 