import { GameTopic, GameRole, Question } from "../types";

import sepseData from "./questions/sepse_2025.json";
import avcData from "./questions/avc_2025.json";
import dorData from "./questions/dor_toracica_2025.json";

type RawPack = {
  meta: { tema: string; versao?: string; total_questoes?: number };
  questoes: Array<{
    id: string;
    nivel: number;
    especialidade: "ENF" | "MED" | "TEC" | "MULTI";
    enunciado: string;
    opcoes: string[];
    correta: number;
    explicacao: string;
    tempo_max: number;
    tags?: string[];
  }>;
};

const PACKS: Record<GameTopic, RawPack> = {
  [GameTopic.SEPSIS]: sepseData as unknown as RawPack,
  [GameTopic.STROKE]: avcData as unknown as RawPack,
  [GameTopic.CHEST_PAIN]: dorData as unknown as RawPack,
};

const mapRole = (esp: RawPack["questoes"][number]["especialidade"]): GameRole => {
  switch (esp) {
    case "ENF": return GameRole.NURSE;
    case "MED": return GameRole.DOCTOR;
    case "TEC": return GameRole.TECH;
    case "MULTI": return GameRole.MULTI;
  }
};

const roleMatches = (questionEsp: RawPack["questoes"][number]["especialidade"], role: GameRole) => {
  if (role === GameRole.MULTI) return true; // multi vê tudo
  return mapRole(questionEsp) === role;
};

const toQuestion = (q: RawPack["questoes"][number]): Question => ({
  id: q.id,
  scenario: q.enunciado,
  options: q.opcoes,
  correctIndex: q.correta,
  explanation: q.explicacao,
  // se seu type Question NÃO tiver esse campo, pode remover:
  timeLimit: q.tempo_max,
});

export const getStaticQuestions = (topic: GameTopic, role: GameRole): Question[] => {
  const pack = PACKS[topic];
  const list = (pack?.questoes || [])
    .filter(q => roleMatches(q.especialidade, role))
    .map(toQuestion);

  return list;
};
