import { Ctx, Update, Command } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';


@Update()
export class TutorUpdate {
   private client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY', ''),
    });
    if (!this.client.apiKey) {
      // Mensaje útil en logs si falta la key
      // (no tiramos la app abajo, pero informamos)
      // También puedes lanzar un error si prefieres fallar en caliente.
      // throw new Error('OPENAI_API_KEY is missing');
      // eslint-disable-next-line no-console
      console.warn('⚠️ OPENAI_API_KEY no está definido');
    }
  }

  @Command('tutor')
  async tutor(@Ctx() ctx: Context) {
    const raw = (ctx.message as any)?.text || '';
    const question = raw.replace(/^\/tutor(@\w+)?\s*/i, '').trim();

    if (!question) {
      return ctx.reply('Escribe tu duda: /tutor ¿por qué la respuesta correcta es 8?');
    }

    const prompt = `Eres una tutora paciente (Regina) para secundaria. Explica de forma clara y breve: ${question}. Da un ejemplo y un tip.`;
    const res = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    const text = res.choices[0].message?.content || 'No pude generar una explicación ahora.';
    return ctx.reply(text);
  }
}