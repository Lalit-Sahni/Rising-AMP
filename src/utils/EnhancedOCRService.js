// Enhanced OCR Service - Comprehensive Receipt Scanner & Parser System
// This integrates the sophisticated system from the user's provided code
import Tesseract from 'tesseract.js';

class ReceiptOCR {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
  }

  async extractText(imageFile) {
    // Use Google Cloud Vision API if available
    if (this.apiKey) {
      return await this.extractWithCloudVision(imageFile);
    }
    // Fallback to Tesseract.js (client-side)
    return await this.extractWithTesseract(imageFile);
  }

  async extractWithCloudVision(imageFile) {
    const base64Image = await this.fileToBase64(imageFile);
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate?key=' + this.apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image.split(',')[1] },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
        }]
      })
    });
    
    const result = await response.json();
    return result.responses[0].fullTextAnnotation.text;
  }

  async extractWithTesseract(imageFile) {
    // Requires including Tesseract.js in your project
    if (typeof Tesseract !== 'undefined') {
      const result = await Tesseract.recognize(imageFile, 'eng', {
        logger: m => console.log(m)
      });
      return result.data.text;
    } else {
      throw new Error('Tesseract.js not available. Please include the library or use Google Cloud Vision API.');
    }
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
}

class ReceiptParser {
  constructor() {
    // Common receipt patterns
    this.patterns = {
      // Date patterns
      date: [
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
        /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
        /\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i,
      ],
      // Amount patterns
      amount: [
        /(?:total|amount|due|paid|grand total)[:\s]*\$?\s*(\d+\.?\d*)/i,
        /\$\s*(\d+\.?\d*)\s*(?:total|due|paid)/i,
        /(?:sub)?total[:\s]*\$?\s*(\d+\.?\d*)/i,
        /balance[:\s]*\$?\s*(\d+\.?\d*)/i,
      ],
      // Tax patterns
      tax: [
        /(?:tax|vat|gst|hst)[:\s]*\$?\s*(\d+\.?\d*)/i,
        /sales\s+tax[:\s]*\$?\s*(\d+\.?\d*)/i,
      ],
      // Company/Vendor patterns
      vendor: [
        /^([A-Z][A-Za-z\s&,.'()-]+)$/m, // Company name at beginning of receipt
        /(?:from|vendor|merchant|store)[:\s]*([A-Za-z\s&,.'()-]+)/i,
      ],
      // Phone patterns
      phone: [
        /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        /\+\d{1,3}\s?\d{10,14}/,
      ],
      // Address patterns
      address: [
        /\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|plaza|pl|way)/i,
      ],
      // Item/Description patterns
      items: [
        /^(.+?)\s+\$?\s*(\d+\.?\d*)$/gm, // Item description followed by price
        /^(.+?)\s+(\d+)\s+@\s+\$?\s*(\d+\.?\d*)\s+\$?\s*(\d+\.?\d*)$/gm, // Quantity format
      ]
    };
  }

  parse(ocrText) {
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line);
    const receipt = {
      rawText: ocrText,
      vendor: this.extractVendor(lines),
      date: this.extractDate(ocrText),
      totalAmount: this.extractTotalAmount(ocrText),
      tax: this.extractTax(ocrText),
      subtotal: this.extractSubtotal(ocrText),
      items: this.extractItems(lines),
      phone: this.extractPhone(ocrText),
      address: this.extractAddress(lines),
      metadata: {
        confidence: 0,
        extractedAt: new Date().toISOString()
      }
    };

    // Calculate confidence score
    receipt.metadata.confidence = this.calculateConfidence(receipt);
    return receipt;
  }

  extractVendor(lines) {
    // Usually vendor name is in the first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Check if line looks like a company name
      if (line.length > 3 && line.length < 50 && /^[A-Z]/.test(line)) {
        // Exclude common receipt headers
        if (!/receipt|invoice|bill|tax/i.test(line)) {
          return line;
        }
      }
    }
    // Try patterns
    for (const pattern of this.patterns.vendor) {
      const match = lines.join('\n').match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  extractDate(text) {
    for (const pattern of this.patterns.date) {
      const match = text.match(pattern);
      if (match) {
        return this.parseDate(match[0]);
      }
    }
    return null;
  }

  parseDate(dateStr) {
    // Convert various date formats to ISO format
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    // Try manual parsing for common formats
    const formats = [
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY/MM/DD
    ];
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        // Assume MM/DD/YYYY for ambiguous dates
        return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
      }
    }
    return dateStr;
  }

  extractTotalAmount(text) {
    for (const pattern of this.patterns.amount) {
      const matches = text.match(new RegExp(pattern, 'gi'));
      if (matches) {
        // Get the last match (usually the total is at the bottom)
        const lastMatch = matches[matches.length - 1];
        const amount = lastMatch.match(/\d+\.?\d*/);
        if (amount) {
          return parseFloat(amount[0]);
        }
      }
    }
    return null;
  }

  extractTax(text) {
    for (const pattern of this.patterns.tax) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    return null;
  }

  extractSubtotal(text) {
    const pattern = /(?:subtotal|sub-total)[:\s]*\$?\s*(\d+\.?\d*)/i;
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  }

  extractItems(lines) {
    const items = [];
    const pricePattern = /\$?\s*(\d+\.?\d*)$/;
    const quantityPattern = /(\d+)\s*[@x]\s*\$?\s*(\d+\.?\d*)/;

    for (const line of lines) {
      // Skip headers and totals
      if (/total|tax|subtotal|payment|change|cash|credit|debit/i.test(line)) {
        continue;
      }

      // Check for quantity format (e.g., "2 x $5.99")
      const qtyMatch = line.match(quantityPattern);
      if (qtyMatch) {
        const description = line.replace(quantityPattern, '').trim();
        if (description) {
          items.push({
            description,
            quantity: parseInt(qtyMatch[1]),
            unitPrice: parseFloat(qtyMatch[2]),
            totalPrice: parseInt(qtyMatch[1]) * parseFloat(qtyMatch[2])
          });
          continue;
        }
      }

      // Check for simple price format
      const priceMatch = line.match(pricePattern);
      if (priceMatch) {
        const description = line.replace(pricePattern, '').trim();
        if (description && description.length > 2) {
          items.push({
            description,
            quantity: 1,
            unitPrice: parseFloat(priceMatch[1]),
            totalPrice: parseFloat(priceMatch[1])
          });
        }
      }
    }
    return items;
  }

  extractPhone(text) {
    for (const pattern of this.patterns.phone) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  extractAddress(lines) {
    // Look for address in first 10 lines
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      for (const pattern of this.patterns.address) {
        const match = lines[i].match(pattern);
        if (match) {
          // Try to get the full address (current line + next line for city/state/zip)
          let address = lines[i];
          if (i + 1 < lines.length && /\d{5}/.test(lines[i + 1])) {
            address += ', ' + lines[i + 1];
          }
          return address;
        }
      }
    }
    return null;
  }

  calculateConfidence(receipt) {
    let score = 0;
    const weights = {
      vendor: 20,
      date: 20,
      totalAmount: 25,
      items: 20,
      tax: 10,
      address: 5
    };

    for (const [field, weight] of Object.entries(weights)) {
      if (receipt[field] && (Array.isArray(receipt[field]) ? receipt[field].length > 0 : true)) {
        score += weight;
      }
    }
    return score;
  }
}

class ExpenseCategorizer {
  constructor() {
    // Define category rules with keywords and patterns
    this.categories = {
      labour: {
        keywords: ['labor', 'labour', 'wage', 'salary', 'payroll', 'overtime', 'hourly', 'contractor', 'consultant', 'freelance', 'service', 'installation', 'repair', 'maintenance', 'technician', 'electrician', 'plumber', 'carpenter', 'painter', 'mechanic', 'worker', 'employee'],
        patterns: [/\bhours?\b/i, /\bhr\b/i, /\bman[\s-]?hours?\b/i]
      },
      equipment: {
        keywords: ['equipment', 'tool', 'machine', 'device', 'instrument', 'apparatus', 'drill', 'saw', 'hammer', 'wrench', 'compressor', 'generator', 'ladder', 'scaffold', 'crane', 'forklift', 'truck', 'vehicle', 'computer', 'printer', 'scanner', 'monitor', 'hardware'],
        patterns: [/\btool\s*box\b/i, /\bpower\s*tool\b/i]
      },
      material: {
        keywords: ['material', 'supply', 'supplies', 'lumber', 'wood', 'metal', 'steel', 'concrete', 'cement', 'brick', 'tile', 'drywall', 'insulation', 'paint', 'primer', 'stain', 'nail', 'screw', 'bolt', 'wire', 'pipe', 'fitting', 'adhesive', 'glue', 'caulk', 'sealant'],
        patterns: [/\d+\s*(ft|feet|m|meter|yard|sq|square)\b/i, /\bgal(?:lon)?\b/i]
      },
      trade: {
        keywords: ['electrician', 'plumber', 'carpenter', 'painter', 'roofer', 'hvac', 'concrete', 'tiling', 'flooring', 'trade'],
        patterns: [/\btrade\s*work\b/i, /\bcontractor\b/i]
      },
      service: {
        keywords: ['service', 'maintenance', 'repair', 'installation', 'consulting', 'inspection'],
        patterns: [/\bservice\s*charge\b/i, /\bmaintenance\s*fee\b/i]
      },
      purchase: {
        keywords: ['purchase', 'buy', 'order', 'supply', 'material'],
        patterns: [/\bpurchase\s*order\b/i, /\bsupply\s*order\b/i]
      }
    };

    // Industry-specific vendor mappings
    this.vendorCategories = {
      'home depot': 'material',
      'lowes': 'material',
      'menards': 'material',
      'ace hardware': 'material',
      'grainger': 'equipment',
      'fastenal': 'material',
      'office depot': 'purchase',
      'staples': 'purchase',
      'shell': 'purchase',
      'exxon': 'purchase',
      'chevron': 'purchase',
      'bp': 'purchase'
    };
  }

