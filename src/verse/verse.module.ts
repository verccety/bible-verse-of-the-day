import { Module } from '@nestjs/common';
import { VerseService } from './verse.service';

@Module({
  providers: [VerseService]
})
export class VerseModule {}
