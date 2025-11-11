import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';             // 👈
import { TelegrafModule } from 'nestjs-telegraf';
import { LessonsService } from './services/lessons.service';
import { SessionService } from './services/session.service';
import { LearnUpdate } from './updates/learn.update';
import { TutorUpdate } from './updates/tutor.update';
import { VoiceUpdate } from './updates/voice.update';
import { AppController } from './app.controller';

const TELEGRAM_TOKEN = "8590046011:AAEgCL05S3i23Y3sjwgQQDDKAWRN76TVS6g" 

@Module({
  imports: [
    // Carga .env y lo expone en process.env y ConfigService
    ConfigModule.forRoot({ isGlobal: true }),              // 👈

    TelegrafModule.forRoot({
      token: process.TELEGRAM_TOKEN!,
      include: []
    })
  ],
  controllers: [AppController],
  providers: [LessonsService, SessionService, LearnUpdate, TutorUpdate, VoiceUpdate]
})
export class AppModule {}