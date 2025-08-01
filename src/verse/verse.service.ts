import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import he from 'he';

@Injectable()
export class VerseService {
  private readonly logger = new Logger(VerseService.name);
  private readonly bibleVersion = 'rusv'; // Or kjv, esv, etc

  public async getVerseOfTheDay(): Promise<string> {
    const url = `https://www.biblegateway.com/votd/get/?format=json&version=${this.bibleVersion}`;
    this.logger.log(
      `Fetching verse from Bible Gateway for version: ${this.bibleVersion}`,
    );

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const { content, display_ref } = response.data.votd;

      // 1. Decode the verse text
      const decodedVerseText = he.decode(content);

      // 2. Format the current date in Russian
      // This will produce a string like "1 августа 2025 г."
      const dateOptions: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      };
      const currentDate = new Intl.DateTimeFormat('ru-RU', dateOptions).format(
        new Date(),
      );

      // 3. Construct the final, beautifully formatted message
      const formattedMessage = `📖 **Стих дня** • *${currentDate}*
──────────────────

*${decodedVerseText}*
**— ${display_ref}**`;

      this.logger.log(
        `Successfully fetched and formatted verse: ${display_ref}`,
      );
      return formattedMessage;
    } catch (error) {
      this.logger.error(
        'Failed to fetch verse from Bible Gateway',
        error.stack,
      );
      throw new Error('Could not retrieve the verse of the day.');
    }
  }
}
