// OpenAI Vision API Service for Construction Receipt/Invoice OCR
// Uses GPT-4 Vision for superior accuracy on construction documents

import { readReceiptWithAi } from '../firebase/readReceipt';
import { fromCents, parseQuantity, parseToCents } from '../money';

function friendlyAiError(error) {
  const code = (error && error.code) || '';
  const message = (error && error.message) || '';
  if (code === 'functions/unauthenticated') return 'Sign in again to read a receipt.';
  if (code === 'functions/permission-denied') return 'You are not on this organisation.';
  if (code === 'functions/not-found') {
    return 'AI receipt reading is not deployed on this environment yet.';
  }
  if (code === 'functions/failed-precondition') {
    return 'AI receipt reading is not configured yet.';
  }
  if (code === 'functions/invalid-argument') {
    return message.replace(/^FirebaseError:\s*/i, '') || 'That photo could not be sent.';
  }
  if (code === 'functions/deadline-exceeded') return 'The AI read timed out. Try a closer photo.';
  if (message) return message.replace(/^FirebaseError:\s*/i, '');
  return 'Could not read that receipt with AI.';
}

class OpenAIOCRService {
  constructor() {
    this.model = "gpt-4o-mini";
  }

  /**
   * Extract text and data from receipt/invoice image using OpenAI Vision
   * via a Cloud Function. Browsers cannot call api.openai.com directly (CORS),
   * and the key must not live in the client.
   */
  async extractTextFromImage(imageFile) {
    try {
      const content = await readReceiptWithAi(imageFile);
      const extractedData = this.parseAIResponse(content);
      const formData = this.mapToFormFields(extractedData);

      return {
        rawText: extractedData.rawText || '',
        category: extractedData.category,
        formData,
        confidence: extractedData.confidence,
        extractedData,
        aiService: 'OpenAI',
        suggestions: this.generateSuggestions(extractedData),
        warnings: extractedData.warnings || []
      };
    } catch (error) {
      console.error('OpenAI OCR extraction failed:', error);
      throw new Error(friendlyAiError(error));
    }
  }

  /**
   * Parse AI response and validate structure
   * @param {string} content - AI response content
   * @returns {Object} Parsed and validated data
   */
  parseAIResponse(content) {
    try {
      // Clean the response (remove markdown formatting if present)
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/, '').replace(/```\n?$/, '');
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/, '').replace(/```\n?$/, '');
      }

      const parsed = JSON.parse(cleanContent);
      const date = this.parseDate(parsed.date);
      const warnings = Array.isArray(parsed.warnings) ? [...parsed.warnings] : [];
      if (!date) {
        warnings.push('Date could not be read from the receipt');
      }
      if (parsed.totalAmount == null || parsed.totalAmount === '') {
        warnings.push('Total amount could not be determined');
      }

