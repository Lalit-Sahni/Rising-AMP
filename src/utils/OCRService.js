// OCR Service for Google Cloud Vision API integration
import SmartInvoiceOCR from './SmartInvoiceOCR.js';

class OCRService {
  constructor() {
    this.apiKey = "AIzaSyBbaimImW_JbsUzSVKnw_oLS_WogjeYEzo";
    this.apiEndpoint = "https://vision.googleapis.com/v1/images:annotate";
    this.smartOCR = new SmartInvoiceOCR();
    
    // Enhanced patterns from the user's provided code
    this.patterns = {
      // Date patterns (more comprehensive)
      date: [
        /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
        /(\d{4}[/-]\d{1,2}[/-]\d{1,2})/,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
        /\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i,
      ],
      
      // Amount patterns (more comprehensive)
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
    
    // Industry-specific vendor mappings for better categorization
    this.vendorCategories = {
      'home depot': 'purchase',
      'lowes': 'purchase', 
      'menards': 'purchase',
      'ace hardware': 'purchase',
      'grainger': 'equipment',
      'fastenal': 'purchase',
      'office depot': 'purchase',
      'staples': 'purchase',
      'shell': 'purchase',
      'exxon': 'purchase',
      'chevron': 'purchase',
      'bp': 'purchase'
    };
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

  // Send image to Google Cloud Vision API
  async extractTextFromImage(imageFile) {
    try {
      const base64Image = await this.imageToBase64(imageFile);
      
      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: "DOCUMENT_TEXT_DETECTION", // Better for receipts than TEXT_DETECTION
                maxResults: 1
              }
            ]
          }
        ]
      };

      const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.responses && data.responses[0] && data.responses[0].fullTextAnnotation) {
        const fullText = data.responses[0].fullTextAnnotation.text;
        return this.processExtractedText(fullText);
      } else if (data.responses && data.responses[0] && data.responses[0].textAnnotations) {
        const fullText = data.responses[0].textAnnotations[0].description;
        return this.processExtractedText(fullText);
      } else {
        throw new Error('No text detected in the image');
      }
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw error;
    }
  }

  // Enhanced text processing with better extraction
  processExtractedText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    // Extract data using enhanced patterns
    const extractedData = {
      vendor: this.extractVendor(lines, text),
      date: this.extractDate(text),
      totalAmount: this.extractTotalAmount(text),
      tax: this.extractTax(text),
      subtotal: this.extractSubtotal(text),
      items: this.extractItems(lines),
      phone: this.extractPhone(text),
      address: this.extractAddress(lines),
      rawText: text
    };
    
    // Detect category with enhanced logic
    const category = this.detectCategory(text, extractedData);
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(extractedData);
    
    // Map to form fields
    const formData = this.mapToFormFields(extractedData, category);
    
    return {
      rawText: text,
      category,
      formData,
      confidence,
      extractedData,
      suggestions: this.generateSuggestions(text, extractedData)
    };
  }

  // Enhanced vendor extraction
  extractVendor(lines, fullText) {
    // First try SmartInvoiceOCR
    const smartVendor = this.smartOCR.extractBusinessName(fullText);
    if (smartVendor) return smartVendor;
    
    // Enhanced vendor detection from user's code
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line.length > 3 && line.length < 50 && /^[A-Z]/.test(line)) {
        if (!/receipt|invoice|bill|tax|total|amount/i.test(line)) {
          return line;
        }
      }
    }
    
    // Try patterns
    for (const pattern of this.patterns.vendor) {
      const match = fullText.match(pattern);
      if (match) return match[1].trim();
    }
    
    return null;
  }

  // Enhanced date extraction
  extractDate(text) {
    // Try SmartInvoiceOCR first
    const smartDate = this.smartOCR.extractDate(text);
    if (smartDate) {
      const parsedDate = new Date(smartDate);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    
    // Enhanced date patterns from user's code
    for (const pattern of this.patterns.date) {
      const match = text.match(pattern);
      if (match) {
        const parsedDate = new Date(match[0]);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }
    
    return new Date();
  }

  // Enhanced amount extraction
  extractTotalAmount(text) {
    // Try SmartInvoiceOCR first
    const smartAmount = this.smartOCR.extractAmount(text);
    if (smartAmount) return parseFloat(smartAmount.replace(/[$,]/g, ''));
    
    // Enhanced amount patterns from user's code
    for (const pattern of this.patterns.amount) {
      const matches = text.match(new RegExp(pattern, 'gi'));
      if (matches) {
        const lastMatch = matches[matches.length - 1];
        const amount = lastMatch.match(/\d+\.?\d*/);
        if (amount) {
          return parseFloat(amount[0]);
        }
      }
    }
    
    return null;
  }

  // Extract tax amount
  extractTax(text) {
    for (const pattern of this.patterns.tax) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    return null;
  }

  // Extract subtotal
  extractSubtotal(text) {
    const pattern = /(?:subtotal|sub-total)[:\s]*\$?\s*(\d+\.?\d*)/i;
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  }

  // Extract line items using user's enhanced patterns
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

  // Extract phone number
  extractPhone(text) {
    for (const pattern of this.patterns.phone) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  // Extract address
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

  // Enhanced category detection with vendor mapping
  detectCategory(text, extractedData) {
    const lowerText = text.toLowerCase();
    
    // Check vendor-based categorization first
    if (extractedData.vendor) {
      const vendorLower = extractedData.vendor.toLowerCase();
      for (const [vendor, category] of Object.entries(this.vendorCategories)) {
        if (vendorLower.includes(vendor)) {
          return category;
        }
      }
    }
    
    // Enhanced keyword detection from user's code
    if (lowerText.includes('labour') || lowerText.includes('labor') || 
        lowerText.includes('worker') || lowerText.includes('employee') ||
        lowerText.includes('hour') || lowerText.includes('rate') ||
        lowerText.includes('wage') || lowerText.includes('salary') ||
        lowerText.includes('contractor') || lowerText.includes('consultant') ||
        lowerText.includes('freelance') || lowerText.includes('service') ||
        lowerText.includes('installation') || lowerText.includes('repair') ||
        lowerText.includes('maintenance') || lowerText.includes('technician')) {
      return 'labour';
    }
    
    if (lowerText.includes('equipment') || lowerText.includes('machinery') ||
        lowerText.includes('rental') || lowerText.includes('lease') ||
        lowerText.includes('excavator') || lowerText.includes('crane') ||
        lowerText.includes('bulldozer') || lowerText.includes('loader') ||
        lowerText.includes('tool') || lowerText.includes('machine') ||
        lowerText.includes('device') || lowerText.includes('instrument') ||
        lowerText.includes('apparatus') || lowerText.includes('drill') ||
        lowerText.includes('saw') || lowerText.includes('hammer') ||
        lowerText.includes('wrench') || lowerText.includes('compressor') ||
        lowerText.includes('generator') || lowerText.includes('ladder') ||
        lowerText.includes('scaffold') || lowerText.includes('forklift') ||
        lowerText.includes('truck') || lowerText.includes('vehicle') ||
        lowerText.includes('computer') || lowerText.includes('printer') ||
        lowerText.includes('scanner') || lowerText.includes('monitor') ||
        lowerText.includes('hardware')) {
      return 'equipment';
    }
    
    if (lowerText.includes('electrician') || lowerText.includes('plumber') ||
        lowerText.includes('carpenter') || lowerText.includes('painter') ||
        lowerText.includes('roofer') || lowerText.includes('hvac') ||
        lowerText.includes('concrete') || lowerText.includes('tiling') ||
        lowerText.includes('flooring') || lowerText.includes('trade')) {
      return 'trade';
    }
    
    if (lowerText.includes('service') || lowerText.includes('maintenance') ||
        lowerText.includes('repair') || lowerText.includes('installation') ||
        lowerText.includes('consulting') || lowerText.includes('inspection')) {
      return 'service';
    }
    
    return 'purchase';
  }

  // Enhanced confidence calculation from user's code
  calculateConfidence(extractedData) {
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
      if (extractedData[field] && (Array.isArray(extractedData[field]) ? extractedData[field].length > 0 : true)) {
        score += weight;
      }
    }
    
    return Math.min(score, 100);
  }

  // Enhanced form field mapping - FIXED to handle undefined items
  mapToFormFields(extractedData, category) {
    const formData = {};
    
    // Ensure items array exists
    const items = extractedData.items || [];
    
    switch (category) {
      case 'labour':
        formData.workerName = extractedData.vendor || null;
        formData.rate = extractedData.totalAmount ? (extractedData.totalAmount / 8).toFixed(2) : null;
        formData.hours = '8';
        formData.date = extractedData.date;
        formData.notes = `Invoice: ${extractedData.invoiceNumber || 'N/A'}`;
        if (items.length > 0) {
          formData.notes += ` | Items: ${items.map(item => item.description).join(', ')}`;
        }
        break;
        
      case 'equipment':
        formData.equipmentName = items.length > 0 ? items[0].description : 'Equipment Rental';
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
        formData.task = items.length > 0 ? items[0].description : 'Trade work';
        formData.notes = `Invoice: ${extractedData.invoiceNumber || 'N/A'}`;
        break;
        
      case 'service':
        formData.serviceName = items.length > 0 ? items[0].description : 'Service';
        formData.provider = extractedData.vendor || null;
        formData.cost = extractedData.totalAmount;
        formData.date = extractedData.date;
        formData.notes = `Invoice: ${extractedData.invoiceNumber || 'N/A'}`;
        break;
        
      case 'purchase':
      default:
        formData.itemName = items.length > 0 ? items[0].description : 'Materials';
        formData.supplier = extractedData.vendor || null;
        formData.unitCost = extractedData.totalAmount;
        formData.quantity = '1';
        formData.date = extractedData.date;
        formData.notes = `Invoice: ${extractedData.invoiceNumber || 'N/A'}`;
        if (items.length > 1) {
          formData.notes += ` | Total items: ${items.length}`;
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
  generateSuggestions(text, extractedData) {
    const suggestions = {};
    
    if (extractedData.vendor) {
      suggestions.vendor = {
        value: extractedData.vendor,
        confidence: 85
      };
    }
    
    if (extractedData.totalAmount) {
      suggestions.amount = {
        value: extractedData.totalAmount,
        confidence: 90
      };
    }
    
    if (extractedData.date) {
      suggestions.date = {
        value: extractedData.date,
        confidence: 85
      };
    }
    
    if (extractedData.items && extractedData.items.length > 0) {
      suggestions.items = {
        value: extractedData.items,
        confidence: 75
      };
    }
    
    return suggestions;
  }
}

export default OCRService; 