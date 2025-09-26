// Validation utility functions
export const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return null;
};

export const validateEmail = (email) => {
  if (!email) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const validatePhone = (phone) => {
  if (!phone) return null;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
    return 'Please enter a valid phone number';
  }
  return null;
};

export const validateAmount = (amount, fieldName = 'Amount') => {
  if (amount === null || amount === undefined || amount === '') {
    return `${fieldName} is required`;
  }
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    return `${fieldName} must be a valid number`;
  }
  if (numAmount < 0) {
    return `${fieldName} cannot be negative`;
  }
  if (numAmount > 999999999) {
    return `${fieldName} is too large`;
  }
  return null;
};

export const validateDate = (date, fieldName = 'Date') => {
  if (!date) {
    return `${fieldName} is required`;
  }
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return `${fieldName} must be a valid date`;
  }
  const now = new Date();
  if (dateObj > now) {
    return `${fieldName} cannot be in the future`;
  }
  return null;
};

export const validatePercentage = (percentage, fieldName = 'Percentage') => {
  if (percentage === null || percentage === undefined || percentage === '') {
    return `${fieldName} is required`;
  }
  const numPercentage = parseFloat(percentage);
  if (isNaN(numPercentage)) {
    return `${fieldName} must be a valid number`;
  }
  if (numPercentage < 0 || numPercentage > 100) {
    return `${fieldName} must be between 0 and 100`;
  }
  return null;
};

export const validateStringLength = (value, fieldName, minLength = 1, maxLength = 255) => {
  if (!value) return null;
  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  if (value.length > maxLength) {
    return `${fieldName} must be no more than ${maxLength} characters`;
  }
  return null;
};

export const validateExpenseForm = (formData, category) => {
  const errors = {};

  // Common validations
  if (formData.amount !== undefined) {
    const amountError = validateAmount(formData.amount, 'Amount');
    if (amountError) errors.amount = amountError;
  }

  if (formData.date !== undefined) {
    const dateError = validateDate(formData.date, 'Date');
    if (dateError) errors.date = dateError;
  }

  if (formData.supplier !== undefined) {
    const supplierError = validateStringLength(formData.supplier, 'Supplier', 1, 100);
    if (supplierError) errors.supplier = supplierError;
  }

  // Category-specific validations
  switch (category) {
    case 'labour':
      if (formData.workerName) {
        const workerError = validateRequired(formData.workerName, 'Worker name');
        if (workerError) errors.workerName = workerError;
      }
      if (formData.rate !== undefined) {
        const rateError = validateAmount(formData.rate, 'Hourly rate');
        if (rateError) errors.rate = rateError;
      }
      break;

    case 'equipment':
      if (formData.equipmentName) {
        const equipmentError = validateRequired(formData.equipmentName, 'Equipment name');
        if (equipmentError) errors.equipmentName = equipmentError;
      }
      break;

    case 'trade':
      if (formData.tradeName) {
        const tradeError = validateRequired(formData.tradeName, 'Trade name');
        if (tradeError) errors.tradeName = tradeError;
      }
      break;

    case 'service':
      if (formData.serviceName) {
        const serviceError = validateRequired(formData.serviceName, 'Service name');
        if (serviceError) errors.serviceName = serviceError;
      }
      break;

    case 'purchase':
      if (formData.itemName) {
        const itemError = validateRequired(formData.itemName, 'Item name');
        if (itemError) errors.itemName = itemError;
      }
      break;
  }

  return errors;
};

export const validateInvoiceForm = (formData) => {
  const errors = {};

  // Required fields
  const requiredFields = ['invoiceNumber', 'amount', 'date', 'supplier'];
  requiredFields.forEach(field => {
    const error = validateRequired(formData[field], field.charAt(0).toUpperCase() + field.slice(1));
    if (error) errors[field] = error;
  });

  // Amount validation
  if (formData.amount !== undefined) {
    const amountError = validateAmount(formData.amount, 'Amount');
    if (amountError) errors.amount = amountError;
  }

  // Date validation
  if (formData.date !== undefined) {
    const dateError = validateDate(formData.date, 'Date');
    if (dateError) errors.date = dateError;
  }

  // Email validation
  if (formData.email) {
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;
  }

  // Phone validation
  if (formData.phone) {
    const phoneError = validatePhone(formData.phone);
    if (phoneError) errors.phone = phoneError;
  }

  return errors;
};

export const validateHIAContractForm = (formData) => {
  const errors = {};

  // Client details validation
  if (formData.clientName) {
    const clientError = validateRequired(formData.clientName, 'Client name');
    if (clientError) errors.clientName = clientError;
  }

  if (formData.projectName) {
    const projectError = validateRequired(formData.projectName, 'Project name');
    if (projectError) errors.projectName = projectError;
  }

  if (formData.totalAmount !== undefined) {
    const amountError = validateAmount(formData.totalAmount, 'Total amount');
    if (amountError) errors.totalAmount = amountError;
  }

  // Bank details validation
  if (formData.accountName) {
    const accountError = validateRequired(formData.accountName, 'Account name');
    if (accountError) errors.accountName = accountError;
  }

  if (formData.accountNumber) {
    const accountNumError = validateRequired(formData.accountNumber, 'Account number');
    if (accountNumError) errors.accountNumber = accountNumError;
  }

  if (formData.bsb) {
    const bsbError = validateStringLength(formData.bsb, 'BSB', 6, 6);
    if (bsbError) errors.bsb = bsbError;
  }

  return errors;
};

// Helper function to check if form has errors
export const hasErrors = (errors) => {
  return Object.keys(errors).length > 0;
};

// Helper function to get first error message
export const getFirstError = (errors) => {
  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey] : null;
}; 