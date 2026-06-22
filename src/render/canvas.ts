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

  drawPlayer(ctx, b);
  b.enemies.forEach((e, i) => drawEnemy(ctx, e, slots[i], i === b.targetIndex && e.alive));

  drawPlayerHud(ctx, b);
  if (stage) {
    ctx.textAlign = "center";
    ctx.font = "11px monospace";
    ctx.fillStyle = "#9690c4";
    ctx.fillText(`STAGE ${stage.index + 1} / ${stage.count}`, W / 2, 14);
  }

  drawFloats(ctx, b, slots);
  drawGuardBadge(ctx, b);
  if (b.phase !== "fighting") drawResult(ctx, b);
}

function drawPlayer(ctx: CanvasRenderingContext2D, b: Battle): void {
  const { x, y } = PLAYER_POS;
  drawSprite(ctx, WARDEN, x, y, 4);
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

  if (e.alive && e.isBroken) ctx.globalAlpha = 0.55 + 0.25 * Math.sin(Date.now() / 80);
  drawSprite(ctx, sprite, x, y, scale, true);
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

  // 攻撃カウント / 予兆
  if (e.isBroken) {
    ctx.fillStyle = "#ffdd44";
    ctx.font = "bold 10px monospace";
    ctx.fillText("BREAK", x, top - 3);
  } else if (e.inTelegraph) {
    ctx.fillStyle = "#ffea00";
    ctx.font = "bold 18px monospace";
    ctx.fillText("!!", x, top - 2);
  } else {
    // カウント数字
    ctx.fillStyle = "#cfc9f2";
    ctx.font = "bold 13px monospace";
    ctx.fillText(`${e.count}`, x, top - 2);
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
  ctx.font = "bold 13px monospace";
  for (const f of b.floats) {
    let pos: { x: number; y: number };
    if (f.anchor === "player") pos = PLAYER_POS;
    else if (f.anchor === "center") pos = { x: W / 2, y: H / 2 };
    else pos = slots[f.anchor] ?? { x: W / 2, y: H / 2 };
    ctx.globalAlpha = Math.max(0, Math.min(1, f.ttl / 900));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, pos.x, pos.y - 50 - f.rise);
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
  ctx.textAlign = "center";
  ctx.font = "bold 20px monospace";
  ctx.globalAlpha = Math.min(1, b.lastGuardTtl / 700);
  ctx.fillStyle = entry[1];
  ctx.fillText(entry[0], W / 2, 130);
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
