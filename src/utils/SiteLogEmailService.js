// Site Log Email Generator using the same OpenAI API key as the OCR service

class SiteLogEmailService {
  constructor() {
    this.apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o-mini';

    if (!this.apiKey) {
      console.warn('⚠️ OpenAI API key not found. Site log email generation will be disabled.');
      console.warn('📝 Please set REACT_APP_OPENAI_API_KEY in your .env.local file.');
    }
  }

  /**
   * Generate a simple email draft (subject + body) for a site log entry.
   * The email is intentionally plain, factual, and based ONLY on provided data.
   *
   * @param {Object} log - Site log entry
   * @param {string} log.company
   * @param {string} log.serviceType
   * @param {string|Date} log.date
   * @param {string} log.comments
   * @param {Array<{url?: string}>} log.images
   * @returns {Promise<{subject: string, body: string}>}
   */
  async generateEmailFromSiteLog(log) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      company = '',
      serviceType = '',
      date,
      comments = '',
      images = []
    } = log || {};

    const isoDate = this.normaliseDate(date);
    const imageUrls = images
      .map((img) => (typeof img === 'string' ? img : img?.url))
      .filter(Boolean);

    const promptPayload = {
      company,
      serviceType,
      date: isoDate,
      comments,
      imageUrls
    };

    const instructions = `You are helping write a brief, professional email summarising a construction site log entry.

STRICT RULES:
- Use ONLY the information provided in the JSON below.
- Do NOT invent or assume extra details (names, addresses, contractual terms, promises, dates, times, quantities, safety issues, etc.).
- Keep the tone neutral and factual, not salesy.
- Keep the body short (3–6 sentences), clear and easy to skim.
- Mention that photos are attached or linked if imageUrls are present, but do not describe their content beyond "photos" or "images".
- If some fields are missing or empty, simply omit them from the email instead of guessing.

Return your answer as pure JSON with this exact shape:
{
  "subject": "one line email subject",
  "body": "multi-line email body"
}

Here is the site log data as JSON:
${JSON.stringify(promptPayload, null, 2)}`;

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: instructions
        }
      ],
      max_tokens: 400,
      temperature: 0.2
    };

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI email generation failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Invalid response from OpenAI when generating email');
    }

    const parsed = this.parseEmailResponse(content);

    // Ensure body is a string
    let body = parsed.body || '';

    // If we have image URLs, append a simple list so they can be copied into the email
    if (Array.isArray(promptPayload.imageUrls) && promptPayload.imageUrls.length > 0) {
      const lines = [
        body.trim(),
        '',
        'Photos:',
        ...promptPayload.imageUrls.map((url, index) => `${index + 1}. ${url}`)
      ];
      body = lines.filter(Boolean).join('\n');
    }

    return {
      subject: parsed.subject || 'Site log update',
      body
    };
  }

  /**
   * Normalise various date inputs into an ISO yyyy-mm-dd string if possible.
   */
  normaliseDate(value) {
    if (!value) return null;

    try {
      // Firestore Timestamp
      if (value.toDate && typeof value.toDate === 'function') {
        const dt = value.toDate();
        return isNaN(dt.getTime()) ? null : dt.toISOString().split('T')[0];
      }

      // JS Date
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
      }

      const dt = new Date(value);
      return isNaN(dt.getTime()) ? null : dt.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  /**
   * Parse the model's response which should be JSON, but may be wrapped in markdown fences.
   */
  parseEmailResponse(content) {
    let clean = content.trim();

    if (clean.startsWith('```json')) {
      clean = clean.replace(/```json\s*/i, '').replace(/```$/, '').trim();
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/```\s*/i, '').replace(/```$/, '').trim();
    }

    try {
      const parsed = JSON.parse(clean);
      return {
        subject: typeof parsed.subject === 'string' ? parsed.subject : '',
        body: typeof parsed.body === 'string' ? parsed.body : ''
      };
    } catch (error) {
      console.error('Failed to parse email JSON from OpenAI:', error, 'Raw content:', content);
      throw new Error('Failed to parse email draft from AI response');
    }
  }
}

export default SiteLogEmailService;

