import { Module } from '@nestjs/common';
import { VerseService } from './verse.service';

@Module({
  providers: [VerseService],
  exports: [VerseService],
})
export class VerseModule {}
