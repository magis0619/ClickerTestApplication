import { Battle, EnemyState, DEATH_ANIM_MS } from "../game/engine.ts";
import {
  KIND_LABEL, WEAKNESS, WEAPON_LABEL,
  RARITY_COLOR, isRainbowRarity, WHITE_FLASH_MS, getWeapon,
  FLOAT_FADE_MS, GUARD_BADGE_MS,
} from "../game/data.ts";
import {
  WARDEN, WARDEN_ATTACK, WARDEN_HURT, CARAPACE, AERIAL, PHANTOM, BOSS,
  CARAPACE_TEL, AERIAL_TEL, PHANTOM_TEL, BOSS_TEL, type Sprite,
} from "./sprites.ts";
import type { EnemyKind } from "../game/types.ts";

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

/** ライトテーマの背景ドットグリッド（ターミナル風の方眼） */
function drawDotGrid(ctx: CanvasRenderingContext2D): void {
  const step = 16;
  ctx.fillStyle = "#d8cdd5";
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
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

const WCLASS_COLOR: Record<string, string> = { slash: "#5fa8ff", pierce: "#7fe070", crush: "#ffb347" };

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
/** 状態に応じて敵のフレーム（待機/予兆）を選ぶ */
function enemyFrame(e: EnemyState): Sprite {
  const acting = e.inTelegraph || e.atkAnimT > 0;
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
  stage?: { index: number; count: number; wave?: number; waves?: number; boss?: boolean; floor?: number },
): void {
  // ライト基調のターミナル風ビューポート（ドットグリッド）
  ctx.fillStyle = "#fcf9f8";
  ctx.fillRect(0, 0, W, H);
  drawDotGrid(ctx);

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
  drawCoins(ctx, b, slots);
  drawFloats(ctx, b, slots);
  ctx.restore();

  drawPlayerHud(ctx, b);
  if (stage) {
    ctx.textAlign = "right";
    ctx.font = "bold 11px monospace";
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
  if (b.phase !== "fighting") drawResult(ctx, b);
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
  // 被弾モーション：強くのけぞって（左後方へ）すぐ戻る＋赤フラッシュ
  const hp = hurt ? b.playerHitT / 320 : 0; // 1→0
  const knock = hurt ? -hp * 18 : 0;
  // 攻撃モーション：序盤に少し引き（windup）→前へ踏み込む→戻る
  const k = attacking ? 1 - b.lungeT / 200 : 0; // 0→1
  const lunge = attacking ? (k < 0.25 ? -k * 24 : Math.sin(Math.PI * k) * 24) : 0;
  // 常時アイドル：呼吸（上下＋伸縮）
  const t = Date.now() / 1000;
  const breathe = Math.sin(t * 2.2);
  const sprite = hurt ? WARDEN_HURT : attacking ? WARDEN_ATTACK : WARDEN;
  const tint = hurt ? { color: "#ff4040", alpha: hp * 0.7 } : undefined;
  drawSpriteAnim(ctx, sprite, x + lunge + knock, y, 5, {
    tint,
    bob: hurt ? -hp * 3 : attacking ? 0 : breathe * 1.3,
    sy: hurt ? 1 - hp * 0.06 : attacking ? 1 : 1 + breathe * 0.035,
    sx: hurt ? 1 + hp * 0.05 : attacking ? 1 : 1 - breathe * 0.025,
  });
  if (b.charge > 1) {
    ctx.textAlign = "center";
    ctx.font = "900 12px monospace";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeText("CHARGED", x, y - 80);
    ctx.fillStyle = "#d97a16";
    ctx.fillText("CHARGED", x, y - 80);
  }
}

/** 敵1体をカード形式で描画（枠・弱点バッジ・名前・HP・スプライト・カウント） */
function drawEnemyCard(
  ctx: CanvasRenderingContext2D,
  e: EnemyState,
  L: EnemyLayout,
  imminent: boolean,
  targeted: boolean,
): void {
  const sprite = e.def.boss ? BOSS : ENEMY_SPRITE[e.def.kind];
  const scale = e.def.boss ? 5 : 4;

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
  ctx.save();
  roundRect(ctx, L.left, L.top, L.w, L.h, 6);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
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

  // === 弱点バッジ（左上の丸：弱点となる武器系統） ===
  const weak = WEAKNESS[e.def.kind];
  const bx = L.left + 16, by = L.top + 16;
  ctx.beginPath();
  ctx.arc(bx, by, 12, 0, Math.PI * 2);
  ctx.fillStyle = "#fbf7f9";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = WCLASS_COLOR[weak];
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = WCLASS_COLOR[weak];
  ctx.fillText(WEAPON_LABEL[weak][0], bx, by + 1);
  ctx.textBaseline = "alphabetic";

  // === 名前（大きく・読みやすく：濃い縁取り付き） ===
  ctx.textAlign = "center";
  ctx.font = "bold 13px monospace";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.strokeText(e.def.name, L.cx, L.top + 20);
  ctx.fillStyle = "#1c1b1b";
  ctx.fillText(e.def.name, L.cx, L.top + 20);

  // === HP / ブレイクゲージ ===
  const barX = L.left + 12, barW = L.w - 24, barY = L.top + 32;
  bar(ctx, barX, barY, barW, 7, e.hp / e.def.maxHp, "#df0b81", "#e6d9e0");
  const bg = e.isBroken ? 1 : Math.min(1, e.breakGauge / e.def.breakThreshold);
  bar(ctx, barX, barY + 9, barW, 3, bg, "#00c2d4", "#d6e6ea");

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
  } else if (danger > 0.5 && !e.isBroken) {
    const blink = 0.5 + 0.5 * Math.sin(Date.now() / (e.inTelegraph ? 70 : 130));
    tint = { color: "#ff2020", alpha: ((danger - 0.5) / 0.5) * 0.6 * blink };
  }
  // 種別ごとのアイドルアニメ（浮遊・呼吸）＋攻撃の踏み込み
  const at = Date.now() / 1000 + e.phase;
  let bob = 0, sx = 1, sy = 1, rot = 0;
  if (e.def.kind === "aerial") { bob = Math.sin(at * 2.4) * 5; rot = Math.sin(at * 1.7) * 0.06; }
  else if (e.def.kind === "phantom") { bob = Math.sin(at * 1.9) * 4; sy = 1 + Math.sin(at * 1.9) * 0.04; }
  else { sy = 1 + Math.sin(at * 1.6) * 0.05; sx = 1 - Math.sin(at * 1.6) * 0.04; }
  const atkLunge = e.atkAnimT > 0 ? Math.sin(Math.PI * (1 - e.atkAnimT / 300)) * -18 : 0;
  const recoil = e.hitFlash > 0 ? (e.hitFlash / 260) * 7 : 0; // 被弾でのけぞる（右へ）
  drawSpriteAnim(ctx, enemyFrame(e), L.cx + flinch + trembleX + flinchKnock + atkLunge + recoil, L.footY + trembleY, scale, {
    flip: true, tint, bob, sx, sy, rot,
  });
  ctx.globalAlpha = 1;

  // === 攻撃カウントバッジ（カード下端中央） ===
  const cy = L.top + L.h - 4;
  if (e.isBroken) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#0a9bb5";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`BREAK ${e.breakTurns}`, L.cx, cy);
  } else if (e.inTelegraph) {
    // 予兆：びっくりマーク
    const pulse = 1 + 0.35 * Math.abs(Math.sin(Date.now() / 80));
    ctx.save();
    ctx.translate(L.cx, cy - 4);
    ctx.scale(pulse, pulse);
    ctx.textAlign = "center";
    ctx.font = "bold 26px monospace";
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
    ctx.font = "900 23px monospace";
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
  ctx.font = "bold 17px monospace";
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
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#8a7a90";
    ctx.fillText(`TARGET: ${t.def.name} [${KIND_LABEL[t.def.kind]}] WEAK:${WEAPON_LABEL[WEAKNESS[t.def.kind]]}`, M, 16);
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
    ctx.font = "900 22px monospace";
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
      drawDamageBurst(ctx, x, y, f.text, f.tag ?? "", !!f.big, pop, alpha);
      continue;
    }
    // 通常テキスト（味方の回復/効果なども相手のダメージ表記くらい大きく）
    const scale = age < 140 ? 1.8 - 0.8 * (age / 140) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 19px monospace";
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

/** ダメージ数値を「赤いギザギザ爆発」の上に大きく描く（会心/弱点はより大きく赤く） */
function drawDamageBurst(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, num: string, tag: string, big: boolean, pop: number, alpha: number,
): void {
  const fontSize = big ? 27 : 21;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.scale(pop, pop);

  // 数値の幅に合わせて爆発の大きさを決める
  ctx.font = `900 ${fontSize}px monospace`;
  const tw = ctx.measureText(num).width;
  const rx = tw / 2 + 16;
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
  if (big) {
    grad.addColorStop(0, "#fff3a0");
    grad.addColorStop(0.5, "#ff8a2a");
    grad.addColorStop(1, "#e01d1d");
  } else {
    grad.addColorStop(0, "#fff2cf");
    grad.addColorStop(0.6, "#ffb23a");
    grad.addColorStop(1, "#ff7a1e");
  }
  ctx.fillStyle = grad;
  ctx.shadowColor = big ? "rgba(255,60,40,0.6)" : "rgba(255,140,40,0.5)";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = big ? "#5a0a06" : "#6a2e08";
  ctx.stroke();

  // 数値（白＋濃い縁取り）
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = big ? "#6a0c06" : "#7a3410";
  ctx.strokeText(num, 0, 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(num, 0, 1);

  // 修飾（会心! 弱点! 渾身!）を爆発の上に小さく
  if (tag) {
    ctx.font = "900 12px monospace";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#5a0a06";
    ctx.strokeText(tag, 0, -ry - 5);
    ctx.fillStyle = "#ffe680";
    ctx.fillText(tag, 0, -ry - 5);
  }
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

function drawGuardBadge(ctx: CanvasRenderingContext2D, b: Battle): void {
  if (b.lastGuardTtl <= 0 || b.lastGuard === "none") return;
  // PERFECT だけ明確に大きく・派手に。通常ガードは控えめ。
  const map: Record<string, { text: string; color: string; size: number; perfect?: boolean; glow?: string }> = {
    guard: { text: "GUARD", color: "#dfe6ff", size: 26 },
    just: { text: "JUST!", color: "#88ddff", size: 32, glow: "#88ddff" },
    perfect: { text: "PERFECT!", color: "#8effe0", size: 44, perfect: true },
  };
  const entry = map[b.lastGuard];
  if (!entry) return;
  const age = GUARD_BADGE_MS - b.lastGuardTtl;
  // 大きく飛び出して手前に来る → 弾むように定位置へ
  const pop = age < 170 ? 2.7 - 1.7 * (age / 170) : 1 + 0.12 * Math.max(0, Math.sin((age - 170) / 60));
  ctx.textAlign = "center";
  // 消える直前まで不透明を保ち、1秒ほどはっきり残す
  const baseAlpha = Math.min(1, b.lastGuardTtl / FLOAT_FADE_MS);
  ctx.save();
  ctx.translate(W / 2, 150);
  ctx.scale(pop, pop);

  if (entry.perfect) {
    // 虹色グロー＋複数アウトラインで「手前に押し出す」厚み
    ctx.shadowColor = rainbowColor();
    ctx.shadowBlur = 26;
    ctx.font = `900 ${entry.size}px monospace`;
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
    ctx.font = `bold ${entry.size}px monospace`;
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
  ctx.font = "900 52px monospace";
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
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}