  categorize(receipt) {
    const categories = [];

    // First, check vendor-based categorization
    if (receipt.vendor) {
      const vendorLower = receipt.vendor.toLowerCase();
      for (const [vendor, category] of Object.entries(this.vendorCategories)) {
        if (vendorLower.includes(vendor)) {
          categories.push({ category, confidence: 0.9, reason: `Vendor match: ${vendor}` });
        }
      }
    }

    // Analyze items
    if (receipt.items && receipt.items.length > 0) {
      const itemCategories = receipt.items.map(item => this.categorizeItem(item.description));
      // Find most common category
      const categoryCounts = {};
      itemCategories.forEach(cat => {
        if (cat.category !== 'purchase') {
          categoryCounts[cat.category] = (categoryCounts[cat.category] || 0) + 1;
        }
      });
      if (Object.keys(categoryCounts).length > 0) {
        const dominantCategory = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])[0][0];
        categories.push({
          category: dominantCategory,
          confidence: 0.7,
          reason: 'Item analysis',
          itemBreakdown: itemCategories
        });
      }
    }

    // Analyze full text as fallback
    const textCategory = this.categorizeText(receipt.rawText);
    if (textCategory.category !== 'purchase') {
      categories.push(textCategory);
    }

    // Return best match or purchase if no clear category
    if (categories.length === 0) {
      return { category: 'purchase', confidence: 0.5, reason: 'No clear category match' };
    }

