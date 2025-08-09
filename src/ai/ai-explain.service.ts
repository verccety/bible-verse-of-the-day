import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiExplainService {
  private readonly logger = new Logger(AiExplainService.name);
  private readonly genAI?: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('GOOGLE_API_KEY');
    if (!key) {
      this.logger.warn('GOOGLE_API_KEY is not set. AI explanations will be disabled.');
      return;
    }
    this.genAI = new GoogleGenerativeAI(key);
  }

  async explain(verseText: string, reference: string): Promise<string> {
    if (!this.genAI) return '';

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
    });

    // Prompt in Russian; keep it respectful, neutral, concise.
    const prompt = [
      'Ты — краткий и уважительный помощник-богослов, который объясняет библейские стихи по-русски.',
      'Дай 2–4 предложения, без богословских споров и доктринальных утверждений.',
      'Сфокусируйся на историко-культурном контексте, ключевой мысли и практическом ободрении.',
      `Стих: ${reference}\nТекст: "${verseText}"\nОбъясни кратко:`,
    ].join('\n\n');

    try {
      const res = await model.generateContent(prompt);
      const out = res.response.text().trim();
      return out;
    } catch (e) {
      this.logger.error('Gemini explanation failed', e as any);
      return '';
    }
  }
}
