type Stage = 'theory' | 'exercise' | 'quickTest' | 'done';

export interface SessionState {
  userId: number;
  lessonId: number;
  stage: Stage;
  index: number;           // índice dentro del arreglo actual
  streak: number;          // correctas seguidas
  firstMistakeNotified: boolean; // para "¡no te rindas!" en 1er error
}

export class SessionService {
  private sessions = new Map<number, SessionState>();

  start(userId: number, lessonId: number): SessionState {
    const s: SessionState = { userId, lessonId, stage: 'theory', index: 0, streak: 0, firstMistakeNotified: false };
    this.sessions.set(userId, s);
    return s;
  }
  get(userId: number) { return this.sessions.get(userId); }
  set(userId: number, state: SessionState) { this.sessions.set(userId, state); }
  end(userId: number) { this.sessions.delete(userId); }
}