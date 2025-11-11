import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('/')
  root(): string {
    return 'Regina Bot ✅ up & running';
  }

  @Get('/health')
  health() {
    return { ok: true, service: 'regina-telegram-bot', ts: Date.now() };
  }
}