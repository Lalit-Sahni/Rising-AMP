import React, { useState } from 'react';
import { FileText, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';
import { useApp } from '../../context/AppContext';

export default function WeeklyReportPage() {
  const { accessCode } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  console.log('WeeklyReportPage accessCode:', accessCode);

  const handleGenerateReport = async () => {
    console.log('Generating report with accessCode:', accessCode);
    
    if (!accessCode) {
      setError("No access code found. Please try logging in again.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const generateWeeklyReport = httpsCallable(functions, 'generateWeeklyReport');
      const result = await generateWeeklyReport({ accessCode });
      
      const { success, downloadUrl, error: apiError } = result.data;

      if (success && downloadUrl) {
        setSuccessMessage("Report generated successfully! Downloading...");
        // Trigger download
        window.open(downloadUrl, '_blank');
      } else {
        throw new Error(apiError || "Failed to generate report.");
      }
    } catch (err) {
      console.error("Error generating report:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen text-zinc-900 p-4 md:p-6 lg:p-8 animate-fadeIn">
      <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">Weekly Report</h1>
              <p className="text-zinc-500 font-medium">Generate and download your weekly site logs and expenses</p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm text-center space-y-6">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
              <h3 className="font-semibold text-zinc-900 mb-2">What's included?</h3>
              <ul className="text-sm text-zinc-600 space-y-2 text-left list-disc pl-5">
                <li>Site logs from the past 7 days with comments and images.</li>
                <li>Expenses recorded in the past 7 days.</li>
                <li>Professional formatting with header and footer.</li>
              </ul>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{successMessage}</p>
              </div>
            )}

            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className={`w-full py-4 px-6 rounded-xl flex items-center justify-center gap-3 text-white font-semibold shadow-lg transition-all duration-300 ${
                isGenerating
                  ? 'bg-zinc-400 cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-light hover:shadow-accent/20 hover:-translate-y-0.5'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Generate Weekly Report
                </>
              )}
            </button>
            <p className="text-xs text-zinc-400">
              The report will be downloaded as a Microsoft Word (.docx) file.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
