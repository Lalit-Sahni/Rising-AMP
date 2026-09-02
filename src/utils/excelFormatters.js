import { CELL_STYLES, getCategoryColor, getStatusColor, hexToArgb } from './excelStyles';
import { getExpenseTotal as jobExpenseTotal } from './jobMetrics';
import { dollarsFromUnknown, parseToCents, fromCents } from '../money';

// Helper function to format date for Excel
export const formatDateForExcel = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return date;
  } catch (error) {
    return 'Invalid date';
  }
};

// Helper function to format currency
export const formatCurrency = (amount) => dollarsFromUnknown(amount);

// Helper function to format percentage
export const formatPercentage = (value, total) => {
  if (!total || total === 0) return 0;
  return (value / total) * 100;
};

// Helper function to calculate duration in days
export const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  } catch (error) {
    return 0;
  }
};

export const getExpenseTotal = (expense) => {
  const fromJob = jobExpenseTotal(expense);
  if (fromJob) return fromJob;
  if (expense && expense.category === 'equipment' && expense.dailyCost && expense.startDate && expense.endDate) {
    const start = new Date(expense.startDate);
    const end = new Date(expense.endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    try {
      return fromCents(parseToCents(expense.dailyCost) * days);
    } catch (error) {
      return 0;
    }
  }
  return 0;
};

// Helper function to get expense display name
export const getExpenseDisplayName = (expense) => {
  switch (expense.category) {
    case 'labour':
      return expense.workerName || 'Labour';
    case 'trade':
      return expense.tradeName || expense.trade || 'Trade';
    case 'equipment':
      return expense.equipmentName || 'Equipment';
    case 'purchase':
      return expense.itemName || 'Purchase';
    case 'service':
      return expense.serviceName || 'Service';
    case 'installation':
      return expense.item || 'Installation';
    case 'investor':
      return expense.itemName || expense.serviceName || 'Investor';
    default:
      return expense.category || 'Unknown';
  }
};

// Helper function to apply alternating row colors
export const applyAlternatingRows = (worksheet, startRow, endRow, lightColor, darkColor = null) => {
  for (let row = startRow; row <= endRow; row++) {
    const fillColor = row % 2 === 0 ? lightColor : (darkColor || lightColor);
    const cellStyle = {
      ...CELL_STYLES.data,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(fillColor) } }
    };
    
    // Apply to all columns (assuming A-Z range)
    for (let col = 1; col <= 26; col++) {
      const cell = worksheet.getCell(row, col);
      if (cell.value !== undefined && cell.value !== null) {
        Object.assign(cell, cellStyle);
      }
    }
  }
};

// Helper function to create bordered table
export const createBorderedTable = (worksheet, startRow, endRow, startCol, endCol) => {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getCell(row, col);
      if (cell.value !== undefined && cell.value !== null) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      }
    }
  }
};

// Helper function to set column widths
export const setColumnWidths = (worksheet, columnWidths) => {
  Object.entries(columnWidths).forEach(([column, width]) => {
    worksheet.getColumn(column).width = width;
  });
};

// Helper function to merge cells
export const mergeCells = (worksheet, startRow, endRow, startCol, endCol) => {
  worksheet.mergeCells(startRow, startCol, endRow, endCol);
};

// Helper function to add title row
export const addTitleRow = (worksheet, row, title, category = null) => {
  const cell = worksheet.getCell(row, 1);
  cell.value = title;
  cell.font = CELL_STYLES.title.font;
  cell.alignment = CELL_STYLES.title.alignment;
  
  if (category) {
    cell.fill = { 
      type: 'pattern', 
      pattern: 'solid', 
      fgColor: { argb: hexToArgb(getCategoryColor(category, 'primary')) } 
    };
  } else {
    cell.fill = CELL_STYLES.title.fill;
  }
  
  // Merge across all columns
  const lastCol = 26; // Z column
  mergeCells(worksheet, row, row, 1, lastCol);
};

// Helper function to add header row
export const addHeaderRow = (worksheet, row, headers, category = null) => {
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(row, index + 1);
    cell.value = header;
    cell.font = CELL_STYLES.header.font;
    cell.alignment = CELL_STYLES.header.alignment;
    cell.border = CELL_STYLES.header.border;
    
    if (category) {
      cell.fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: hexToArgb(getCategoryColor(category, 'primary')) } 
      };
    } else {
      cell.fill = CELL_STYLES.header.fill;
    }
  });
};

// Helper function to add data row
export const addDataRow = (worksheet, row, data, styles = {}) => {
  data.forEach((value, index) => {
    const cell = worksheet.getCell(row, index + 1);
    cell.value = value;
    
    // Apply default data style
    Object.assign(cell, CELL_STYLES.data);
    
    // Apply custom styles if provided
    if (styles[index]) {
      Object.assign(cell, styles[index]);
    }
  });
};

// Helper function to add summary row
export const addSummaryRow = (worksheet, row, label, value, isCurrency = false) => {
  const labelCell = worksheet.getCell(row, 1);
  labelCell.value = label;
  Object.assign(labelCell, CELL_STYLES.summary);
  
  const valueCell = worksheet.getCell(row, 2);
  valueCell.value = value;
  Object.assign(valueCell, CELL_STYLES.summary);
  
  if (isCurrency) {
    valueCell.numFmt = CELL_STYLES.currency.numFmt;
  }
};

// Helper function to create category-specific row style
export const createCategoryRowStyle = (category, isAlternating = false) => {
  const baseStyle = { ...CELL_STYLES.data };
  
  if (isAlternating) {
    baseStyle.fill = { 
      type: 'pattern', 
      pattern: 'solid', 
      fgColor: { argb: hexToArgb(getCategoryColor(category, 'light')) } 
    };
  }
  
  return baseStyle;
};

// Helper function to create status-based row style
export const createStatusRowStyle = (status) => {
  const baseStyle = { ...CELL_STYLES.data };
  
  baseStyle.fill = { 
    type: 'pattern', 
    pattern: 'solid', 
    fgColor: { argb: hexToArgb(getStatusColor(status)) } 
  };
  
  return baseStyle;
};

const excelFormatters = {
  formatDateForExcel,
  formatCurrency,
  formatPercentage,
  calculateDuration,
  getExpenseTotal,
  getExpenseDisplayName,
  applyAlternatingRows,
  createBorderedTable,
  setColumnWidths,
  mergeCells,
  addTitleRow,
  addHeaderRow,
  addDataRow,
  addSummaryRow,
  createCategoryRowStyle,
  createStatusRowStyle
};

export default excelFormatters;
