import { CATEGORY_COLORS, CELL_STYLES, hexToArgb } from './excelStyles';
import { 
  formatDateForExcel, 
  formatPercentage, 
  calculateDuration,
  getExpenseTotal, 
  getExpenseDisplayName,
  applyAlternatingRows,
  setColumnWidths,
  addTitleRow,
  addHeaderRow,
  addDataRow,
  mergeCells
} from './excelFormatters';
import { getCategoryColor } from './excelStyles';
import { dollarsFromUnknown, parseQuantity } from '../money';


// Generate summary statistics
const generateSummary = (expenses) => {
  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((sum, expense) => {
    const amount = getExpenseTotal(expense);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const reviewedCount = expenses.filter(e => e.reviewed === true).length;
  const pendingCount = expenses.filter(e => e.reviewed !== true).length;
  
  // Category breakdown
  const categoryBreakdown = {};
  expenses.forEach(expense => {
    const category = expense.category || 'Unknown';
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = { count: 0, amount: 0 };
    }
    categoryBreakdown[category].count++;
    const amount = getExpenseTotal(expense);
    categoryBreakdown[category].amount += isNaN(amount) ? 0 : amount;
  });
  
  return {
    totalExpenses: totalExpenses || 0,
    totalAmount: totalAmount || 0,
    reviewedCount: reviewedCount || 0,
    pendingCount: pendingCount || 0,
    categoryBreakdown
  };
};

// Create Executive Summary Sheet
const createExecutiveSummary = (workbook, summary) => {
  const worksheet = workbook.addWorksheet('Executive Summary');
  
  // Title
  addTitleRow(worksheet, 1, 'Expense Report - Executive Summary');
  
  // Export date
  const dateCell = worksheet.getCell(2, 1);
  dateCell.value = `Generated: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  dateCell.font = { name: 'Arial', size: 12, bold: true };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  mergeCells(worksheet, 2, 2, 1, 4);
  
  // Key Metrics Cards (Row 4)
  const metrics = [
    { label: 'Total Expenses', value: summary.totalExpenses, icon: '📊' },
    { label: 'Total Amount', value: `$${summary.totalAmount.toLocaleString()}`, icon: '💰' },
    { label: 'Reviewed', value: summary.reviewedCount, icon: '✅' },
    { label: 'Pending', value: summary.pendingCount, icon: '⏳' }
  ];
  
  metrics.forEach((metric, index) => {
    const col = index + 1;
    const cell = worksheet.getCell(4, col);
    cell.value = `${metric.icon} ${metric.value}`;
    cell.font = { name: 'Arial', size: 14, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb('#E5E7EB') } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    
    const labelCell = worksheet.getCell(5, col);
    labelCell.value = metric.label;
    labelCell.font = { name: 'Arial', size: 10 };
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  
  // Category Breakdown Table (Row 7)
  const breakdownHeader = worksheet.getCell(7, 1);
  breakdownHeader.value = 'Expense Breakdown by Category';
  breakdownHeader.font = { name: 'Arial', size: 14, bold: true };
  breakdownHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb('#1E3A8A') } };
  breakdownHeader.font.color = { argb: 'FFFFFFFF' };
  mergeCells(worksheet, 7, 7, 1, 5);
  
  // Table headers
  addHeaderRow(worksheet, 8, ['Category', 'Count', 'Amount', 'Percentage', 'Status'], null);
  
  // Category data
  let currentRow = 9;
  Object.entries(summary.categoryBreakdown).forEach(([category, data]) => {
    const percentage = formatPercentage(data.amount, summary.totalAmount);
    const status = data.count > 0 ? 'Active' : 'None';
    
    const rowData = [
      category,
      data.count,
      data.amount,
      percentage,
      status
    ];
    
    addDataRow(worksheet, currentRow, rowData, [
      CELL_STYLES.data,
      CELL_STYLES.number,
      CELL_STYLES.currency,
      CELL_STYLES.percentage,
      CELL_STYLES.data
    ]);
    
    // Apply category color to row
    const categoryColor = getCategoryColor(category, 'light');
    for (let col = 1; col <= 5; col++) {
      const cell = worksheet.getCell(currentRow, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(categoryColor) } };
    }
    
    currentRow++;
  });
  
  // Set column widths
  setColumnWidths(worksheet, {
    A: 15, B: 10, C: 15, D: 12, E: 10
  });
  
  return worksheet;
};

// Create Labour Expenses Sheet
const createLabourSheet = (workbook, labourExpenses) => {
  const worksheet = workbook.addWorksheet('Labour Expenses');
  
  // Title
  addTitleRow(worksheet, 1, 'Labour Expenses', 'labour');
  
  // Summary row
  const totalHours = labourExpenses.reduce((sum, exp) => sum + parseQuantity(exp.hours), 0);
  const totalCost = labourExpenses.reduce((sum, exp) => sum + getExpenseTotal(exp), 0);
  const avgRate = totalHours > 0 ? totalCost / totalHours : 0;
  
  const summaryData = [
    `Total Hours: ${totalHours.toFixed(1)}`,
    `Total Cost: $${totalCost.toLocaleString()}`,
    `Avg Rate: $${avgRate.toFixed(2)}/hr`
  ];
  
  summaryData.forEach((text, index) => {
    const cell = worksheet.getCell(2, index + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 12, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(CATEGORY_COLORS.labour.light) } };
  });
  
  // Headers
  const headers = ['Date', 'Worker Name', 'Role', 'Hours', 'Rate/Hour', 'Total', 'Status', 'Notes'];
  addHeaderRow(worksheet, 4, headers, 'labour');
  
  // Data rows
  let currentRow = 5;
  labourExpenses.forEach(expense => {
    const rowData = [
      formatDateForExcel(expense.date || expense.timestamp),
      expense.workerName || '',
      expense.role || '',
      parseQuantity(expense.hours),
      dollarsFromUnknown(expense.rate),
      getExpenseTotal(expense),
      expense.reviewed ? 'Reviewed' : 'Pending',
      expense.notes || ''
    ];
    
    addDataRow(worksheet, currentRow, rowData, [
      CELL_STYLES.date,
      CELL_STYLES.data,
      CELL_STYLES.data,
      CELL_STYLES.hours,
      CELL_STYLES.currency,
      CELL_STYLES.currency,
      CELL_STYLES.data,
      CELL_STYLES.data
    ]);
    
    currentRow++;
  });
  
  // Apply alternating rows
  applyAlternatingRows(worksheet, 5, currentRow - 1, CATEGORY_COLORS.labour.light);
  
  // Set column widths
  setColumnWidths(worksheet, {
    A: 12, B: 20, C: 15, D: 8, E: 12, F: 12, G: 10, H: 30
  });
  
  return worksheet;
};

// Create Trade Expenses Sheet
const createTradeSheet = (workbook, tradeExpenses) => {
  const worksheet = workbook.addWorksheet('Trade Expenses');
  
  // Title
  addTitleRow(worksheet, 1, 'Trade Expenses', 'trade');
  
  // Summary
  const totalTrades = tradeExpenses.length;
  const totalCost = tradeExpenses.reduce((sum, exp) => sum + getExpenseTotal(exp), 0);
  const avgJobCost = totalTrades > 0 ? totalCost / totalTrades : 0;
  
  const summaryData = [
    `Total Trades: ${totalTrades}`,
    `Total Cost: $${totalCost.toLocaleString()}`,
    `Avg Job Cost: $${avgJobCost.toFixed(2)}`
  ];
  
  summaryData.forEach((text, index) => {
    const cell = worksheet.getCell(2, index + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 12, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(CATEGORY_COLORS.trade.light) } };
  });
  
  // Headers
  const headers = ['Date', 'Trade Name', 'Category', 'Task', 'Amount', 'Status', 'Notes'];
  addHeaderRow(worksheet, 4, headers, 'trade');
  
  // Data rows
  let currentRow = 5;
  tradeExpenses.forEach(expense => {
    const rowData = [
      formatDateForExcel(expense.date || expense.timestamp),
      expense.tradeName || '',
      expense.tradeCategory || '',
      expense.task || '',
      getExpenseTotal(expense),
      expense.reviewed ? 'Reviewed' : 'Pending',
      expense.notes || ''
    ];
    
    addDataRow(worksheet, currentRow, rowData, [
      CELL_STYLES.date,
      CELL_STYLES.data,
      CELL_STYLES.data,
      CELL_STYLES.data,
      CELL_STYLES.currency,
      CELL_STYLES.data,
      CELL_STYLES.data
    ]);
    
    currentRow++;
  });
  
  // Apply alternating rows
  applyAlternatingRows(worksheet, 5, currentRow - 1, CATEGORY_COLORS.trade.light);
  
  // Set column widths
  setColumnWidths(worksheet, {
    A: 12, B: 20, C: 15, D: 25, E: 12, F: 10, G: 30
  });
  
  return worksheet;
};

// Create Equipment Expenses Sheet
const createEquipmentSheet = (workbook, equipmentExpenses) => {
  const worksheet = workbook.addWorksheet('Equipment Expenses');
  
  // Title
  addTitleRow(worksheet, 1, 'Equipment Expenses', 'equipment');
  
  // Summary
  const totalItems = equipmentExpenses.length;
  const totalCost = equipmentExpenses.reduce((sum, exp) => sum + getExpenseTotal(exp), 0);
  const activeRentals = equipmentExpenses.filter(exp => exp.startDate && exp.endDate).length;
  
  const summaryData = [
    `Total Items: ${totalItems}`,
    `Total Cost: $${totalCost.toLocaleString()}`,
    `Active Rentals: ${activeRentals}`
  ];
  
  summaryData.forEach((text, index) => {
    const cell = worksheet.getCell(2, index + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 12, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(CATEGORY_COLORS.equipment.light) } };
  });
  
  // Headers
  const headers = ['Equipment Name', 'Start Date', 'End Date', 'Duration (Days)', 'Daily Rate', 'Total Cost', 'Status', 'Notes'];
  addHeaderRow(worksheet, 4, headers, 'equipment');
  
  // Data rows
  let currentRow = 5;
  equipmentExpenses.forEach(expense => {
    const duration = calculateDuration(expense.startDate, expense.endDate);
    const dailyRate = expense.dailyCost || 0;
    
    const rowData = [
      expense.equipmentName || '',
      formatDateForExcel(expense.startDate),
      formatDateForExcel(expense.endDate),
      duration,
      dailyRate,
      getExpenseTotal(expense),
      expense.reviewed ? 'Reviewed' : 'Pending',
      expense.notes || ''
    ];
    
    addDataRow(worksheet, currentRow, rowData, [
      CELL_STYLES.data,
      CELL_STYLES.date,
      CELL_STYLES.date,
      CELL_STYLES.number,
      CELL_STYLES.currency,
      CELL_STYLES.currency,
      CELL_STYLES.data,
      CELL_STYLES.data
    ]);
    
    currentRow++;
  });
  
  // Apply alternating rows
  applyAlternatingRows(worksheet, 5, currentRow - 1, CATEGORY_COLORS.equipment.light);
  
  // Set column widths
  setColumnWidths(worksheet, {
    A: 20, B: 12, C: 12, D: 12, E: 12, F: 12, G: 10, H: 30
  });
  
  return worksheet;
};

// Create Service Expenses Sheet
const createServiceSheet = (workbook, serviceExpenses) => {
  const worksheet = workbook.addWorksheet('Service Expenses');
  
  // Title
  addTitleRow(worksheet, 1, 'Service Expenses', 'service');
  
  // Summary
  const totalServices = serviceExpenses.length;
  const totalCost = serviceExpenses.reduce((sum, exp) => sum + getExpenseTotal(exp), 0);
  const uniqueProviders = new Set(serviceExpenses.map(exp => exp.provider).filter(Boolean)).size;
  
  const summaryData = [
    `Total Services: ${totalServices}`,
    `Total Cost: $${totalCost.toLocaleString()}`,
    `Unique Providers: ${uniqueProviders}`
  ];
  
  summaryData.forEach((text, index) => {
    const cell = worksheet.getCell(2, index + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 12, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(CATEGORY_COLORS.service.light) } };
  });
  
  // Headers
  const headers = ['Date', 'Service Name', 'Provider', 'Cost', 'Status', 'Notes'];
  addHeaderRow(worksheet, 4, headers, 'service');
  
  // Data rows
  let currentRow = 5;
  serviceExpenses.forEach(expense => {
    const rowData = [
      formatDateForExcel(expense.date || expense.timestamp),
      expense.serviceName || '',
      expense.provider || '',
      getExpenseTotal(expense),
      expense.reviewed ? 'Reviewed' : 'Pending',
      expense.notes || ''
    ];
    
    addDataRow(worksheet, currentRow, rowData, [
      CELL_STYLES.date,
      CELL_STYLES.data,
      CELL_STYLES.data,
      CELL_STYLES.currency,
      CELL_STYLES.data,
      CELL_STYLES.data
    ]);
    
    currentRow++;
  });
  
  // Apply alternating rows
  applyAlternatingRows(worksheet, 5, currentRow - 1, CATEGORY_COLORS.service.light);
  
  // Set column widths
  setColumnWidths(worksheet, {
    A: 12, B: 20, C: 20, D: 12, E: 10, F: 30
  });
  
  return worksheet;
};

// Create Purchase Expenses Sheet
const createPurchaseSheet = (workbook, purchaseExpenses) => {
  const worksheet = workbook.addWorksheet('Materials & Purchases');
  
  // Title
  addTitleRow(worksheet, 1, 'Materials & Purchases', 'purchase');
  
  // Summary
  const totalItems = purchaseExpenses.length;
  const totalQuantity = purchaseExpenses.reduce((sum, exp) => sum + parseQuantity(exp.quantity), 0);
  const totalCost = purchaseExpenses.reduce((sum, exp) => sum + getExpenseTotal(exp), 0);
  
  const summaryData = [
    `Total Items: ${totalItems}`,
    `Total Quantity: ${totalQuantity}`,
    `Total Cost: $${totalCost.toLocaleString()}`
  ];
  
  summaryData.forEach((text, index) => {
    const cell = worksheet.getCell(2, index + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 12, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(CATEGORY_COLORS.purchase.light) } };
  });
  
  // Headers
  const headers = ['Date', 'Item Name', 'Supplier', 'Quantity', 'Unit Cost', 'Total Cost', 'Status', 'Notes'];
  addHeaderRow(worksheet, 4, headers, 'purchase');
  
  // Data rows
  let currentRow = 5;
  purchaseExpenses.forEach(expense => {
    const rowData = [
      formatDateForExcel(expense.date || expense.timestamp),
      expense.itemName || '',
      expense.supplier || '',
      parseQuantity(expense.quantity),
      dollarsFromUnknown(expense.unitCost),
      getExpenseTotal(expense),
      expense.reviewed ? 'Reviewed' : 'Pending',
      expense.notes || ''
    ];
    
    addDataRow(worksheet, currentRow, rowData, [
      CELL_STYLES.date,
      CELL_STYLES.data,
      CELL_STYLES.data,
      CELL_STYLES.number,
      CELL_STYLES.currency,
      CELL_STYLES.currency,
      CELL_STYLES.data,
      CELL_STYLES.data
    ]);
    
    currentRow++;
  });
  
  // Apply alternating rows
  applyAlternatingRows(worksheet, 5, currentRow - 1, CATEGORY_COLORS.purchase.light);
  
  // Set column widths
  setColumnWidths(worksheet, {
    A: 12, B: 20, C: 20, D: 10, E: 12, F: 12, G: 10, H: 30
  });
  
  return worksheet;
};

// Create Installation Expenses Sheet
const createInstallationSheet = (workbook, installationExpenses) => {
  const worksheet = workbook.addWorksheet('Installation Expenses');
  
  // Title
  addTitleRow(worksheet, 1, 'Installation Expenses', 'installation');
  
  // Summary
  const totalInstallations = installationExpenses.length;
  const totalCost = installationExpenses.reduce((sum, exp) => sum + getExpenseTotal(exp), 0);
  
  const summaryData = [
    `Total Installations: ${totalInstallations}`,
    `Total Cost: $${totalCost.toLocaleString()}`
  ];
  
  summaryData.forEach((text, index) => {
    const cell = worksheet.getCell(2, index + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 12, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(CATEGORY_COLORS.installation.light) } };
  });
  
  // Headers
  const headers = ['Date', 'Item', 'Amount', 'Status', 'Notes'];
  addHeaderRow(worksheet, 4, headers, 'installation');
  
  // Data rows
  let currentRow = 5;
  installationExpenses.forEach(expense => {
    const rowData = [
      formatDateForExcel(expense.date || expense.timestamp),
      expense.item || '',
      getExpenseTotal(expense),
      expense.reviewed ? 'Reviewed' : 'Pending',
      expense.notes || ''
    ];
    
    addDataRow(worksheet, currentRow, rowData, [
      CELL_STYLES.date,
      CELL_STYLES.data,
      CELL_STYLES.currency,
      CELL_STYLES.data,
      CELL_STYLES.data
    ]);
    
    currentRow++;
  });
  
  // Apply alternating rows
  applyAlternatingRows(worksheet, 5, currentRow - 1, CATEGORY_COLORS.installation.light);
  
  // Set column widths
  setColumnWidths(worksheet, {
    A: 12, B: 20, C: 12, D: 10, E: 30
  });
  
  return worksheet;
};

// Create Master List Sheet
const createMasterSheet = (workbook, allExpenses) => {
  const worksheet = workbook.addWorksheet('All Expenses');
  
  // Title
  addTitleRow(worksheet, 1, 'Complete Expense Register');
  
  // Headers
  const headers = [
    'Expense ID', 'Date', 'Category', 'Description', 'Amount', 'Status',
    'Worker Name', 'Role', 'Hours', 'Rate',
    'Trade Name', 'Trade Category', 'Task',
    'Equipment Name', 'Start Date', 'End Date',
    'Service Name', 'Provider',
    'Item Name', 'Supplier', 'Quantity', 'Unit Cost',
    'Item', 'Notes'
  ];
  
  addHeaderRow(worksheet, 3, headers, null);
  
  // Data rows
  let currentRow = 4;
  allExpenses.forEach(expense => {
    const rowData = [
      expense.id || '',
      formatDateForExcel(expense.date || expense.timestamp),
      expense.category || '',
      getExpenseDisplayName(expense),
      getExpenseTotal(expense),
      expense.reviewed ? 'Reviewed' : 'Pending',
      expense.workerName || '',
      expense.role || '',
      expense.hours || '',
      expense.rate || '',
      expense.tradeName || '',
      expense.tradeCategory || '',
      expense.task || '',
      expense.equipmentName || '',
      formatDateForExcel(expense.startDate),
      formatDateForExcel(expense.endDate),
      expense.serviceName || '',
      expense.provider || '',
      expense.itemName || '',
      expense.supplier || '',
      expense.quantity || '',
      expense.unitCost || '',
      expense.item || '',
      expense.notes || ''
    ];
    
    addDataRow(worksheet, currentRow, rowData);
    
    // Apply category-based row coloring
    const categoryColor = getCategoryColor(expense.category, 'light');
    for (let col = 1; col <= headers.length; col++) {
      const cell = worksheet.getCell(currentRow, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(categoryColor) } };
    }
    
    currentRow++;
  });
  
  // Set column widths
  setColumnWidths(worksheet, {
    A: 15, B: 12, C: 12, D: 25, E: 12, F: 10,
    G: 20, H: 15, I: 8, J: 10,
    K: 20, L: 15, M: 20,
    N: 20, O: 12, P: 12,
    Q: 20, R: 20,
    S: 20, T: 20, U: 10, V: 12,
    W: 20, X: 30
  });
  
  return worksheet;
};

// Main export function
export const exportExpensesToExcel = async (expenses, filename) => {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'RisingAMP';
    workbook.lastModifiedBy = 'System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const live = (expenses || []).filter((exp) => String(exp.status || '').toLowerCase() !== 'void');
    const summary = generateSummary(live);

    const labourExpenses = live.filter(exp => exp.category === 'labour');
    const tradeExpenses = live.filter(exp => exp.category === 'trade');
    const equipmentExpenses = live.filter(exp => exp.category === 'equipment');
    const serviceExpenses = live.filter(exp => exp.category === 'service');
    const purchaseExpenses = live.filter(exp => exp.category === 'purchase');
    const installationExpenses = live.filter(exp => exp.category === 'installation');

    createExecutiveSummary(workbook, summary);
    createLabourSheet(workbook, labourExpenses);
    createTradeSheet(workbook, tradeExpenses);
    createEquipmentSheet(workbook, equipmentExpenses);
    createServiceSheet(workbook, serviceExpenses);
    createPurchaseSheet(workbook, purchaseExpenses);
    createInstallationSheet(workbook, installationExpenses);
    createMasterSheet(workbook, live);

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Excel export error:', error);
    return { success: false, error: error.message };
  }
};

export default exportExpensesToExcel;