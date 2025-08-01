import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { VerseModule } from '../verse/verse.module';

@Module({
  imports: [VerseModule],
  providers: [TelegramService],
})
export class TelegramModule {}
