// src/services/staticQuestions.ts
import { GameTopic, GameRole, Question } from "../types";

// ✅ ajuste esses imports conforme onde está sua pasta questions
import avc from "../questions/avc_2025.json";
import sepse from "../questions/sepse_2025.json";
import dor from "../questions/dor_toracica_2025.json";

// Tipagem do seu JSON
type RawDB = {
  meta?: any;
  questoes: Array<{
    id: string;
    especialidade: "ENFERMEIRO" | "MEDICO" | "TECNICO" | "MULTI";
    dificuldade?: "BASICO" | "INTERMEDIARIO" | "AVANCADO";
    enunciado: string;
    opcoes: string[];
    correta: number;
    explicacao: string;
    tempo_max?: number;
  }>;
};

const DB_BY_TOPIC: Record<GameTopic, RawDB> = {
  [GameTopic.SEPSIS]: sepse as RawDB,
  [GameTopic.STROKE]: avc as RawDB,
  [GameTopic.CHEST_PAIN]: dor as RawDB,
};

const roleToEspecialidade: Record<
  GameRole,
  RawDB["questoes"][number]["especialidade"]
> = {
  [GameRole.NURSE]: "ENFERMEIRO",
  [GameRole.DOCTOR]: "MEDICO",
  [GameRole.TECH]: "TECNICO",
  [GameRole.MULTI]: "MULTI",
};

const normalizeDifficulty = (d?: string) => {
  if (!d) return "Médio";
  const up = d.toUpperCase();
  if (up === "BASICO") return "Básico";
  if (up === "INTERMEDIARIO") return "Médio";
  if (up === "AVANCADO") return "Avançado";
  return "Médio";
};

export const getStaticQuestions = (
  topic: GameTopic,
  role: GameRole
): Question[] => {
  const db = DB_BY_TOPIC[topic];
  if (!db || !Array.isArray(db.questoes) || db.questoes.length === 0) return [];

  const wanted = roleToEspecialidade[role];

  const filtered =
    wanted === "MULTI"
      ? db.questoes
      : db.questoes.filter((q) => q.especialidade === wanted);

  return filtered.map((q) => ({
    id: q.id,
    scenario: q.enunciado,
    options: q.opcoes,
    correctIndex: q.correta,
    explanation: q.explicacao,
    difficulty: normalizeDifficulty(q.dificuldade),
    topic,
    role,
  }));
};
