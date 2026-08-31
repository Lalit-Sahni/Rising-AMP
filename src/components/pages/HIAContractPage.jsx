import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Upload, Download, Save } from 'lucide-react';

const HIAContractPage = () => {
  const {
    hiaContracts,
    addHIAContractToFirebase,
    saveClientDetailsToFirebase,
    saveUserBankDetailsToFirebase,
    loadClientDetails,
    loadUserBankDetails,
    showToast
  } = useApp();

  const liveHiaContracts = (hiaContracts || []).filter(
    (contract) => String(contract.status || '').toLowerCase() !== 'void'
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [extractedStages, setExtractedStages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form states
  const [clientForm, setClientForm] = useState({
    projectName: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: ''
  });
  
  const [bankForm, setBankForm] = useState({
    bsb: '',
    accountName: '',
    accountNumber: ''
  });

  const fileInputRef = useRef(null);

  // Load existing data
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        await loadClientDetails();
        if (isMounted) {
          await loadUserBankDetails();
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error loading HIA contract data:', error);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [loadClientDetails, loadUserBankDetails]);

  // Mock OCR processing function (in a real app, you'd use a service like Google Vision API)
  const processImageOCR = async (imageFile) => {
    setIsProcessing(true);
    
    // Simulate OCR processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock extracted data based on the HIA contract image
    const mockExtractedData = [
      {
        stage: 1,
        description: "Deposit and establishment of site.",
        percent: 5.00,
        amount: 62500.00
      },
      {
        stage: 2,
        description: "Survey pegouts, excavation, piers, termite caps and concrete slabs.",
        percent: 15.00,
        amount: 187500.00
      },
      {
        stage: 3,
        description: "Pest control, ground floor timber walls, stormwater plumbing, 1.5m brickwork",
        percent: 15.00,
        amount: 187500.00
      },
      {
        stage: 4,
        description: "Joists, first floor yellow tongue board, scaffolding, roof frame complete.",
        percent: 15.00,
        amount: 187500.00
      },
      {
        stage: 5,
        description: "Gutter fascia, roof (top roof only), scaffolding, brickwork complete.",
        percent: 15.00,
        amount: 187500.00
      },
      {
        stage: 6,
        description: "Lower roof complete, plumbing & electrical roughings, aircorn ducts only and gyprock.",
        percent: 15.00,
        amount: 187500.00
      },
      {
        stage: 7,
        description: "Internal doors, architraves, skirting, cornice, tiling, bath, vanity, shower screen.",
        percent: 10.00,
        amount: 125000.00
      },
      {
        stage: 8,
        description: "Kitchen, laundry, ensuite, main bathroom, electrical fit off, painting complete.",
        percent: 10.00,
        amount: 125000.00
      }
    ];
    
    setExtractedStages(mockExtractedData);
    setIsProcessing(false);
    setCurrentStep(2);
    showToast('HIA Contract processed successfully!', 'success');
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedImage(file);
      processImageOCR(file);
    }
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    try {
      await saveClientDetailsToFirebase(clientForm.projectName, clientForm);
      showToast('Client details saved successfully!', 'success');
      setCurrentStep(3);
    } catch (error) {
      showToast('Error saving client details', 'error');
    }
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    try {
      await saveUserBankDetailsToFirebase(bankForm);
      showToast('Bank details saved successfully!', 'success');
      setCurrentStep(4);
    } catch (error) {
      showToast('Error saving bank details', 'error');
    }
  };

  const generateProgressPaymentPDF = async (stage) => {
    try {
      const [{ default: jsPDF }, html2canvasModule] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const html2canvas = html2canvasModule.default;
      const pdf = new jsPDF();
      
      // Create HTML content for the PDF
      const pdfContent = document.createElement('div');
      pdfContent.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1f2937; margin: 0; font-size: 24px;">PROGRESS PAYMENT INVOICE</h1>
            <p style="color: #6b7280; margin: 5px 0;">Construction Company</p>
            <p style="color: #6b7280; margin: 5px 0;">123 Construction St, Building City, BC 1234</p>
            <p style="color: #6b7280; margin: 5px 0;">Phone: (02) 1234 5678 | Email: info@construction.com</p>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
              <h3 style="color: #1f2937; margin: 0 0 10px 0;">Bill To:</h3>
              <p style="margin: 5px 0; color: #374151;">${clientForm.clientName}</p>
              <p style="margin: 5px 0; color: #374151;">${clientForm.clientAddress}</p>
              <p style="margin: 5px 0; color: #374151;">Email: ${clientForm.clientEmail}</p>
              <p style="margin: 5px 0; color: #374151;">Phone: ${clientForm.clientPhone}</p>
            </div>
            <div style="text-align: right;">
              <h3 style="color: #1f2937; margin: 0 0 10px 0;">Invoice Details:</h3>
              <p style="margin: 5px 0; color: #374151;"><strong>Project:</strong> ${clientForm.projectName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Stage:</strong> ${stage.stage}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #d1d5db; padding: 12px; text-align: left; color: #1f2937;">Description</th>
                <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #1f2937;">Percentage</th>
                <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #1f2937;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #d1d5db; padding: 12px; color: #374151;">${stage.description}</td>
                <td style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #374151;">${stage.percent}%</td>
                <td style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #374151;">$${stage.amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          <div style="text-align: right; margin-bottom: 30px;">
            <h2 style="color: #1f2937; margin: 0;">Total: $${stage.amount.toLocaleString()}</h2>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #1f2937; margin: 0 0 15px 0;">Payment Details:</h3>
            <p style="margin: 5px 0; color: #374151;"><strong>BSB:</strong> ${bankForm.bsb}</p>
            <p style="margin: 5px 0; color: #374151;"><strong>Account Name:</strong> ${bankForm.accountName}</p>
            <p style="margin: 5px 0; color: #374151;"><strong>Account Number:</strong> ${bankForm.accountNumber}</p>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 14px;">
            <p>Thank you for your business!</p>
            <p>Please make payment within 14 days of invoice date.</p>
          </div>
        </div>
      `;
      
      // Convert HTML to canvas and then to PDF
      const canvas = await html2canvas(pdfContent, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Download the PDF
      pdf.save(`Progress_Payment_Stage_${stage.stage}_${clientForm.projectName}.pdf`);
      showToast(`Progress Payment PDF for Stage ${stage.stage} downloaded!`, 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Error generating PDF', 'error');
    }
  };

  const saveContractToFirebase = async () => {
    try {
      const contractData = {
        projectName: clientForm.projectName,
        totalAmount: extractedStages.reduce((sum, stage) => sum + stage.amount, 0),
        stages: extractedStages,
        clientDetails: clientForm,
        bankDetails: bankForm,
        imageUrl: uploadedImage ? URL.createObjectURL(uploadedImage) : null,
        createdAt: new Date()
      };
      
      await addHIAContractToFirebase(contractData);
      showToast('HIA Contract saved successfully!', 'success');
      setCurrentStep(1);
      setUploadedImage(null);
      setExtractedStages([]);
      setClientForm({
        projectName: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: ''
      });
      setBankForm({
        bsb: '',
        accountName: '',
        accountNumber: ''
      });
    } catch (error) {
      showToast('Error saving HIA contract', 'error');
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-4xl mx-auto">
        <div className="bg-surface rounded-ot p-6 border border-hairline shadow-whisper mb-4">
          <div className="eyebrow mb-1">Progress payments</div>
          <h1 className="text-[26px] font-semibold tracking-tight mb-6">HIA contracts</h1>
          
          {/* Step Navigation */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep >= step ? 'bg-accent text-white' : 'bg-canvas text-slate-400 border border-hairline'
                }`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`w-16 h-1 mx-2 ${
                    currentStep > step ? 'bg-accent' : 'bg-hairline'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Upload HIA Contract */}
          {currentStep === 1 && (
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Upload HIA Contract</h2>
              <p className="text-slate-400 mb-6">Upload an image of your HIA contract to extract progress payment stages</p>
              
              <div className="border-2 border-dashed border-hairline rounded-lg p-8 mb-6">
                <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">Click to upload or drag and drop</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                >
                  Choose File
                </button>
              </div>
              
              {isProcessing && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-2"></div>
                  <p className="text-slate-400">Processing HIA contract...</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Client Details */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Client Details</h2>
              <form onSubmit={handleClientSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Project Name</label>
                    <input
                      type="text"
                      value={clientForm.projectName}
                      onChange={(e) => setClientForm({...clientForm, projectName: e.target.value})}
                      className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Client Name</label>
                    <input
                      type="text"
                      value={clientForm.clientName}
                      onChange={(e) => setClientForm({...clientForm, clientName: e.target.value})}
                      className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Client Email</label>
                    <input
                      type="email"
                      value={clientForm.clientEmail}
                      onChange={(e) => setClientForm({...clientForm, clientEmail: e.target.value})}
                      className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Client Phone</label>
                    <input
                      type="tel"
                      value={clientForm.clientPhone}
                      onChange={(e) => setClientForm({...clientForm, clientPhone: e.target.value})}
                      className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Client Address</label>
                  <textarea
                    value={clientForm.clientAddress}
                    onChange={(e) => setClientForm({...clientForm, clientAddress: e.target.value})}
                    className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                    rows="3"
                    required
                  />
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="bg-surface border border-hairline hover:border-[#D6D9DD] text-ink px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    className="bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                  >
                    Save & Continue
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 3: Bank Details */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Bank Details</h2>
              <form onSubmit={handleBankSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">BSB</label>
                    <input
                      type="text"
                      value={bankForm.bsb}
                      onChange={(e) => setBankForm({...bankForm, bsb: e.target.value})}
                      className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                      placeholder="000-000"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Account Name</label>
                    <input
                      type="text"
                      value={bankForm.accountName}
                      onChange={(e) => setBankForm({...bankForm, accountName: e.target.value})}
                      className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Account Number</label>
                    <input
                      type="text"
                      value={bankForm.accountNumber}
                      onChange={(e) => setBankForm({...bankForm, accountNumber: e.target.value})}
                      className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="bg-surface border border-hairline hover:border-[#D6D9DD] text-ink px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    className="bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                  >
                    Save & Continue
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 4: Review and Generate PDFs */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Review & Generate Progress Payments</h2>
              
              <div className="bg-canvas rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium mb-2">Project Summary</h3>
                <p><strong>Project:</strong> {clientForm.projectName}</p>
                <p><strong>Client:</strong> {clientForm.clientName}</p>
                <p><strong>Total Contract Value:</strong> ${extractedStages.reduce((sum, stage) => sum + stage.amount, 0).toLocaleString()}</p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Progress Payment Stages</h3>
                {extractedStages.map((stage, index) => (
                  <div key={index} className="bg-canvas rounded-lg p-4 border border-hairline">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">Stage {stage.stage}</h4>
                        <p className="text-slate-400 text-sm">{stage.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${stage.amount.toLocaleString()}</p>
                        <p className="text-slate-400 text-sm">{stage.percent}%</p>
                      </div>
                    </div>
                    <button
                      onClick={() => generateProgressPaymentPDF(stage)}
                      className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 text-white px-3 py-1.5 rounded-ot-sm text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Generate PDF
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between mt-6">
                <button
                  onClick={prevStep}
                  className="bg-surface border border-hairline hover:border-[#D6D9DD] text-ink px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                >
                  Previous
                </button>
                <button
                  onClick={saveContractToFirebase}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save Contract
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Saved Contracts Section */}
        {liveHiaContracts.length > 0 && (
          <div className="bg-surface rounded-ot p-6 border border-hairline shadow-whisper">
            <h2 className="text-lg font-semibold text-ink mb-6">Saved HIA contracts</h2>
            <div className="space-y-4">
              {liveHiaContracts.map((contract, index) => (
                <div key={index} className="bg-canvas rounded-lg p-4 border border-hairline">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{contract.projectName}</h3>
                      <p className="text-slate-400 text-sm">Total: ${contract.totalAmount?.toLocaleString()}</p>
                      <p className="text-slate-400 text-sm">{contract.stages?.length || 0} stages</p>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HIAContractPage; 