      return {
        vendor: parsed.vendor || null,
        date,
        totalAmount: this.parseAmount(parsed.totalAmount),
        tax: this.parseAmount(parsed.tax),
        subtotal: this.parseAmount(parsed.subtotal),
        invoiceNumber: parsed.invoiceNumber || null,
        items: Array.isArray(parsed.items) ? parsed.items.map(item => ({
          description: item.description || '',
          quantity: parseQuantity(item.quantity) || 1,
          unitPrice: this.parseAmount(item.unitPrice),
          totalPrice: this.parseAmount(item.totalPrice)
        })) : [],
        category: this.validateCategory(parsed.category),
        confidence: typeof parsed.confidence === 'number'
          ? Math.min(Math.max(parsed.confidence, 0), 100)
          : null,
        rawText: parsed.rawText || '',
        warnings
      };

    } catch (error) {
      console.error('Error parsing AI response:', error);
      throw new Error('Failed to parse AI response. The image may be unclear or the AI service may be experiencing issues.');
    }
  }

  /**
   * Parse and validate date
   * @param {string|Date} dateInput - Date input
   * @returns {Date|null} Parsed date or null
   */
  parseDate(dateInput) {
    if (!dateInput) return null;

    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  }

  /**
   * Parse and validate amount
   * @param {number|string} amountInput - Amount input
   * @returns {number|null} Parsed amount or null
   */
  parseAmount(amountInput) {
    if (amountInput === null || amountInput === undefined) return null;
    
    try {
      return fromCents(parseToCents(amountInput));
    } catch {
      return null;
    }
  }

  /**
   * Validate category
   * @param {string} category - Category string
   * @returns {string} Valid category
   */
  validateCategory(category) {
    const validCategories = ['labour', 'trade', 'equipment', 'service', 'purchase'];
    return validCategories.includes(category) ? category : 'purchase';
  }

  /**
   * Map extracted data to form fields
   * @param {Object} extractedData - Parsed AI data
   * @returns {Object} Form field data
   */
  mapToFormFields(extractedData) {
    const formData = {};

    switch (extractedData.category) {
      case 'labour':
        formData.workerName = extractedData.vendor || null;
        formData.rate = extractedData.totalAmount ? (extractedData.totalAmount / 8).toFixed(2) : null;
        formData.hours = '8';
        formData.date = extractedData.date;
        formData.notes = `Invoice: ${extractedData.invoiceNumber || 'N/A'}`;
        if (extractedData.items.length > 0) {
          formData.notes += ` | Items: ${extractedData.items.map(item => item.description).join(', ')}`;
        }
        break;

      case 'equipment':
        formData.equipmentName = extractedData.items.length > 0 ? extractedData.items[0].description : 'Equipment Rental';
        formData.dailyCost = extractedData.totalAmount;
        formData.startDate = extractedData.date;
        formData.endDate = extractedData.date;
        formData.notes = `Supplier: ${extractedData.vendor || 'N/A'}`;
        break;

      case 'trade':
        formData.tradeCategory = this.detectTradeCategory(extractedData.rawText);
        formData.tradeName = extractedData.vendor || null;
        formData.amount = extractedData.totalAmount;
        formData.date = extractedData.date;
        formData.task = extractedData.items.length > 0 ? extractedData.items[0].description : 'Trade work';
        formData.notes = `Invoice: ${extractedData.invoiceNumber || 'N/A'}`;
        break;

      case 'service':
        formData.serviceName = extractedData.items.length > 0 ? extractedData.items[0].description : 'Service';
        formData.provider = extractedData.vendor || null;
        formData.cost = extractedData.totalAmount;
        formData.date = extractedData.date;
        formData.notes = `Invoice: ${extractedData.invoiceNumber || 'N/A'}`;
        break;

      case 'purchase':
      default:
        formData.itemName = extractedData.items.length > 0 ? extractedData.items[0].description : 'Materials';
        formData.supplier = extractedData.vendor || null;
        formData.unitCost = extractedData.totalAmount;
        formData.quantity = '1';
        formData.date = extractedData.date;
        formData.notes = `Invoice: ${extractedData.invoiceNumber || 'N/A'}`;
        if (extractedData.items.length > 1) {
          formData.notes += ` | Total items: ${extractedData.items.length}`;
        }
        break;
    }

    return formData;
  }

  /**
   * Detect trade category from text
   * @param {string} text - Raw text content
   * @returns {string} Trade category
   */
  detectTradeCategory(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('electric') || lowerText.includes('electrical')) return 'Electrician';
    if (lowerText.includes('plumb') || lowerText.includes('pipe')) return 'Plumber';
    if (lowerText.includes('carpent') || lowerText.includes('wood')) return 'Carpenter';
    if (lowerText.includes('paint')) return 'Painter';
    if (lowerText.includes('roof')) return 'Roofer';
    if (lowerText.includes('hvac') || lowerText.includes('heating') || lowerText.includes('cooling')) return 'HVAC';
    if (lowerText.includes('concrete') || lowerText.includes('cement')) return 'Concrete';
    if (lowerText.includes('tile') || lowerText.includes('tiling')) return 'Tiling';
    if (lowerText.includes('floor')) return 'Flooring';

    return 'Other';
  }

  /**
   * Generate suggestions for form fields
   * @param {Object} extractedData - Parsed data
   * @returns {Object} Field suggestions with confidence
   */
  generateSuggestions(extractedData) {
    const suggestions = {};

    if (extractedData.vendor) {
      suggestions.vendor = {
        value: extractedData.vendor,
        confidence: 90
      };
    }

    if (extractedData.totalAmount) {
      suggestions.amount = {
        value: extractedData.totalAmount,
        confidence: 95
      };
    }

    if (extractedData.date) {
      suggestions.date = {
        value: extractedData.date,
        confidence: 90
      };
    }

    if (extractedData.items && extractedData.items.length > 0) {
      suggestions.items = {
        value: extractedData.items,
        confidence: 85
      };
    }

    return suggestions;
  }
}

export default OpenAIOCRService;
