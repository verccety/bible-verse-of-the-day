import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VerseModule } from './verse/verse.module';
import { TelegramModule } from './telegram/telegram.module';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram/telegram.service';
import { VerseService } from './verse/verse.service';

@Module({
  imports: [
    VerseModule,
    TelegramModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [TelegramService, VerseService, AppService],
})
export class AppModule {}
