import React from 'react';
import { AlertTriangle, FileQuestion, CheckCircle, ArrowRight } from 'lucide-react';

const AlertsWidget = ({ alerts = null }) => {
  // Default/dummy alerts for testing
  const defaultAlerts = {
    unreviewedCount: 5,
    uncategorizedCount: 3
  };

  const alertData = alerts || defaultAlerts;

  // Handle alert click navigation
  const handleAlertClick = (filterType) => {
    // This would typically navigate to /expenses?filter=review or similar
    console.log(`Navigate to expenses with filter: ${filterType}`);
    // For now, just show in console since we don't have routing set up
  };

  const alertConfigs = [
    {
      type: 'review',
      count: alertData.unreviewedCount,
      icon: FileQuestion,
      title: 'Expenses Need Review',
      message: 'expenses require your attention',
      color: 'amber',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-900',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-200',
      hoverBg: 'hover:bg-amber-200'
    },
    {
      type: 'categorize',
      count: alertData.uncategorizedCount,
      icon: AlertTriangle,
      title: 'Missing Categories',
      message: 'expenses missing category',
      color: 'red',
      bgColor: 'bg-red-100',
      textColor: 'text-red-900',
      iconColor: 'text-red-600',
      borderColor: 'border-red-200',
      hoverBg: 'hover:bg-red-200'
    }
  ];

  // Filter out alerts with zero count
  const activeAlerts = alertConfigs.filter(alert => alert.count > 0);

  return (
    <div className="bg-slate-800 rounded-xl p-4 shadow">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-orange-400" />
        <h2 className="text-xl font-semibold text-slate-100">Action Required</h2>
      </div>

      {activeAlerts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeAlerts.map((alert) => {
            const Icon = alert.icon;
            return (
              <button
                key={alert.type}
                onClick={() => handleAlertClick(alert.type)}
                className={`${alert.bgColor} ${alert.textColor} ${alert.borderColor} border rounded-md p-4 shadow font-semibold text-left transition-all duration-200 ${alert.hoverBg} transform hover:scale-105 hover:shadow-lg`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Icon className={`w-6 h-6 ${alert.iconColor} mt-0.5 flex-shrink-0`} />
                    <div>
                      <div className="text-lg font-bold">
                        {alert.count}
                      </div>
                      <div className="text-sm font-semibold mb-1">
                        {alert.title}
                      </div>
                      <div className="text-xs opacity-75">
                        {alert.count} {alert.message}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className={`w-5 h-5 ${alert.iconColor} opacity-60`} />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        // All clear state
        <div className="bg-green-100 text-green-900 border border-green-200 rounded-md p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <div className="text-lg font-semibold mb-2">All Caught Up!</div>
          <div className="text-sm opacity-75">
            No expenses require review or categorization
          </div>
        </div>
      )}

      {/* Additional info/actions */}
      {activeAlerts.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>
              {activeAlerts.reduce((sum, alert) => sum + alert.count, 0)} total actions needed
            </span>
            <button
              onClick={() => handleAlertClick('all')}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              View all expenses →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsWidget; 