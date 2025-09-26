import React from 'react';

const LoadingSkeleton = ({ 
  type = 'card', 
  lines = 3, 
  className = '',
  height = 'h-4',
  width = 'w-full'
}) => {
  const renderCardSkeleton = () => (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-700 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-3 bg-slate-700 rounded w-1/2"></div>
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className={`${height} bg-slate-700 rounded ${width}`}></div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTableSkeleton = () => (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-4 bg-slate-700 rounded w-1/4"></div>
              <div className="h-4 bg-slate-700 rounded w-1/3"></div>
              <div className="h-4 bg-slate-700 rounded w-1/6"></div>
              <div className="h-4 bg-slate-700 rounded w-1/6"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderListSkeleton = () => (
    <div className={`animate-pulse ${className}`}>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-700 rounded w-2/3"></div>
                <div className="h-3 bg-slate-700 rounded w-1/2"></div>
              </div>
              <div className="h-8 bg-slate-700 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderChartSkeleton = () => (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="h-6 bg-slate-700 rounded w-1/3 mb-6"></div>
        <div className="flex items-end justify-between h-32 space-x-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 bg-slate-700 rounded-t" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
          ))}
        </div>
        <div className="flex justify-between mt-4 space-x-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-700 rounded flex-1"></div>
          ))}
        </div>
      </div>
    </div>
  );

  switch (type) {
    case 'table':
      return renderTableSkeleton();
    case 'list':
      return renderListSkeleton();
    case 'chart':
      return renderChartSkeleton();
    case 'card':
    default:
      return renderCardSkeleton();
  }
};

export default LoadingSkeleton; 