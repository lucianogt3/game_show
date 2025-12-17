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
  const [isMobile, setIsMobile] = useState(false);
  const [touchActive, setTouchActive] = useState(false);

  // ----------------------------
  // REFS
  // ----------------------------
  const questionTimerRef = useRef<number | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);
  const scoreAnimationRef = useRef<number | null>(null);
  const touchStartY = useRef<number>(0);

  // ----------------------------
  // CONSTANTS
  // ----------------------------
  const QUESTIONS_PER_ROUND = 10;
  const QUESTION_TIME_SECONDS = 20;
  const AUTO_NEXT_DELAY_SECONDS = 6;

  const ROLES = [GameRole.NURSE, GameRole.DOCTOR, GameRole.TECH, GameRole.MULTI];
  const TOPICS = [GameTopic.SEPSIS, GameTopic.STROKE, GameTopic.CHEST_PAIN];

  const ROLE_COLORS: Record<GameRole, string> = {
    [GameRole.NURSE]: "bg-green-900/80 border-green-500 text-green-300",
    [GameRole.DOCTOR]: "bg-red-900/80 border-red-500 text-red-300",
    [GameRole.TECH]: "bg-blue-900/80 border-blue-500 text-blue-300",
    [GameRole.MULTI]: "bg-yellow-900/80 border-yellow-500 text-yellow-300",
  };

  // ----------------------------
  // DETECT MOBILE
  // ----------------------------
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || 
                    ('ontouchstart' in window && window.innerWidth <= 1024);
      setIsMobile(mobile);
      console.log("📱 Dispositivo móvel:", mobile, "Largura:", window.innerWidth);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ----------------------------
  // GLOBAL TOUCH FOR PRESS START
  // ----------------------------
  useEffect(() => {
    if (gameState !== GameState.PRESS_START) return;
    
    const handleGlobalStart = () => {
      console.log('🚀 Iniciando jogo...');
      audioService.playSelect();
      setGameState(GameState.HOME);
    };
    
    window.addEventListener('click', handleGlobalStart);
    window.addEventListener('touchstart', handleGlobalStart);
    
    return () => {
      window.removeEventListener('click', handleGlobalStart);
      window.removeEventListener('touchstart', handleGlobalStart);
    };
  }, [gameState]);

  // ----------------------------
  // TOUCH GESTURES FOR MOBILE
  // ----------------------------
  useEffect(() => {
    if (!isMobile || gameState !== GameState.PLAYING || showExplanation) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      setTouchActive(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      setTouchActive(false);
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchEndY - touchStartY.current;
      
      // Swipe para cima/baixo navega entre opções
      if (Math.abs(deltaY) > 50) {
        if (deltaY < 0) {
          // Swipe para cima
          setSelectedOption(prev => Math.min(3, prev + 1));
        } else {
          // Swipe para baixo
          setSelectedOption(prev => Math.max(0, prev - 1));
        }
        audioService.playNavigate();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, gameState, showExplanation]);

  // ----------------------------
  // CLEAR TIMERS
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

    if ([GameState.HOME, GameState.ROLE_SELECT, GameState.PROTOCOL_SELECT, 
         GameState.NAME_ENTRY, GameState.RANKING].includes(gameState)) {
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
  // TIMER: EXPLANATION
  // ----------------------------
  useEffect(() => {
    clearAutoNextTimer();

    if (gameState !== GameState.PLAYING || !showExplanation) {
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
    if (!currentQuestion || showExplanation) return;
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
    if (!currentQuestion || showExplanation) return;
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

    try {
      const updated = await scoreService.saveScore(newEntry);
      setHighScores(updated);
      return updated;
    } catch (error) {
      console.error("Erro ao salvar score:", error);
      throw error;
    }
  };

  const nextRound = () => {
    clearAutoNextTimer();
    setStats((prev) => {
      const finished = prev.totalQuestions >= QUESTIONS_PER_ROUND;
      if (finished) {
        setGameState(GameState.RESULT);
        saveScore(prev).then(() => {
          if (prev.correctAnswers >= QUESTIONS_PER_ROUND * 0.7) {
            audioService.playWin();
          }
        });
        return prev;
      }
      void loadQuestion(selectedTopic, selectedRole);
      return prev;
    });
  };

  // ----------------------------
  // INPUT HANDLING
  // ----------------------------
  const handleInput = useCallback((key: string) => {
    if (key === "Escape" && gameState !== GameState.PRESS_START && gameState !== GameState.NAME_ENTRY && gameState !== GameState.HOME) {
      setGameState(GameState.HOME);
      setMenuIndex(0);
      audioService.playBack();
      return;
    }

    if (gameState === GameState.PRESS_START && (key === "Enter" || key === " " || key === "z")) {
      audioService.playSelect();
      setGameState(GameState.HOME);
      return;
    }

    if (gameState === GameState.HOME) {
      if (key === "ArrowUp") setMenuIndex(p => p > 0 ? p - 1 : 3);
      else if (key === "ArrowDown") setMenuIndex(p => p < 3 ? p + 1 : 0);
      else if (key === "Enter" || key === " " || key === "z") {
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

    if (gameState === GameState.RANKING && (key === "Enter" || key === " " || key === "z" || key === "Backspace")) {
      setGameState(GameState.HOME);
      audioService.playBack();
      return;
    }

    if (gameState === GameState.ROLE_SELECT) {
      if (key === "ArrowUp") setMenuIndex(p => p > 0 ? p - 1 : ROLES.length - 1);
      else if (key === "ArrowDown") setMenuIndex(p => p < ROLES.length - 1 ? p + 1 : 0);
      else if (key === "Enter" || key === " " || key === "z") {
        setSelectedRole(ROLES[menuIndex]);
        setGameState(GameState.PROTOCOL_SELECT);
        setMenuIndex(0);
        audioService.playSelect();
      }
      return;
    }

    if (gameState === GameState.PROTOCOL_SELECT) {
      if (key === "ArrowUp") setMenuIndex(p => p > 0 ? p - 1 : TOPICS.length - 1);
      else if (key === "ArrowDown") setMenuIndex(p => p < TOPICS.length - 1 ? p + 1 : 0);
      else if (key === "Enter" || key === " " || key === "z") {
        const topic = TOPICS[menuIndex];
        setSelectedTopic(topic);
        void startGame(selectedRole, topic);
        audioService.playSelect();
      }
      return;
    }

    if (gameState === GameState.PLAYING && !showExplanation) {
      if (key === "ArrowUp") setSelectedOption(p => p > 0 ? p - 1 : 3);
      else if (key === "ArrowDown") setSelectedOption(p => p < 3 ? p + 1 : 0);
      else if (key === "Enter" || key === " " || key === "z") {
        handleAnswerSubmission(selectedOption);
      }
      if (key === "a") handleAnswerSubmission(0);
      if (key === "b") handleAnswerSubmission(1);
      if (key === "c") handleAnswerSubmission(2);
      if (key === "d") handleAnswerSubmission(3);
      return;
    }

    if ((gameState === GameState.PLAYING && showExplanation) || gameState === GameState.RESULT) {
      if (key === "Enter" || key === " " || key === "z") {
        if (gameState === GameState.RESULT) setGameState(GameState.HOME);
        else nextRound();
      }
    }
  }, [gameState, menuIndex, selectedRole, selectedOption, showExplanation, selectedTopic]);

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
  // MOBILE-OPTIMIZED RENDERS
  // ----------------------------
  const renderPressStart = () => (
    <div className="flex flex-col items-center justify-center h-full w-full px-4">
      <div className="text-center mb-8 animate-float">
        <h1 className="text-5xl md:text-7xl lg:text-9xl text-yellow-400 font-arcade glow-text mb-4" 
            style={{ textShadow: "4px 4px 0px #8B0000" }}>
          DR. ARCADE
        </h1>
        <div className="bg-black/90 px-4 py-3 inline-block border-3 border-red-600 rounded-lg">
          <h2 className="text-xl md:text-3xl lg:text-4xl text-white font-arcade tracking-wider">
            EMERGÊNCIA
          </h2>
        </div>
      </div>
      
      <div className={`mt-12 p-6 rounded-2xl border-3 ${blink ? 'border-green-500 bg-green-900/30' : 'border-green-800 bg-black/50'} transition-all duration-300 ${isMobile ? 'min-h-[120px] flex items-center justify-center' : ''}`}>
        <span className={`text-2xl md:text-4xl text-green-400 font-arcade ${isMobile ? 'text-center block' : ''}`}>
          {isMobile ? 'TOQUE PARA INICIAR' : 'PRESS START'}
        </span>
        {isMobile && (
          <div className="text-green-300 text-sm mt-2 animate-pulse">
            ⚡ Toque em qualquer lugar
          </div>
        )}
      </div>
      
      <div className="mt-8 text-gray-400 font-arcade text-sm bg-black/70 p-4 rounded-lg">
        {isMobile ? '👆 TOQUE • 📱 MOBILE • 🎮 ARCADE' : '1UP • 10 QUESTÕES • RANKING'}
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center h-full w-full px-4">
      <h1 className="text-3xl md:text-5xl text-yellow-400 font-arcade glow-text mb-8 text-center">
        MENU PRINCIPAL
      </h1>
      
      <div className="w-full max-w-md space-y-4">
        <button
          onClick={() => { setGameState(GameState.NAME_ENTRY); audioService.playSelect(); }}
          onTouchStart={() => { setGameState(GameState.NAME_ENTRY); audioService.playSelect(); }}
          className={`w-full p-5 border-4 text-center text-lg md:text-xl font-arcade rounded-xl active:scale-95 transition-all ${menuIndex === 0 ? 'border-green-400 text-green-300 bg-green-900/70 shadow-[0_0_30px_rgba(74,222,128,0.4)]' : 'border-gray-700 text-gray-400 bg-black/60'}`}
          style={{ minHeight: isMobile ? '70px' : 'auto' }}
        >
          ▶ INICIAR GAME
        </button>
        
        <button
          onClick={() => { setGameState(GameState.RANKING); audioService.playSelect(); }}
          onTouchStart={() => { setGameState(GameState.RANKING); audioService.playSelect(); }}
          className={`w-full p-5 border-4 text-center text-lg md:text-xl font-arcade rounded-xl active:scale-95 transition-all ${menuIndex === 1 ? 'border-purple-400 text-purple-300 bg-purple-900/70 shadow-[0_0_30px_rgba(192,132,252,0.4)]' : 'border-gray-700 text-gray-400 bg-black/60'}`}
          style={{ minHeight: isMobile ? '70px' : 'auto' }}
        >
          🏆 RANKING (TOP 10)
        </button>
        
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-black/60 p-4 rounded-xl border-2 border-blue-800">
            <div className="text-blue-300 mb-2 font-arcade text-sm">🔊 MÚSICA</div>
            <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-blue-500" style={{width: `${musicVol * 100}%`}} />
            </div>
            <div className="flex justify-between">
              <button onClick={() => setMusicVol(v => Math.max(0, v - 0.1))} className="text-blue-400 text-lg px-3">−</button>
              <span className="text-white text-sm">{Math.round(musicVol * 100)}%</span>
              <button onClick={() => setMusicVol(v => Math.min(1, v + 0.1))} className="text-blue-400 text-lg px-3">+</button>
            </div>
          </div>
          
          <div className="bg-black/60 p-4 rounded-xl border-2 border-blue-800">
            <div className="text-blue-300 mb-2 font-arcade text-sm">🎵 SFX</div>
            <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-blue-500" style={{width: `${sfxVol * 100}%`}} />
            </div>
            <div className="flex justify-between">
              <button onClick={() => { setSfxVol(v => Math.max(0, v - 0.1)); audioService.playSelect(); }} className="text-blue-400 text-lg px-3">−</button>
              <span className="text-white text-sm">{Math.round(sfxVol * 100)}%</span>
              <button onClick={() => { setSfxVol(v => Math.min(1, v + 0.1)); audioService.playSelect(); }} className="text-blue-400 text-lg px-3">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRanking = () => (
    <div className="flex flex-col items-center justify-center h-full w-full px-4">
      <h2 className="text-3xl md:text-4xl text-yellow-400 font-arcade glow-text mb-6 text-center">
        🏆 HALL DA FAMA
      </h2>
      
      <div className="w-full max-w-2xl bg-black/90 border-3 border-blue-500 rounded-2xl p-4 overflow-y-auto max-h-[60vh]">
        <div className="grid grid-cols-12 gap-2 text-blue-300 font-arcade text-sm border-b-2 border-blue-700 pb-2 mb-2">
          <div className="col-span-1">#</div>
          <div className="col-span-5">NOME</div>
          <div className="col-span-3">SCORE</div>
          <div className="col-span-3">ROLE</div>
        </div>
        
        {highScores.map((entry, i) => (
          <div key={i} className={`grid grid-cols-12 gap-2 py-3 border-b border-gray-800 ${i === 0 ? 'text-yellow-300 animate-pulse' : 'text-gray-300'}`}>
            <div className="col-span-1 font-bold">{i + 1}</div>
            <div className="col-span-5 truncate">{entry.name}</div>
            <div className="col-span-3 text-green-400 font-bold">{entry.score.toString().padStart(5,'0')}</div>
            <div className="col-span-3 text-xs opacity-70 truncate">{entry.role}</div>
          </div>
        ))}
      </div>
      
      <button 
        onClick={() => { setGameState(GameState.HOME); audioService.playBack(); }}
        onTouchStart={() => { setGameState(GameState.HOME); audioService.playBack(); }}
        className="mt-8 px-10 py-4 bg-red-900/80 border-3 border-red-500 text-white font-arcade text-lg rounded-xl active:scale-95 transition-all"
        style={{ minWidth: isMobile ? '200px' : 'auto' }}
      >
        ↩ VOLTAR
      </button>
    </div>
  );

  const renderRoleSelect = () => (
    <div className="flex flex-col items-center justify-center h-full w-full px-4">
      <h2 className="text-3xl md:text-4xl text-white font-arcade mb-8 text-center">
        👤 ESCOLHA O PERFIL
      </h2>
      
      <div className="w-full max-w-md space-y-4">
        {ROLES.map((role, idx) => (
          <button 
            key={role}
            onClick={() => { 
              setSelectedRole(role); 
              setGameState(GameState.PROTOCOL_SELECT); 
              audioService.playSelect(); 
            }}
            onTouchStart={() => { 
              setSelectedRole(role); 
              setGameState(GameState.PROTOCOL_SELECT); 
              audioService.playSelect(); 
            }}
            className={`w-full p-5 border-4 font-arcade text-lg md:text-xl text-center rounded-xl active:scale-95 transition-all ${ROLE_COLORS[role]} ${menuIndex === idx ? 'scale-105 shadow-[0_0_30px_currentColor]' : ''}`}
            style={{ minHeight: isMobile ? '80px' : 'auto' }}
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );

  const renderProtocolSelect = () => (
    <div className="flex flex-col items-center justify-center h-full w-full px-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl text-white font-arcade mb-2">📋 PROTOCOLO</h2>
        <p className={`text-xl font-arcade ${ROLE_COLORS[selectedRole].split(' ')[2]}`}>
          👤 {selectedRole}
        </p>
      </div>
      
      <div className="w-full max-w-md space-y-4">
        {TOPICS.map((topic, idx) => (
          <button 
            key={topic}
            onClick={() => {
              setSelectedTopic(topic);
              startGame(selectedRole, topic);
              audioService.playSelect();
            }}
            onTouchStart={() => {
              setSelectedTopic(topic);
              startGame(selectedRole, topic);
              audioService.playSelect();
            }}
            className={`w-full p-5 border-4 font-arcade text-lg md:text-xl text-center rounded-xl active:scale-95 transition-all ${menuIndex === idx ? 'border-purple-500 text-purple-300 bg-purple-900/70 scale-105 shadow-[0_0_30px_rgba(168,85,247,0.5)]' : 'border-gray-800 text-gray-400 bg-black/60'}`}
            style={{ minHeight: isMobile ? '80px' : 'auto' }}
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

    return (
      <>
        {scoreAnimation !== null && (
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className="text-4xl md:text-5xl font-arcade text-yellow-400 glow-text shadow-lg">
              +{scoreAnimation}
            </div>
          </div>
        )}

        <div className={`absolute inset-0 pointer-events-none z-50 ${visualFeedback === 'correct' ? 'animate-flash-green' : visualFeedback === 'wrong' ? 'animate-flash-red' : ''}`} />

        <div className={`flex flex-col h-full w-full px-2 md:px-4 relative z-20 select-none ${visualFeedback === 'wrong' ? 'animate-shake' : ''}`}>
          {/* HEADER MOBILE-OPTIMIZED */}
          <div className="flex justify-between items-center border-b-2 border-gray-700 pb-3 mb-4 bg-gradient-to-r from-black/80 to-black/60 p-3 rounded-xl mt-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-300 text-xs font-arcade">PLAYER</span>
              </div>
              <span className="text-white text-lg font-arcade truncate max-w-[100px]">{playerName}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className={`px-3 py-1 border-2 rounded-lg text-xs font-arcade mb-1 flex items-center gap-1 ${ROLE_COLORS[stats.role]}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                {stats.role.substring(0, isMobile ? 3 : 10)}
              </div>
              <span className="text-purple-200 font-arcade text-xs bg-purple-900/40 px-2 py-0.5 rounded">
                {stats.topic}
              </span>
            </div>
            
            <div className="flex flex-col items-end">
              <span className="text-yellow-300 font-arcade text-xl md:text-2xl glow-text">
                {stats.score.toString().padStart(isMobile ? 5 : 6,'0')}
              </span>
              <div className="flex gap-2 text-xs text-gray-400 font-arcade mt-1">
                <span className="bg-gray-800 px-2 py-0.5 rounded">🔥 {stats.streak}</span>
                <span className="bg-gray-800 px-2 py-0.5 rounded">Q{stats.totalQuestions+1}/{QUESTIONS_PER_ROUND}</span>
              </div>
            </div>
          </div>

          {/* TIMER MOBILE-FRIENDLY */}
          <div className="relative mb-4">
            <div className="w-full h-6 bg-gray-900 rounded-full border-2 border-gray-700 overflow-hidden shadow-inner relative">
              <div 
                className={`h-full transition-all duration-1000 ease-linear ${timerColor} ${timeLeft < 5 ? 'animate-pulse' : ''}`} 
                style={{ width: `${timerWidth}%` }} 
              />
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <div className="text-xs font-bold text-white bg-black/50 px-2 py-0.5 rounded">
                  ⏰ TEMPO
                </div>
                <div className="text-base font-arcade font-bold text-white drop-shadow-lg">
                  {timeLeft}s
                </div>
              </div>
            </div>
          </div>

          {/* QUESTION CARD */}
          <div className="bg-gradient-to-br from-black/95 to-gray-900/95 border-3 border-blue-600 p-4 md:p-6 rounded-xl mb-4 min-h-[120px] flex items-center">
            <div className="w-full">
              <div className="flex items-center justify-center mb-3">
                <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white font-bold text-xs md:text-sm">?</span>
                </div>
                <span className="text-blue-300 font-arcade text-xs md:text-sm uppercase">
                  QUESTÃO {stats.totalQuestions + 1}
                </span>
              </div>
              
              <p className="text-lg md:text-xl text-blue-100 text-center font-bold leading-relaxed line-clamp-3">
                {currentQuestion.scenario}
              </p>
            </div>
          </div>

          {/* OPTIONS - SINGLE COLUMN FOR MOBILE */}
          <div className="space-y-3 mb-4 flex-1 overflow-y-auto">
            {currentQuestion.options.map((opt, idx) => {
              const optionLetter = ['A','B','C','D'][idx];
              let style = "border-gray-700 text-gray-300 bg-gradient-to-br from-gray-900 to-black";
              let letterBg = "bg-gray-800";
              let letterText = "text-gray-400";
              
              if (showExplanation) {
                if (idx === currentQuestion.correctIndex) {
                  style = "border-green-500 bg-gradient-to-br from-green-900/80 to-green-800/60 text-green-100 scale-[1.02]";
                  letterBg = "bg-green-600";
                  letterText = "text-white";
                } else if (selectedOption !== -1 && idx === selectedOption) {
                  style = "border-red-500 bg-gradient-to-br from-red-900/80 to-red-800/60 text-red-200 opacity-80";
                  letterBg = "bg-red-600";
                  letterText = "text-white";
                } else {
                  style = "border-gray-800 text-gray-500 bg-gray-900/40 opacity-60";
                }
              } else {
                if (idx === selectedOption) {
                  style = "border-yellow-400 bg-gradient-to-br from-yellow-900/60 to-amber-900/40 text-yellow-100 shadow-[0_0_15px_rgba(250,204,21,0.3)]";
                  letterBg = "bg-yellow-600";
                  letterText = "text-white";
                }
              }

              return (
                <button 
                  key={idx}
                  onClick={() => { if (!showExplanation) handleAnswerSubmission(idx); }}
                  onTouchStart={() => { if (!showExplanation) handleAnswerSubmission(idx); }}
                  disabled={showExplanation}
                  className={`w-full p-4 border-3 rounded-xl text-base md:text-lg font-bold text-left flex items-center transition-all duration-200 active:scale-95 ${style}`}
                  style={{ minHeight: isMobile ? '70px' : 'auto' }}
                >
                  <span className={`w-10 h-10 flex items-center justify-center border-2 border-current rounded-full mr-4 text-lg font-arcade font-bold shrink-0 ${letterBg} ${letterText}`}>
                    {optionLetter}
                  </span>
                  
                  <div className="flex-1">
                    <p className="leading-relaxed line-clamp-2">{opt}</p>
                    {!showExplanation && idx === selectedOption && (
                      <div className="text-xs text-yellow-300 font-arcade mt-1 animate-pulse">
                        {isMobile ? 'TOQUE PARA CONFIRMAR ✓' : 'PRESSIONE ENTER'}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* MOBILE CONTROLS HINT */}
          {!showExplanation && isMobile && (
            <div className="flex justify-center gap-4 mt-2 mb-2">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700">↑↓</span>
                <span>DESLIZE</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700">👆</span>
                <span>TOQUE</span>
              </div>
            </div>
          )}

          {/* EXPLANATION OVERLAY */}
          {showExplanation && (
            <div 
              onClick={() => nextRound()}
              onTouchStart={() => nextRound()}
              className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center p-4 z-50"
            >
              <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-black border-3 border-white p-6 rounded-2xl">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-4">
                    {selectedOption === currentQuestion.correctIndex ? '✅' : '❌'}
                  </div>
                  <h3 className={`text-2xl font-arcade mb-2 ${selectedOption === currentQuestion.correctIndex ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedOption === currentQuestion.correctIndex ? 'RESPOSTA CORRETA!' : 'RESPOSTA ERRADA'}
                  </h3>
                </div>
                
                <div className="bg-gray-900/70 border-2 border-gray-700 p-4 rounded-xl mb-6">
                  <div className="text-gray-300 text-sm font-arcade mb-2">💡 EXPLICAÇÃO</div>
                  <p className="text-white text-base leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>

                <div className="relative">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>PRÓXIMA QUESTÃO</span>
                    <span>{Math.ceil(autoNextTime)}s</span>
                  </div>
                  <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-white to-gray-300 transition-all duration-1000"
                      style={{ width: `${100 - autoNextWidth}%` }}
                    />
                  </div>
                  <div className="text-center mt-4 text-sm text-gray-300">
                    {isMobile ? 'TOQUE PARA CONTINUAR' : 'CLIQUE PARA CONTINUAR'}
                  </div>
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
    const percentage = Math.round((stats.correctAnswers / QUESTIONS_PER_ROUND) * 100);

    return (
      <div className="flex flex-col items-center justify-center h-full w-full px-4">
        <h2 className="text-4xl md:text-5xl text-white font-arcade glow-text mb-6 text-center">
          🎮 FIM DE JOGO
        </h2>
        
        <div className="w-full max-w-md bg-black/90 border-3 border-yellow-500 rounded-2xl p-6 mb-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">
              {percentage >= 70 ? '🏆' : percentage >= 50 ? '👍' : '💪'}
            </div>
            <div className="text-gray-300 font-arcade text-sm">JOGADOR</div>
            <div className="text-white font-arcade text-2xl mb-1">{stats.name || playerName}</div>
            <div className={`text-xs px-3 py-1 rounded-full inline-block ${percentage >= 70 ? 'bg-green-900/50 text-green-300' : percentage >= 50 ? 'bg-yellow-900/50 text-yellow-300' : 'bg-red-900/50 text-red-300'}`}>
              {percentage}% DE ACERTOS
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-900/50 p-3 rounded-xl">
              <div className="text-gray-400 text-xs mb-1">ROLE</div>
              <div className="text-blue-300 text-lg">{stats.role}</div>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-xl">
              <div className="text-gray-400 text-xs mb-1">DATA</div>
              <div className="text-gray-200">{date}</div>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-xl">
              <div className="text-gray-400 text-xs mb-1">SCORE FINAL</div>
              <div className="text-yellow-400 text-2xl font-bold">{stats.score}</div>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-xl">
              <div className="text-gray-400 text-xs mb-1">ACERTOS</div>
              <div className="text-green-400 text-xl">{stats.correctAnswers}/{QUESTIONS_PER_ROUND}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button
            onClick={() => setGameState(GameState.HOME)}
            onTouchStart={() => setGameState(GameState.HOME)}
            className="flex-1 py-4 border-3 border-green-500 text-green-300 font-arcade bg-black/60 rounded-xl active:scale-95 transition-all text-lg"
            style={{ minHeight: isMobile ? '60px' : 'auto' }}
          >
            🏠 MENU
          </button>

          <button
            onClick={() => setGameState(GameState.RANKING)}
            onTouchStart={() => setGameState(GameState.RANKING)}
            className="flex-1 py-4 border-3 border-purple-500 text-purple-300 font-arcade bg-black/60 rounded-xl active:scale-95 transition-all text-lg"
            style={{ minHeight: isMobile ? '60px' : 'auto' }}
          >
            🏆 RANKING
          </button>
        </div>
      </div>
    );
  };

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-2xl md:text-3xl text-blue-400 font-arcade animate-pulse mb-6 flex items-center gap-2">
        <span>CARREGANDO</span>
        <div className="flex gap-1">
          {[0, 100, 200].map(delay => (
            <div key={delay} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
                 style={{ animationDelay: `${delay}ms` }} />
          ))}
        </div>
      </div>
      <div className="w-64 md:w-80 h-3 bg-gray-900 rounded-full border-2 border-blue-900 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-pulse w-full" />
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen bg-black overflow-hidden flex flex-col relative">
      <ArcadeBackground />
      
      <div className="relative z-20 w-full h-full overflow-y-auto">
        {gameState === GameState.PRESS_START && renderPressStart()}
        {gameState === GameState.HOME && renderHome()}
        {gameState === GameState.RANKING && renderRanking()}
        {gameState === GameState.NAME_ENTRY && (
          <div className="flex items-center justify-center h-full">
            <VirtualKeyboard
              initialName={playerName === "JOGADOR" ? "" : playerName}
              onComplete={(name) => {
                setPlayerName(name || "JOGADOR");
                setGameState(GameState.ROLE_SELECT);
                audioService.playSelect();
              }}
              onCancel={() => {
                setGameState(GameState.HOME);
                audioService.playBack();
              }}
              isMobile={isMobile}
            />
          </div>
        )}
        {gameState === GameState.ROLE_SELECT && renderRoleSelect()}
        {gameState === GameState.PROTOCOL_SELECT && renderProtocolSelect()}
        {gameState === GameState.LOADING && renderLoading()}
        {gameState === GameState.PLAYING && renderGame()}
        {gameState === GameState.RESULT && renderResult()}
      </div>

      <JoystickHint isMobile={isMobile} />
    </div>
  );
};

export default App;