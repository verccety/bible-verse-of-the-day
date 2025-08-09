import { Injectable, Logger } from '@nestjs/common';
import { BibleGatewayService } from '../bible-gateway/bible-gateway.service';
import { AiExplainService } from '../ai/ai-explain.service';

@Injectable()
export class VerseService {
  private readonly logger = new Logger(VerseService.name);

  constructor(
    private readonly bibleGatewayService: BibleGatewayService,
    private readonly aiExplainService: AiExplainService,
  ) {}

  public async getVerseOfTheDay(): Promise<string> {
    try {
      const [rusvVerse, csbVerse] = await Promise.all([
        this.bibleGatewayService.fetchVerse('rusv'),
        this.bibleGatewayService.fetchVerse('csb'),
      ]);

      const dateOptions: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      };
      const currentDate = new Intl.DateTimeFormat('ru-RU', dateOptions).format(
        new Date(),
      );

      // Ask AI for a short Russian explanation of the Russian verse
      let explanation = '';
      try {
        explanation = await this.aiExplainService.explain(
          csbVerse.content,
          csbVerse.display_ref,
        );
      } catch (e) {
        this.logger.warn('AI explanation unavailable, continuing without it');
      }

      const formattedMessage = `📖 **Стих дня**
      🗓 ${currentDate}
      
      ━━━━━━━━━━━━━━━━━━━━
      
      💭 *${rusvVerse.content}*
      
      ━━━━━━━━━━━━━━━━━━━━
      
      🌍 *${csbVerse.content}* 
      ${explanation ? `
      ━━━━━━━━━━━━━━━━━━━━
      
      📝 Краткое объяснение: ${explanation}
      ` : ''}
      
      **— ${rusvVerse.display_ref}**`;

      this.logger.log(
        `Successfully fetched and formatted verses: ${rusvVerse.display_ref}`,
      );
      return formattedMessage;
    } catch (error) {
      this.logger.error(
        'Failed to fetch verses from Bible Gateway',
        error.stack,
      );
      throw new Error('Could not retrieve the verse of the day.');
    }
  }
}
