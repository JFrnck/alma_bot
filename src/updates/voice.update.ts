import { Ctx, Update, Command } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Update()
export class VoiceUpdate {
  @Command('voz')
  async voiceInfo(@Ctx() ctx: Context) {
    return ctx.reply('ℹ️ Los mensajes de voz motivacionales se envían automáticamente según tu progreso.');
  }
}