    // Sort by confidence and return best match
    return categories.sort((a, b) => b.confidence - a.confidence)[0];
  }

  categorizeItem(description) {
    if (!description) return { category: 'purchase', confidence: 0 };
    const descLower = description.toLowerCase();
    let bestMatch = { category: 'purchase', confidence: 0, matchedKeywords: [] };

    for (const [category, rules] of Object.entries(this.categories)) {
      let score = 0;
      const matchedKeywords = [];

      // Check keywords
      for (const keyword of rules.keywords) {
        if (descLower.includes(keyword)) {
          score += 1;
          matchedKeywords.push(keyword);
        }
      }

      // Check patterns
      for (const pattern of rules.patterns) {
        if (pattern.test(description)) {
          score += 1.5;
          matchedKeywords.push(`pattern: ${pattern}`);
        }
      }

      if (score > bestMatch.confidence) {
        bestMatch = {
          category,
          confidence: Math.min(score / 3, 1), // Normalize confidence
          matchedKeywords
        };
      }
    }
    return bestMatch;
  }

  categorizeText(text) {
    if (!text) return { category: 'purchase', confidence: 0 };
    const textLower = text.toLowerCase();
    let bestMatch = { category: 'purchase', confidence: 0 };

    for (const [category, rules] of Object.entries(this.categories)) {
      let score = 0;

      // Count keyword occurrences
      for (const keyword of rules.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = textLower.match(regex);
        if (matches) {
          score += matches.length * 0.5;
        }
      }

      // Check patterns
      for (const pattern of rules.patterns) {
        if (pattern.test(text)) {
          score += 2;
        }
      }

      if (score > bestMatch.confidence) {
        bestMatch = {
          category,
          confidence: Math.min(score / 10, 0.8), // Cap at 0.8 for text analysis
          reason: 'Full text analysis'
        };
      }
    }
    return bestMatch;
  }
}

