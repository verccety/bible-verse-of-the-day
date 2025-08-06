import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import he from 'he';

@Injectable()
export class VerseService {
  private readonly logger = new Logger(VerseService.name);

  private async fetchVerseForVersion(
    version: string,
  ): Promise<{ content: string; display_ref: string }> {
    const url = `https://www.biblegateway.com/votd/get/?format=json&version=${version}`;
    this.logger.log(
      `Fetching verse from Bible Gateway for version: ${version}`,
    );

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const { content, display_ref } = response.data.votd;
      const decodedVerseText = he.decode(content);
      return { content: decodedVerseText, display_ref };
    } catch (error) {
      this.logger.error(
        `Failed to fetch verse from Bible Gateway for version ${version}`,
        error.stack,
      );
      throw new Error(
        `Could not retrieve the verse of the day for version ${version}.`,
      );
    }
  }

  public async getVerseOfTheDay(): Promise<string> {
    try {
      const [rusvVerse, csbVerse] = await Promise.all([
        this.fetchVerseForVersion('rusv'),
        this.fetchVerseForVersion('csb'),
      ]);

      const dateOptions: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      };
      const currentDate = new Intl.DateTimeFormat('ru-RU', dateOptions).format(
        new Date(),
      );

      const formattedMessage = `📖 **Стих дня**
      🗓 ${currentDate}
      
      ━━━━━━━━━━━━━━━━━━━━
      
      💭 *${rusvVerse.content}*
      
      ━━━━━━━━━━━━━━━━━━━━
      
      🌍 *${csbVerse.content}* (CSB)
      
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
