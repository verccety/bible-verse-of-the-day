import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class VerseService {
  private readonly logger = new Logger(VerseService.name);
  private readonly bibleVersion = 'rusv'; // Or kjv, esv, etc

 public async getVerseOfTheDay(): Promise<string> {
    try {
      const url = `https://developers.youversion.com/1/verse-of-the-day/1?version=${this.bibleVersion}`;
      const response = await axios.get(url);

      const verseText = response.data.votd.text;

      const message = `📖 *Verse of the Day* ()\n\n_${verseText}_`;
      this.logger.log(`Successfully fetched verse: ${verseText}`);
      return message;
    } catch (error) {
      this.logger.error('Failed to fetch verse of the day', error);
      throw new Error('Could not retrieve the verse of the day.');
    }
  }
}
