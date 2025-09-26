// SmartInvoiceOCR utility for extracting invoice fields from OCR text
class SmartInvoiceOCR {
    constructor() {
        this.patterns = {
            amount: {
                total: [
                    /(?:total|balance|amount)\s*(?:due|payable|owed)?\s*:? \s*[$ 0abc]\s*([\d,]+\.?\d*)/gi,
                    /[$ 0abc]\s*([\d,]+\.?\d*)\s*(?:total|due|payable)/gi,
                    /(?:grand\s*total|final\s*amount|net\s*total)\s*:? 0\s*[$ 0abc]?\s*([\d,]+\.?\d*)/gi,
                    /(?:invoice\s*total|total\s*invoice)\s*:? 0\s*[$ 0abc]?\s*([\d,]+\.?\d*)/gi,
                    /(?:amount|total|sum)\s*:? 0\s*[$ 0abc]?\s*([\d,]+\.?\d*)\s*(?:usd|eur|gbp|inr)?/gi,
                    /(?:please\s*pay|payment\s*due)\s*:? 0\s*[$ 0abc]?\s*([\d,]+\.?\d*)/gi,
                    /^\s*[$ 0abc]\s*([\d,]+\.?\d*)\s*$/gm,
                    /(?:subtotal|sub-total)\s*:? 0\s*[$ 0abc]?\s*([\d,]+\.?\d*)/gi
                ],
                exclude: [
                    /(?:invoice\s*#|invoice\s*number|inv\s*no)/i,
                    /(?:po\s*#|po\s*number|purchase\s*order)/i,
                    /(?:tax\s*id|ein|vat|gst)\s*:? 0[\d-]+/i,
                    /(?:phone|tel|fax|mobile)\s*:? 0[\d-]+/i,
                    /(?:zip|postal|postcode)\s*:? 0\d+/i
                ]
            },
            date: {
                formats: [
                    /(?:invoice\s*date|date\s*of\s*invoice|billing\s*date|issued?\s*date?)\s*:? 0(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/gi,
                    /(?:invoice\s*date|date)\s*:? 0(\w+\s+\d{1,2},?\s+\d{2,4})/gi,
                    /(?:invoice\s*date|date)\s*:? 0(\d{1,2}\s+\w+\s+\d{2,4})/gi,
                    /(?:dated?|invoice\s*date)\s*:? 0(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/gi,
                    /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g,
                    /\b(\w{3,9}\s+\d{1,2},?\s+\d{2,4})\b/g,
                    /\b(\d{1,2}\s+\w{3,9}\s+\d{2,4})\b/g
                ],
                dueDate: [
                    /(?:due\s*date|payment\s*due|pay\s*by)\s*:? 0(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/gi,
                    /(?:due\s*date|payment\s*due)\s*:? 0(\w+\s+\d{1,2},?\s+\d{2,4})/gi,
                    /(?:due|payable)\s*(?:on|by)?\s*:? 0(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/gi
                ]
            },
            businessName: {
                patterns: [
                    /(?:from|vendor|supplier|company|business)\s*:? 0([A-Za-z0-9\s&.,'-]+)/gi,
                    /(?:bill\s*from|billed\s*by|invoice\s*from)\s*:? 0([A-Za-z0-9\s&.,'-]+)/gi,
                    /^([A-Z][A-Za-z0-9\s&.,'-]+(?:Inc|LLC|Ltd|Corp|Co|Company|Enterprise|Services|Solutions|Group|Industries).?)/gm,
                    /(?:payable\s*to|make\s*checks?\s*payable\s*to)\s*:? 0([A-Za-z0-9\s&.,'-]+)/gi
                ],
                suffixes: ['Inc', 'LLC', 'Ltd', 'Corp', 'Co', 'Company', 'Enterprise', 'Services', 'Solutions', 'Group', 'Industries', 'Partners', 'Associates', 'Consulting']
            },
            invoiceNumber: {
                patterns: [
                    /(?:invoice\s*#|invoice\s*no|invoice\s*number|inv\s*#|inv\s*no)\s*:? 0([A-Z0-9-]+)/gi,
                    /(?:#|no.?|number)\s*:? 0([A-Z0-9-]+)(?:\s|$)/gi,
                    /\b(INV-\d+|[A-Z]{2,}-\d+)\b/g
                ]
            }
        };
    }

    // Extract all invoice data from text
    extractInvoiceData(text) {
        return {
            amount: this.extractAmount(text),
            date: this.extractDate(text),
            businessName: this.extractBusinessName(text),
            invoiceNumber: this.extractInvoiceNumber(text)
        };
    }

    // Extract amount from text
    extractAmount(text) {
        for (const pattern of this.patterns.amount.total) {
            const match = pattern.exec(text);
            if (match) {
                const amount = match[1];
                // Check if this amount should be excluded
                const shouldExclude = this.patterns.amount.exclude.some(excludePattern => 
                    excludePattern.test(text.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50))
                );
                if (!shouldExclude) {
                    return amount;
                }
            }
        }
        return null;
    }

    // Extract date from text
    extractDate(text) {
        for (const pattern of this.patterns.date.formats) {
            const match = pattern.exec(text);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    // Extract business name from text
    extractBusinessName(text) {
        for (const pattern of this.patterns.businessName.patterns) {
            const match = pattern.exec(text);
            if (match) {
                return match[1].trim();
            }
        }
        return null;
    }

    // Extract invoice number from text
    extractInvoiceNumber(text) {
        for (const pattern of this.patterns.invoiceNumber.patterns) {
            const match = pattern.exec(text);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
}

export default SmartInvoiceOCR; 