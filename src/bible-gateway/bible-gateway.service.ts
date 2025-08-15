import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import he from 'he';
import { htmlToText } from 'html-to-text';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BibleGatewayService {
  private readonly logger = new Logger(BibleGatewayService.name);

  constructor(private readonly httpService: HttpService) {}

  async fetchVerse(
    version: string,
  ): Promise<{ content: string; display_ref: string }> {
    const url = `https://www.biblegateway.com/votd/get/?format=json&version=${version}`;
    this.logger.log(
      `Fetching verse from Bible Gateway for version: ${version}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        }),
      );

      const { display_ref } = response.data.votd;
      // Parse display_ref and fetch each passage separately. Join with newlines.
      const refs = this.parseDisplayRef(display_ref);
      const texts = await Promise.all(
        refs.map((ref) => this.fetchPassageText(ref, version)),
      );
      const joined = texts.filter(Boolean).join('\n');
      return { content: joined, display_ref };
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

  // Parse display_ref like "Rev 3:14,20" => ["Rev 3:14", "Rev 3:20"]
  // Keep ranges intact (e.g., "John 3:16-18" remains one ref)
  // Split multiple passages by ';'
  private parseDisplayRef(displayRef: string): string[] {
    if (!displayRef) return [];
    const parts = displayRef
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);

    const expanded: string[] = [];
    for (const part of parts) {
      const match = part.match(/^(.+?)\s+(\d+):(.*)$/); // book + chapter + : + rest
      if (!match) {
        expanded.push(part);
        continue;
      }
      const book = match[1].trim();
      const chapter = match[2].trim();
      const rest = match[3].trim();

      const segments = rest
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length <= 1) {
        expanded.push(`${book} ${chapter}:${rest}`);
      } else {
        for (const seg of segments) {
          expanded.push(`${book} ${chapter}:${seg}`);
        }
      }
    }

    return expanded.length ? expanded : [displayRef.trim()];
  }

  // Fetch passage HTML from BibleGateway and convert to plain text
  private async fetchPassageText(
    ref: string,
    version: string,
  ): Promise<string> {
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=${encodeURIComponent(
      version,
    )}`;

    try {
      const resp = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
          },
          maxRedirects: 5,
        }),
      );

      const decoded = he.decode(resp.data as string);
      const text = htmlToText(decoded, {
        wordwrap: false,
        selectors: [
          { selector: '.passage-text', format: 'block' },
          { selector: '.passage-content', format: 'block' },
          { selector: 'sup.versenum', format: 'skip' },
          { selector: 'h1, h2, h3, header, footer, nav', format: 'skip' },
          { selector: 'script, style', format: 'skip' },
        ],
      });

      return text
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
        .join('\n')
        .trim();
    } catch (e) {
      this.logger.warn(
        `Failed to fetch passage for ref "${ref}" (${version}): ${e?.message || e}`,
      );
      return '';
    }
  }
}
