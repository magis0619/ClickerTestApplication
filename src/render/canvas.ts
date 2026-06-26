import { Battle, EnemyState, DEATH_ANIM_MS, type FloatText } from "../game/engine.ts";
import {
  KIND_LABEL, WEAKNESS,
  RARITY_COLOR, isRainbowRarity, WHITE_FLASH_MS, getWeapon,
  FLOAT_FADE_MS, GUARD_BADGE_MS, ATTACK_WINDUP_MS,
} from "../game/data.ts";
import {
  WARDEN, WARDEN_ATTACK, WARDEN_HURT, CARAPACE, AERIAL, PHANTOM, BOSS,
  CARAPACE_TEL, AERIAL_TEL, PHANTOM_TEL, BOSS_TEL, RARE, RARE_TEL, ENEMY_BY_ID, type Sprite,
} from "./sprites.ts";
import type { EnemyKind } from "../game/types.ts";
import stageClearUrl from "../assets/stage_clear.png";
import defeatedUrl from "../assets/defeated.png";
import perfectUrl from "../assets/perfect.png";
import bossBattleUrl from "../assets/boss_battle.png";

/** バナー演出用のドット絵画像（白を透過したPNG）。読み込めたものだけ使う */
function loadImg(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}
const BADGE_CLEAR = loadImg(stageClearUrl);
const BADGE_DEFEATED = loadImg(defeatedUrl);
const BADGE_PERFECT = loadImg(perfectUrl);
const BADGE_BOSS = loadImg(bossBattleUrl);
/** 画像が表示可能か */
function imgReady(img: HTMLImageElement): boolean { return img.complete && img.naturalWidth > 0; }
/**
 * バナー画像を中央(cx,cy)に描く。targetH を基準にしつつ、画面幅(maxW)を超えない
 * 範囲で最大化する＝はみ出さない。pop=拡大率、alpha=不透明度、glow指定時は発光。
 */
function drawBadgeImage(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  cx: number, cy: number, targetH: number, pop: number, alpha: number, glow?: string,
  maxW = W - 36, glowBlur = 26,
): void {
  // 高さ基準と幅上限の小さい方を基準スケールに（はみ出し防止）
  const base = Math.min(targetH / img.naturalHeight, maxW / img.naturalWidth);
  // pop で拡大するが、幅上限は常に超えない
  const scale = Math.min(base * pop, maxW / img.naturalWidth);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.imageSmoothingEnabled = false; // ドット絵をくっきり拡大
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = glowBlur; }
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

/**
 * バナー画像に「エフェクト」を足して描く（脈打つ発光＋微振動＋周囲の火花）。
 * kind="boss" は火花が立ち上り、"defeated" は火花が舞い落ちる。
 */
function drawBadgeFx(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  cx: number, cy: number, targetH: number, pop: number, alpha: number,
  color: string, t: number, kind: "boss" | "defeated",
): void {
  // 周囲の火花
  const n = kind === "boss" ? 12 : 9;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + t * 0.0011;
    const rad = 96 + Math.sin(t * 0.006 + i) * 22;
    const fl = 0.5 + 0.5 * Math.sin(t * 0.01 + i * 1.7);
    const drift = kind === "boss" ? -(((t * 0.05 + i * 34) % 90) - 45) : (((t * 0.05 + i * 34) % 90) - 45);
    const px = cx + Math.cos(ang) * rad * 1.35;
    const py = cy + Math.sin(ang) * rad * 0.62 + drift;
    ctx.globalAlpha = alpha * fl * 0.9;
    ctx.fillStyle = i % 2 ? "#fff2c0" : color;
    const s = 2 + fl * 3.2;
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  // 微振動＋脈打つ発光で本体を描く
  const jx = Math.sin(t * 0.019) * (kind === "boss" ? 3 : 2) + Math.sin(t * 0.045) * 1.4;
  const jy = Math.sin(t * 0.027) * (kind === "boss" ? 2 : 1.3);
  const blur = 24 + (0.5 + 0.5 * Math.sin(t * 0.012)) * 22;
  drawBadgeImage(ctx, img, cx + jx, cy + jy, targetH, pop, alpha, color, W - 36, blur);
}

const W = 480;
const H = 400;
const PLAYER_POS = { x: 74, y: 352 };
const GROUND_Y = 300;

/** 敵カードの配置情報（カード枠・スプライト足元位置） */
interface EnemyLayout {
  left: number; top: number; w: number; h: number; cx: number; footY: number;
}

/** 敵カードを横一列に並べる配置を計算 */
function enemyLayout(n: number): EnemyLayout[] {
  const margin = 12, gap = 10, top = 86, h = 160;
  const maxCard = 190;
  const cardW = Math.min(maxCard, (W - 2 * margin - (n - 1) * gap) / Math.max(1, n));
  const totalW = cardW * n + gap * (n - 1);
  const startX = (W - totalW) / 2;
  const out: EnemyLayout[] = [];
  for (let i = 0; i < n; i++) {
    const left = startX + i * (cardW + gap);
    out.push({ left, top, w: cardW, h, cx: left + cardW / 2, footY: top + h - 30 });
  }
  return out;
}

/** N体の敵の配置スロット（当たり判定で共有：スプライト中心） */
export function enemySlots(n: number): { x: number; y: number }[] {
  return enemyLayout(n).map((L) => ({ x: L.cx, y: L.footY }));
}

// ===== バトル背景テーマ（ワールドごとにコンセプト＝色を変える） =====
interface BattleGlow { color: string; a: number; r: number; sx: number; sy: number; }
interface BattleTheme {
  bg: string;            // 地の色
  grid: string;          // ドットグリッドの色
  motes: string[];       // 漂う粒の色
  glows: BattleGlow[];   // ゆっくり動く大きな光のにじみ（彩り）
}

/** 既定テーマ（紫×ピンクの淡い光） */
const THEME_DEFAULT: BattleTheme = {
  bg: "#fcf9f8",
  grid: "#d8cdd5",
  motes: ["#ff9ad6", "#c7bce8", "#bcd0f2"],
  glows: [
    { color: "#ffc2e8", a: 0.20, r: 230, sx: 0.05, sy: 0.04 },
    { color: "#cdb6f2", a: 0.18, r: 200, sx: 0.07, sy: 0.05 },
  ],
};

/** ワールド1：森（緑×木漏れ日） */
const THEME_FOREST: BattleTheme = {
  bg: "#eef7e4",
  grid: "#c2dcab",
  motes: ["#7cc35a", "#aee07f", "#5fae3e", "#eaf6a8"],
  glows: [
    { color: "#9be870", a: 0.24, r: 250, sx: 0.05, sy: 0.04 },
    { color: "#3fa85e", a: 0.20, r: 210, sx: 0.07, sy: 0.06 },
    { color: "#fff2a8", a: 0.14, r: 170, sx: 0.03, sy: 0.05 }, // 木漏れ日
  ],
};

/** ワールド2：火山（赤×橙の灰と火の粉） */
const THEME_VOLCANO: BattleTheme = {
  bg: "#fbeadf",
  grid: "#e2c2ab",
  motes: ["#ff7a3c", "#ffb061", "#ff4d4d", "#ffe1a8"],
  glows: [
    { color: "#ff7a3c", a: 0.24, r: 250, sx: 0.06, sy: 0.05 },
    { color: "#ff3d3d", a: 0.18, r: 200, sx: 0.08, sy: 0.06 },
    { color: "#ffd36b", a: 0.14, r: 170, sx: 0.04, sy: 0.05 },
  ],
};

/** ワールド3：氷（水色×白の雪と氷晶） */
const THEME_FROST: BattleTheme = {
  bg: "#e9f4fb",
  grid: "#bcd6e6",
  motes: ["#8fd6ff", "#cfeeff", "#aab8ff", "#ffffff"],
  glows: [
    { color: "#8fd6ff", a: 0.24, r: 250, sx: 0.04, sy: 0.04 },
    { color: "#5fa8ff", a: 0.18, r: 200, sx: 0.06, sy: 0.05 },
    { color: "#e6f6ff", a: 0.16, r: 180, sx: 0.03, sy: 0.05 },
  ],
};

