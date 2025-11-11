import { Ctx, Update, Command, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { LessonsService } from '../services/lessons.service';
import { SessionService } from '../services/session.service';

@Update()
export class LearnUpdate {
  constructor(
    private readonly lessons: LessonsService,
    private readonly session: SessionService
  ) {}

  @Command('aprender')
  async aprender(@Ctx() ctx: Context) {
    const userId = ctx.from!.id;

    // Inicia Lesson 1 (ID=1)
    const s = this.session.start(userId, 1);
    const l = this.lessons.getLesson(1)!;

    await ctx.replyWithMarkdown(`*${l.title}*`);
    // 👉 ahora mostramos SOLO el primer párrafo y esperamos botón
    return this.sendNextBlock(ctx, s);
  }

  private async sendNextBlock(ctx: Context, s: any) {
    const l = this.lessons.getLesson(s.lessonId)!;

    // 1) Teoría: mostrar un párrafo y botón "Siguiente" / "Empezar ejercicios"
    if (s.stage === 'theory') {
      return this.sendTheoryParagraph(ctx, s);
    }

    // 2) Quick Test (fin de Lesson 1 → bloque “Lecciones 1 y 2”)
    if (s.stage === 'quickTest') {
      if (!l.quickTest || s.index >= l.quickTest.length) {
        s.stage = 'done';
        this.session.set(s.userId, s);
        return ctx.reply('🎉 ¡Prueba Rápida completada! ¡Excelente trabajo!');
      }
      const q = l.quickTest[s.index];
      await this.sendOptions(ctx, q.question, q.options, `qt_${q.id}_${s.index}`);
      return;
    }

    // 3) Ejercicios
    if (s.stage === 'exercise') {
      return this.sendExercise(ctx, s);
    }

    return ctx.reply('✅ Lección finalizada.');
  }

  private async sendTheoryParagraph(ctx: Context, s: any) {
    const l = this.lessons.getLesson(s.lessonId)!;
    const i = s.index;

    // Si ya acabó la teoría, pasa a ejercicios
    if (i >= l.theory.length) {
      s.stage = 'exercise';
      s.index = 0;
      this.session.set(s.userId, s);
      await ctx.reply('🧩 ¡Practiquemos! (Ejercicios Lección 1)');
      return this.sendExercise(ctx, s);
    }

    const isLast = i === l.theory.length - 1;
    const text = l.theory[i];

    // Teclado con "Siguiente" o "Empezar ejercicios"
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: isLast ? 'Empezar ejercicios 🧩' : 'Siguiente ▶️',
              callback_data: 'th_next'
            }
          ]
        ]
      }
    };

    await ctx.reply(text, keyboard);
  }

  @Action('th_next')
  async handleTheoryNext(@Ctx() ctx: Context) {
    const userId = ctx.from!.id;

    // Limpia teclado del mensaje anterior para evitar taps dobles
    try {
      await (ctx as any).editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {}

    // Recupera sesión; si se perdió por hot-reload, reinicia en Lesson 1
    let s = this.session.get(userId);
    if (!s) s = this.session.start(userId, 1);

    // Avanza al siguiente párrafo
    s.index += 1;
    this.session.set(userId, s);

    // Continuar flujo (si termina teoría, pasará a ejercicios)
    return this.sendNextBlock(ctx, s);
  }

  private async sendExercise(ctx: Context, s: any) {
    const l = this.lessons.getLesson(s.lessonId)!;

    if (s.index >= l.exercises.length) {
      // Pasar a Quick Test
      s.stage = 'quickTest';
      s.index = 0;
      this.session.set(s.userId, s);
      await ctx.reply('🏆 ¡Prueba Rápida! (Lecciones 1 y 2)');
      return this.sendNextBlock(ctx, s);
    }

    const ex = l.exercises[s.index];
    const title = ex.difficulty ? `(${ex.difficulty}) ` : '';
    await this.sendOptions(ctx, `${title}${ex.question}`, ex.options, `ex_${ex.id}_${s.index}`);
  }

  private async sendOptions(ctx: Context, question: string, options: string[], tag: string) {
    const keyboard = {
      reply_markup: {
        inline_keyboard: options.map((opt, i) => [{ text: opt, callback_data: `${tag}_${i}` }])
      }
    };
    await ctx.reply(question, keyboard);
  }

  // =========================
  // HANDLER: Ejercicios (ex_)
  // =========================
  @Action(/ex_(\d+)_(\d+)_(\d+)/)
  async handleExercise(@Ctx() ctx: Context) {
    const userId = ctx.from!.id;

    // 1) Parse seguro desde callback_data
    const data = (ctx.callbackQuery as any)?.data as string;
    const m = data ? data.match(/^ex_(\d+)_(\d+)_(\d+)$/) : null;
    if (!m) {
      await ctx.answerCbQuery();
      return;
    }
    const [, /*exIdStr*/, idxStr, optStr] = m;
    const exIndex = parseInt(idxStr, 10);
    const chosen = parseInt(optStr, 10);

    // 2) Guard de sesión (por si se perdió con hot-reload)
    let s = this.session.get(userId);
    if (!s) s = this.session.start(userId, 1);

    const l = this.lessons.getLesson(s.lessonId)!;
    const ex = l.exercises?.[exIndex];
    if (!ex) {
      await ctx.answerCbQuery();
      await ctx.reply('Ups, no encontré el ejercicio. Intenta /aprender otra vez.');
      return;
    }

    // 3) Feedback inmediato + limpiar teclado previo
    const isCorrect = chosen === ex.correctIndex;
    await ctx.answerCbQuery(isCorrect ? '✅ ¡Correcto!' : '❌ Incorrecto');
    try {
      await (ctx as any).editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {}

    // 4) Mostrar solución coloreada
    const colored = ex.options
      .map((opt, i) => {
        const label = opt.replace(/^([a-c]\)\s)/i, '');
        if (i === ex.correctIndex) return `🟩 ${label}`;
        if (i === chosen && !isCorrect) return `🟥 ${label}`;
        return `▫️ ${label}`;
      })
      .join('\n');

    await ctx.reply(`${ex.question}\n\n${colored}`);

    // 5) Streak + motivación
    if (isCorrect) {
      s.streak += 1;
      if (s.streak === 4) {
        await ctx.reply('🔊 (Regina) ¡Lo estás haciendo muy bien!'); // futuro: audio ElevenLabs
      }
    } else {
      s.streak = 0;
      if (!s.firstMistakeNotified) {
        s.firstMistakeNotified = true;
        await ctx.reply('🔊 (Regina) ¡No te rindas! Tú puedes 💪');
      }
      await ctx.reply('Si necesitas ayuda pídele a Regina:\n/tutor "Explícame por qué la respuesta correcta es 8"');
      if (ex.tutorHint) await ctx.reply(`Pista: ${ex.tutorHint}`);
    }

    // 6) Avanzar índice y continuar
    s.index = exIndex + 1;
    this.session.set(userId, s);
    return this.sendNextBlock(ctx, s);
  }

  // =========================
  // HANDLER: Quick Test (qt_)
  // =========================
  @Action(/qt_(\d+)_(\d+)_(\d+)/)
  async handleQuick(@Ctx() ctx: Context) {
    const userId = ctx.from!.id;

    // 1) Parse seguro desde callback_data
    const data = (ctx.callbackQuery as any)?.data as string;
    const m = data ? data.match(/^qt_(\d+)_(\d+)_(\d+)$/) : null;
    if (!m) {
      await ctx.answerCbQuery();
      return;
    }
    const [, /*qtIdStr*/, idxStr, optStr] = m;
    const qIndex = parseInt(idxStr, 10);
    const chosen = parseInt(optStr, 10);

    // 2) Guard de sesión
    let s = this.session.get(userId);
    if (!s) s = this.session.start(userId, 1);

    const l = this.lessons.getLesson(s.lessonId)!;
    const q = l.quickTest?.[qIndex];
    if (!q) {
      await ctx.answerCbQuery();
      await ctx.reply('Ups, no encontré la pregunta. Intenta /aprender otra vez.');
      return;
    }

    // 3) Feedback + limpiar teclado
    const isCorrect = chosen === q.correctIndex;
    await ctx.answerCbQuery(isCorrect ? '✅ ¡Correcto!' : '❌ Incorrecto');
    try {
      await (ctx as any).editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {}

    // 4) Solución coloreada
    const colored = q.options
      .map((opt, i) => {
        if (i === q.correctIndex) return `🟩 ${opt}`;
        if (i === chosen && !isCorrect) return `🟥 ${opt}`;
        return `▫️ ${opt}`;
      })
      .join('\n');

    await ctx.reply(`${q.question}\n\n${colored}`);

    // 5) Streak + motivación
    if (isCorrect) {
      s.streak += 1;
      if (s.streak === 4) {
        await ctx.reply('🔊 (Regina) ¡Lo estás haciendo muy bien!');
      }
    } else {
      s.streak = 0;
      if (!s.firstMistakeNotified) {
        s.firstMistakeNotified = true;
        await ctx.reply('🔊 (Regina) ¡No te rindas! Tú puedes 💪');
      }
      await ctx.reply('¿Duda? Usa /tutor "Explícame por qué la respuesta correcta es 8".');
    }

    // 6) Avanzar índice y continuar
    s.index = qIndex + 1;
    this.session.set(userId, s);
    return this.sendNextBlock(ctx, s);
  }
}