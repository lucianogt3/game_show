// services/scoreService.ts
import { db } from "./firebase";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import type { ScoreEntry } from "../types";

const COL = "rankings";

export const scoreService = {
  async getScores(): Promise<ScoreEntry[]> {
    try {
      const q = query(collection(db, COL), orderBy("score", "desc"), limit(10));
      const snap = await getDocs(q);

      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          name: data.name ?? "JOGADOR",
          score: Number(data.score ?? 0),
          role: data.role ?? "NURSE",
          date: data.date ?? "",
        } as ScoreEntry;
      });
    } catch (err) {
      console.error("[scoreService.getScores] erro:", err);
      return []; // não quebra a UI
    }
  },

  async saveScore(entry: ScoreEntry): Promise<ScoreEntry[]> {
    try {
      await addDoc(collection(db, COL), {
        name: entry.name,
        score: entry.score,
        role: entry.role,
        date: entry.date,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[scoreService.saveScore] erro:", err);
      // NÃO trava o jogo — segue o fluxo
    }

    return this.getScores();
  },
};
