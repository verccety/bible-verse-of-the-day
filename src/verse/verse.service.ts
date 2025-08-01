import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

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
      // THE FIX IS HERE: Add a headers object to the axios call
      const response = await axios.get(url, {
        headers: {
          // This header makes our request look like it's coming from a real browser
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const { text: content } = response.data.votd;

      if (!content ) {
        throw new Error('Invalid response structure from Bible Gateway API.');
      }

      const formattedMessage = `📖 **Verse of the Day** ($)\n\n*${content}*`;

      this.logger.log(
        `Successfully fetched and formatted verse: ${content}`,
      );
      return formattedMessage;
    } catch (error) {
      this.logger.error(
        'Failed to fetch verse from Bible Gateway',
        error.stack,
      );
      throw new Error(
        'Could not retrieve the verse of the day from Bible Gateway.',
      );
    }
  }
}
