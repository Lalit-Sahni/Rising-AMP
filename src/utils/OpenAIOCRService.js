// OpenAI Vision API Service for Construction Receipt/Invoice OCR
// Uses GPT-4 Vision for superior accuracy on construction documents

class OpenAIOCRService {
  constructor() {
    this.apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    this.apiEndpoint = "https://api.openai.com/v1/chat/completions";
    // Use a current vision-capable model
    this.model = "gpt-4o-mini";
    
    // Validate API key
    if (!this.apiKey) {
      console.warn('⚠️ OpenAI API key not found. OCR functionality will be limited.');
      console.warn('📝 Please set REACT_APP_OPENAI_API_KEY in your .env.local file.');
    }
  }

  /**
   * Convert image file to base64
   * @param {File} file - Image file
   * @returns {Promise<string>} Base64 encoded image
   */
  async imageToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Extract text and data from receipt/invoice image using OpenAI Vision
   * @param {File} imageFile - Image file to process
   * @returns {Promise<Object>} Extracted data with confidence scores
   */
  async extractTextFromImage(imageFile) {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Convert image to base64
      const base64Image = await this.imageToBase64(imageFile);
      
      // Create the prompt for construction expense extraction
      const prompt = this.createConstructionPrompt();
      
      const requestBody = {
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "high" } }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      };

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI API');
      }

      const content = data.choices[0].message.content;
      
      // Parse the JSON response
      const extractedData = this.parseAIResponse(content);
      
      // Map to form fields
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
      throw error;
    }
  }

  /**
   * Create construction-specific prompt for AI
   * @returns {string} Formatted prompt
   */
  createConstructionPrompt() {
    return `You are an expert at extracting data from construction industry receipts and invoices. 

Analyze this image and extract the following information in JSON format:

{
  "vendor": "Company/supplier name",
  "date": "Date in YYYY-MM-DD format",
  "totalAmount": 123.45,
  "tax": 12.34,
  "subtotal": 111.11,
  "invoiceNumber": "Invoice/Receipt number",
  "items": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 10.00,
      "totalPrice": 10.00
    }
  ],
  "category": "labour|trade|equipment|service|purchase",
  "confidence": 85,
  "rawText": "Full extracted text",
  "warnings": ["Any issues or uncertainties"]
}

CATEGORY RULES:
- "labour": Worker payments, hourly rates, payroll, contractor fees
- "trade": Electrician, plumber, carpenter, painter, roofer, HVAC, concrete work
- "equipment": Tool rentals, machinery, equipment purchases, vehicle rentals
- "service": Maintenance, repairs, consulting, inspections, cleaning
- "purchase": Materials, supplies, lumber, hardware, consumables

CONSTRUCTION-SPECIFIC VENDORS:
- Home Depot, Lowe's, Menards → "purchase" (materials)
- Equipment rental companies → "equipment"
- Trade contractors → "trade"
- Labor/contractor payments → "labour"

IMPORTANT:
1. Be very accurate with amounts and dates
2. Extract ALL line items with quantities and prices
3. Identify the correct category based on content
4. Provide confidence score (0-100) for overall accuracy
5. Include any warnings about unclear text or missing information
6. If you cannot determine something, use null or empty string
7. For handwritten receipts, do your best but note in warnings

Return ONLY the JSON object, no additional text.`;
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
          quantity: parseFloat(item.quantity) || 1,
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
    
    const amount = parseFloat(amountInput);
    return isNaN(amount) ? null : amount;
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

  /**
   * Test API connectivity
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        return false;
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }
}

export default OpenAIOCRService;
