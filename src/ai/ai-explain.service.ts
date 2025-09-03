import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerativeModel,
  type GenerateContentResult,
} from '@google/generative-ai';

@Injectable()
export class AiExplainService {
  private static readonly CONSTANTS = {
    MODEL_PRIMARY: 'gemini-2.5-pro',
    MODEL_FALLBACK: 'gemini-2.5-flash',
    API_KEY_NAME: 'GOOGLE_API_KEY',
    MAX_RETRIES_KEY: 'AI_EXPLAIN_MAX_RETRIES',
    DEFAULT_MAX_RETRIES: 3,
    BASE_DELAY_MS: 500,
    JITTER_MS: 200,
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
  private readonly primary?: GenerativeModel;
  private readonly fallback?: GenerativeModel;
  private readonly maxRetries: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>(
      AiExplainService.CONSTANTS.API_KEY_NAME,
    );
    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_API_KEY is not configured. AI explanations are disabled.',
      );
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const baseModelConfig = {
      // Loosen filters a bit to avoid benign blocks on religious text
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
      // Clear role & constraints (helps prevent “recitation” blocks)
      systemInstruction: this.buildSystemInstruction(),
    } as const;

    this.primary = genAI.getGenerativeModel({
      model: AiExplainService.CONSTANTS.MODEL_PRIMARY,
      ...baseModelConfig,
      safetySettings: [...baseModelConfig.safetySettings], // turns readonly into mutable
    });
    this.fallback = genAI.getGenerativeModel({
      model: AiExplainService.CONSTANTS.MODEL_FALLBACK,
      ...baseModelConfig,
      safetySettings: [...baseModelConfig.safetySettings],
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

  async explain(verseText: string, reference: string): Promise<string> {
    if (!this.primary || !verseText?.trim()) return '';

    // NOTE: Explicitly tell the model not to quote the verse (avoids “recitation” blocks).
    const userPromptBase =
      `Стих: ${reference}\n` +
      `Текст стиха:\n${verseText}\n\n` +
      `Задача: кратко объясни смысл стиха (2–4 предложения) своими словами на русском.\n` +
      `Не цитируй текст из стиха; не приводить дословные фразы длиннее 10 слов подряд.`;

    // Try primary model, then fallback model if needed
    for (const { model, name } of [
      { model: this.primary!, name: '2.5-pro' },
      { model: this.fallback!, name: '2.5-flash' },
    ]) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const result = await model.generateContent(userPromptBase);
          const text = this.extractText(result);
          if (text) return this.sanitize(text);

          // Log deep diagnostics if empty
          this.logDiagnostics(
            result,
            `${name} attempt ${attempt} produced empty text`,
          );
          // If prompt was blocked for “RECITATION” or similar, append an extra guard and retry immediately.
          if (this.wasRecitationBlocked(result)) {
            const amended =
              userPromptBase +
              '\nПожалуйста, перефразируй своими словами, без цитирования и ссылок.';
            const retried = await model.generateContent(amended);
            const t2 = this.extractText(retried);
            if (t2) return this.sanitize(t2);
            this.logDiagnostics(retried, `${name} recitation-retry also empty`);
          }

          // No text — throw to trigger backoff
          throw new Error('Empty candidates');
        } catch (error: any) {
          if (attempt >= this.maxRetries) {
            this.logger.error(
              `AI explanation failed on ${name} after ${this.maxRetries} attempts: ${error?.message || error}`,
            );
            break;
          }
          this.logger.warn(
            `AI explanation ${name} attempt ${attempt} failed: ${error?.message || error}. Retrying...`,
          );
          await this.sleep(this.calculateBackoffDelay(attempt));
        }
      }
    }
    return '';
  }

  private buildSystemInstruction(): string {
    return [
      'Ты — краткий и уважительный помощник-богослов, который объясняет библейские стихи по-русски.',
      'Напиши 2–4 предложения. Сразу переходи к сути, без приветствий и вступлений.',
      'Не используй списки, эмодзи, Markdown. Не давай выводов вроде «надеюсь, это помогло».',
      'Пиши только своими словами, не цитируй входной текст; не воспроизводи длинные фрагменты.',
      'Сфокусируйся на историко-культурном контексте (если уместно), ключевой мысли и практическом выводе.',
    ].join(' ');
  }

  private extractText(res: GenerateContentResult): string {
    // 1) normal path
    try {
      const t = res?.response?.text?.();
      if (t) return t;
    } catch {
      /* ignore */
    }

    // 2) fallback to first candidate parts
    const cands = res?.response?.candidates ?? [];
    for (const c of cands) {
      const parts = c?.content?.parts ?? [];
      const t = parts
        .map((p: any) => p?.text ?? '')
        .join('\n')
        .trim();
      if (t) return t;
    }
    return '';
  }

  private wasRecitationBlocked(res: GenerateContentResult): boolean {
    const pf = (res as any)?.response?.promptFeedback;
    const block = pf?.blockReason?.toString()?.toUpperCase?.() || '';
    // Some SDKs surface “RECITATION” in candidate safety ratings instead
    const ratings = (
      (res as any)?.response?.candidates?.[0]?.safetyRatings ?? []
    ).map((r: any) => r?.category || '');
    return (
      block.includes('RECITATION') ||
      ratings.join('|').toUpperCase().includes('RECITATION')
    );
  }

  private logDiagnostics(res: GenerateContentResult, msg: string) {
    try {
      const pf = (res as any)?.response?.promptFeedback;
      const cand0 = (res as any)?.response?.candidates?.[0];
      this.logger.warn(
        `${msg}. promptFeedback=${JSON.stringify(pf)} finishReason=${cand0?.finishReason} safety=${JSON.stringify(cand0?.safetyRatings)}`,
      );
    } catch {
      // swallow
    }
  }

  private sanitize(text: string): string {
    if (!text) return '';
    const P = AiExplainService.CONSTANTS.SANITIZE_PATTERNS;
    const sanitized = text
      .trim()
      .replace(P.LEADING_PHRASES, '')
      .replace(P.TRAILING_PHRASES, '')
      .replace(P.STRIP_QUOTES, '$1')
      .replace(P.EXCESS_WHITESPACE, ' ')
      .trim();
    return /^[\s.,!?:]*$/.test(sanitized) ? '' : sanitized;
  }

  private calculateBackoffDelay(attempt: number): number {
    const { BASE_DELAY_MS, JITTER_MS } = AiExplainService.CONSTANTS;
    return (
      BASE_DELAY_MS * (1 << (attempt - 1)) +
      Math.floor(Math.random() * JITTER_MS)
    );
  }
  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
