class AudioService {
  private music: HTMLAudioElement;

  private sfxVolume = 0.8;
  private musicVolume = 0.5;

  private currentTrackPath = "";
  private unlocked = false;

  private audioCtx: AudioContext | null = null;

  // ✅ evita spam (principalmente navigate em hover/teclas)
  private lastNavAt = 0;
  private NAV_COOLDOWN_MS = 90;

  // 🎚️ multiplicadores por tipo (ajuste fino aqui)
  private MULT = {
    navigate: 0.25,  // bem suave
    type: 0.20,      // se quiser usar no teclado virtual
    select: 0.45,
    back: 0.40,
    feedback: 0.70,  // correct/wrong/win/timeout
  };

  // Arquivos em: public/audio/...
  private readonly MUSICS = {
    MENU: "/audio/bgm_menu.mp3",
    GAME_SEPSE: "/audio/bgm_sepse.mp3",
    GAME_AVC: "/audio/bgm_avc.mp3",
    GAME_DOR: "/audio/bgm_dor_toracica.mp3",
  };

  private readonly SFX = {
    NAVIGATE: "/audio/sfx_navigate.wav",
    SELECT: "/audio/sfx_select.wav",
    BACK: "/audio/sfx_back.wav",
    CORRECT: "/audio/sfx_correct.wav",
    WRONG: "/audio/sfx_wrong.wav",
    WIN: "/audio/sfx_win.wav",
    TIMEOUT: "/audio/sfx_timeout.wav",
  };

  constructor() {
    // ✅ 1 elemento fixo para BGM (melhor que recriar sempre)
    this.music = new Audio();
    this.music.loop = true;
    this.music.preload = "auto";
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.music.volume = this.musicVolume;
  }

  // ✅ chame no primeiro Enter/Click (PRESS START)
  async unlock() {
    if (this.unlocked) return;

    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (Ctx) {
        this.audioCtx = this.audioCtx || new Ctx();
        await this.audioCtx.resume();
      }

      // micro-play real pra destravar
      const a = new Audio(this.SFX.SELECT);
      a.volume = 0.001;
      await a.play();
      a.pause();

      this.unlocked = true;
    } catch (e) {
      console.warn("[Audio] unlock falhou:", e);
      this.unlocked = true;
    }
  }

  private resolveBgmPath(type: "menu" | "sepse" | "avc" | "dor") {
    if (type === "sepse") return this.MUSICS.GAME_SEPSE;
    if (type === "avc") return this.MUSICS.GAME_AVC;
    if (type === "dor") return this.MUSICS.GAME_DOR;
    return this.MUSICS.MENU;
  }

  async playBGM(type: "menu" | "sepse" | "avc" | "dor") {
    const path = this.resolveBgmPath(type);

    // evita reiniciar a mesma música
    if (this.currentTrackPath === path && !this.music.paused) return;

    this.currentTrackPath = path;
    this.music.src = path;
    this.music.loop = true;
    this.music.volume = this.musicVolume;

    try {
      await this.music.play();
    } catch (e) {
      console.warn("[Audio] BGM bloqueado (faltou unlock antes):", path, e);
    }
  }

  stopBGM() {
    this.music.pause();
    this.music.currentTime = 0;
    this.currentTrackPath = "";
  }

  private async playSound(path: string, mult = 1) {
    try {
      const sfx = new Audio(path);
      sfx.preload = "auto";
      sfx.volume = Math.max(0, Math.min(1, this.sfxVolume * mult));
      await sfx.play();
    } catch (e) {
      // pode ignorar se quiser
      // console.warn("[Audio] SFX falhou:", path, e);
    }
  }

  // ✅ navegação com cooldown (resolve “forte ao trocar card”)
  playNavigate() {
    const now = Date.now();
    if (now - this.lastNavAt < this.NAV_COOLDOWN_MS) return;
    this.lastNavAt = now;
    void this.playSound(this.SFX.NAVIGATE, this.MULT.navigate);
  }

  // opcional: usar no teclado virtual ao digitar letras
  playType() {
    void this.playSound(this.SFX.NAVIGATE, this.MULT.type);
  }

  playSelect() { void this.playSound(this.SFX.SELECT, this.MULT.select); }
  playBack() { void this.playSound(this.SFX.BACK, this.MULT.back); }

  playCorrect() { void this.playSound(this.SFX.CORRECT, this.MULT.feedback); }
  playWrong() { void this.playSound(this.SFX.WRONG, this.MULT.feedback); }
  playWin() { void this.playSound(this.SFX.WIN, this.MULT.feedback); }
  playTimeout() { void this.playSound(this.SFX.TIMEOUT, this.MULT.feedback); }
}

export const audioService = new AudioService();
