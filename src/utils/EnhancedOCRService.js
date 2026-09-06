import OpenAIOCRService from './OpenAIOCRService.js';

class EnhancedOCRService {
  constructor() {
    this.openAIService = new OpenAIOCRService();
  }

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

  // OpenAI only. Do not fall back to Google Vision or Tesseract — those
  // produce a fake "read" when AI is down. Show an error instead.
  async extractTextFromImage(imageFile) {
    try {
      const result = await this.openAIService.extractTextFromImage(imageFile);
      result.aiService = 'OpenAI';
      result.imageFile = imageFile;
      return result;
    } catch (error) {
      const message = (error && error.message) || 'Could not read that receipt with AI.';
      throw new Error(message);
    }
  }

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
