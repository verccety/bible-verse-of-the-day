import { Module } from '@nestjs/common';
import { VerseService } from './verse.service';
import { BibleGatewayModule } from '../bible-gateway/bible-gateway.module';

@Module({
  imports: [BibleGatewayModule],
  providers: [VerseService],
  exports: [VerseService],
})
export class VerseModule {}