class ReceiptProcessor {
  constructor(options = {}) {
    this.ocr = new ReceiptOCR(options.ocrApiKey);
    this.parser = new ReceiptParser();
    this.categorizer = new ExpenseCategorizer();
    this.enhancers = options.enhancers || [];
  }

  async processReceipt(imageFile) {
    try {
      // Step 1: Extract text from image
      console.log('Extracting text from receipt...');
      const ocrText = await this.ocr.extractText(imageFile);
      if (!ocrText || ocrText.trim().length === 0) {
        throw new Error('No text could be extracted from the image');
      }

      // Step 2: Parse the text
      console.log('Parsing receipt data...');
      const parsedReceipt = this.parser.parse(ocrText);

      // Step 3: Categorize the expense
      console.log('Categorizing expense...');
      const category = this.categorizer.categorize(parsedReceipt);

      // Step 4: Enhance data (optional)
      let enhancedData = { ...parsedReceipt, category };
      for (const enhancer of this.enhancers) {
        enhancedData = await enhancer.enhance(enhancedData);
      }

      // Step 5: Validate and clean data
      const finalData = this.validateAndClean(enhancedData);

      return {
        success: true,
        data: finalData,
        confidence: this.calculateOverallConfidence(finalData)
      };
    } catch (error) {
      console.error('Error processing receipt:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  validateAndClean(data) {
    // Ensure all required fields have valid values
    const cleaned = {
      vendor: data.vendor || 'Unknown Vendor',
      date: data.date || new Date().toISOString().split('T')[0],
      totalAmount: data.totalAmount || this.calculateTotalFromItems(data.items),
      tax: data.tax || 0,
      subtotal: data.subtotal || null,
      category: data.category.category,
      categoryConfidence: data.category.confidence,
      items: data.items || [],
      phone: data.phone || null,
      address: data.address || null,
      metadata: data.metadata
    };

    // Validate amount
    if (cleaned.totalAmount === null || cleaned.totalAmount <= 0) {
      cleaned.totalAmount = 0;
      cleaned.metadata.warnings = cleaned.metadata.warnings || [];
      cleaned.metadata.warnings.push('Total amount could not be determined');
    }

    // Validate date
    if (!this.isValidDate(cleaned.date)) {
      cleaned.date = new Date().toISOString().split('T')[0];
      cleaned.metadata.warnings = cleaned.metadata.warnings || [];
      cleaned.metadata.warnings.push('Date could not be determined, using today\'s date');
    }

    return cleaned;
  }

  calculateTotalFromItems(items) {
    if (!items || items.length === 0) return null;
    return items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  }

  isValidDate(dateStr) {
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && date.getFullYear() > 2000 && date.getFullYear() < 2100;
  }

  calculateOverallConfidence(data) {
    const scores = [
      data.metadata.confidence / 100,
      data.categoryConfidence,
      data.totalAmount > 0 ? 1 : 0,
      this.isValidDate(data.date) ? 1 : 0,
      data.vendor !== 'Unknown Vendor' ? 1 : 0
    ];
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
}

// Enhanced OCR Service - Main class that integrates everything
class EnhancedOCRService {
  constructor() {
    this.apiKey = "AIzaSyBbaimImW_JbsUzSVKnw_oLS_WogjeYEzo";
    this.processor = new ReceiptProcessor({ ocrApiKey: this.apiKey });
  }

  // Convert image to base64
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

  // Main method to extract text and process receipt
  async extractTextFromImage(imageFile) {
    try {
      const result = await this.processor.processReceipt(imageFile);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      const data = result.data;
      
      // Map to form fields compatible with existing app
      const formData = this.mapToFormFields(data);
      
      return {
        rawText: data.rawText,
        category: data.category,
        formData,
        confidence: result.confidence * 100, // Convert to percentage
        extractedData: {
          vendor: data.vendor,
          date: data.date,
          totalAmount: data.totalAmount,
          tax: data.tax,
          subtotal: data.subtotal,
          items: data.items,
          phone: data.phone,
          address: data.address
        },
        suggestions: this.generateSuggestions(data),
        warnings: data.metadata.warnings || []
      };
    } catch (error) {
      console.error('Enhanced OCR extraction failed:', error);
      throw error;
    }
  }

  // Map extracted data to form fields
  mapToFormFields(data) {
    const formData = {};

    switch (data.category) {
      case 'labour':
        formData.workerName = data.vendor || null;
        formData.rate = data.totalAmount ? (data.totalAmount / 8).toFixed(2) : null;
        formData.hours = '8';
        formData.date = data.date;
        formData.notes = `Invoice: ${data.invoiceNumber || 'N/A'}`;
        if (data.items.length > 0) {
          formData.notes += ` | Items: ${data.items.map(item => item.description).join(', ')}`;
        }
        break;

      case 'equipment':
        formData.equipmentName = data.items.length > 0 ? data.items[0].description : 'Equipment Rental';
        formData.dailyCost = data.totalAmount;
        formData.startDate = data.date;
        formData.endDate = data.date;
        formData.notes = `Supplier: ${data.vendor || 'N/A'}`;
        break;

      case 'trade':
        formData.tradeCategory = this.detectTradeCategory(data.rawText);
        formData.tradeName = data.vendor || null;
        formData.amount = data.totalAmount;
        formData.date = data.date;
        formData.task = data.items.length > 0 ? data.items[0].description : 'Trade work';
        formData.notes = `Invoice: ${data.invoiceNumber || 'N/A'}`;
        break;

      case 'service':
        formData.serviceName = data.items.length > 0 ? data.items[0].description : 'Service';
        formData.provider = data.vendor || null;
        formData.cost = data.totalAmount;
        formData.date = data.date;
        formData.notes = `Invoice: ${data.invoiceNumber || 'N/A'}`;
        break;

      case 'material':
      case 'purchase':
      default:
        formData.itemName = data.items.length > 0 ? data.items[0].description : 'Materials';
        formData.supplier = data.vendor || null;
        formData.unitCost = data.totalAmount;
        formData.quantity = '1';
        formData.date = data.date;
        formData.notes = `Invoice: ${data.invoiceNumber || 'N/A'}`;
        if (data.items.length > 1) {
          formData.notes += ` | Total items: ${data.items.length}`;
        }
        break;
    }

    return formData;
  }

  // Detect trade category from text
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

  // Generate suggestions for form fields
  generateSuggestions(data) {
    const suggestions = {};

    if (data.vendor) {
      suggestions.vendor = {
        value: data.vendor,
        confidence: 85
      };
    }

    if (data.totalAmount) {
      suggestions.amount = {
        value: data.totalAmount,
        confidence: 90
      };
    }

    if (data.date) {
      suggestions.date = {
        value: data.date,
        confidence: 85
      };
    }

    if (data.items && data.items.length > 0) {
      suggestions.items = {
        value: data.items,
        confidence: 75
      };
    }

    return suggestions;
  }
}

export default EnhancedOCRService; 