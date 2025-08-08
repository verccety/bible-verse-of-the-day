import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import he from 'he';
import { htmlToText } from 'html-to-text';

@Injectable()
export class BibleGatewayService {
  private readonly logger = new Logger(BibleGatewayService.name);

  constructor(private readonly httpService: HttpService) {}

  async fetchVerse(version: string): Promise<{ content: string; display_ref: string }> {
    const url = `https://www.biblegateway.com/votd/get/?format=json&version=${version}`;
    this.logger.log(`Fetching verse from Bible Gateway for version: ${version}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        })
      );

      const { content, display_ref } = response.data.votd;
      const decodedVerseText = he.decode(content);
      const plainText = htmlToText(decodedVerseText, {
        wordwrap: false,
      });
      return { content: plainText, display_ref };
    } catch (error) {
      this.logger.error(
        `Failed to fetch verse from Bible Gateway for version ${version}`,
        error.stack,
      );
      throw new Error(`Could not retrieve the verse of the day for version ${version}.`);
    }
  }
}
