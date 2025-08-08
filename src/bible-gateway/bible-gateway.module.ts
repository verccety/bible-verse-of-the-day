import { Module } from '@nestjs/common';
import { BibleGatewayService } from './bible-gateway.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule.register({ timeout: 5000, maxRedirects: 3 })],
  providers: [BibleGatewayService],
  exports: [BibleGatewayService],
})
export class BibleGatewayModule {}
