// services/questionService.ts
import { GameTopic, GameRole, Question } from "../types";
import { getStaticQuestions } from "./staticQuestions";

// evita repetir pergunta imediatamente
const usedIds = new Set<string>();

// embaralha array mantendo mapa de índices
const shuffleWithIndex = <T>(arr: T[]) => {
  const a = [...arr];
  const idxMap = a.map((_, i) => i);

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
    [idxMap[i], idxMap[j]] = [idxMap[j], idxMap[i]];
  }

  return { shuffled: a, idxMap };
};

// embaralha alternativas e ajusta correctIndex
const shuffleQuestionOptions = (q: Question): Question => {
  const { shuffled, idxMap } = shuffleWithIndex(q.options);
  const newCorrectIndex = idxMap.findIndex(
    (origIdx) => origIdx === q.correctIndex
  );

  return {
    ...q,
    options: shuffled,
    correctIndex: newCorrectIndex,
  };
};

export const getQuestion = async (
  topic: GameTopic,
  role: GameRole
): Promise<Question> => {
  // delay visual (loading)
  await new Promise((r) => setTimeout(r, 300));

  const questions = getStaticQuestions(topic, role);

  if (!questions.length) {
    return {
      id: "fallback",
      scenario: `Nenhuma questão encontrada para ${topic}`,
      options: ["OK", "Entendi", "Continuar", "Voltar"],
      correctIndex: 0,
      explanation: "Verifique os arquivos JSON da pasta questions.",
      difficulty: "Básico",
      topic,
      role,
    };
  }

  // evita repetição imediata
  let pool = questions.filter((q) => !usedIds.has(q.id));
  if (!pool.length) {
    usedIds.clear();
    pool = questions;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  usedIds.add(pick.id);

  // ✅ AQUI está o segredo: embaralha opções + corrige índice
  return shuffleQuestionOptions({
    ...pick,
    options: [...pick.options], // garante cópia
  });
};

export const clearQuestionHistory = () => {
  usedIds.clear();
};
