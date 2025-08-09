import { Module } from '@nestjs/common';
import { VerseService } from './verse.service';
import { BibleGatewayModule } from '../bible-gateway/bible-gateway.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [BibleGatewayModule, AiModule],
  providers: [VerseService],
  exports: [VerseService],
})
export class VerseModule {}

