// ===== オリジナルのチップチューンBGM / 効果音（Web Audioで生成） =====
// 外部音源は一切使用せず、波形をコードで合成している。

type Wave = OscillatorType;

// --- メロディ定義（16分音符 × 32 = 2小節, 120BPM）。null は休符 ---
const A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, G4 = 392;
const _ = null;

const LEAD: (number | null)[] = [
  A4, _, C5, _, E5, _, D5, _, C5, _, A4, _, E5, _, _, _,
  G4, _, B4, _, D5, _, C5, _, B4, _, G4, _, D5, _, _, _,
];

const A2 = 110, G2 = 98, F2 = 87.31, E2 = 82.41;
const BASS: (number | null)[] = [
  A2, _, _, _, A2, _, _, _, F2, _, _, _, F2, _, _, _,
  G2, _, _, _, G2, _, _, _, E2, _, _, _, E2, _, _, _,
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private readonly bpm = 120;
  private readonly volume = 0.16;

  /** ユーザー操作後に呼ぶ（AudioContextは操作起点でないと鳴らせない） */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    this.startBgm();
  }

  private startBgm(): void {
    if (!this.ctx || this.timer != null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.scheduler(), 25);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  private scheduler(): void {
    if (!this.ctx) return;
    const secPerStep = 60 / this.bpm / 4; // 16分音符
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      const lead = LEAD[this.step];
      if (lead) this.tone(lead, this.nextNoteTime, secPerStep * 0.9, "square", 0.5);
      const bass = BASS[this.step];
      if (bass) this.tone(bass, this.nextNoteTime, secPerStep * 3.5, "triangle", 0.8);
      this.nextNoteTime += secPerStep;
      this.step = (this.step + 1) % LEAD.length;
    }
  }

  private tone(freq: number, time: number, dur: number, type: Wave, vol: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  /** 即時の単発音（効果音用） */
  private blip(freq: number, type: Wave, dur: number, vol = 0.5, slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  sfxAttack(): void {
    this.blip(330, "square", 0.09, 0.4, 180);
  }
  sfxGuard(): void {
    this.blip(660, "triangle", 0.08, 0.5);
  }
  sfxWin(): void {
    this.blip(523.25, "square", 0.12, 0.4);
    window.setTimeout(() => this.blip(659.25, "square", 0.12, 0.4), 110);
    window.setTimeout(() => this.blip(783.99, "square", 0.18, 0.4), 220);
  }
  sfxLose(): void {
    this.blip(330, "sawtooth", 0.3, 0.4, 110);
  }
}

export const audio = new AudioEngine();
