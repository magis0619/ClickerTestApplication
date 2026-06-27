// ===== オリジナルのチップチューンBGM / 効果音（Web Audioで生成） =====
// 外部音源は一切使用せず、波形をコードで合成している。

import { settings } from "../game/settings.ts";

type Wave = OscillatorType;

// --- メロディ定義（16分音符 × 32 = 2小節）。null は休符 ---
const _ = null;
// 音名→周波数（必要な音だけ）
const E4 = 329.63, F4 = 349.23, G4 = 392, A4 = 440, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880;
const F1 = 43.65, A1 = 55, B1 = 61.74, C2 = 65.41, D2 = 73.42, E2 = 82.41, F2 = 87.31, G2 = 98, A2 = 110;

/** 1曲ぶんの演奏データ（リード＋ベース＋テンポ＋波形） */
interface BgmTrack {
  lead: (number | null)[];
  bass: (number | null)[];
  bpm: number;
  leadWave: Wave;
  bassWave: Wave;
}

/** メニュー/既定：明るいハイパーポップ */
const TRACK_MENU: BgmTrack = {
  bpm: 120, leadWave: "square", bassWave: "triangle",
  lead: [
    A4, _, C5, _, E5, _, D5, _, C5, _, A4, _, E5, _, _, _,
    G4, _, B4, _, D5, _, C5, _, B4, _, G4, _, D5, _, _, _,
  ],
  bass: [
    A2, _, _, _, A2, _, _, _, F2, _, _, _, F2, _, _, _,
    G2, _, _, _, G2, _, _, _, E2, _, _, _, E2, _, _, _,
  ],
};

/** ワールド1：森（やさしい長調・牧歌的） */
const TRACK_FOREST: BgmTrack = {
  bpm: 112, leadWave: "square", bassWave: "triangle",
  lead: [
    A4, _, C5, _, E5, _, _, C5, D5, _, _, _, C5, _, A4, _,
    G4, _, A4, _, C5, _, E5, _, D5, _, C5, _, A4, _, _, _,
  ],
  bass: [
    A2, _, _, _, E2, _, _, _, F2, _, _, _, C2, _, _, _,
    G2, _, _, _, D2, _, _, _, A2, _, _, _, E2, _, _, _,
  ],
};

/** ワールド2：火山（疾走する短調・切迫） */
const TRACK_VOLCANO: BgmTrack = {
  bpm: 132, leadWave: "sawtooth", bassWave: "square",
  lead: [
    E5, _, E5, D5, E5, _, G5, _, E5, _, D5, _, B4, _, _, _,
    C5, _, C5, B4, C5, _, E5, _, D5, _, B4, _, A4, _, _, _,
  ],
  bass: [
    E2, _, E2, _, E2, _, E2, _, C2, _, C2, _, C2, _, C2, _,
    G2, _, G2, _, G2, _, G2, _, A2, _, A2, _, B1, _, _, _,
  ],
};

/** ワールド3：氷（澄んだ高音・スロー＆スパース） */
const TRACK_FROST: BgmTrack = {
  bpm: 100, leadWave: "triangle", bassWave: "triangle",
  lead: [
    E5, _, _, _, G5, _, _, _, A5, _, _, G5, E5, _, _, _,
    D5, _, _, _, E5, _, _, _, C5, _, _, _, _, _, _, _,
  ],
  bass: [
    A2, _, _, _, _, _, _, _, F2, _, _, _, _, _, _, _,
    G2, _, _, _, _, _, _, _, C2, _, _, _, _, _, _, _,
  ],
};

/** ワールド4：雷（高速・緊張） */
const TRACK_STORM: BgmTrack = {
  bpm: 140, leadWave: "square", bassWave: "square",
  lead: [
    B4, _, D5, _, F5, _, D5, _, B4, _, F5, _, E5, _, _, _,
    A4, _, C5, _, E5, _, C5, _, A4, _, E5, _, D5, _, _, _,
  ],
  bass: [
    B1, _, B1, _, B1, _, B1, _, G2, _, G2, _, G2, _, G2, _,
    A2, _, A2, _, A2, _, A2, _, E2, _, E2, _, E2, _, E2, _,
  ],
};

