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

      // Destructure the two fields we need from the API response
      const { content, display_ref } = response.data.votd;

      // 1. The 'display_ref' is already clean, so we use it directly.
      const verseReference = display_ref;

      // 2. The 'content' has HTML entities, so we decode it.
      const decodedVerseText = he.decode(content);

      // 3. Construct the final message with the clean parts.
      const formattedMessage = `📖 **Verse of the Day** (${verseReference})\n\n*${decodedVerseText}*`;

      this.logger.log(
        `Successfully fetched and formatted verse: ${verseReference}`,
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
