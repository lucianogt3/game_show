import { ScoreEntry } from "../types";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  writeBatch
} from "firebase/firestore";

const SCORES_KEY = "arcade_scores";
const FIRESTORE_COLLECTION = "scores"; // Nome da coleção no Firestore

export const scoreService = {
  async saveScore(entry: ScoreEntry): Promise<ScoreEntry[]> {
    console.log("💾 Tentando salvar score:", entry);

    try {
      console.log("🔥 Tentando salvar no Firestore...");
      
      // Ajustado: usando 'name' em vez de 'playerName' para bater com seu objeto
      const docRef = await addDoc(collection(db, FIRESTORE_COLLECTION), {
        name: entry.name || entry.playerName || "Anônimo", 
        score: Number(entry.score) || 0,
        role: entry.role || "Não definido",
        protocol: entry.protocol || entry.topic || "Geral", // fallback para topic se protocol sumir
        timestamp: Timestamp.now()
      });
      
      console.log("✅✅✅ Score salvo NO FIRESTORE com ID:", docRef.id);
      this.syncLocalWithFirestore(entry);
      
    } catch (firestoreError) {
      console.error("❌ Falha crítica no Firestore:", firestoreError);
      // Fallback para localStorage
      const saved = localStorage.getItem(SCORES_KEY);
      const scores: ScoreEntry[] = saved ? JSON.parse(saved) : [];
      scores.push(entry);
      localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
    }
    
    return this.getScores();
  },

  async getScores(): Promise<ScoreEntry[]> {
    console.log("📥 Buscando scores...");
    
    // 1. TENTA buscar do Firestore primeiro
    try {
      const scoresQuery = query(
        collection(db, FIRESTORE_COLLECTION),
        orderBy("score", "desc"),
        limit(10)
      );
      
      const querySnapshot = await getDocs(scoresQuery);
      const firestoreScores: ScoreEntry[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        firestoreScores.push({
          name: data.name || "Sem nome",
          score: data.score,
          role: data.role,
          protocol: data.protocol || data.topic,
          timestamp: data.timestamp?.toDate() || new Date()
        });
      });
      
      console.log("✅ Scores do Firestore:", firestoreScores.length, "registros");
      
      // Atualiza o localStorage com dados do Firestore
      if (firestoreScores.length > 0) {
        localStorage.setItem(SCORES_KEY, JSON.stringify(firestoreScores));
      }
      
      return firestoreScores;
      
    } catch (firestoreError) {
      console.error("❌ Falha ao buscar do Firestore:", firestoreError);
      console.log("🔄 Buscando do localStorage...");
      
      // 2. FALLBACK: Busca do localStorage
      try {
        const saved = localStorage.getItem(SCORES_KEY);
        const scores: ScoreEntry[] = saved ? JSON.parse(saved) : [];
        
        const topScores = scores
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        
        console.log("✅ Scores do localStorage:", topScores.length, "registros");
        return topScores;
        
      } catch (localError) {
        console.error("❌ Falha ao carregar scores:", localError);
        return [];
      }
    }
  },

  // Método auxiliar para sincronização
  async syncLocalWithFirestore(newEntry: ScoreEntry): Promise<void> {
    try {
      const saved = localStorage.getItem(SCORES_KEY);
      const scores: ScoreEntry[] = saved ? JSON.parse(saved) : [];
      scores.push(newEntry);
      localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
    } catch (error) {
      console.error("Erro na sincronização local:", error);
    }
  },

  // Métodos auxiliares existentes (mantidos para compatibilidade)
  getLocalScores(): ScoreEntry[] {
    const saved = localStorage.getItem(SCORES_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  saveLocalScores(scores: ScoreEntry[]) {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  },

  clearAllScores(): void {
    localStorage.removeItem(SCORES_KEY);
    console.log("🧹 Todos os scores locais foram limpos");
    // Nota: Isso não limpa o Firestore!
  }
};