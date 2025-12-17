export enum GameTopic {
  SEPSIS = 'Sepse',
  STROKE = 'AVC',
  CHEST_PAIN = 'Dor Torácica',
  NONE = 'None'
}

export enum GameRole {
  NURSE = 'Enfermeiro',
  DOCTOR = 'Médico',
  TECH = 'Técnico',
  MULTI = 'Multidisciplinar'
}

export enum GameState {
  PRESS_START = 'PRESS_START', // Nova tela inicial
  HOME = 'HOME',           // Menu Principal
  RANKING = 'RANKING',     // Tela de Ranking
  NAME_ENTRY = 'NAME_ENTRY',
  ROLE_SELECT = 'ROLE_SELECT',
  PROTOCOL_SELECT = 'PROTOCOL_SELECT',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  RESULT = 'RESULT'
}

export interface Question {
  id: string;
  scenario: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface PlayerStats {
  name: string;
  score: number;
  streak: number;
  role: GameRole;
  topic: GameTopic;
  correctAnswers: number;
  totalQuestions: number;
}

export interface ScoreEntry {
  name: string;
  score: number;
  role: GameRole;
  date: string;
}