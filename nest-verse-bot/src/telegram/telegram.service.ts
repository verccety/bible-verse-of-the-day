import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { VerseService } from '../verse/verse.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Telegraf;

  constructor(
    private readonly configService: ConfigService,
    private readonly verseService: VerseService, // Inject VerseService
  ) {
    const token = this.configService.get<string>('TG_TOKEN');
    if (!token) {
      throw new Error('TG_TOKEN is not defined in environment variables');
    }
    this.bot = new Telegraf(token);
  }

  async sendDailyVerse() {
    this.logger.log('Preparing to send daily verse...');
    const chatId = this.configService.get<string>('CHAT_ID');
    if (!chatId) {
      this.logger.error('CHAT_ID is not defined. Aborting.');
      return;
    }

    try {
      // Get the formatted verse from our VerseService
      const message = await this.verseService.getVerseOfTheDay();

      // Send the message
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
      });
      this.logger.log(`Successfully sent verse to chat ID: ${chatId}`);
    } catch (error) {
      this.logger.error('Failed to send daily verse', error.stack);
      // Re-throw the error so the GitHub Action knows the script failed
      throw error;
    }
  }
}