/** ワールド4：雷雲の天空（紫×黄の稲妻と光） */
const THEME_STORM: BattleTheme = {
  bg: "#efeaf7",
  grid: "#c8bedd",
  motes: ["#b98cff", "#ffe14d", "#8fb4ff", "#e0c2ff"],
  glows: [
    { color: "#9b6bff", a: 0.24, r: 250, sx: 0.06, sy: 0.05 },
    { color: "#ffe14d", a: 0.14, r: 180, sx: 0.09, sy: 0.07 },
    { color: "#6f8bff", a: 0.18, r: 200, sx: 0.05, sy: 0.05 },
  ],
};

/** ワールド5：星辰の深淵（マゼンタ×藍の星屑） */
const THEME_ABYSS: BattleTheme = {
  bg: "#f0ecf6",
  grid: "#c9c0dc",
  motes: ["#c86bff", "#ff7de9", "#7d9bff", "#ffe98a"],
  glows: [
    { color: "#c86bff", a: 0.24, r: 250, sx: 0.05, sy: 0.04 },
    { color: "#6f7bff", a: 0.20, r: 210, sx: 0.07, sy: 0.06 },
    { color: "#ff7de9", a: 0.14, r: 170, sx: 0.04, sy: 0.05 },
  ],
};

/** ワールド番号 → テーマ */
const BATTLE_THEMES: Record<number, BattleTheme> = {
  1: THEME_FOREST,
  2: THEME_VOLCANO,
  3: THEME_FROST,
  4: THEME_STORM,
  5: THEME_ABYSS,
};
function battleTheme(world?: number): BattleTheme {
  return (world != null && BATTLE_THEMES[world]) || THEME_DEFAULT;
}

