import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GameState,
  GameTopic,
  GameRole,
  Question,
  PlayerStats,
  ScoreEntry,
} from "./types";
import { getQuestion } from "./services/questionService";
import { audioService } from "./services/audioService";
import { scoreService } from "./services/scoreService";
import { VirtualKeyboard } from "./components/VirtualKeyboard";
import { JoystickHint } from "./components/JoystickHint";
import ArcadeBackground from "./components/ArcadeBackground";

const App: React.FC = () => {
  // ----------------------------
  // STATE
  // ----------------------------
  const [gameState, setGameState] = useState<GameState>(GameState.PRESS_START);

  const [playerName, setPlayerName] = useState<string>("JOGADOR");
  const [selectedRole, setSelectedRole] = useState<GameRole>(GameRole.NURSE);
  const [selectedTopic, setSelectedTopic] = useState<GameTopic>(GameTopic.SEPSIS);
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);

  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(20);

  const [stats, setStats] = useState<PlayerStats>({
    name: "",
    score: 0,
    streak: 0,
    role: GameRole.NURSE,
    topic: GameTopic.SEPSIS,
    correctAnswers: 0,
    totalQuestions: 0,
  });

  const [visualFeedback, setVisualFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [autoNextTime, setAutoNextTime] = useState<number>(6);
  const [scoreAnimation, setScoreAnimation] = useState<number | null>(null);

  const [musicVol, setMusicVol] = useState(0.6);
  const [sfxVol, setSfxVol] = useState(1.0);

  const [menuIndex, setMenuIndex] = useState(0);
  const [blink, setBlink] = useState(true);

  // ----------------------------
  // REFS (timers)
  // ----------------------------
  const questionTimerRef = useRef<number | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);
  const scoreAnimationRef = useRef<number | null>(null);

  // ----------------------------
  // CONSTANTS
  // ----------------------------
  const QUESTIONS_PER_ROUND = 10;
  const QUESTION_TIME_SECONDS = 20;
  const AUTO_NEXT_DELAY_SECONDS = 6;

  const ROLES = [GameRole.NURSE, GameRole.DOCTOR, GameRole.TECH, GameRole.MULTI];
  const TOPICS = [GameTopic.SEPSIS, GameTopic.STROKE, GameTopic.CHEST_PAIN];

  const ROLE_COLORS: Record<GameRole, string> = {
    [GameRole.NURSE]: "text-green-400 border-green-500 bg-green-900/40",
    [GameRole.DOCTOR]: "text-red-400 border-red-500 bg-red-900/40",
    [GameRole.TECH]: "text-blue-400 border-blue-500 bg-blue-900/40",
    [GameRole.MULTI]: "text-yellow-400 border-yellow-500 bg-yellow-900/40",
  };

  // ----------------------------
  // HELPERS: clear timers
  // ----------------------------
  const clearQuestionTimer = () => {
    if (questionTimerRef.current) {
      window.clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
    }
  };

  const clearAutoNextTimer = () => {
    if (autoNextTimerRef.current) {
      window.clearInterval(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
  };

  // ----------------------------
  // AUDIO
  // ----------------------------
  useEffect(() => {
    audioService.setVolumes(musicVol, sfxVol);
  }, [musicVol, sfxVol]);

  useEffect(() => {
    if (gameState === GameState.PRESS_START) return;

    const isMenuState = [
      GameState.HOME,
      GameState.ROLE_SELECT,
      GameState.PROTOCOL_SELECT,
      GameState.NAME_ENTRY,
      GameState.RANKING,
    ].includes(gameState);

    if (isMenuState) {
      audioService.playBGM("menu");
      return;
    }

    if (gameState === GameState.PLAYING) {
      if (selectedTopic === GameTopic.SEPSIS) audioService.playBGM("sepse");
      else if (selectedTopic === GameTopic.STROKE) audioService.playBGM("avc");
      else audioService.playBGM("dor");
      return;
    }

    if (gameState === GameState.RESULT) {
      audioService.stopBGM();
    }
  }, [gameState, selectedTopic]);

  // ----------------------------
  // BLINK PRESS START
  // ----------------------------
  useEffect(() => {
    if (gameState !== GameState.PRESS_START) return;
    const interval = window.setInterval(() => setBlink((prev) => !prev), 500);
    return () => window.clearInterval(interval);
  }, [gameState]);

  // ----------------------------
  // LOAD SCORES
  // ----------------------------
  useEffect(() => {
    const loadScores = async () => {
      const scores = await scoreService.getScores();
      setHighScores(scores);
    };
    loadScores();
  }, []);

  // ----------------------------
  // TIMER: QUESTION
  // ----------------------------
  useEffect(() => {
    clearQuestionTimer();

    if (gameState !== GameState.PLAYING) return;
    if (!currentQuestion) return;
    if (showExplanation) return;

    setTimeLeft(QUESTION_TIME_SECONDS);

    questionTimerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearQuestionTimer();
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearQuestionTimer();
  }, [gameState, showExplanation, currentQuestion?.id]);

  // ----------------------------
  // TIMER: EXPLANATION (auto next)
  // ----------------------------
  useEffect(() => {
    clearAutoNextTimer();

    if (gameState !== GameState.PLAYING) {
      setAutoNextTime(AUTO_NEXT_DELAY_SECONDS);
      return;
    }
    if (!showExplanation) {
      setAutoNextTime(AUTO_NEXT_DELAY_SECONDS);
      return;
    }

    setAutoNextTime(AUTO_NEXT_DELAY_SECONDS);

    autoNextTimerRef.current = window.setInterval(() => {
      setAutoNextTime((prev) => {
        if (prev <= 1) {
          clearAutoNextTimer();
          nextRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearAutoNextTimer();
  }, [showExplanation, gameState]);

  // ----------------------------
  // SCORE ANIMATION
  // ----------------------------
  useEffect(() => {
    if (scoreAnimation === null) return;

    if (scoreAnimationRef.current) window.clearTimeout(scoreAnimationRef.current);

    scoreAnimationRef.current = window.setTimeout(() => {
      setScoreAnimation(null);
    }, 1000);

    return () => {
      if (scoreAnimationRef.current) window.clearTimeout(scoreAnimationRef.current);
    };
  }, [scoreAnimation]);

  // ----------------------------
  // GAME FLOW
  // ----------------------------
  const startGame = async (role: GameRole, topic: GameTopic) => {
    clearQuestionTimer();
    clearAutoNextTimer();

    setStats({
      name: playerName,
      score: 0,
      streak: 0,
      role,
      topic,
      correctAnswers: 0,
      totalQuestions: 0,
    });

    setSelectedRole(role);
    setSelectedTopic(topic);

    setGameState(GameState.LOADING);
    await loadQuestion(topic, role);
  };

  const loadQuestion = async (topic: GameTopic, role: GameRole) => {
    clearQuestionTimer();
    clearAutoNextTimer();

    setGameState(GameState.LOADING);
    setVisualFeedback("idle");

    try {
      const q = await getQuestion(topic, role);
      setCurrentQuestion(q);

      setSelectedOption(0);
      setShowExplanation(false);
      setTimeLeft(QUESTION_TIME_SECONDS);
      setAutoNextTime(AUTO_NEXT_DELAY_SECONDS);

      setGameState(GameState.PLAYING);
    } catch (err) {
      console.error("Erro ao carregar pergunta:", err);

      setCurrentQuestion({
        id: "fallback",
        scenario: "Falha ao carregar questões. Tente novamente.",
        options: ["OK", "Entendido", "Prosseguir", "Voltar"],
        correctIndex: 0,
        explanation: "Verifique se os arquivos JSON foram importados corretamente.",
        difficulty: "Médio",
        topic,
        role,
      });

      setSelectedOption(0);
      setShowExplanation(false);
      setTimeLeft(QUESTION_TIME_SECONDS);
      setAutoNextTime(AUTO_NEXT_DELAY_SECONDS);
      setGameState(GameState.PLAYING);
    }
  };

  // ----------------------------
  // ANSWER / TIMEOUT
  // ----------------------------
  const handleTimeout = () => {
    if (!currentQuestion) return;
    if (showExplanation) return;

    clearQuestionTimer();

    setSelectedOption(-1);
    audioService.playTimeout?.();
    audioService.playWrong();

    setVisualFeedback("wrong");
    setStats((prev) => ({
      ...prev,
      streak: 0,
      totalQuestions: prev.totalQuestions + 1,
    }));

    setShowExplanation(true);
  };

  const handleAnswerSubmission = (choiceIndex: number) => {
    if (!currentQuestion) return;
    if (showExplanation) return;

    clearQuestionTimer();

    setSelectedOption(choiceIndex);
    const isCorrect = choiceIndex === currentQuestion.correctIndex;
    const scoreToAdd = isCorrect ? 100 + stats.streak * 10 : 0;

    if (isCorrect) {
      audioService.playCorrect();
      setVisualFeedback("correct");
      setScoreAnimation(scoreToAdd);

      setStats((prev) => ({
        ...prev,
        score: prev.score + scoreToAdd,
        streak: prev.streak + 1,
        correctAnswers: prev.correctAnswers + 1,
        totalQuestions: prev.totalQuestions + 1,
      }));
    } else {
      audioService.playWrong();
      setVisualFeedback("wrong");

      setStats((prev) => ({
        ...prev,
        streak: 0,
        totalQuestions: prev.totalQuestions + 1,
      }));
    }

    setShowExplanation(true);
  };

  const saveScore = async (snapshot: PlayerStats) => {
  const newEntry: ScoreEntry = {
    name: snapshot.name,
    score: snapshot.score,
    role: snapshot.role,
    date: new Date().toLocaleDateString("pt-BR"),
  };

  console.log("Tentando salvar score:", newEntry);
  
  try {
    const updated = await scoreService.saveScore(newEntry);
    setHighScores(updated);
    console.log("Score salvo com sucesso, novo ranking:", updated);
    return updated; // <-- ADICIONE ESTA LINHA
  } catch (error) {
    console.error("Erro ao salvar score:", error);
    throw error; // <-- Lançar erro para ser capturado pelo caller
  }
};

  const nextRound = () => {
  clearAutoNextTimer();

  setStats((prev) => {
    const finished = prev.totalQuestions >= QUESTIONS_PER_ROUND;

    if (finished) {
      setGameState(GameState.RESULT);

      // ✅ Salva ranking ASSINCRONAMENTE sem bloquear
      saveScore(prev).then(() => {
        console.log("✅ Score salvo após fim de jogo");
        if (prev.correctAnswers >= QUESTIONS_PER_ROUND * 0.7) {
          audioService.playWin();
        }
      }).catch(error => {
        console.error("❌ Erro ao salvar score final:", error);
      });

      return prev;
    }

    void loadQuestion(selectedTopic, selectedRole);
    return prev;
  });
};

  // ----------------------------
  // DEBUG EFFECTS
  // ----------------------------
  useEffect(() => {
    console.log("Estado atualizado - stats:", stats);
    console.log("Estado atualizado - gameState:", gameState);
  }, [stats, gameState]);

  // ----------------------------
  // INPUT
  // ----------------------------
  const handleInput = useCallback(
    (key: string) => {
      if (key === "Escape") {
        if (gameState === GameState.NAME_ENTRY) return;
        if (gameState === GameState.PRESS_START) return;
        if (gameState !== GameState.HOME) {
          setGameState(GameState.HOME);
          setMenuIndex(0);
          audioService.playBack();
        }
        return;
      }

      // PRESS START
      if (gameState === GameState.PRESS_START) {
        if (key === "Enter" || key === " " || key === "z" || key === "a" || key === "b") {
          (async () => {
            await audioService.unlock();
            audioService.playSelect();
            audioService.playBGM("menu");
            setGameState(GameState.HOME);
          })();
        }
        return;
      }

      // HOME
      if (gameState === GameState.HOME) {
        const MENU_ITEMS = 4;

        if (key === "ArrowUp") {
          setMenuIndex((p) => (p > 0 ? p - 1 : MENU_ITEMS - 1));
          audioService.playNavigate();
        } else if (key === "ArrowDown") {
          setMenuIndex((p) => (p < MENU_ITEMS - 1 ? p + 1 : 0));
          audioService.playNavigate();
        } else if (key === "ArrowLeft" || key === "ArrowRight") {
          const delta = key === "ArrowRight" ? 0.1 : -0.1;
          if (menuIndex === 2) setMusicVol((v) => Math.min(1, Math.max(0, v + delta)));
          if (menuIndex === 3) {
            setSfxVol((v) => Math.min(1, Math.max(0, v + delta)));
            audioService.playNavigate();
          }
        } else if (key === "Enter" || key === " " || key === "z") {
          if (menuIndex === 0) {
            setGameState(GameState.NAME_ENTRY);
            audioService.playSelect();
          } else if (menuIndex === 1) {
            setGameState(GameState.RANKING);
            audioService.playSelect();
          }
        }
        return;
      }

      // RANKING
      if (gameState === GameState.RANKING) {
        if (key === "Enter" || key === " " || key === "z" || key === "Backspace") {
          setGameState(GameState.HOME);
          audioService.playBack();
        }
        return;
      }

      // ROLE_SELECT
      if (gameState === GameState.ROLE_SELECT) {
        if (key === "ArrowUp") {
          setMenuIndex((p) => (p > 0 ? p - 1 : ROLES.length - 1));
          audioService.playNavigate();
        } else if (key === "ArrowDown") {
          setMenuIndex((p) => (p < ROLES.length - 1 ? p + 1 : 0));
          audioService.playNavigate();
        } else if (key === "Enter" || key === " " || key === "z") {
          setSelectedRole(ROLES[menuIndex]);
          setGameState(GameState.PROTOCOL_SELECT);
          setMenuIndex(0);
          audioService.playSelect();
        }
        return;
      }

      // PROTOCOL_SELECT
      if (gameState === GameState.PROTOCOL_SELECT) {
        if (key === "ArrowUp") {
          setMenuIndex((p) => (p > 0 ? p - 1 : TOPICS.length - 1));
          audioService.playNavigate();
        } else if (key === "ArrowDown") {
          setMenuIndex((p) => (p < TOPICS.length - 1 ? p + 1 : 0));
          audioService.playNavigate();
        } else if (key === "Enter" || key === " " || key === "z") {
          const topic = TOPICS[menuIndex];
          setSelectedTopic(topic);
          void startGame(selectedRole, topic);
          audioService.playSelect();
        }
        return;
      }

      // PLAYING (answer)
      if (gameState === GameState.PLAYING && !showExplanation) {
        if (key === "ArrowUp") {
          setSelectedOption((p) => (p > 0 ? p - 1 : 3));
          audioService.playNavigate();
        } else if (key === "ArrowDown") {
          setSelectedOption((p) => (p < 3 ? p + 1 : 0));
          audioService.playNavigate();
        } else if (key === "Enter" || key === " " || key === "z") {
          handleAnswerSubmission(selectedOption);
        }

        if (key === "a") handleAnswerSubmission(0);
        if (key === "b") handleAnswerSubmission(1);
        if (key === "c") handleAnswerSubmission(2);
        if (key === "d") handleAnswerSubmission(3);

        return;
      }

      // EXPLANATION / RESULT
      if ((gameState === GameState.PLAYING && showExplanation) || gameState === GameState.RESULT) {
        if (key === "Enter" || key === " " || key === "z") {
          if (gameState === GameState.RESULT) setGameState(GameState.HOME);
          else nextRound();
        }
      }
    },
    [gameState, menuIndex, selectedRole, selectedOption, showExplanation, selectedTopic]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      handleInput(e.key);
    };

    if (gameState !== GameState.NAME_ENTRY) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      if (gameState !== GameState.NAME_ENTRY) window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleInput, gameState]);

  // ----------------------------
  // RENDERS
  // ----------------------------
  const renderPressStart = () => (
    <div className="flex flex-col items-center justify-center h-full w-full select-none z-20">
      <div className="mb-16 text-center space-y-2 animate-float">
        <h1
          className="text-6xl md:text-9xl text-yellow-400 font-arcade glow-text"
          style={{ textShadow: "4px 4px 0px #8B0000" }}
        >
          ARCADE SHOW
        </h1>
        <div className="bg-black/80 px-4 py-2 inline-block border-2 border-red-600 rounded">
          <h2 className="text-2xl md:text-4xl text-white font-arcade tracking-[0.3em]">
            HOSPITAL SANTA MÔNICA
          </h2>
        </div>
      </div>
      <div className="mt-8">
        <span
          className={`text-2xl md:text-4xl text-green-400 font-arcade ${
            blink ? "opacity-100" : "opacity-20"
          } transition-opacity duration-100`}
        >
          PRESS START
        </span>
      </div>
      <div className="mt-12 text-gray-400 font-arcade text-xs md:text-sm bg-black/50 p-2 rounded">
        1UP | 10 QUESTÕES | RANKING LOCAL
      </div>
    </div>
  );
  
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto space-y-8 select-none z-20">
      <div className="text-center space-y-2 mb-4">
         <h1 className="text-4xl md:text-6xl text-yellow-400 font-arcade glow-text">MENU PRINCIPAL</h1>
      </div>
      <div className="w-full space-y-4 px-4">
        <button
          onMouseEnter={() => { setMenuIndex(0); audioService.playNavigate(); }}
          onClick={() => { setGameState(GameState.NAME_ENTRY); audioService.playSelect(); }}
          className={`w-full p-4 border-4 text-center text-xl font-arcade transition-all cursor-pointer ${menuIndex === 0 ? 'border-green-400 text-green-400 bg-green-900/60 scale-105 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'border-gray-700 text-gray-500 bg-black/50'}`}
        >
          INICIAR GAME
        </button>
        <button
          onMouseEnter={() => { setMenuIndex(1); audioService.playNavigate(); }}
          onClick={() => { setGameState(GameState.RANKING); audioService.playSelect(); }}
          className={`w-full p-4 border-4 text-center text-xl font-arcade transition-all cursor-pointer ${menuIndex === 1 ? 'border-purple-400 text-purple-400 bg-purple-900/60 scale-105 shadow-[0_0_20px_rgba(192,132,252,0.5)]' : 'border-gray-700 text-gray-500 bg-black/50'}`}
        >
          RANKING (TOP 10)
        </button>
        <div className="flex gap-4">
          <div 
            onMouseEnter={() => { setMenuIndex(2); audioService.playNavigate(); }}
            onClick={() => setMusicVol(v => v >= 1 ? 0 : v + 0.1)}
            className={`flex-1 p-3 border-2 text-center transition-all cursor-pointer bg-black/50 ${menuIndex === 2 ? 'border-blue-400' : 'border-gray-800'}`}
          >
            <div className="text-blue-300 mb-1 font-arcade text-xs">MÚSICA</div>
            <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{width: `${musicVol * 100}%`}} />
            </div>
          </div>
          <div 
            onMouseEnter={() => { setMenuIndex(3); audioService.playNavigate(); }}
            onClick={() => { setSfxVol(v => v >= 1 ? 0 : v + 0.1); audioService.playSelect(); }}
            className={`flex-1 p-3 border-2 text-center transition-all cursor-pointer bg-black/50 ${menuIndex === 3 ? 'border-blue-400' : 'border-gray-800'}`}
          >
            <div className="text-blue-300 mb-1 font-arcade text-xs">SFX</div>
            <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{width: `${sfxVol * 100}%`}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRanking = () => (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto p-8 select-none z-20">
      <h2 className="text-4xl text-yellow-400 font-arcade mb-8 glow-text">HALL DA FAMA</h2>
      <div className="w-full border-4 border-blue-500 bg-black/90 p-4 rounded-lg overflow-y-auto max-h-[60vh] shadow-[0_0_30px_rgba(59,130,246,0.3)]">
        <table className="w-full text-left font-arcade text-sm md:text-base">
          <thead className="text-blue-300 border-b-2 border-blue-500">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">NOME</th>
              <th className="p-3">SCORE</th>
              <th className="p-3 hidden md:table-cell">ROLE</th>
              <th className="p-3 hidden md:table-cell">DATA</th>
            </tr>
          </thead>
          <tbody>
            {highScores.map((entry, i) => (
              <tr key={i} className={`border-b border-gray-800 ${i === 0 ? 'text-yellow-300 animate-pulse' : 'text-gray-300'}`}>
                <td className="p-3">{i + 1}</td>
                <td className="p-3">{entry.name}</td>
                <td className="p-3 text-green-400">{entry.score.toString().padStart(6, '0')}</td>
                <td className="p-3 hidden md:table-cell text-xs opacity-70">{entry.role}</td>
                <td className="p-3 hidden md:table-cell text-xs text-gray-500">{entry.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button 
        onClick={() => { setGameState(GameState.HOME); audioService.playBack(); }}
        className="mt-8 px-8 py-4 bg-red-900/80 border-2 border-red-500 text-white font-arcade hover:bg-red-700 hover:scale-105 transition-all"
      >
        VOLTAR
      </button>
    </div>
  );

  const renderRoleSelect = () => (
    <div className="flex flex-col items-center justify-center h-full w-full space-y-8 select-none z-20">
      <h2 className="text-4xl text-white font-arcade mb-8">ESCOLHA O PERFIL</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl px-4">
        {ROLES.map((role, idx) => (
          <button 
            key={role} 
            onMouseEnter={() => { setMenuIndex(idx); audioService.playNavigate(); }}
            onClick={() => { 
               setSelectedRole(role); 
               setGameState(GameState.PROTOCOL_SELECT); 
               setMenuIndex(0); 
               audioService.playSelect(); 
            }}
            className={`p-6 border-4 font-arcade text-xl text-center transition-all duration-100 cursor-pointer ${
              menuIndex === idx 
                ? `${ROLE_COLORS[role]} scale-105 shadow-[0_0_30px_currentColor] z-10 bg-black`
                : 'border-gray-800 text-gray-600 bg-black/60 hover:bg-gray-900'
            }`}
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );

  const renderProtocolSelect = () => (
    <div className="flex flex-col items-center justify-center h-full w-full space-y-8 select-none z-20">
      <div className="text-center">
         <h2 className="text-4xl text-white font-arcade mb-2">PROTOCOLO</h2>
         <p className={`text-xl font-arcade opacity-80 ${ROLE_COLORS[selectedRole].split(' ')[0]}`}>{selectedRole}</p>
      </div>
      <div className="w-full max-w-2xl space-y-4 px-4">
        {TOPICS.map((topic, idx) => (
          <button 
             key={topic}
             onMouseEnter={() => { setMenuIndex(idx); audioService.playNavigate(); }}
             onClick={() => {
                setSelectedTopic(topic);
                startGame(selectedRole, topic);
                audioService.playSelect();
             }}
             className={`w-full p-6 border-4 font-arcade text-2xl text-center transition-all cursor-pointer ${
               menuIndex === idx
                 ? 'border-purple-500 text-purple-300 bg-purple-900/60 scale-105 shadow-[0_0_30px_rgba(168,85,247,0.5)] z-10'
                 : 'border-gray-800 text-gray-600 bg-black/60 hover:bg-gray-900'
             }`}
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );

  const renderGame = () => {
    if (!currentQuestion) return null;
    
    const timerWidth = Math.max(0, (timeLeft / QUESTION_TIME_SECONDS) * 100);
    const autoNextWidth = Math.max(0, (autoNextTime / AUTO_NEXT_DELAY_SECONDS) * 100);
    
    let timerColor = "bg-gradient-to-r from-green-500 to-green-400";
    if (timeLeft < 10) timerColor = "bg-gradient-to-r from-yellow-500 to-yellow-400";
    if (timeLeft < 5) timerColor = "bg-gradient-to-r from-red-600 to-red-500";

    const containerClasses = `flex flex-col h-full w-full max-w-5xl mx-auto p-4 md:p-8 relative z-20 select-none ${visualFeedback === 'wrong' ? 'animate-shake' : ''}`;
    const flashClasses = visualFeedback === 'correct' ? 'animate-flash-green' : visualFeedback === 'wrong' ? 'animate-flash-red' : '';

    return (
      <>
        {scoreAnimation !== null && (
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className="text-5xl font-arcade text-yellow-400 glow-text shadow-lg">
              +{scoreAnimation}
            </div>
          </div>
        )}

        <div className={`absolute inset-0 pointer-events-none z-50 ${flashClasses}`} />

        <div className={containerClasses}>
          <div className="flex flex-wrap justify-between items-end border-b-2 border-gray-700 pb-4 mb-6 bg-gradient-to-r from-black/60 to-black/40 p-4 rounded-xl backdrop-blur-sm shadow-lg">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-400 text-xs font-arcade">JOGADOR</span>
              </div>
              <span className="text-white text-2xl font-arcade mt-1">{playerName}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className={`px-4 py-2 border-3 rounded-lg text-sm font-arcade mb-2 shadow-[0_0_15px_currentColor] flex items-center gap-2 ${ROLE_COLORS[stats.role]}`}>
                <div className="w-2 h-2 rounded-full bg-current"></div>
                {stats.role}
              </div>
              <span className="text-purple-300 font-arcade text-sm bg-purple-900/30 px-3 py-1 rounded-full">
                {stats.topic}
              </span>
            </div>
            
            <div className="flex flex-col items-end">
              <div className="relative">
                <span className="text-yellow-400 font-arcade text-3xl glow-text">
                  {stats.score.toString().padStart(6,'0')}
                </span>
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <div className="flex gap-3 text-xs text-gray-400 font-arcade mt-2">
                <span className="bg-gray-800 px-2 py-1 rounded">STREAK: <span className="text-blue-400">{stats.streak}</span></span>
                <span className="bg-gray-800 px-2 py-1 rounded">Q: <span className="text-green-400">{stats.totalQuestions+1}</span>/<span className="text-white">{QUESTIONS_PER_ROUND}</span></span>
              </div>
            </div>
          </div>

          <div className="relative mb-8">
            <div className="w-full h-8 bg-gray-900 rounded-full border-2 border-gray-700 overflow-hidden shadow-inner relative">
              <div 
                className={`h-full transition-all duration-1000 ease-linear ${timerColor} ${timeLeft < 5 ? 'animate-pulse' : ''}`} 
                style={{ width: `${timerWidth}%` }} 
              />
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <div className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">
                  TEMPO
                </div>
                <div className="text-lg font-arcade font-bold text-white drop-shadow-lg">
                  {timeLeft}s
                </div>
              </div>
            </div>
            
            <div className="flex justify-between w-full mt-2">
              {[20, 15, 10, 5, 0].map((mark) => (
                <div key={mark} className="text-xs text-gray-500 font-arcade">
                  {mark}s
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-black/90 to-gray-900/90 border-4 border-blue-600 p-8 rounded-2xl mb-8 shadow-[0_0_40px_rgba(59,130,246,0.4)] min-h-[180px] flex items-center justify-center backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full translate-x-24 translate-y-24"></div>
            
            <div className="relative z-10 w-full">
              <div className="flex items-center justify-center mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">?</span>
                </div>
                <span className="text-blue-300 font-arcade text-sm uppercase tracking-wider">QUESTÃO {stats.totalQuestions + 1}</span>
              </div>
              
              <p className="text-2xl md:text-3xl text-blue-100 text-center font-bold leading-relaxed font-sans drop-shadow-lg">
                {currentQuestion.scenario}
              </p>
              
              <div className="flex justify-center mt-4">
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
                    {currentQuestion.difficulty}
                  </span>
                  <span className="px-3 py-1 bg-blue-900/50 rounded-full text-xs text-blue-300">
                    {currentQuestion.topic}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {currentQuestion.options.map((opt, idx) => {
              const optionLetter = ['A','B','C','D'][idx];
              let style = "border-gray-700 text-gray-400 bg-gradient-to-br from-gray-900 to-black";
              let hoverStyle = "hover:border-gray-500 hover:text-gray-300 hover:scale-[1.02]";
              let letterBg = "bg-gray-800";
              let letterText = "text-gray-400";
              
              if (showExplanation) {
                if (idx === currentQuestion.correctIndex) {
                  style = "border-green-500 bg-gradient-to-br from-green-900/80 to-green-800/60 text-green-100 scale-[1.02] shadow-[0_0_25px_rgba(34,197,94,0.5)]";
                  letterBg = "bg-green-600";
                  letterText = "text-white";
                } else if (selectedOption !== -1 && idx === selectedOption) {
                  style = "border-red-500 bg-gradient-to-br from-red-900/80 to-red-800/60 text-red-200 opacity-80";
                  letterBg = "bg-red-600";
                  letterText = "text-white";
                } else {
                  style = "border-gray-800 text-gray-600 bg-gray-900/40 opacity-40";
                  hoverStyle = "";
                }
              } else {
                if (idx === selectedOption) {
                  style = "border-yellow-400 bg-gradient-to-br from-yellow-900/60 to-amber-900/40 text-yellow-100 shadow-[0_0_25px_rgba(250,204,21,0.3)] scale-[1.02]";
                  letterBg = "bg-yellow-600";
                  letterText = "text-white";
                  hoverStyle = "";
                } else {
                  hoverStyle = "hover:border-gray-500 hover:text-gray-300 hover:scale-[1.02] hover:bg-gray-800/50";
                }
              }

              return (
                <button 
                  key={idx} 
                  onMouseEnter={() => { if (!showExplanation) { setSelectedOption(idx); audioService.playNavigate(); }}}
                  onClick={() => { if (!showExplanation) handleAnswerSubmission(idx); }}
                  disabled={showExplanation}
                  className={`p-6 border-3 rounded-xl text-lg font-bold transition-all duration-200 text-left flex items-center cursor-pointer ${style} ${hoverStyle} group relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  
                  <span className={`w-12 h-12 flex items-center justify-center border-2 border-current rounded-full mr-5 text-xl font-arcade font-bold shrink-0 ${letterBg} ${letterText} shadow-lg`}>
                    {optionLetter}
                  </span>
                  
                  <div className="flex-1">
                    <p className="text-lg leading-relaxed">{opt}</p>
                    {!showExplanation && idx === selectedOption && (
                      <div className="text-xs text-yellow-300 font-arcade mt-2 animate-pulse">
                        PRESSIONE ENTER PARA CONFIRMAR
                      </div>
                    )}
                  </div>
                  
                  {!showExplanation && idx === selectedOption && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full animate-ping"></div>
                  )}
                </button>
              );
            })}
          </div>

          {!showExplanation && (
            <div className="flex justify-center gap-8 mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-400 font-arcade">
                <span className="bg-gray-800 px-3 py-1 rounded border border-gray-700">↑↓</span>
                <span>NAVEGAR</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400 font-arcade">
                <span className="bg-gray-800 px-3 py-1 rounded border border-gray-700">A/B/C/D</span>
                <span>SELECIONAR</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400 font-arcade">
                <span className="bg-gray-800 px-3 py-1 rounded border border-gray-700">ENTER</span>
                <span>CONFIRMAR</span>
              </div>
            </div>
          )}

          {showExplanation && (
            <div 
              onClick={() => nextRound()}
              className="fixed inset-0 md:absolute md:inset-x-0 md:bottom-0 md:top-auto md:left-1/2 md:-translate-x-1/2 md:w-[800px] bg-gradient-to-b from-black to-gray-900 border-4 border-white p-8 z-50 shadow-[0_0_200px_rgba(0,0,0,1)] animate-pop-in rounded-2xl overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-32 h-32 bg-green-500 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 right-10 w-48 h-48 bg-blue-500 rounded-full blur-3xl"></div>
              </div>

              <div className="absolute top-6 right-6 opacity-30">
                {selectedOption === currentQuestion.correctIndex ? (
                  <div className="relative">
                    <svg className="w-32 h-32 text-green-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute inset-0 bg-green-500 rounded-full blur-xl"></div>
                  </div>
                ) : (
                  <div className="relative">
                    <svg className="w-32 h-32 text-red-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute inset-0 bg-red-500 rounded-full blur-xl"></div>
                  </div>
                )}
              </div>

              <h3 className={`text-center font-arcade text-4xl mb-8 relative z-10 ${selectedOption === currentQuestion.correctIndex ? 'text-green-400' : 'text-red-400'} drop-shadow-lg`}>
                {selectedOption === currentQuestion.correctIndex ? '✅ RESPOSTA CORRETA!' : '❌ RESPOSTA ERRADA'}
              </h3>
              
              <div className="bg-gray-900/70 border-2 border-gray-700 p-6 rounded-xl mb-8 relative z-10">
                <div className="text-gray-300 text-sm font-arcade mb-3 uppercase tracking-wider">EXPLICAÇÃO</div>
                <p className="text-white text-xl font-sans leading-relaxed">
                  {currentQuestion.explanation}
                </p>
              </div>

              <div className="relative z-10">
                <div className="flex justify-between text-sm text-gray-400 font-arcade mb-2">
                  <span>PRÓXIMA QUESTÃO</span>
                  <span>{Math.ceil(autoNextTime)}s</span>
                </div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-white to-gray-300 transition-all duration-1000 ease-linear"
                    style={{ width: `${100 - autoNextWidth}%` }}
                  />
                </div>
                <div className="text-center mt-3 text-xs text-gray-500 font-arcade">
                  CLIQUE OU PRESSIONE ENTER PARA AVANÇAR
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderResult = () => {
  const date = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="flex flex-col items-center justify-center h-full w-full space-y-6 z-20 select-none">
      <h2 className="text-6xl text-white font-arcade glow-text">FIM DE JOGO</h2>
        <div className="w-full max-w-lg bg-black/80 border-4 border-yellow-500 rounded-2xl p-8">
        <div className="text-gray-300 font-arcade text-sm">JOGADOR</div>
        <div className="text-white font-arcade text-3xl mb-4">{stats.name || playerName}</div>

        <div className="grid grid-cols-2 gap-4 font-arcade">
          <div>
            <div className="text-gray-400 text-xs">ROLE</div>
            <div className="text-blue-300">{stats.role}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">DATA</div>
            <div className="text-gray-200">{date}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">SCORE</div>
            <div className="text-yellow-400 text-3xl">{stats.score}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">ACERTOS</div>
            <div className="text-green-400">{stats.correctAnswers}/{QUESTIONS_PER_ROUND}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          className="px-6 py-4 border-2 border-green-500 text-green-400 font-arcade bg-black/60 hover:bg-green-900/60 transition-all"
          onClick={() => setGameState(GameState.HOME)}
        >
          MENU
        </button>

        <button
          className="px-6 py-4 border-2 border-purple-500 text-purple-400 font-arcade bg-black/60 hover:bg-purple-900/60 transition-all"
          onClick={() => setGameState(GameState.RANKING)}
        >
          RANKING
        </button>
      </div>
    </div>
  );
};

  return (
    <div className="w-full h-screen bg-transparent overflow-hidden flex flex-col relative font-sans selection:bg-transparent">
      <ArcadeBackground />

      <div
        className={`absolute inset-0 transition-colors duration-1000 z-10 pointer-events-none 
        ${gameState === GameState.PLAYING ? 
          (stats.role === GameRole.NURSE ? 'bg-gradient-to-br from-green-900/10 via-transparent to-green-900/5' : 
           stats.role === GameRole.DOCTOR ? 'bg-gradient-to-br from-red-900/10 via-transparent to-red-900/5' :
           stats.role === GameRole.TECH ? 'bg-gradient-to-br from-blue-900/10 via-transparent to-blue-900/5' :
           'bg-gradient-to-br from-yellow-900/10 via-transparent to-yellow-900/5') 
          : 'bg-black/10'}`}
      />

      <div className="relative z-20 w-full h-full">
        {gameState === GameState.PRESS_START && renderPressStart()}
        {gameState === GameState.HOME && renderHome()}
        {gameState === GameState.RANKING && renderRanking()}
        {gameState === GameState.NAME_ENTRY && (
          <div className="flex items-center justify-center h-full z-20">
            <VirtualKeyboard
              initialName={playerName === "JOGADOR" ? "" : playerName}
              onComplete={(name) => {
                setPlayerName(name || "JOGADOR");
                setMenuIndex(0);
                setGameState(GameState.ROLE_SELECT);
                audioService.playSelect();
              }}
              onCancel={() => {
                setGameState(GameState.HOME);
                audioService.playBack();
              }}
            />
          </div>
        )}
        {gameState === GameState.ROLE_SELECT && renderRoleSelect()}
        {gameState === GameState.PROTOCOL_SELECT && renderProtocolSelect()}
        {gameState === GameState.LOADING && (
          <div className="flex flex-col items-center justify-center h-full z-20">
            <div className="text-3xl text-blue-400 font-arcade animate-pulse mb-6 flex items-center gap-3">
              <span>CARREGANDO</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "100ms" }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "200ms" }} />
              </div>
            </div>
            <div className="w-80 h-4 bg-gray-900 rounded-full border-2 border-blue-900 overflow-hidden shadow-lg">
              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-[width_2s_ease-in-out_infinite] w-full origin-left rounded-full" />
            </div>
          </div>
        )}
        {gameState === GameState.PLAYING && renderGame()}
        {gameState === GameState.RESULT && renderResult()}
      </div>

      <JoystickHint />
    </div>
  );
};

export default App;