// src/run-task.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TelegramService } from './telegram/telegram.service';

async function bootstrap() {
  // Create an application context instead of a full HTTP server
  const app = await NestFactory.createApplicationContext(AppModule);

  // Resolve the TelegramService from the DI container
  const telegramService = app.get(TelegramService);

  console.log('Running the send daily verse task...');

  try {
    // Execute the task
    await telegramService.sendDailyVerse();
    console.log('Task finished successfully.');
  } catch (error) {
    console.error('Task failed with an error:', error);
    // Ensure the process exits with an error code to fail the GitHub Action
    process.exit(1);
  } finally {
    // Gracefully close the application context
    await app.close();
    process.exit(0);
  }
}

bootstrap();
