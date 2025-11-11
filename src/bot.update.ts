// src/bot.update.ts
import { Ctx, Hears, InjectBot, On, Start, Update } from 'nestjs-telegraf';
import { Context, Telegraf, Markup } from 'telegraf';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { VoiceService } from './voice.service';

@Update()
export class BotUpdate {
  private openai: OpenAI;

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly config: ConfigService,
    private readonly voice: VoiceService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.warn('[OpenAI] Falta OPENAI_API_KEY en las variables de entorno (.env no cargado o variable vacía)');
    }
    this.openai = new OpenAI({ apiKey: apiKey ?? '' });
  }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    await ctx.reply(
      '¡Hola! Soy Regina Tutor 🤖. Usa /aprender para comenzar.',
      Markup.keyboard([['/aprender']]).resize(),
    );
  }

  @Hears('/aprender')
  async onAprender(@Ctx() ctx: Context) {
    await ctx.reply(
      '¿Qué quieres hacer hoy?',
      Markup.inlineKeyboard([
        [Markup.button.callback('📘 Estudiar examen', 'mode_exam')],
        [Markup.button.callback('🔁 Repasar lección', 'mode_review')],
        [Markup.button.callback('✨ Aprender', 'mode_learn')],
      ]),
    );
  }

  @On('callback_query')
  async onCallback(@Ctx() ctx: any) {
    const data = ctx.callbackQuery?.data;
    if (data === 'mode_review') {
      await ctx.editMessageText(
        'Elige tema:',
        Markup.inlineKeyboard([
          [Markup.button.callback('Divisibilidad', 'topic_div')],
          [Markup.button.callback('Fracciones', 'topic_frac')],
        ]),
      );
    } else if (data === 'topic_div') {
      await ctx.editMessageText('Ok, repasemos *Divisibilidad*. Escribe /tutor si quieres ayuda con audio.', { parse_mode: 'Markdown' });
      await ctx.reply('Pregunta: ¿84 es divisible por 3 y por 7? Explica.');
    } else {
      await ctx.answerCbQuery('Opción recibida ✅');
    }
  }

  @Hears('/tutor')
  async onTutor(@Ctx() ctx: Context) {
    // Permite usar: "/tutor explica este problema ..." (texto opcional después del comando)
    const raw = (ctx as any)?.message?.text as string | undefined;
    const userQuestion = raw ? raw.replace(/^\/tutor\s*/i, '').trim() : '';
    if (!this.config.get<string>('OPENAI_API_KEY')) {
      await ctx.reply('No tengo la clave de OpenAI configurada todavía. Agrega OPENAI_API_KEY al .env y reinicia.');
      return;
    }
    try {
      const promptUser = userQuestion && userQuestion.length > 0
        ? `Ayúdame a entender este problema: ${userQuestion}`
        : `Explica el tema de divisibilidad con un ejemplo claro y breve para un alumno de 2° de secundaria.`;
      const system = `
Eres un tutor de matemáticas peruano para 2° de secundaria.
Responde en español claro y motivador, máximo 120-150 palabras.
Si el estudiante comete un error, valida lo correcto, corrige con tacto y ofrece una pista.
Da pasos concretos y un ejemplo sencillo.
      `.trim();

      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: promptUser },
        ],
      });

      const text =
        res.choices?.[0]?.message?.content?.toString().trim() ||
        'No pude generar una explicación, intenta otra vez 🙏';

      await ctx.reply(text);
      await ctx.reply('Si quieres una explicación en audio, envíame: /voz seguido de tu duda. Ej: "/voz cómo sé si 84 es divisible por 7?"');
    } catch (err: any) {
      console.error('[OpenAI] Error:', err?.response?.data ?? err?.message ?? err);
      await ctx.reply('Tuve un problema generando la explicación. Intenta de nuevo en un momento.');
    }
  }

  @Hears(/^\/voz\b/i)
  async onVoz(@Ctx() ctx: Context) {
    const raw = (ctx as any)?.message?.text as string | undefined;
    const question = raw ? raw.replace(/^\/voz\s*/i, '').trim() : '';
    if (!this.config.get<string>('OPENAI_API_KEY')) {
      await ctx.reply('Configura OPENAI_API_KEY en el .env para generar el guion de audio.');
      return;
    }
    try {
      // 1) Genera guion con OpenAI
      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'Genera un guion para audio de 30-45 segundos, tono amable y didáctico, para un alumno de 2° de secundaria en Perú.' },
          { role: 'user', content: question || 'Explica brevemente la regla de divisibilidad por 3 y por 7 con un ejemplo.' },
        ],
      });
      const script =
        res.choices?.[0]?.message?.content?.toString().trim() ||
        'No pude generar el guion en este momento.';

      // 2) Convierte a audio (MP3) con ElevenLabs
      const audio = await this.voice.ttsToBuffer(script);

      // 3) Envía el audio a Telegram
      await (ctx as any).replyWithAudio(
        { source: audio, filename: 'explicacion.mp3' },
        { caption: 'Aquí tienes tu explicación en audio 🎧' },
      );
    } catch (err: any) {
      console.error('[TTS] Error /voz:', err?.response?.data ?? err?.message ?? err);
      await ctx.reply('No pude generar el audio ahora. Intenta más tarde.');
    }
  }

  @On('text')
  async onText(@Ctx() ctx: any) {
    const text = ctx.message.text as string;
    // Aquí pondrías tu lógica de corrección con OpenAI u otra
    await ctx.reply(`Recibí: "${text}". ¡Buen trabajo!`);
  }
}