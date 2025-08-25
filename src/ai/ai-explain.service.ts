import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from '@google/generative-ai';

@Injectable()
export class AiExplainService {
  // 1. All static configuration is centralized here for clarity and maintainability.
  private static readonly CONSTANTS = {
    // Model and API settings
    MODEL_NAME: 'gemini-2.5-pro', // A fast, cost-effective, and capable model
    API_KEY_NAME: 'GOOGLE_API_KEY',
    MAX_RETRIES_KEY: 'AI_EXPLAIN_MAX_RETRIES',

    // Default values for retry logic
    DEFAULT_MAX_RETRIES: 3,
    BASE_DELAY_MS: 500,
    JITTER_MS: 200,

    // Pre-compiled, powerful regexes for sanitization
    SANITIZE_PATTERNS: {
      STRIP_QUOTES: /^[“"«]\s*([\s\S]*?)\s*[”"»]$/u,
      LEADING_PHRASES:
        /^(?:(?:конечно|итак|давайте|здравствуйте|привет|добрый\s+(?:день|вечер|утро)|вкратце|кратко|разумеется|действительно|несомненно|важно\s+отметить\s*,?\s+что)[,!\s\-—:]*)+/i,
      TRAILING_PHRASES:
        /\s*(?:надеюсь,?\s+это\s+помогло\.?|будем\s+помнить\.?|в\s+заключени[еи][,.\s].*)?$/i,
      EXCESS_WHITESPACE: /\s+/g,
    },
  };

  private readonly logger = new Logger(AiExplainService.name);
  private readonly model?: GenerativeModel;
  private readonly maxRetries: number;

  constructor(private readonly config: ConfigService) {
    const apiKey: string | undefined = this.config.get<string>(
      AiExplainService.CONSTANTS.API_KEY_NAME,
    );

    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_API_KEY is not configured. AI explanations are disabled.',
      );
      return;
    }

    // 2. The model is initialized once for efficiency.
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: AiExplainService.CONSTANTS.MODEL_NAME,
      // 3. System instruction cleanly separates the AI's role from the prompt.
      systemInstruction: this.buildSystemInstruction(),
      // 4. Generation config ensures concise and consistent responses.
      generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
    });

    const retries = parseInt(
      this.config.get<string>(AiExplainService.CONSTANTS.MAX_RETRIES_KEY) ??
        String(AiExplainService.CONSTANTS.DEFAULT_MAX_RETRIES),
      10,
    );
    this.maxRetries =
      !isNaN(retries) && retries > 0
        ? retries
        : AiExplainService.CONSTANTS.DEFAULT_MAX_RETRIES;
  }

  /**
   * Generates a concise theological explanation for a Bible verse.
   * Retries on failure with exponential backoff and jitter.
   * @returns The explanation, or an empty string if disabled or failed.
   */
  async explain(verseText: string, reference: string): Promise<string> {
    if (!this.model || !verseText?.trim()) {
      return '';
    }

    const userPrompt = `Стих: ${reference}\nТекст: "${verseText}"\nДай краткое объяснение:`;

    // 5. Retry loop is clean, with error handling logic separated.
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(userPrompt);
        const explanation = this.sanitize(result.response.text());

        if (explanation) {
          return explanation;
        }
        console.log('response text:', result.response.text());
        throw new Error('AI returned an empty or invalid explanation.');
      } catch (error) {
        if (attempt >= this.maxRetries) {
          this.logger.error(
            `AI explanation failed after ${this.maxRetries} attempts: ${error.message}`,
          );
          break; // Exit loop after final failure
        }

        this.logger.warn(
          `AI explanation attempt ${attempt} failed: ${error.message}. Retrying...`,
        );
        const delay = this.calculateBackoffDelay(attempt);
        await this.sleep(delay);
      }
    }

    return '';
  }

  private buildSystemInstruction(): string {
    return [
      'Ты — краткий и уважительный помощник-богослов, который объясняет библейские стихи по-русски.',
      'Напиши 2–4 предложения. Сразу перейди к сути без приветствий, обращений, вступлений и фраз типа «конечно», «давайте», «итак».',
      'Избегай эмодзи и Markdown-разметки. Не используй списки. Не добавляй заключений вроде «надеюсь, это помогло».',
      'Сфокусируйся на историко-культурном контексте (если уместно), ключевой мысли и практическом ободрении.',
    ].join(' '); // A single space is sufficient here
  }

  /**
   * Cleans raw AI output using a series of efficient regex replacements.
   */
  private sanitize(text: string): string {
    if (!text) return '';

    const { SANITIZE_PATTERNS } = AiExplainService.CONSTANTS;

    // 6. A fluent chain of replacements is readable and efficient.
    const sanitizedText = text
      .trim()
      .replace(SANITIZE_PATTERNS.LEADING_PHRASES, '')
      .replace(SANITIZE_PATTERNS.TRAILING_PHRASES, '')
      .replace(SANITIZE_PATTERNS.STRIP_QUOTES, '$1')
      .replace(SANITIZE_PATTERNS.EXCESS_WHITESPACE, ' ')
      .trim();

    // Final check to ensure the result isn't just leftover punctuation.
    return /^[\s.,!?:]*$/.test(sanitizedText) ? '' : sanitizedText;
  }

  /**
   * Calculates exponential backoff delay with jitter.
   */
  private calculateBackoffDelay(attempt: number): number {
    const { BASE_DELAY_MS, JITTER_MS } = AiExplainService.CONSTANTS;
    // Using bit-shift for powers of 2 is clean and fast.
    const exponential = BASE_DELAY_MS * (1 << (attempt - 1));
    const jitter = Math.floor(Math.random() * JITTER_MS);
    return exponential + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
