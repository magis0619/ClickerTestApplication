import { Battle, EnemyState } from "../game/engine.ts";
import { KIND_LABEL, WEAKNESS, WEAPON_LABEL, PLAYER_MAX_HP, PLAYER_MAX_EN } from "../game/data.ts";
import { WARDEN, CARAPACE, AERIAL, PHANTOM, BOSS, type Sprite } from "./sprites.ts";
import type { EnemyKind } from "../game/types.ts";

const W = 480;
const H = 320;
const PLAYER_POS = { x: 90, y: 215 };

/** N体の敵の配置スロット（描画と当たり判定で共有） */
export function enemySlots(n: number): { x: number; y: number }[] {
  if (n <= 1) return [{ x: 360, y: 195 }];
  if (n === 2) return [{ x: 300, y: 170 }, { x: 415, y: 205 }];
  if (n === 3) return [{ x: 265, y: 150 }, { x: 360, y: 205 }, { x: 445, y: 150 }];
  // 4体以上は等間隔
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: 250 + (i * 200) / (n - 1), y: i % 2 === 0 ? 150 : 205 });
  }
  return out;
}

const ENEMY_SPRITE: Record<EnemyKind, Sprite> = {
  carapace: CARAPACE,
  aerial: AERIAL,
  phantom: PHANTOM,
};

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

