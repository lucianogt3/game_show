import { ScoreEntry } from "../types";

// URL do seu servidor backend (se existir). 
// Se deixar vazio ou a chamada falhar, usa LocalStorage.
const API_URL = ""; 

class ScoreService {
  private readonly STORAGE_KEY = 'dr_arcade_ranking';

  async getHighScores(): Promise<ScoreEntry[]> {
    // 1. Tentar buscar do servidor (se configurado)
    if (API_URL) {
      try {
        const response = await fetch(`${API_URL}/scores`);
        if (response.ok) {
          const data = await response.json();
          return data;
        }
      } catch (error) {
        console.warn("API Offline, using LocalStorage");
      }
    }

    // 2. Fallback para LocalStorage
    const local = localStorage.getItem(this.STORAGE_KEY);
    if (local) {
      return JSON.parse(local);
    }
    return [];
  }

  async saveScore(entry: ScoreEntry): Promise<ScoreEntry[]> {
    let updatedScores: ScoreEntry[] = [];
    
    // Ler atuais
    const current = await this.getHighScores();
    updatedScores = [...current, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Manter top 10

    // 1. Salvar no servidor
    if (API_URL) {
      try {
        fetch(`${API_URL}/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
      } catch (e) {
        console.error("Failed to sync score to server");
      }
    }

    // 2. Salvar localmente
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedScores));
    
    return updatedScores;
  }

  initDefaultScores(): ScoreEntry[] {
    const dummyScores: ScoreEntry[] = [
      { name: "DR. HOUSE", score: 5000, role: "Médico" as any, date: "01/01" },
      { name: "GREY", score: 4200, role: "Enfermeiro" as any, date: "02/01" },
      { name: "ROSS", score: 3500, role: "Multidisciplinar" as any, date: "03/01" },
    ];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dummyScores));
    return dummyScores;
  }
}

export const scoreService = new ScoreService();