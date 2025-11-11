// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Render te da el puerto como process.env.PORT
  const port = process.env.PORT || config.get('PORT') || 3000;

  // Escuchar en todas las interfaces (requerido en Render)
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 App running on port ${port}`);
}
bootstrap();