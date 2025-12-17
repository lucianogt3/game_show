import { GoogleGenAI, Type } from "@google/genai";
import { GameTopic, GameRole, Question } from "../types";

const API_KEY = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey: API_KEY });

const getRoleContext = (role: GameRole): string => {
  switch (role) {
    case GameRole.NURSE:
      return "Foco: Administração de medicação, sinais vitais, triagem, acesso venoso, cuidados de enfermagem e monitorização.";
    case GameRole.DOCTOR:
      return "Foco: Diagnóstico diferencial, prescrição de drogas, fisiopatologia, decisão clínica avançada e exames complementares.";
    case GameRole.TECH:
      return "Foco: Posicionamento para exames, coleta de exames, preparo de materiais, segurança do paciente e transporte.";
    default:
      return "Foco: Atuação multidisciplinar, comunicação em alça fechada, segurança e protocolos gerais.";
  }
};

const getTopicContext = (topic: GameTopic): string => {
  switch (topic) {
    case GameTopic.SEPSIS:
      return "Protocolo de Sepse (pacote 1h), qSOFA, lactato, hemoculturas, antibiótico precoce.";
    case GameTopic.STROKE:
      return "Protocolo AVC, escala de Cincinnati/NIHSS, janela trombolítica, tomografia, controle de PA.";
    case GameTopic.CHEST_PAIN:
      return "Protocolo Dor Torácica, ECG em 10min, MONAB, supra de ST, troponina.";
    default: return "";
  }
};

export const generateQuestion = async (topic: GameTopic, role: GameRole): Promise<Question> => {
  try {
    const prompt = `
      Gere uma questão de múltipla escolha para um jogo de arcade hospitalar.
      
      PÚBLICO ALVO: ${role.toUpperCase()}.
      TEMA: ${topic.toUpperCase()}.
      
      CONTEXTO DO PAPEL: ${getRoleContext(role)}
      CONTEXTO DO TEMA: ${getTopicContext(topic)}
      
      A questão deve ser:
      1. Curta e direta (estilo arcade).
      2. Nível técnico adequado ao cargo escolhido.
      3. Prática (baseada em cenário real de emergência).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "Você é um instrutor de simulação realística. Gere JSON estrito.",
        temperature: 0.8,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenario: { type: Type.STRING, description: "Cenário clínico (max 180 caracteres)." },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "4 opções curtas."
            },
            correctIndex: { type: Type.INTEGER, description: "0-3" },
            explanation: { type: Type.STRING, description: "Feedback educativo curto (max 100 caracteres)." }
          },
          required: ["scenario", "options", "correctIndex", "explanation"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Sem resposta do Gemini");

    const data = JSON.parse(text);
    
    return {
      id: Date.now().toString(),
      scenario: data.scenario,
      options: data.options,
      correctIndex: data.correctIndex,
      explanation: data.explanation
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      id: 'fallback',
      scenario: `[FALHA DE REDE - MODO OFFLINE] Paciente com ${topic}. Qual a prioridade para o ${role}?`,
      options: [
        "Monitorização e Segurança",
        "Preencher prontuário",
        "Chamar a família",
        "Aguardar evolução"
      ],
      correctIndex: 0,
      explanation: "Segurança e estabilização são sempre prioridade."
    };
  }
};