/** 背景の彩り：ゆっくり漂う大きな光のにじみ（テーマ色） */
function drawBackdropGlow(ctx: CanvasRenderingContext2D, theme: BattleTheme): void {
  const t = Date.now() / 1000;
  ctx.save();
  theme.glows.forEach((g, i) => {
    const cx = W * (0.3 + 0.4 * Math.sin(t * g.sx * 2 + i * 1.7));
    const cy = H * (0.32 + 0.4 * Math.cos(t * g.sy * 2 + i * 1.3));
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.r);
    grad.addColorStop(0, hexA(g.color, g.a));
    grad.addColorStop(1, hexA(g.color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  });
  ctx.restore();
}

/** 背景ドットグリッド（ゆっくり上へ流れて奥行きと動きを出す）。色はテーマ依存 */
function drawDotGrid(ctx: CanvasRenderingContext2D, theme: BattleTheme): void {
  const step = 16;
  const drift = (Date.now() / 70) % step; // 方眼がゆっくり上方向へスクロール
  ctx.fillStyle = theme.grid;
  for (let y = step / 2 - drift; y < H + step; y += step) {
    if (y < -2) continue;
    for (let x = step / 2; x < W; x += step) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

/**
 * 背景に常時漂う光の粒。下から上へゆっくり昇り、横にゆれ、ちらつく。
 * バトル画面に「止まっていない」動きを与える（キャラより奥に描く）。色はテーマ依存。
 */
function drawAmbientMotes(ctx: CanvasRenderingContext2D, theme: BattleTheme): void {
  const t = Date.now() / 1000;
  const cols = theme.motes;
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const speed = 9 + (i % 5) * 5;                  // 粒ごとの速度差＝奥行き
    const sway = Math.sin(t * 0.6 + i * 1.3) * 12;  // ゆらゆら横ゆれ
    const x = (((i * 79) % W) + sway + W) % W;
    const y = H - ((t * speed + i * 47) % (H + 40)); // 下端→上端へ循環
    const size = 1 + (i % 3);
    const tw = 0.18 + 0.34 * (0.5 + 0.5 * Math.sin(t * 2.1 + i * 1.7)); // 明滅
    ctx.globalAlpha = tw;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
  }
  ctx.restore();
}

/** 角丸矩形パス */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 弱点色＝攻撃ボタン(SLASH/PIERCE/STRIKE)と同じ系統色。敵カード背景の色味に使う */
const WEAK_COLOR: Record<string, string> = { slash: "#ff2d8f", pierce: "#1fb6ff", crush: "#ff9e2e" };
/** "#rrggbb" を rgba(...) 文字列へ（alpha 付き） */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const ENEMY_SPRITE: Record<EnemyKind, Sprite> = {
  carapace: CARAPACE,
  aerial: AERIAL,
  phantom: PHANTOM,
};
/** 予兆/攻撃モーション用フレーム */
const ENEMY_TEL_SPRITE: Record<EnemyKind, Sprite> = {
  carapace: CARAPACE_TEL,
  aerial: AERIAL_TEL,
  phantom: PHANTOM_TEL,
};
/** 待機フレーム（撃破演出などで使う静止画）。敵IDごとの専用→種別→共通の順で解決 */
function enemyStill(e: EnemyState): Sprite {
  const custom = ENEMY_BY_ID[e.def.id];
  if (custom) return custom.base;
  if (e.def.rare) return RARE;
  if (e.def.boss) return BOSS;
  return ENEMY_SPRITE[e.def.kind];
}
/** 状態に応じて敵のフレーム（待機/予兆）を選ぶ */
function enemyFrame(e: EnemyState): Sprite {
  const acting = e.inTelegraph || e.atkAnimT > 0;
  const custom = ENEMY_BY_ID[e.def.id];
  if (custom) return acting ? custom.tel : custom.base;
  if (e.def.rare) return acting ? RARE_TEL : RARE;
  if (e.def.boss) return acting ? BOSS_TEL : BOSS;
  return acting ? ENEMY_TEL_SPRITE[e.def.kind] : ENEMY_SPRITE[e.def.kind];
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  cx: number,
  footY: number,
  scale: number,
  flip = false,
  tint?: { color: string; alpha: number },
): void {
  const width = sprite.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const height = sprite.rows.length;
  const left = Math.round(cx - (width * scale) / 2);
  const top = Math.round(footY - height * scale);
  for (let y = 0; y < height; y++) {
    const row = sprite.rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = sprite.palette[row[x]];
      if (!color) continue;
      const px = flip ? width - 1 - x : x;
      ctx.fillStyle = color;
      ctx.fillRect(left + px * scale, top + y * scale, scale, scale);
    }
  }
  // 被弾フラッシュなどの白系オーバーレイ
  if (tint && tint.alpha > 0) {
    ctx.globalAlpha = tint.alpha;
    ctx.fillStyle = tint.color;
    for (let y = 0; y < height; y++) {
      const row = sprite.rows[y];
      for (let x = 0; x < row.length; x++) {
        if (!sprite.palette[row[x]]) continue;
        const px = flip ? width - 1 - x : x;
        ctx.fillRect(left + px * scale, top + y * scale, scale, scale);
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** スプライトを単体のcanvas要素に描き出す（ボタン用アイコンなどに使う） */
export function makeSpriteCanvas(sprite: Sprite, scale: number): HTMLCanvasElement {
  const width = sprite.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const height = sprite.rows.length;
  const cv = document.createElement("canvas");
  cv.width = width * scale;
  cv.height = height * scale;
  const c = cv.getContext("2d")!;
  drawSprite(c, sprite, cv.width / 2, cv.height, scale);
  return cv;
}

export function render(
  ctx: CanvasRenderingContext2D,
  b: Battle,
  stage?: { index: number; count: number; wave?: number; waves?: number; boss?: boolean; floor?: number; world?: number },
): void {
  // ワールドのコンセプトに合わせた背景テーマ（ワールド1＝森：緑）
  const theme = battleTheme(stage?.world);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  drawBackdropGlow(ctx, theme);
  drawDotGrid(ctx, theme);
  drawAmbientMotes(ctx, theme);

  // 地面のライン（淡いグレー）
  ctx.strokeStyle = "#d2c7cf";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  const layout = enemyLayout(b.enemies.length);
  const slots = layout.map((L) => ({ x: L.cx, y: L.footY }));

  // 「次に攻撃する敵」を特定：予兆中を最優先、なければカウントが小さい順
  let imminent = -1, best = Infinity;
  b.enemies.forEach((e, i) => {
    if (!e.alive || e.isBroken || e.flinchT > 0) return;
    const key = e.telegraphT > 0 ? e.telegraphT : 100000 + e.count * 1000;
    if (key < best) { best = key; imminent = i; }
  });

  // 画面シェイク（ヒットストップ中はフリーズフレームにして揺らさない）
  ctx.save();
  if (b.shakeT > 0 && b.hitstopT <= 0) {
    const mag = Math.min(b.shakeMag, b.shakeMag * (b.shakeT / 120));
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
  }
  drawPlayer(ctx, b);
  b.enemies.forEach((e, i) =>
    drawEnemyCard(ctx, e, layout[i], i === imminent, i === b.targetIndex && e.alive));
  if (b.perfectFxT > 0 && b.perfectFxIndex >= 0) {
    drawPerfectFx(ctx, b, slots[b.perfectFxIndex]);
  }
  drawExplosions(ctx, b, slots);
  drawCoins(ctx, b, slots);
  // ボス開始警告：画面を暗くする（入りでスッと暗く→終わりで通常の明るさへ戻す）。バナーはこの上に出す
  if (b.introT > 0) {
    const age = b.introMax - b.introT;
    let a = 0.97; // ほぼ真っ暗（背景はほとんど見えない）
    if (age < 220) a *= age / 220;
    if (b.introT < 420) a *= b.introT / 420;
    ctx.fillStyle = `rgba(4,3,9,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (b.isVictoryFx) drawVictoryFx(ctx, b); // STAGE CLEAR の盛り上げ（紙吹雪＋花火）
  drawFloats(ctx, b, slots);
  ctx.restore();

  drawPlayerHud(ctx, b);
  drawSkillBanner(ctx, b);
  if (stage) {
    ctx.textAlign = "right";
    ctx.font = "bold 11px 'Space Mono', 'Hiragino Kaku Gothic ProN', monospace";
    ctx.fillStyle = "#8a7a90";
    let label: string;
    if (stage.floor != null) {
      // 無限の回廊：階層を表示（5階ごとはボス）
      const boss = stage.floor % 5 === 0;
      label = `FLOOR_${stage.floor}${boss ? " :: BOSS" : ""}`;
      if (boss) ctx.fillStyle = "#df0b81";
    } else {
      label = `STAGE_${stage.index + 1}/${stage.count}`;
      if (stage.wave != null && stage.waves != null) {
        label += stage.boss ? " :: BOSS" : ` :: W${stage.wave + 1}/${stage.waves}`;
      }
      if (stage.boss) ctx.fillStyle = "#df0b81";
    }
    ctx.fillText(label, W - 10, 16);
  }

  drawWarningBanner(ctx, b, imminent);
  drawTargetArrows(ctx, b);
  // パーフェクト時の画面ホワイトアウト（バッジより奥に出す）
  if (b.whiteFlashT > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, b.whiteFlashT / WHITE_FLASH_MS) * 0.92})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawGuardBadge(ctx, b);
  drawDefeatBadge(ctx, b);
  // STAGE CLEAR 終盤の暗転（これが満ちると won へ移り、リザルトが黒から明転する）
  if (b.victoryFade > 0) {
    ctx.fillStyle = `rgba(6,4,12,${b.victoryFade})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (b.phase !== "fighting") drawResult(ctx, b);
}

/** STAGE CLEAR の盛り上げ演出：舞い落ちる紙吹雪＋数回の花火バースト */
function drawVictoryFx(ctx: CanvasRenderingContext2D, b: Battle): void {
  const age = b.victoryAge;
  const t = Date.now() / 1000;
  const cols = ["#ff2d8f", "#1fb6ff", "#ffd34d", "#57d36b", "#b96bff", "#ff7de9"];
  ctx.save();
  // 紙吹雪：上から舞い落ちて回転・明滅
  const fadeIn = Math.min(1, age / 200);
  for (let i = 0; i < 48; i++) {
    const speed = 42 + (i % 7) * 18;
    const x = (((i * 53) % W) + Math.sin(t * 1.5 + i) * 16 + W) % W;
    const y = ((age / 1000) * speed + i * 37) % (H + 30) - 20;
    const w = 4 + (i % 3) * 2, h = 7 + (i % 2) * 4;
    ctx.save();
    ctx.globalAlpha = fadeIn * (0.7 + 0.3 * Math.sin(t * 3 + i));
    ctx.translate(x, y);
    ctx.rotate(t * 2 + i);
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  // 花火バースト：時間差で数発、放射状に弾ける
  const bursts = [
    { x: 0.24, y: 0.30, d: 0 }, { x: 0.76, y: 0.26, d: 280 }, { x: 0.50, y: 0.20, d: 560 },
    { x: 0.34, y: 0.58, d: 880 }, { x: 0.70, y: 0.60, d: 1160 },
  ];
  for (const bu of bursts) {
    const ba = age - bu.d;
    if (ba < 0 || ba > 640) continue;
    const p = ba / 640;
    const cx = W * bu.x, cy = H * bu.y;
    const rays = 14;
    ctx.globalAlpha = (1 - p) * 0.95;
    for (let r = 0; r < rays; r++) {
      const ang = (r / rays) * Math.PI * 2;
      const rad = p * 50;
      const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
      const s = 4 * (1 - p) + 1.5;
      ctx.fillStyle = cols[(r + bu.d) % cols.length];
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
  }
  ctx.restore();
}

/**
 * 敗北宣言バナー（敗北演出中＝losePending）。
 * スロー演出の中で PERFECT と同じくらいの大きさ(44px)で「DEFEATED」を弾ませて出す。
 */
function drawDefeatBadge(ctx: CanvasRenderingContext2D, b: Battle): void {
  if (!b.losePending) return;
  const age = b.loseAnimMax - b.loseAnimT;
  // 画面を徐々に暗く沈める。終盤(残り約450ms)はほぼ真っ暗まで沈めて暗転につなげる
  let dark = Math.min(0.5, (age / 600) * 0.5);
  if (b.loseAnimT < 450) dark = 0.5 + (1 - b.loseAnimT / 450) * 0.45;
  ctx.fillStyle = `rgba(10,4,8,${dark})`;
  ctx.fillRect(0, 0, W, H);
  // 弾んで飛び出す→定位置で微振動。出だしはフェードイン
  const pop = age < 180 ? 2.6 - 1.6 * (age / 180) : 1 + 0.1 * Math.max(0, Math.sin((age - 180) / 70));
  const alpha = Math.min(1, age / 160);
  if (imgReady(BADGE_DEFEATED)) {
    drawBadgeFx(ctx, BADGE_DEFEATED, W / 2, 150, 170, pop, alpha, "#ff4d63", Date.now(), "defeated");
    return;
  }
  ctx.save();
  ctx.translate(W / 2, 150);
  ctx.scale(pop, pop);
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "#ff4d63";
  ctx.shadowBlur = 24;
  ctx.font = "900 88px 'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#2a060c";
  ctx.strokeText("DEFEATED", 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffb3bd";
  ctx.fillText("DEFEATED", 0, 0);
  ctx.restore();
}

/** タイトル/メニュー画面用の背景＋見出し */
export function drawBackdrop(ctx: CanvasRenderingContext2D, title: string, subtitle = ""): void {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#1a1430");
  grad.addColorStop(1, "#0c0a18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#2e2750";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 255);
  ctx.lineTo(W, 255);
  ctx.stroke();

  drawSprite(ctx, WARDEN, W / 2, 250, 5);

  ctx.textAlign = "center";
  ctx.font = "bold 30px monospace";
  ctx.fillStyle = "#5fa8ff";
  ctx.fillText(title, W / 2, 60);
  if (subtitle) {
    ctx.font = "12px monospace";
    ctx.fillStyle = "#9690c4";
    ctx.fillText(subtitle, W / 2, 84);
  }
}

interface AnimOpts {
  flip?: boolean;
  tint?: { color: string; alpha: number };
  bob?: number; sx?: number; sy?: number; rot?: number; dx?: number;
}
/** 揺れ・伸縮・回転つきでスプライトを描く（足元を基準に変形） */
function drawSpriteAnim(
  ctx: CanvasRenderingContext2D, sprite: Sprite, cx: number, footY: number, scale: number, o: AnimOpts,
): void {
  ctx.save();
  ctx.translate(cx + (o.dx ?? 0), footY + (o.bob ?? 0));
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.sx ?? 1, o.sy ?? 1);
  drawSprite(ctx, sprite, 0, 0, scale, o.flip, o.tint);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, b: Battle): void {
  const { x, y } = PLAYER_POS;
  // 被弾を最優先（攻撃中でも割り込んでのけぞる）
  const hurt = b.playerHitT > 0;
  const attacking = !hurt && b.lungeT > 0;
  // 溜め（windup）：攻撃ボタンを押してから着弾までの構え。後方に引いて力を溜める
  const windup = !hurt && !attacking && b.windupT > 0;
  // 被弾モーション：強くのけぞって（左後方へ）すぐ戻る＋赤フラッシュ
  const hp = hurt ? b.playerHitT / 320 : 0; // 1→0
  const knock = hurt ? -hp * 18 : 0;
  // 攻撃モーション：序盤に少し引き（windup）→前へ踏み込む→戻る
  const k = attacking ? 1 - b.lungeT / 200 : 0; // 0→1
  const lunge = attacking ? (k < 0.25 ? -k * 24 : Math.sin(Math.PI * k) * 24) : 0;
  // 溜め中の引き：残り時間が多いほど大きく後方へ引き、着弾直前に少し前傾して溜める
  const wu = windup ? 1 - b.windupT / ATTACK_WINDUP_MS : 0; // 0→1
  const wuBack = windup ? -Math.sin(Math.PI * wu) * 12 - 4 : 0;
  // 常時アイドル：呼吸（上下＋伸縮）
  const t = Date.now() / 1000;
  const breathe = Math.sin(t * 2.2);
  const sprite = hurt ? WARDEN_HURT : attacking ? WARDEN_ATTACK : windup ? WARDEN_ATTACK : WARDEN;
  const tint = hurt ? { color: "#ff4040", alpha: hp * 0.7 } : undefined;
  const px = x + lunge + knock + wuBack;
  // ためる中：CHARGED の文字ではなく、プレイヤーをまとう金色オーラで表現
  if (b.charge > 1) drawChargeAura(ctx, px, y - 34);
  drawSpriteAnim(ctx, sprite, px, y, 5, {
    tint,
    bob: hurt ? -hp * 3 : attacking ? 0 : windup ? wu * 2 : breathe * 1.3,
    sy: hurt ? 1 - hp * 0.06 : attacking ? 1 : windup ? 1 - wu * 0.04 : 1 + breathe * 0.035,
    sx: hurt ? 1 + hp * 0.05 : attacking ? 1 : windup ? 1 + wu * 0.04 : 1 - breathe * 0.025,
  });
}

/** ためる中：プレイヤーをまとう金色オーラ＋立ち上る金粉 */
function drawChargeAura(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const t = Date.now() / 1000;
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.save();
  // 金色のオーラ（縦長の放射グラデ）
  const r = 46 + pulse * 10;
  const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, r);
  g.addColorStop(0, `rgba(255,224,120,${0.5 * pulse})`);
  g.addColorStop(0.55, `rgba(255,196,60,${0.22 * pulse})`);
  g.addColorStop(1, "rgba(255,196,60,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.8, r * 1.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // 立ち上る金粉
  for (let i = 0; i < 8; i++) {
    const ph = i * 1.4;
    const rise = ((t * 60 + i * 22) % 70); // 0→70 上昇
    const sx = cx + Math.sin(t * 2.5 + ph) * (16 + (i % 3) * 6);
    const sy = cy + 36 - rise;
    const fade = 1 - rise / 70;
    ctx.globalAlpha = fade * (0.5 + 0.5 * Math.sin(t * 8 + ph));
    ctx.fillStyle = i % 2 ? "#fff2c0" : "#ffd24d";
    const s = 2 + fade * 2.5;
    ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
  }
  ctx.restore();
}

/**
 * ブレイク状態の大型バナー（過去のハイパーポップ系デザインに準拠：
 * 太いアウトライン＋金グラデ＋発光＋脈動）。敵カード中央に大きく出す。
 */
function drawBreakBadge(ctx: CanvasRenderingContext2D, L: EnemyLayout, turns: number): void {
  const t = Date.now() / 1000;
  const pulse = 1 + 0.09 * Math.sin(t * 8);
  const cx = L.cx, cy = L.top + L.h * 0.5;
  const fs = Math.min(30, L.w * 0.26);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = `900 ${fs}px 'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif`;
  ctx.shadowColor = "#ffcf3f";
  ctx.shadowBlur = 16;
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#5a3d00";
  ctx.strokeText("BREAK", 0, 0);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#8a5e00";
  ctx.strokeText("BREAK", 0, 0);
  ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
  g.addColorStop(0, "#fff7d6");
  g.addColorStop(0.5, "#ffd34d");
  g.addColorStop(1, "#f59a12");
  ctx.fillStyle = g;
  ctx.fillText("BREAK", 0, 0);
  // 残りターン
  ctx.font = `900 ${Math.round(fs * 0.42)}px 'Space Mono', 'Hiragino Kaku Gothic ProN', monospace`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#5a3d00";
  ctx.strokeText(`残り ${turns}`, 0, fs * 0.72);
  ctx.fillStyle = "#fff2c0";
  ctx.fillText(`残り ${turns}`, 0, fs * 0.72);
  ctx.restore();
}

/** 敵1体をカード形式で描画（枠・弱点バッジ・名前・HP・スプライト・カウント） */
/** レアモンスターの足元に脈打つ金色オーラを描く */
function drawRareAura(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const t = Date.now() / 1000;
  const pulse = 0.6 + 0.4 * Math.sin(t * 3);
  ctx.save();
  const r = 40 + pulse * 8;
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
  g.addColorStop(0, `rgba(255,221,120,${0.35 * pulse})`);
  g.addColorStop(0.6, `rgba(255,200,80,${0.14 * pulse})`);
  g.addColorStop(1, "rgba(255,200,80,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** レアモンスターの周囲で瞬く宝石のきらめき（4方向の星形） */
function drawRareGlitter(ctx: CanvasRenderingContext2D, L: EnemyLayout): void {
  const t = Date.now() / 1000;
  const cols = ["#fff6cf", "#ffd24d", "#5fe0ff", "#ff7de9"];
  const N = 7;
  ctx.save();
  for (let i = 0; i < N; i++) {
    const ph = i * 1.7;
    const tw = 0.5 + 0.5 * Math.sin(t * 4 + ph); // 瞬き
    if (tw < 0.12) continue;
    const ang = ph + t * 0.6;
    const rad = 30 + (i % 3) * 16;
    const x = L.cx + Math.cos(ang) * rad * 1.1;
    const y = (L.top + L.h * 0.5) + Math.sin(ang) * rad * 0.7;
    const s = (1.6 + (i % 2) * 1.4) * tw;
    ctx.globalAlpha = tw;
    ctx.fillStyle = cols[i % cols.length];
    // 4芒星（十字＋中心）
    ctx.fillRect(x - s, y - 0.6, s * 2, 1.2);
    ctx.fillRect(x - 0.6, y - s, 1.2, s * 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEnemyCard(
  ctx: CanvasRenderingContext2D,
  e: EnemyState,
  L: EnemyLayout,
  imminent: boolean,
  targeted: boolean,
): void {
  const sprite = enemyStill(e);
  const scale = e.def.bigBoss ? 7 : e.def.boss || e.def.rare ? 5 : 4;

  // 撃破演出：カード枠は出さず、ノックバック→フェード→宝箱（ドロップ）
  if (!e.alive) {
    if (e.deathT > 0) drawDeath(ctx, e, L.cx, L.footY, sprite, scale);
    if (e.drop) drawChest(ctx, e, L);
    return;
  }

  const danger = e.danger;

  // === 登場アニメ：右からスライドイン＋フェード（カードごと） ===
  const sp = e.spawnT > 0 ? e.spawnT / 420 : 0; // 1→0
  ctx.save();
  ctx.translate(sp * 150, 0);
  if (sp > 0) ctx.globalAlpha = 1 - sp;

  // === カード枠 ===
  const weak = WEAKNESS[e.def.kind];
  ctx.save();
  roundRect(ctx, L.left, L.top, L.w, L.h, 6);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.fill();
  // 弱点色をカード背景に薄く敷く（上は淡く、足元ほど濃い縦グラデ）。弱点が一目で分かる
  const wg = ctx.createLinearGradient(0, L.top, 0, L.top + L.h);
  wg.addColorStop(0, hexA(WEAK_COLOR[weak], 0.05));
  wg.addColorStop(1, hexA(WEAK_COLOR[weak], 0.26));
  roundRect(ctx, L.left, L.top, L.w, L.h, 6);
  ctx.fillStyle = wg;
  ctx.fill();
  if (imminent && danger > 0.25) {
    // 次に攻撃する敵：マゼンタで強調＋グロー
    const glow = 0.5 + 0.5 * Math.sin(Date.now() / (e.inTelegraph ? 80 : 150));
    ctx.shadowColor = "#df0b81";
    ctx.shadowBlur = 8 + glow * 12;
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(223,11,129,${0.7 + glow * 0.3})`;
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    ctx.lineWidth = targeted ? 3 : 1.5;
    ctx.strokeStyle = targeted ? "#df0b81" : "#2a2030";
    ctx.stroke();
  }
  ctx.restore();

  // 弱点バッジは廃止し、上のカード背景の色味で弱点を示す

  // === 名前（大きく・読みやすく：濃い縁取り付き） ===
  ctx.textAlign = "center";
  ctx.font = "800 13px 'Hanken Grotesk', 'Hiragino Kaku Gothic ProN', sans-serif";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.strokeText(e.def.name, L.cx, L.top + 20);
  ctx.fillStyle = "#1c1b1b";
  ctx.fillText(e.def.name, L.cx, L.top + 20);

  // === HP / ブレイクゲージ（太く・はっきり）===
  const barX = L.left + 12, barW = L.w - 24, barY = L.top + 30;
  bar(ctx, barX, barY, barW, 12, e.hp / e.def.maxHp, "#df0b81", "#efe2ea");
  const bg = e.isBroken ? 1 : Math.min(1, e.breakGauge / e.def.breakThreshold);
  // ブレイク満タン（＝ブレイク中）は金色で目立たせる
  bar(ctx, barX, barY + 15, barW, 7, bg, e.isBroken ? "#ffcf3f" : "#00c2d4", "#d6e6ea");

  // === スプライト（震え・赤点滅・怯み・被弾を反映） ===
  let trembleX = 0, trembleY = 0;
  if (danger > 0.45 && !e.isBroken) {
    const m = ((danger - 0.45) / 0.55) * (e.inTelegraph ? 3.6 : 2.2);
    trembleX = (Math.random() * 2 - 1) * m;
    trembleY = (Math.random() * 2 - 1) * m;
  }
  const flinchKnock = e.flinchT > 0 ? Math.min(16, e.flinchT * 0.024) : 0;
  const flinch = e.hitFlash > 0 ? (Math.random() * 2 - 1) * 5 : 0;
  if (e.isBroken) ctx.globalAlpha = 0.55 + 0.25 * Math.sin(Date.now() / 80);
  let tint: { color: string; alpha: number } | undefined;
  if (e.hitFlash > 0) {
    tint = { color: "#ffffff", alpha: Math.min(0.85, e.hitFlash / 260) };
  } else if (e.inTelegraph) {
    // 攻撃前：はっきり点滅して警告する（赤⇄明をくっきり切り替え）
    const on = Math.floor(Date.now() / 120) % 2 === 0;
    tint = { color: "#ff2626", alpha: on ? 0.78 : 0.12 };
  }
  // 種別ごとのアイドルアニメ（浮遊・呼吸）＋攻撃の踏み込み
  const at = Date.now() / 1000 + e.phase;
  let bob = 0, sx = 1, sy = 1, rot = 0;
  if (e.def.kind === "aerial") { bob = Math.sin(at * 2.4) * 5; rot = Math.sin(at * 1.7) * 0.06; }
  else if (e.def.kind === "phantom") { bob = Math.sin(at * 1.9) * 4; sy = 1 + Math.sin(at * 1.9) * 0.04; }
  else { sy = 1 + Math.sin(at * 1.6) * 0.05; sx = 1 - Math.sin(at * 1.6) * 0.04; }
  const atkLunge = e.atkAnimT > 0 ? Math.sin(Math.PI * (1 - e.atkAnimT / 300)) * -18 : 0;
  const recoil = e.hitFlash > 0 ? (e.hitFlash / 260) * 7 : 0; // 被弾でのけぞる（右へ）
  // レアモンスター：足元に金色のオーラ（煌びやかさ）
  if (e.def.rare && !e.isBroken) drawRareAura(ctx, L.cx, L.footY - 24);
  drawSpriteAnim(ctx, enemyFrame(e), L.cx + flinch + trembleX + flinchKnock + atkLunge + recoil, L.footY + trembleY, scale, {
    flip: true, tint, bob, sx, sy, rot,
  });
  ctx.globalAlpha = 1;
  // レアモンスター：周囲に瞬く宝石のきらめき
  if (e.def.rare && e.alive) drawRareGlitter(ctx, L);

  // === 攻撃カウントバッジ（カード下端中央） ===
  const cy = L.top + L.h - 4;
  if (e.isBroken) {
    drawBreakBadge(ctx, L, e.breakTurns);
  } else if (e.inTelegraph) {
    // 予兆：びっくりマーク
    const pulse = 1 + 0.35 * Math.abs(Math.sin(Date.now() / 80));
    ctx.save();
    ctx.translate(L.cx, cy - 4);
    ctx.scale(pulse, pulse);
    ctx.textAlign = "center";
    ctx.font = "bold 26px 'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif";
    ctx.fillStyle = "#1a0a0a";
    ctx.fillText("!", 1.5, 1.5);
    ctx.fillStyle = "#ff3b3b";
    ctx.fillText("!", 0, 0);
    ctx.restore();
  } else {
    const urgent = e.count <= 1;
    const ccy = cy - 9;
    const r = 16 + (urgent ? Math.abs(Math.sin(Date.now() / 120)) * 2.5 : 0);
    ctx.beginPath();
    ctx.arc(L.cx, ccy, r, 0, Math.PI * 2);
    ctx.fillStyle = urgent ? "#df0b81" : "#15101c";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = urgent ? "#ff5db0" : "#3a3048";
    ctx.stroke();
    // カウント数値：太字で、味方スキルのコスト表示くらい大きく
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 23px 'Space Mono', 'Hiragino Kaku Gothic ProN', monospace";
    ctx.fillText(`${e.count}`, L.cx, ccy + 1);
    ctx.textBaseline = "alphabetic";
  }

  // === ターゲットマーカー（カード下に黄色い三角） ===
  if (targeted) {
    const ty = L.top + L.h + 8;
    ctx.fillStyle = "#df0b81";
    ctx.beginPath();
    ctx.moveTo(L.cx, ty + 8);
    ctx.lineTo(L.cx - 8, ty);
    ctx.lineTo(L.cx + 8, ty);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore(); // 登場アニメ（スライド/フェード）の終了
}

/** 上部の警告バナー：次に攻撃する敵が迫っているとき表示 */
function drawWarningBanner(ctx: CanvasRenderingContext2D, b: Battle, imminent: number): void {
  if (imminent < 0) return;
  const e = b.enemies[imminent];
  if (!e || !e.inTelegraph) return; // 予兆中（!が出ている間）だけ表示
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 80));
  ctx.textAlign = "center";
  ctx.globalAlpha = pulse;
  ctx.font = "bold 17px 'Hanken Grotesk', 'Hiragino Kaku Gothic ProN', sans-serif";
  ctx.fillStyle = "#ff4040";
  ctx.fillText("⚠ 敵の攻撃！ ガード！", W / 2, 74);
  ctx.globalAlpha = 1;
}

/** 時間で巡回する虹色（アストラル用） */
function rainbowColor(off = 0): string {
  const h = (Date.now() / 8 + off) % 360;
  return `hsl(${h}, 90%, 62%)`;
}

/** 撃破ドロップの宝箱。レアリティ色で塗り、ポップ＆きらめき演出 */
function drawChest(ctx: CanvasRenderingContext2D, e: EnemyState, L: EnemyLayout): void {
  const elapsed = DEATH_ANIM_MS - e.deathT; // 0→ 撃破からの経過
  const t = Math.min(1, elapsed / 300);
  if (t <= 0) return;
  const pop = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.3 : 1; // 出現バウンド
  const bob = Math.sin(Date.now() / 320) * 1.5;            // 浮遊
  const rarity = getWeapon(e.drop!.baseId)?.rarity ?? "common";
  const rainbow = isRainbowRarity(rarity);
  const col = rainbow ? rainbowColor() : RARITY_COLOR[rarity];

  const w = 36, h = 28;
  ctx.save();
  ctx.translate(L.cx, L.footY + 4 + bob);
  ctx.scale(pop, pop);
  const x = -w / 2, y = -h;
  // 本体（グロー付き）
  ctx.shadowColor = col;
  ctx.shadowBlur = 16;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.shadowBlur = 0;
  // 下半分を暗く（立体感）
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(x, y + h * 0.46, w, h * 0.54);
  // 蓋の境界
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.44); ctx.lineTo(x + w, y + h * 0.44); ctx.stroke();
  // 外枠
  roundRect(ctx, x, y, w, h, 4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1a0f08";
  ctx.stroke();
  // 金の留め金
  ctx.fillStyle = "#ffd35f";
  ctx.fillRect(-5, y + h * 0.34, 10, 11);
  ctx.fillStyle = "#1a0f08";
  ctx.fillRect(-1.5, y + h * 0.44, 3, 4);
  ctx.restore();

  // 上に舞うきらめき
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(Date.now() / 200);
  ctx.fillStyle = rainbow ? rainbowColor(140) : col;
  ctx.textAlign = "center";
  ctx.font = "bold 13px monospace";
  ctx.fillText("✦", L.cx + 15, L.footY - h - 2);
  ctx.fillText("✦", L.cx - 16, L.footY - h + 6);
  ctx.globalAlpha = 1;
}

/** 対象切替の左右矢印 */
function drawTargetArrows(ctx: CanvasRenderingContext2D, b: Battle): void {
  if (b.aliveEnemies.length <= 1) return;
  const y = 166;
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 400));
  ctx.fillStyle = `rgba(223,11,129,${0.5 + pulse * 0.4})`;
  // 左
  ctx.beginPath();
  ctx.moveTo(14, y); ctx.lineTo(26, y - 9); ctx.lineTo(26, y + 9); ctx.closePath();
  ctx.fill();
  // 右
  ctx.beginPath();
  ctx.moveTo(W - 14, y); ctx.lineTo(W - 26, y - 9); ctx.lineTo(W - 26, y + 9); ctx.closePath();
  ctx.fill();
}

/** 撃破演出：ノックバックで吹き飛び、回転しながらフェード、上にドロップのきらめき */
function drawDeath(
  ctx: CanvasRenderingContext2D,
  e: EnemyState,
  x: number,
  y: number,
  sprite: Sprite,
  scale: number,
): void {
  const p = 1 - e.deathT / DEATH_ANIM_MS; // 0→1
  const dx = e.deathDir * p * 52;               // 奥へ吹き飛ぶ
  const dy = -Math.sin(p * Math.PI) * 22 + p * p * 30; // 跳ねて落ちる
  const tilt = e.deathDir * p * 0.9;            // 回転
  const alpha = Math.max(0, 1 - p * 1.05);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + dx, y + dy - scale * sprite.rows.length * 0.5);
  ctx.rotate(tilt);
  // 撃破直後は白く飛ばす
  const flash = p < 0.25 ? { color: "#ffffff", alpha: 0.8 * (1 - p / 0.25) } : undefined;
  drawSprite(ctx, sprite, 0, scale * sprite.rows.length * 0.5, scale, true, flash);
  ctx.restore();

  // ドロップのきらめき（上方向へ舞う金色の星）
  ctx.globalAlpha = Math.max(0, 1 - p);
  ctx.fillStyle = "#ffd35f";
  ctx.textAlign = "center";
  ctx.font = "bold 12px monospace";
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + p * 3;
    const r = p * 26;
    ctx.fillText("✦", x + Math.cos(a) * r, y - 20 - p * 30 + Math.sin(a) * r * 0.4);
  }
  ctx.globalAlpha = 1;
}

/** パーフェクト弾きエフェクト：閃光リング＋放射状スパーク */
function drawPerfectFx(
  ctx: CanvasRenderingContext2D,
  b: Battle,
  pos: { x: number; y: number },
): void {
  const p = 1 - b.perfectFxT / 360; // 0→1
  const { x } = pos;
  const y = pos.y - 24;

  // 中心の閃光
  ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 6 + p * 6, 0, Math.PI * 2);
  ctx.fill();

  // 拡がるリング
  ctx.globalAlpha = Math.max(0, 1 - p);
  ctx.strokeStyle = "#bfefff";
  ctx.lineWidth = 3 * (1 - p) + 0.5;
  ctx.beginPath();
  ctx.arc(x, y, 4 + p * 34, 0, Math.PI * 2);
  ctx.stroke();

  // 放射状スパーク
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + 0.3;
    const r0 = 8 + p * 18;
    const r1 = 16 + p * 40;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPlayerHud(ctx: CanvasRenderingContext2D, b: Battle): void {
  const M = 10; // 左右マージン
  // HP/ENは攻撃ボタンの上（DOM側）へ移動。ここでは対象敵の弱点ヒントのみ表示。
  const t = b.enemies[b.targetIndex];
  if (t && t.alive) {
    ctx.textAlign = "left";
    ctx.font = "bold 11px 'Space Mono', 'Hiragino Kaku Gothic ProN', monospace";
    ctx.fillStyle = "#8a7a90";
    ctx.fillText(`TARGET: ${t.def.name} [${KIND_LABEL[t.def.kind]}]`, M, 16);
  }
}

/** 撃破時の爆発エフェクト：中心フラッシュ＋拡がる炎リング＋放射スパーク */
function drawExplosions(ctx: CanvasRenderingContext2D, b: Battle, slots: { x: number; y: number }[]): void {
  for (const ex of b.explosions) {
    const base = slots[ex.anchor];
    if (!base) continue;
    const p = 1 - ex.ttl / ex.max; // 0→1
    const a = Math.max(0, 1 - p);
    const x = base.x, y = base.y - 28;

    // 中心フラッシュ
    ctx.globalAlpha = a * 0.9;
    const fr = 8 + p * 32;
    const g = ctx.createRadialGradient(x, y, 2, x, y, fr);
    g.addColorStop(0, "#fff8e0");
    g.addColorStop(0.45, "#ffae3a");
    g.addColorStop(1, "rgba(224,29,29,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, fr, 0, Math.PI * 2); ctx.fill();

    // 拡がるリング
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#ffd35f";
    ctx.lineWidth = 4 * (1 - p) + 1;
    ctx.beginPath(); ctx.arc(x, y, 10 + p * 48, 0, Math.PI * 2); ctx.stroke();

    // 放射状スパーク
    ctx.strokeStyle = "#ff7a1e";
    ctx.lineWidth = 3;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + 0.2;
      const r0 = 10 + p * 22, r1 = 18 + p * 54;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0);
      ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** 撃破時のコイン（金貨）を描く。回転で横幅が伸縮する */
function drawCoins(ctx: CanvasRenderingContext2D, b: Battle, slots: { x: number; y: number }[]): void {
  for (const c of b.coins) {
    const base = slots[c.anchor];
    if (!base) continue;
    const x = base.x + c.ox;
    const y = base.y + c.oy;
    const alpha = Math.max(0, Math.min(1, c.ttl / 300));
    ctx.globalAlpha = alpha;
    const wob = Math.abs(Math.cos(c.spin)); // 回転で見える幅が変わる
    const cw = 2.5 + wob * 4;
    const ch = 7;
    ctx.fillStyle = "#ffd95f";
    ctx.beginPath();
    ctx.ellipse(x, y, cw, ch, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#a9781a";
    ctx.stroke();
    if (cw > 3.6) {
      ctx.fillStyle = "#fff6c8";
      ctx.beginPath();
      ctx.ellipse(x - cw * 0.25, y - ch * 0.3, cw * 0.3, ch * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** 味方(player)の表記を、画面右側（中央より右）にログ的に積んで表示する */
function drawPlayerLog(ctx: CanvasRenderingContext2D, b: Battle): void {
  const logs = b.floats.filter((f) => f.anchor === "player");
  if (logs.length === 0) return;
  const x = W - 12;
  let y = H - 12; // バトル枠の一番下から上へ積む
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  // 新しいもの（配列末尾）を一番下に、古いものを上へ積む（最大6件）
  for (let i = logs.length - 1; i >= 0 && i >= logs.length - 6; i--) {
    const f = logs[i];
    const alpha = Math.max(0, Math.min(1, f.ttl / FLOAT_FADE_MS));
    ctx.globalAlpha = alpha;
    ctx.font = "900 22px 'Hanken Grotesk', 'Hiragino Kaku Gothic ProN', sans-serif";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, x, y);
    y -= 28;
  }
  ctx.globalAlpha = 1;
}

function drawFloats(ctx: CanvasRenderingContext2D, b: Battle, slots: { x: number; y: number }[]): void {
  drawPlayerLog(ctx, b); // 味方の表記は右側ログへ
  for (const f of b.floats) {
    if (f.anchor === "player") continue; // ログで描画済み
    if (f.kind === "announce") { drawAnnounce(ctx, f); continue; } // 中央の大型バナー
    let pos: { x: number; y: number };
    if (f.anchor === "center") pos = { x: W / 2, y: H / 2 };
    else pos = slots[f.anchor] ?? { x: W / 2, y: H / 2 };
    const age = f.max - f.ttl;
    const x = pos.x + (f.dx ?? 0);
    const y = pos.y - 50 - f.rise;
    // 消える直前(FLOAT_FADE_MS)までは不透明を保つ
    const alpha = Math.max(0, Math.min(1, f.ttl / FLOAT_FADE_MS));

    if (f.kind === "damage") {
      // 出現時に大きく弾けてから定位置へ
      const pop = age < 160 ? 1.75 - 0.75 * (age / 160) : 1;
      drawDamageBurst(ctx, x, y, f.text, !!f.big, !!f.crit, pop, alpha);
      continue;
    }
    // 通常テキスト（味方の回復/効果なども相手のダメージ表記くらい大きく）
    const scale = age < 140 ? 1.8 - 0.8 * (age / 140) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 19px 'Hanken Grotesk', 'Hiragino Kaku Gothic ProN', sans-serif";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4.5;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * ウェーブ開始・CLEAR などの大型バナー告知。PERFECT と同等の大きさ(44px)で、
 * 暗幕＋上下のアクセントラインを敷いたデザイン基準のバナーとして描く。
 */
function drawAnnounce(ctx: CanvasRenderingContext2D, f: FloatText): void {
  const age = f.max - f.ttl;
  // 小さく弾けて大きく → 落ち着く（オーバーシュート）
  const t = Math.min(1, age / 280);
  const back = (x: number) => 1 + 2.0 * Math.pow(x - 1, 3) + 1.1 * Math.pow(x - 1, 2);
  const pop = 0.5 + 0.5 * back(t);
  const alpha = Math.max(0, Math.min(1, f.ttl / FLOAT_FADE_MS));
  const cy = 138;

  // STAGE CLEAR / BOSS BATTLE は専用のドット絵バナーで表示
  if (f.text === "STAGE CLEAR" && imgReady(BADGE_CLEAR)) {
    // 画面いっぱいに（横幅上限をほぼ全幅にし、高さ基準を大きく取って幅で決まるように）
    drawBadgeImage(ctx, BADGE_CLEAR, W / 2, H / 2, 360, pop, alpha, "#ff5db6", W);
    return;
  }
  if (f.text === "BOSS BATTLE" && imgReady(BADGE_BOSS)) {
    drawBadgeFx(ctx, BADGE_BOSS, W / 2, H / 2, 260, pop, alpha, "#ff5a2a", Date.now(), "boss");
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2, cy);
  ctx.scale(pop, pop);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const size = 44;
  ctx.font = `900 ${size}px 'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif`;
  const tw = ctx.measureText(f.text).width;
  const bw = tw + 64;
  const bh = 62;

  // 暗幕の帯
  ctx.fillStyle = "rgba(10,8,20,0.58)";
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 8);
  ctx.fill();
  // 上下のアクセントライン（告知色）
  ctx.fillStyle = f.color;
  ctx.fillRect(-bw / 2, -bh / 2, bw, 4);
  ctx.fillRect(-bw / 2, bh / 2 - 4, bw, 4);

  // 文字（厚い暗色アウトライン＋告知色のグロー＋白い本体）
  ctx.lineJoin = "round";
  ctx.shadowColor = f.color;
  ctx.shadowBlur = 22;
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#0c0a18";
  ctx.strokeText(f.text, 0, 2);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = f.color;
  ctx.strokeText(f.text, 0, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(f.text, 0, 2);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** ダメージ数値を「ギザギザ爆発」の上に大きく描く（数値は1.5倍、会心は色を変える） */
function drawDamageBurst(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, num: string, big: boolean, crit: boolean, pop: number, alpha: number,
): void {
  // 吹き出しを1.5倍に（big=40 / 通常=31）
  const fontSize = big ? 40 : 31;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.scale(pop, pop);

  // 数値の幅に合わせて爆発の大きさを決める
  ctx.font = `900 ${fontSize}px 'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif`;
  const tw = ctx.measureText(num).width;
  const rx = tw / 2 + 22;
  const ry = fontSize * 0.95;

  // ギザギザの爆発（外側→内側を交互に結ぶ星形）
  const spikes = big ? 14 : 12;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? 1 : 0.64;
    const sx = Math.cos(ang) * rx * rr;
    const sy = Math.sin(ang) * ry * rr;
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(rx, ry));
  if (crit) {
    // 会心：ピンク〜パープルで色を変える
    grad.addColorStop(0, "#fff0fa");
    grad.addColorStop(0.5, "#ff5db6");
    grad.addColorStop(1, "#b80069");
  } else if (big) {
    grad.addColorStop(0, "#fff3a0");
    grad.addColorStop(0.5, "#ff8a2a");
    grad.addColorStop(1, "#e01d1d");
  } else {
    grad.addColorStop(0, "#fff2cf");
    grad.addColorStop(0.6, "#ffb23a");
    grad.addColorStop(1, "#ff7a1e");
  }
  ctx.fillStyle = grad;
  ctx.shadowColor = crit ? "rgba(223,11,129,0.65)" : big ? "rgba(255,60,40,0.6)" : "rgba(255,140,40,0.5)";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = crit ? "#5a0033" : big ? "#5a0a06" : "#6a2e08";
  ctx.stroke();

  // 数値（白＋濃い縁取り）
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = crit ? "#6a0040" : big ? "#6a0c06" : "#7a3410";
  ctx.strokeText(num, 0, 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(num, 0, 1);

  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

/**
 * スキル発動時の「スキル名バナー」をプレイヤーの右に描く。
 * 左から滑り込みながらフェードイン。連携スキルは金色＋火花でワクワク感を出す。
 */
function drawSkillBanner(ctx: CanvasRenderingContext2D, b: Battle): void {
  const sb = b.skillBanner;
  if (!sb) return;
  const age = sb.max - sb.ttl;
  // 出現（左からスライド＋フェードイン）と消える間際のフェードアウト
  const appear = Math.min(1, age / 180);
  const ease = 1 - Math.pow(1 - appear, 3); // easeOutCubic
  const fadeOut = Math.min(1, sb.ttl / FLOAT_FADE_MS);
  const alpha = Math.min(appear, fadeOut);
  const slide = (1 - ease) * -18; // 左から滑り込む
  const fontStack = "'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif";
  const combo = !!sb.combo;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";

  // 吹き出しの寸法を計算
  const fs = combo ? 22 : 18;
  ctx.font = `900 ${fs}px ${fontStack}`;
  const tw = ctx.measureText(sb.text).width;
  const tagH = combo ? 15 : 0;
  const padX = 12, padY = 8;
  const bx = 96 + slide;
  const bw = tw + padX * 2;
  const bh = fs + tagH + padY * 2 + (combo ? 3 : 0);
  const by = 298 - bh;
  const textX = bx + padX;

  // ===== 吹き出し枠（プレイヤー方向＝左下にしっぽ）。本体としっぽを一筆書きの輪郭にして内部の線を出さない =====
  const fill = combo ? "#fff7e0" : "#ffffff";
  const line = combo ? "#9a6f0b" : "#1c1b1b";
  const lw = combo ? 3 : 2.5;
  const r = 9;
  const t1 = bx + 14, t2 = bx + 30, tipX = bx - 2, tipY = by + bh + 14;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + r, r);          // 右上
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r); // 右下
    ctx.lineTo(t2, by + bh);                              // 下辺 → しっぽ右
    ctx.lineTo(tipX, tipY);                               // しっぽ先端
    ctx.lineTo(t1, by + bh);                              // しっぽ左 → 下辺
    ctx.lineTo(bx + r, by + bh);
    ctx.arcTo(bx, by + bh, bx, by + bh - r, r);           // 左下
    ctx.lineTo(bx, by + r);
    ctx.arcTo(bx, by, bx + r, by, r);                     // 左上
    ctx.closePath();
  };
  if (combo) { ctx.shadowColor = "#ffcf3f"; ctx.shadowBlur = 16 * alpha; }
  ctx.fillStyle = fill;
  path();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  path();
  ctx.stroke();

  const nameY = by + bh - padY - 2;

  if (combo) {
    // 「⚡連携」タグ
    const tagY = by + padY + 11;
    ctx.font = `900 12px ${fontStack}`;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#5a3d00";
    ctx.strokeText("⚡ 連携", textX, tagY);
    const tg = ctx.createLinearGradient(textX, tagY - 11, textX, tagY + 2);
    tg.addColorStop(0, "#fff3c4");
    tg.addColorStop(1, "#ffb01f");
    ctx.fillStyle = tg;
    ctx.fillText("⚡ 連携", textX, tagY);

    // スキル名（金グラデ＋濃い縁取り）
    ctx.font = `900 ${fs}px ${fontStack}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#5a3d00";
    ctx.strokeText(sb.text, textX, nameY);
    const g = ctx.createLinearGradient(textX, nameY - fs, textX, nameY + 2);
    g.addColorStop(0, "#fff7d6");
    g.addColorStop(0.5, "#ffd34d");
    g.addColorStop(1, "#f59a12");
    ctx.fillStyle = g;
    ctx.fillText(sb.text, textX, nameY);

    // 火花（吹き出し周りで瞬く金の粒）
    const tsec = age / 1000;
    for (let i = 0; i < 6; i++) {
      const px = bx - 4 + ((i * 53) % (bw + 12));
      const py = by + 6 + Math.sin(tsec * 9 + i * 1.7) * 10;
      const twk = 0.5 + 0.5 * Math.sin(tsec * 11 + i * 2.3);
      ctx.globalAlpha = alpha * twk;
      ctx.fillStyle = i % 2 ? "#fff6cf" : "#ffd24d";
      const s = 1.4 + twk * 1.8;
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
  } else {
    // 通常スキル：黒字
    ctx.font = `800 ${fs}px ${fontStack}`;
    ctx.fillStyle = "#1c1b1b";
    ctx.fillText(sb.text, textX, nameY);
  }

  ctx.restore();
}

function drawGuardBadge(ctx: CanvasRenderingContext2D, b: Battle): void {
  if (b.lastGuardTtl <= 0 || b.lastGuard === "none") return;
  // PERFECT だけ明確に大きく・派手に。通常ガードは控えめ。
  const map: Record<string, { text: string; color: string; size: number; perfect?: boolean; glow?: string }> = {
    guard: { text: "GUARD", color: "#dfe6ff", size: 26 },
    just: { text: "JUST!", color: "#88ddff", size: 32, glow: "#88ddff" },
    perfect: { text: "PERFECT!", color: "#8effe0", size: 88, perfect: true },
  };
  const entry = map[b.lastGuard];
  if (!entry) return;
  const age = GUARD_BADGE_MS - b.lastGuardTtl;
  // 大きく飛び出して手前に来る → 弾むように定位置へ
  const pop = age < 170 ? 2.7 - 1.7 * (age / 170) : 1 + 0.12 * Math.max(0, Math.sin((age - 170) / 60));
  ctx.textAlign = "center";
  // 消える直前まで不透明を保ち、1秒ほどはっきり残す
  const baseAlpha = Math.min(1, b.lastGuardTtl / FLOAT_FADE_MS);
  // PERFECT は専用のドット絵バナーで表示
  if (entry.perfect && imgReady(BADGE_PERFECT)) {
    drawBadgeImage(ctx, BADGE_PERFECT, W / 2, 150, 170, pop, baseAlpha, "#8effe0");
    return;
  }
  ctx.save();
  ctx.translate(W / 2, 150);
  ctx.scale(pop, pop);

  if (entry.perfect) {
    // 虹色グロー＋複数アウトラインで「手前に押し出す」厚み
    ctx.shadowColor = rainbowColor();
    ctx.shadowBlur = 26;
    ctx.font = `900 ${entry.size}px 'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif`;
    ctx.lineJoin = "round";
    ctx.globalAlpha = baseAlpha;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#06281f";
    ctx.strokeText(entry.text, 0, 0);
    ctx.lineWidth = 4;
    ctx.strokeStyle = rainbowColor(180);
    ctx.strokeText(entry.text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#eafff8";
    ctx.fillText(entry.text, 0, 0);
  } else {
    // JUST はシアンのグローで GUARD より少し派手に
    if (entry.glow) {
      ctx.shadowColor = entry.glow;
      ctx.shadowBlur = 14;
    }
    ctx.font = `bold ${entry.size}px 'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif`;
    ctx.lineJoin = "round";
    ctx.globalAlpha = baseAlpha;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#11132a";
    ctx.strokeText(entry.text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = entry.color;
    ctx.fillText(entry.text, 0, 0);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawResult(ctx: CanvasRenderingContext2D, b: Battle): void {
  const won = b.phase === "won";
  // 画面いっぱいの暗幕（勝敗で色味を変える）
  ctx.fillStyle = won ? "rgba(6,20,38,0.82)" : "rgba(32,8,12,0.84)";
  ctx.fillRect(0, 0, W, H);

  // 出現アニメ（小さく弾けて大きく → 落ち着く）
  const t = Math.min(1, b.resultT / 380);
  const back = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
  const pop = 0.3 + 0.7 * back(t);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(pop, pop);
  ctx.textAlign = "center";
  ctx.lineJoin = "round";

  const main = won ? "#bfefff" : "#ffb3bd";
  const glow = won ? "#3fa8ff" : "#ff4d63";
  const line1 = won ? "STAGE" : "YOU";
  const line2 = won ? "CLEAR!" : "DIED";

  ctx.shadowColor = glow;
  ctx.shadowBlur = 26;
  ctx.font = "900 52px 'Anybody', 'Hiragino Kaku Gothic ProN', sans-serif";
  ctx.lineWidth = 9;
  ctx.strokeStyle = won ? "#062542" : "#2a060c";
  ctx.strokeText(line1, 0, -24);
  ctx.strokeText(line2, 0, 34);
  ctx.shadowBlur = 0;
  ctx.fillStyle = main;
  ctx.fillText(line1, 0, -24);
  ctx.fillText(line2, 0, 34);
  ctx.restore();
}

function bar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  ratio: number, fill: string, bgc: string,
): void {
  ctx.fillStyle = bgc;
  ctx.fillRect(x, y, w, h);
  const fw = w * Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, fw, h);
  // 上側に白いハイライト帯を入れて立体感・視認性を上げる
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x, y, fw, Math.max(1, h * 0.34));
  // はっきりした黒枠で輪郭を強調
  ctx.strokeStyle = "rgba(20,12,18,0.8)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}
