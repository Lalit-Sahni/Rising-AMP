// Calculation utility functions

// Expense calculations
export const calculateTotalExpenses = (expenses) => {
  if (!expenses || !Array.isArray(expenses)) return 0;
  return expenses.reduce((total, expense) => total + (expense.amount || 0), 0);
};

export const calculateExpensesByCategory = (expenses) => {
  if (!expenses || !Array.isArray(expenses)) return {};
  
  return expenses.reduce((acc, expense) => {
    const category = expense.category || 'other';
    acc[category] = (acc[category] || 0) + (expense.amount || 0);
    return acc;
  }, {});
};

export const calculateExpensesByMonth = (expenses) => {
  if (!expenses || !Array.isArray(expenses)) return {};
  
  return expenses.reduce((acc, expense) => {
    const date = new Date(expense.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[monthKey] = (acc[monthKey] || 0) + (expense.amount || 0);
    return acc;
  }, {});
};

export const calculateBudgetRemaining = (budget, expenses) => {
  const totalExpenses = calculateTotalExpenses(expenses);
  return Math.max(0, budget - totalExpenses);
};

export const calculateBudgetPercentage = (budget, expenses) => {
  if (!budget || budget === 0) return 0;
  const totalExpenses = calculateTotalExpenses(expenses);
  return Math.min(100, (totalExpenses / budget) * 100);
};

// Invoice calculations
export const calculateTotalInvoices = (invoices) => {
  if (!invoices || !Array.isArray(invoices)) return 0;
  return invoices.reduce((total, invoice) => total + (invoice.amount || 0), 0);
};

export const calculatePaidInvoices = (invoices) => {
  if (!invoices || !Array.isArray(invoices)) return 0;
  return invoices
    .filter(invoice => invoice.status === 'paid')
    .reduce((total, invoice) => total + (invoice.amount || 0), 0);
};

export const calculateOutstandingInvoices = (invoices) => {
  if (!invoices || !Array.isArray(invoices)) return 0;
  return invoices
    .filter(invoice => invoice.status === 'pending' || invoice.status === 'overdue')
    .reduce((total, invoice) => total + (invoice.amount || 0), 0);
};

export const calculateInvoiceStats = (invoices) => {
  if (!invoices || !Array.isArray(invoices)) {
    return {
      total: 0,
      paid: 0,
      outstanding: 0,
      overdue: 0,
      count: 0,
      paidCount: 0,
      outstandingCount: 0,
      overdueCount: 0
    };
  }

  const stats = invoices.reduce((acc, invoice) => {
    acc.total += invoice.amount || 0;
    acc.count += 1;

    if (invoice.status === 'paid') {
      acc.paid += invoice.amount || 0;
      acc.paidCount += 1;
    } else if (invoice.status === 'overdue') {
      acc.outstanding += invoice.amount || 0;
      acc.overdue += invoice.amount || 0;
      acc.outstandingCount += 1;
      acc.overdueCount += 1;
    } else if (invoice.status === 'pending') {
      acc.outstanding += invoice.amount || 0;
      acc.outstandingCount += 1;
    }

    return acc;
  }, {
    total: 0,
    paid: 0,
    outstanding: 0,
    overdue: 0,
    count: 0,
    paidCount: 0,
    outstandingCount: 0,
    overdueCount: 0
  });

  return stats;
};

// HIA Contract calculations
export const calculateContractTotal = (stages) => {
  if (!stages || !Array.isArray(stages)) return 0;
  return stages.reduce((total, stage) => total + (stage.amount || 0), 0);
};

export const calculateContractPercentage = (stages) => {
  if (!stages || !Array.isArray(stages)) return 0;
  return stages.reduce((total, stage) => total + (stage.percent || 0), 0);
};

export const calculateStageAmount = (totalContractValue, percentage) => {
  return (totalContractValue * percentage) / 100;
};

export const calculateStagePercentage = (stageAmount, totalContractValue) => {
  if (!totalContractValue || totalContractValue === 0) return 0;
  return (stageAmount / totalContractValue) * 100;
};

// Progress Payment calculations
export const calculateTotalProgressPayments = (payments) => {
  if (!payments || !Array.isArray(payments)) return 0;
  return payments.reduce((total, payment) => total + (payment.amount || 0), 0);
};

export const calculateProgressPaymentPercentage = (payments, contractTotal) => {
  if (!contractTotal || contractTotal === 0) return 0;
  const totalPayments = calculateTotalProgressPayments(payments);
  return Math.min(100, (totalPayments / contractTotal) * 100);
};

// Date calculations
export const getDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getMonthsBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
};

export const isOverdue = (dueDate) => {
  const today = new Date();
  const due = new Date(dueDate);
  return due < today;
};

export const getDaysOverdue = (dueDate) => {
  if (!isOverdue(dueDate)) return 0;
  return getDaysBetween(dueDate, new Date());
};

// Financial calculations
export const calculateTax = (amount, taxRate = 10) => {
  return (amount * taxRate) / 100;
};

export const calculateSubtotal = (amount, taxRate = 10) => {
  return amount / (1 + taxRate / 100);
};

export const calculateTotalWithTax = (subtotal, taxRate = 10) => {
  return subtotal + calculateTax(subtotal, taxRate);
};

export const formatCurrency = (amount, currency = 'AUD') => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
};

// Statistical calculations
export const calculateAverage = (values) => {
  if (!values || !Array.isArray(values) || values.length === 0) return 0;
  const sum = values.reduce((total, value) => total + (value || 0), 0);
  return sum / values.length;
};

export const calculateMedian = (values) => {
  if (!values || !Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

export const calculateVariance = (values) => {
  if (!values || !Array.isArray(values) || values.length === 0) return 0;
  const mean = calculateAverage(values);
  const squaredDiffs = values.map(value => Math.pow((value || 0) - mean, 2));
  return calculateAverage(squaredDiffs);
};

export const calculateStandardDeviation = (values) => {
  return Math.sqrt(calculateVariance(values));
};

// Utility functions
export const roundToDecimals = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

export const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

export const isNumeric = (value) => {
  return !isNaN(parseFloat(value)) && isFinite(value);
}; 