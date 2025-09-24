import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { htmlToText } from 'html-to-text';
import he from 'he';

@Injectable()
export class BibleGatewayService {
  private readonly logger = new Logger(BibleGatewayService.name);

  constructor(private readonly httpService: HttpService) {}

  async fetchVerse(
    version: string,
  ): Promise<{ content: string; display_ref: string }> {
    const url = `https://www.biblegateway.com/votd/get/?format=json&version=${encodeURIComponent(
      version,
    )}`;
    this.logger.log(
      `Fetching verse from Bible Gateway for version: ${version}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: browserLikeHeaders({
            // If the API is picky about CORS/anti-bot, set these to your real site:
            // origin: 'https://your-site.example',
            // referer: 'https://your-site.example/some-page',
          }),
          responseType: 'json',
          // Axios will auto-decompress when Accept-Encoding is set
          maxRedirects: 5,
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
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch verse from Bible Gateway for version ${version}: ${error?.message || error}`,
        error?.stack,
      );
      throw new Error(
        `Could not retrieve the verse of the day for version ${version}.`,
      );
    }
  }

  // Parse display_ref like:
  // - "Rev 3:14,20"            => ["Rev 3:14", "Rev 3:20"]
  // - "1 John 1:8-10, 2:1-2"   => ["1 John 1:8-10", "1 John 2:1-2"]
  // - Multiple passages split by ';'
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
      const book = match[1].trim(); // works for "Romans" and "К Римлянам"
      const chapter = match[2].trim();
      const rest = match[3].trim();

      const segments = rest
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (segments.length === 0) {
        expanded.push(`${book} ${chapter}`);
        continue;
      }

      for (const seg of segments) {
        // If segment already includes a chapter (e.g., "2:1-2"),
        // don't prefix the previous chapter.
        if (seg.includes(':')) {
          expanded.push(`${book} ${seg}`);
        } else {
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
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(
      ref,
    )}&version=${encodeURIComponent(version)}`;

    try {
      const resp = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          responseType: 'text',
          maxRedirects: 5,
        }),
      );

      const decoded = he.decode(String(resp.data));

      // Narrow to the main passage blocks; avoid scraping the whole page.
      const text = htmlToText(decoded, {
        wordwrap: false,
        baseElements: {
          selectors: ['.passage-text', '.passage-content'],
          // If your html-to-text version doesn't support this flag, you can remove it.
          returnDomByDefault: false,
        },
        // IMPORTANT: one selector per rule (no comma-separated lists).
        selectors: [
          // Drop verse numbers and common notes/cross-refs
          { selector: 'sup.versenum', format: 'skip' },
          { selector: 'sup.footnote', format: 'skip' },
          { selector: 'sup.crossreference', format: 'skip' },
          { selector: '.footnotes', format: 'skip' },
          { selector: '.crossrefs', format: 'skip' },
          { selector: '.passage-other-trans', format: 'skip' },

          // Drop chrome
          { selector: 'h1', format: 'skip' },
          { selector: 'h2', format: 'skip' },
          { selector: 'h3', format: 'skip' },
          { selector: 'header', format: 'skip' },
          { selector: 'footer', format: 'skip' },
          { selector: 'nav', format: 'skip' },
          { selector: 'script', format: 'skip' },
          { selector: 'style', format: 'skip' },

          // Render paragraphs as blocks (explicit but harmless)
          { selector: 'p', format: 'block' },

          // Optional: ignore link URLs in output
          { selector: 'a', options: { ignoreHref: true } as any },
        ],
      });

      // Tidy whitespace: collapse extra blank lines, trim right side.
      return text
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
        .filter((l) => !this.shouldDropLine(l)) // drop "Read full chapter" etc.
        .join('\n')
        .trim();
    } catch (e: any) {
      this.logger.warn(
        `Failed to fetch passage for ref "${ref}" (${version}): ${e?.message || e}`,
      );
      return '';
    }
  }

  private shouldDropLine(line: string): boolean {
    // normalize spaces & case
    const t = line
      .replace(/\u00A0/g, ' ')
      .trim()
      .toLowerCase();

    // common BG CTAs / variants (en + ru)
    return (
      t === 'read full chapter' ||
      t === 'read the full chapter' ||
      t === 'читать главу полностью' ||
      t === 'читать полностью'
    );
  }
}

function browserLikeHeaders(opts?: { origin?: string; referer?: string }) {
  const h: Record<string, string> = {
    // Chrome 140 on Windows 10 x64
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.186 Safari/537.36',

    // Typical for fetch/XHR (Axios defaults are similar but we mimic Chrome more closely)
    accept: 'application/json, text/plain, */*',

    // Common browser defaults
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate, br, zstd',

    // Client Hints commonly present in Chrome requests (safe to omit if not needed)
    'sec-ch-ua':
      '"Chromium";v="140", "Google Chrome";v="140", "Not=A?Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',

    // Fetch metadata (these values are typical for cross-site API calls)
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    'sec-fetch-site': 'cross-site',

    // Some APIs still key off this
    'x-requested-with': 'XMLHttpRequest',
  };

  if (opts?.origin) h['origin'] = opts.origin;
  if (opts?.referer) h['referer'] = opts.referer;
  return h;
}
