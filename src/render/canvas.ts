import { Battle } from "../game/engine.ts";
import { KIND_LABEL, WEAKNESS, WEAPON_LABEL, PLAYER_MAX_HP, PLAYER_MAX_EN } from "../game/data.ts";
import { WARDEN, CARAPACE, AERIAL, PHANTOM, BOSS, type Sprite } from "./sprites.ts";
import type { EnemyKind } from "../game/types.ts";

/** スプライトを「水平中央 cx・底辺 footY」基準で拡大描画。flipで左右反転 */
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
      const ch = row[x];
      const color = sprite.palette[ch];
      if (!color) continue; // "." や空白は透明
      const px = flip ? width - 1 - x : x;
      ctx.fillStyle = color;
      ctx.fillRect(left + px * scale, top + y * scale, scale, scale);
    }
  }
}

const ENEMY_SPRITE: Record<EnemyKind, Sprite> = {
  carapace: CARAPACE,
  aerial: AERIAL,
  phantom: PHANTOM,
};

const W = 480;
const H = 320;

const PLAYER_POS = { x: 110, y: 200 };
const ENEMY_POS = { x: 360, y: 180 };

export function render(
  ctx: CanvasRenderingContext2D,
  b: Battle,
  stage?: { index: number; count: number },
): void {
  // 背景
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#1a1430");
  grad.addColorStop(1, "#0c0a18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 地面ライン
  ctx.strokeStyle = "#2e2750";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 250);
  ctx.lineTo(W, 250);
  ctx.stroke();

  drawPlayer(ctx, b);
  drawEnemy(ctx, b);
  drawHud(ctx, b);
  if (stage) {
    ctx.textAlign = "center";
    ctx.font = "11px monospace";
    ctx.fillStyle = "#9690c4";
    ctx.fillText(`STAGE ${stage.index + 1} / ${stage.count}`, W / 2, 16);
  }
  drawFloats(ctx, b);
  drawGuardBadge(ctx, b);

  if (b.phase !== "fighting") drawResult(ctx, b);
}

function drawPlayer(ctx: CanvasRenderingContext2D, _b: Battle): void {
  const { x, y } = PLAYER_POS;
  drawSprite(ctx, WARDEN, x, y, 4); // 守人は右（敵）を向く
}

function drawEnemy(ctx: CanvasRenderingContext2D, b: Battle): void {
  const { x, y } = ENEMY_POS;
  const broken = b.isBroken;
  const sprite = b.enemy.boss ? BOSS : ENEMY_SPRITE[b.enemy.kind];
  const scale = b.enemy.boss ? 4 : 4;

  // ブレイク中は半透明＋黄味で気絶を表現
  if (broken) ctx.globalAlpha = 0.55 + 0.25 * Math.sin(Date.now() / 80);
  drawSprite(ctx, sprite, x, y, scale, true); // 敵は左（プレイヤー）を向く
  ctx.globalAlpha = 1;

  // 攻撃予兆
  if (b.pending && !broken) {
    const t = b.pending.elapsed / b.pending.landAt; // 0→1
    ctx.fillStyle = "#ffea00";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!!", x, y - 58);
    // 着弾ゲージ（縮む円弧）
    ctx.strokeStyle = "#ffea00";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 70, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, t));
    ctx.stroke();
  }

  if (broken) {
    ctx.fillStyle = "#ffdd44";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("BREAK", x, y - 58);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, b: Battle): void {
  ctx.textAlign = "left";

  // プレイヤーHP / EN（左上）
  ctx.fillStyle = "#cfe4ff";
  ctx.font = "11px monospace";
  ctx.fillText("WARDEN", 12, 18);
  bar(ctx, 12, 24, 150, 10, b.playerHp / PLAYER_MAX_HP, "#3ad27a", "#10331f");
  ctx.fillStyle = "#9fd9ff";
  ctx.fillText(`HP ${Math.ceil(b.playerHp)}/${PLAYER_MAX_HP}`, 12, 47);
  bar(ctx, 12, 52, 150, 8, b.playerEn / PLAYER_MAX_EN, "#46b6ff", "#102a3a");
  ctx.fillStyle = "#9fd9ff";
  ctx.fillText(`EN ${Math.floor(b.playerEn)}/${PLAYER_MAX_EN}`, 12, 74);

  // 敵HP / ブレイクゲージ（右上）
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffd0e0";
  ctx.fillText(`${b.enemy.name}（${KIND_LABEL[b.enemy.kind]}）`, W - 12, 18);
  bar(ctx, W - 12 - 150, 24, 150, 10, b.enemyHp / b.enemy.maxHp, "#ff5d86", "#33101c");
  ctx.fillStyle = "#ffd0e0";
  ctx.fillText(`HP ${b.enemyHp}/${b.enemy.maxHp}`, W - 12, 47);
  // ブレイクゲージ
  const bg = b.isBroken ? 1 : Math.min(1, b.breakGauge / b.enemy.breakThreshold);
  bar(ctx, W - 12 - 150, 52, 150, 8, bg, "#ffcf3f", "#3a2f10");
  ctx.fillStyle = "#ffcf3f";
  ctx.fillText(b.isBroken ? "BREAK!" : "BREAK GAUGE", W - 12, 74);

  // 弱点ヒント
  ctx.textAlign = "left";
  ctx.fillStyle = "#7f7aa0";
  ctx.fillText(`弱点: ${WEAPON_LABEL[WEAKNESS[b.enemy.kind]]}`, 12, H - 10);
}

function drawFloats(ctx: CanvasRenderingContext2D, b: Battle): void {
  ctx.textAlign = "center";
  ctx.font = "bold 14px monospace";
  for (const f of b.floats) {
    const pos = f.anchor === "player" ? PLAYER_POS : f.anchor === "enemy" ? ENEMY_POS : { x: W / 2, y: H / 2 };
    const alpha = Math.max(0, Math.min(1, f.ttl / 900));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, pos.x, pos.y - 60 - f.rise);
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
  ctx.fillText(entry[0], W / 2, 120);
  ctx.globalAlpha = 1;
}

function drawResult(ctx: CanvasRenderingContext2D, b: Battle): void {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = b.phase === "won" ? "#66ddff" : "#ff6677";
  ctx.fillText(b.phase === "won" ? "BATTLE WON" : "DEFEATED", W / 2, H / 2 - 6);
  ctx.font = "12px monospace";
  ctx.fillStyle = "#cccccc";
  ctx.fillText("「もう一度」で再戦", W / 2, H / 2 + 20);
}

function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
  bgc: string,
): void {
  ctx.fillStyle = bgc;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}
