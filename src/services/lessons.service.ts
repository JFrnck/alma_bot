import lessonsData from '../data/lessons.json';

export type Lesson = {
  id: number;
  slug: string;
  title: string;
  theory: string[];
  exercises: { id: number; difficulty?: string; question: string; options: string[]; correctIndex: number; tutorHint?: string; }[];
  quickTest?: { id: number; question: string; options: string[]; correctIndex: number; }[];
};

export class LessonsService {
  private map = new Map<number, Lesson>();

  constructor() {
    (lessonsData as any).lessons.forEach((l: Lesson) => this.map.set(l.id, l));
  }
  getLesson(id: number): Lesson | undefined { return this.map.get(id); }
}