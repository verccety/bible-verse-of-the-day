import { Module } from '@nestjs/common';
import { AiExplainService } from './ai-explain.service';

@Module({
  providers: [AiExplainService],
  exports: [AiExplainService],
})
export class AiModule {}