/** ワールド5：深淵（暗く荘厳・スロー） */
const TRACK_ABYSS: BgmTrack = {
  bpm: 92, leadWave: "triangle", bassWave: "sine",
  lead: [
    A4, _, _, _, C5, _, _, B4, A4, _, _, _, E5, _, _, _,
    F4, _, _, _, A4, _, _, G4, F4, _, _, _, E4, _, _, _,
  ],
  bass: [
    A1, _, _, _, _, _, _, _, F1, _, _, _, _, _, _, _,
    D2, _, _, _, _, _, _, _, E2, _, _, _, _, _, _, _,
  ],
};

/** ワールド番号 → BGMトラック */
const WORLD_TRACKS: Record<number, BgmTrack> = {
  1: TRACK_FOREST, 2: TRACK_VOLCANO, 3: TRACK_FROST, 4: TRACK_STORM, 5: TRACK_ABYSS,
};

// BGM/SFX の基準音量（設定値 0..1 を掛ける）
const BGM_BASE = 0.16;
const SFX_BASE = 0.16;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** BGM専用ゲイン（設定のBGM音量で制御） */
  private bgmGain: GainNode | null = null;
  /** 効果音専用ゲイン（設定のSFX音量で制御） */
  private sfxGain: GainNode | null = null;
  muted = false;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  /** 現在再生中のトラック（既定はメニュー） */
  private track: BgmTrack = TRACK_MENU;

  /** ユーザー操作後に呼ぶ（AudioContextは操作起点でないと鳴らせない） */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = BGM_BASE * settings.bgm;
    this.bgmGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = SFX_BASE * settings.sfx;
    this.sfxGain.connect(this.master);
    this.startBgm();
  }

  /** 設定変更を即時反映（音量スライダー用） */
  applyVolumes(): void {
    if (this.bgmGain) this.bgmGain.gain.value = BGM_BASE * settings.bgm;
    if (this.sfxGain) this.sfxGain.gain.value = SFX_BASE * settings.sfx;
  }

  private startBgm(): void {
    if (!this.ctx || this.timer != null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.scheduler(), 25);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }

  /** 再生するBGMトラックを切り替える（ワールド遷移・戦闘開始時に呼ぶ） */
  private setTrack(t: BgmTrack): void {
    if (this.track === t) return;
    this.track = t;
    this.step = 0; // 小節の頭から鳴らし直す
  }
  /** 指定ワールドの戦闘BGMへ切り替え（未定義ワールドはメニュー曲） */
  playWorldBgm(world?: number): void {
    this.setTrack((world != null && WORLD_TRACKS[world]) || TRACK_MENU);
  }
  /** メニュー/ホームのBGMへ戻す */
  playMenuBgm(): void {
    this.setTrack(TRACK_MENU);
  }

  private scheduler(): void {
    if (!this.ctx) return;
    const tr = this.track;
    const secPerStep = 60 / tr.bpm / 4; // 16分音符
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      const lead = tr.lead[this.step];
      if (lead) this.tone(lead, this.nextNoteTime, secPerStep * 0.9, tr.leadWave, 0.5);
      const bass = tr.bass[this.step];
      if (bass) this.tone(bass, this.nextNoteTime, secPerStep * 3.5, tr.bassWave, 0.8);
      this.nextNoteTime += secPerStep;
      this.step = (this.step + 1) % tr.lead.length;
    }
  }

  private tone(freq: number, time: number, dur: number, type: Wave, vol: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  /** 即時の単発音（効果音用） */
  private blip(freq: number, type: Wave, dur: number, vol = 0.5, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** ノイズバースト（金属音・打撃の芯に使う） */
  private noise(dur: number, vol: number, hp = 1500, delay = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** ボタンを押した瞬間の「カチッ」 */
  sfxClick(): void {
    this.blip(900, "square", 0.025, 0.35, 1400);
    this.noise(0.018, 0.18, 3500);
  }
  /** メニュー/ナビのボタン押下音（やわらかいクリック） */
  sfxUiClick(): void {
    this.blip(680, "square", 0.03, 0.3, 1020);
    this.blip(1020, "triangle", 0.05, 0.16, undefined, 0.015);
  }
  /** 武器系統ごとの攻撃音：斬＝スウィッシュ / 突＝刺突 / 打＝重撃 */
  sfxAttack(weapon: "slash" | "pierce" | "crush" = "slash"): void {
    switch (weapon) {
      case "slash": // 斬：鋭い斬撃のスウィッシュ
        this.blip(960, "sawtooth", 0.09, 0.34, 180);
        this.noise(0.06, 0.22, 3000);
        break;
      case "pierce": // 突：素早い刺突（高めの二段突き）
        this.blip(640, "square", 0.05, 0.4, 1500);
        this.blip(1500, "square", 0.04, 0.24, 2100, 0.02);
        this.noise(0.03, 0.16, 3600);
        break;
      case "crush": // 打：重く沈む一撃
        this.blip(120, "sawtooth", 0.16, 0.5, 55);
        this.blip(80, "sine", 0.22, 0.4);
        this.noise(0.09, 0.32, 500);
        break;
    }
  }
  /** クリティカル：きらめく金属の特別音 */
  sfxCrit(): void {
    this.noise(0.05, 0.4, 5000);
    this.blip(1320, "square", 0.1, 0.35, 2640);
    this.blip(1980, "triangle", 0.16, 0.3, undefined, 0.03);
    this.blip(2640, "square", 0.12, 0.22, undefined, 0.07);
  }
  /** ボス戦開始：ブザーのような警報音（低高を繰り返す） */
  sfxBossAlarm(): void {
    const beats = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    beats.forEach((d, i) => this.blip(i % 2 ? 340 : 240, "sawtooth", 0.17, 0.42, undefined, d));
    this.noise(1.15, 0.1, 180);
  }
  sfxGuard(): void {
    this.blip(660, "triangle", 0.08, 0.5);
  }
  /** 通常ガード：芯のない鈍い受け止め音 */
  sfxGuardHit(): void {
    this.blip(300, "triangle", 0.1, 0.35, 200);
    this.noise(0.05, 0.18, 900);
  }
  /** JUST：通常ガードより澄み、パーフェクトより軽い中間の弾き音 */
  sfxJust(): void {
    this.blip(1200, "triangle", 0.1, 0.35, 1600);
    this.noise(0.04, 0.2, 3000);
  }
  /** パーフェクト：澄んだ金属音の「キィン！」（弾き返しの快感） */
  sfxPerfect(): void {
    // 鋭いノイズの芯 + 高い金属倍音を重ねる
    this.noise(0.06, 0.5, 4000);
    this.blip(1760, "square", 0.18, 0.4, 2640);
    this.blip(2640, "triangle", 0.22, 0.3);
    this.blip(3520, "triangle", 0.16, 0.18, undefined, 0.02);
    // 余韻のきらめき
    this.blip(2093, "square", 0.12, 0.22, undefined, 0.09);
  }
  /** 攻撃予兆の警告音（緊張を煽る低い鼓動） */
  sfxWarn(): void {
    this.blip(180, "square", 0.12, 0.3, 120);
  }
  /** 被弾：鈍い痛打 */
  sfxHurt(): void {
    this.blip(150, "sawtooth", 0.18, 0.4, 70);
    this.noise(0.08, 0.3, 600);
  }
  /** ブレイク：ガラス/結晶が砕け散るような派手な破砕音 */
  sfxBreak(): void {
    // 一撃の芯（低→高への弾け）＋ガラスの破片が散るノイズ
    this.blip(620, "square", 0.18, 0.4, 90);
    this.noise(0.18, 0.34, 1400);
    // 砕けた破片のきらめき（高音が散らばる）
    this.blip(1568, "triangle", 0.1, 0.22, undefined, 0.04);
    this.blip(2093, "triangle", 0.09, 0.18, undefined, 0.08);
    this.noise(0.12, 0.16, 4500, 0.06);
  }
  /** 敵撃破：落下するような下降音 */
  sfxEnemyDie(): void {
    this.blip(520, "square", 0.22, 0.35, 90);
    this.noise(0.1, 0.2, 800, 0.02);
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