export function render(
  ctx: CanvasRenderingContext2D,
  b: Battle,
  stage?: { index: number; count: number },
): void {
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

  const slots = enemySlots(b.enemies.length);

  // 画面シェイク（エンティティ層のみ）
  ctx.save();
  if (b.shakeT > 0) {
    const mag = Math.min(8, b.shakeT * 0.03);
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
  }
  drawPlayer(ctx, b);
  b.enemies.forEach((e, i) => drawEnemy(ctx, e, slots[i], i === b.targetIndex && e.alive));
  drawFloats(ctx, b, slots);
  ctx.restore();

  drawPlayerHud(ctx, b);
  if (stage) {
    ctx.textAlign = "center";
    ctx.font = "11px monospace";
    ctx.fillStyle = "#9690c4";
    ctx.fillText(`STAGE ${stage.index + 1} / ${stage.count}`, W / 2, 14);
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

function drawPlayer(ctx: CanvasRenderingContext2D, b: Battle): void {
  const { x, y } = PLAYER_POS;
  // 攻撃時の踏み込み（前に出てから戻る）
  const lunge = b.lungeT > 0 ? Math.sin(Math.PI * (1 - b.lungeT / 200)) * 16 : 0;
  drawSprite(ctx, WARDEN, x + lunge, y, 4);
  if (b.charge > 1) {
    ctx.textAlign = "center";
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#ffd35f";
    ctx.fillText("CHARGED", x, y - 64);
  }
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: EnemyState,
  pos: { x: number; y: number },
  targeted: boolean,
): void {
  const { x, y } = pos;
  if (!e.alive) {
    ctx.globalAlpha = 0.18;
  }
  const sprite = e.def.boss ? BOSS : ENEMY_SPRITE[e.def.kind];
  const scale = e.def.boss ? 4 : 3;

  // 被弾時のけぞり（横揺れ）
  const flinch = e.hitFlash > 0 ? (Math.random() * 2 - 1) * 4 : 0;
  if (e.alive && e.isBroken) ctx.globalAlpha = 0.55 + 0.25 * Math.sin(Date.now() / 80);
  const flash = e.hitFlash > 0 ? { color: "#ffffff", alpha: Math.min(0.85, e.hitFlash / 260) } : undefined;
  drawSprite(ctx, sprite, x + flinch, y, scale, true, flash);
  ctx.globalAlpha = 1;

  if (!e.alive) return;

  const halfW = (e.def.boss ? 28 : 20);

  // ターゲットマーカー
  if (targeted) {
    ctx.fillStyle = "#ffea00";
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x - 6, y + 16);
    ctx.lineTo(x + 6, y + 16);
    ctx.closePath();
    ctx.fill();
  }

  // HPバー
  const top = y - (e.def.boss ? 48 : 36) * 1 - 16;
  bar(ctx, x - halfW, top, halfW * 2, 5, e.hp / e.def.maxHp, "#ff5d86", "#33101c");
  // ブレイクゲージ
  const bg = e.isBroken ? 1 : Math.min(1, e.breakGauge / e.def.breakThreshold);
  bar(ctx, x - halfW, top + 6, halfW * 2, 3, bg, "#ffcf3f", "#3a2f10");

  // 名前
  ctx.textAlign = "center";
  ctx.font = "9px monospace";
  ctx.fillStyle = "#ffd0e0";
  ctx.fillText(e.def.name, x, top - 14);

  // 攻撃カウント / 予兆（ポップ演出付き）
  const cy = top - 4;
  if (e.isBroken) {
    ctx.fillStyle = "#ffdd44";
    ctx.font = "bold 11px monospace";
    ctx.fillText("BREAK", x, cy);
  } else if (e.inTelegraph) {
    // 「!!」を鼓動させる
    const pulse = 1 + 0.3 * Math.abs(Math.sin(Date.now() / 90));
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(pulse, pulse);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#1a0a0a";
    ctx.fillText("!!", 1, 1); // 影
    ctx.fillStyle = "#ff3b3b";
    ctx.fillText("!!", 0, 0);
    ctx.restore();
  } else {
    // カウント数字を円バッジでポップ表示
    const urgent = e.count <= 1;
    const r = 9 + (urgent ? Math.abs(Math.sin(Date.now() / 120)) * 2 : 0);
    ctx.beginPath();
    ctx.arc(x, cy - 4, r, 0, Math.PI * 2);
    ctx.fillStyle = urgent ? "#a8324a" : "#2a2350";
    ctx.fill();
    ctx.strokeStyle = urgent ? "#ff6f8a" : "#5a4fa0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`${e.count}`, x, cy);
  }
}

function drawPlayerHud(ctx: CanvasRenderingContext2D, b: Battle): void {
  ctx.textAlign = "left";
  ctx.fillStyle = "#cfe4ff";
  ctx.font = "11px monospace";
  ctx.fillText("WARDEN", 12, 28);
  bar(ctx, 12, 33, 150, 10, b.playerHp / PLAYER_MAX_HP, "#3ad27a", "#10331f");
  ctx.fillStyle = "#9fd9ff";
  ctx.fillText(`HP ${Math.ceil(b.playerHp)}/${PLAYER_MAX_HP}`, 12, 56);
  bar(ctx, 12, 61, 150, 8, b.playerEn / PLAYER_MAX_EN, "#46b6ff", "#102a3a");
  ctx.fillStyle = "#9fd9ff";
  ctx.fillText(`EN ${Math.floor(b.playerEn)}/${PLAYER_MAX_EN}`, 12, 83);

  // 対象敵の弱点ヒント
  const t = b.enemies[b.targetIndex];
  if (t && t.alive) {
    ctx.fillStyle = "#7f7aa0";
    ctx.fillText(`対象: ${t.def.name}（${KIND_LABEL[t.def.kind]}） 弱点:${WEAPON_LABEL[WEAKNESS[t.def.kind]]}`, 12, H - 10);
  }
}

function drawFloats(ctx: CanvasRenderingContext2D, b: Battle, slots: { x: number; y: number }[]): void {
  ctx.textAlign = "center";
  for (const f of b.floats) {
    let pos: { x: number; y: number };
    if (f.anchor === "player") pos = PLAYER_POS;
    else if (f.anchor === "center") pos = { x: W / 2, y: H / 2 };
    else pos = slots[f.anchor] ?? { x: W / 2, y: H / 2 };
    // 出現直後に大きく→通常サイズへ縮むポップ
    const age = 900 - f.ttl;
    const scale = age < 140 ? 1.8 - 0.8 * (age / 140) : 1;
    const px = pos.x;
    const py = pos.y - 50 - f.rise;
    ctx.globalAlpha = Math.max(0, Math.min(1, f.ttl / 900));
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#000000";
    ctx.globalAlpha *= 0.5;
    ctx.fillText(f.text, 1, 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, f.ttl / 900));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawGuardBadge(ctx: CanvasRenderingContext2D, b: Battle): void {
  if (b.lastGuardTtl <= 0 || b.lastGuard === "none") return;
  const map: Record<string, [string, string]> = {
    guard: ["GUARD", "#cccccc"],
    just: ["JUST GUARD", "#88ddff"],
    parry: ["PARRY", "#66ffaa"],
  };
  const entry = map[b.lastGuard];
  if (!entry) return;
  const age = 700 - b.lastGuardTtl;
  const scale = age < 130 ? 1.6 - 0.6 * (age / 130) : 1;
  ctx.textAlign = "center";
  ctx.globalAlpha = Math.min(1, b.lastGuardTtl / 700);
  ctx.save();
  ctx.translate(W / 2, 130);
  ctx.scale(scale, scale);
  ctx.font = "bold 20px monospace";
  ctx.fillStyle = "#000000";
  ctx.globalAlpha *= 0.4;
  ctx.fillText(entry[0], 1.5, 1.5);
  ctx.globalAlpha = Math.min(1, b.lastGuardTtl / 700);
  ctx.fillStyle = entry[1];
  ctx.fillText(entry[0], 0, 0);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawResult(ctx: CanvasRenderingContext2D, b: Battle): void {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = b.phase === "won" ? "#66ddff" : "#ff6677";
  ctx.fillText(b.phase === "won" ? "STAGE CLEAR" : "DEFEATED", W / 2, H / 2);
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
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}
