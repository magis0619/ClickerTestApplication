import "./style.css";
import { render } from "./render/canvas.ts";
import { Game } from "./game/game.ts";
import { SKILLS, STAGE_COUNT, WEAPON_LABEL } from "./game/data.ts";
import type { Skill, WeaponClass } from "./game/types.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const controls = document.getElementById("controls") as HTMLDivElement;

const game = new Game();

/** 戦闘中のスキルボタン参照（EN不足時のグレーアウト更新用） */
let skillButtons: { btn: HTMLButtonElement; skill: Skill }[] = [];
let renderedScreen = "";

// ===== 画面ごとのUI生成 =====
function buildControls(): void {
  controls.innerHTML = "";
  skillButtons = [];
  renderedScreen = game.screen;

  if (game.screen === "battle") buildBattleControls();
  else buildResultControls();
}

function buildBattleControls(): void {
  const skills = game.effectiveSkills();
  const skillWrap = document.createElement("div");
  skillWrap.className = "skills";

  const order: WeaponClass[] = ["slash", "pierce", "crush"];
  for (const weapon of order) {
    const col = document.createElement("div");
    col.className = `wclass wclass-${weapon}`;
    const label = document.createElement("div");
    label.className = "wlabel";
    label.textContent = WEAPON_LABEL[weapon];
    col.appendChild(label);

    for (const skill of skills.filter((s) => s.weapon === weapon)) {
      const lv = game.skillLevel(skill.id);
      const btn = document.createElement("button");
      btn.className = "skill-btn";
      btn.innerHTML =
        `<span class="sname">${skill.name} <em>Lv${lv}</em></span>` +
        `<span class="scost">威力${skill.power} / EN ${skill.enCost}</span>`;
      btn.addEventListener("click", () => game.battle.useSkill(skill));
      col.appendChild(btn);
      skillButtons.push({ btn, skill });
    }
    skillWrap.appendChild(col);
  }

  const actionRow = document.createElement("div");
  actionRow.className = "actions";
  const guardBtn = document.createElement("button");
  guardBtn.className = "guard-btn";
  guardBtn.textContent = "ガード (Space)";
  guardBtn.addEventListener("click", () => game.battle.guard());
  actionRow.appendChild(guardBtn);

  controls.appendChild(skillWrap);
  controls.appendChild(actionRow);
}

function buildResultControls(): void {
  const panel = document.createElement("div");
  panel.className = "result-panel";

  const title = document.createElement("h2");
  if (game.screen === "reward") {
    title.textContent = `STAGE ${game.stageIndex + 1} CLEAR`;
    title.className = "r-win";
  } else if (game.screen === "clear") {
    title.textContent = "DUNGEON CLEAR!";
    title.className = "r-win";
  } else {
    title.textContent = "DEFEATED";
    title.className = "r-lose";
  }
  panel.appendChild(title);

  const info = document.createElement("p");
  info.className = "r-info";
  if (game.screen === "reward") info.textContent = `霊片 +${game.lastReward}　所持: ${game.save.shards}`;
  else if (game.screen === "clear")
    info.textContent = `全${STAGE_COUNT}ステージ制覇！　所持霊片: ${game.save.shards}`;
  else info.textContent = `到達: STAGE ${game.stageIndex + 1}　所持霊片: ${game.save.shards}`;
  panel.appendChild(info);

  // 育成パネル（どの画面でも強化可能）
  panel.appendChild(buildUpgradePanel());

  // 次アクション
  const actionRow = document.createElement("div");
  actionRow.className = "actions";
  if (game.screen === "reward") {
    const nextBtn = primaryButton("次のステージへ (N)", () => {
      game.next();
      buildControls();
    });
    actionRow.appendChild(nextBtn);
  } else {
    const retryBtn = primaryButton("ダンジョンに再挑戦 (R)", () => {
      game.restartRun();
      buildControls();
    });
    actionRow.appendChild(retryBtn);
  }
  panel.appendChild(actionRow);

  controls.appendChild(panel);
}

function buildUpgradePanel(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "upgrade-panel";
  const head = document.createElement("div");
  head.className = "u-head";
  head.textContent = "スキル強化（霊片を消費）";
  wrap.appendChild(head);

  for (const base of SKILLS) {
    const lv = game.skillLevel(base.id);
    const cost = game.costFor(base.id);
    const row = document.createElement("div");
    row.className = "u-row";
    row.innerHTML =
      `<span class="u-name">${base.name}</span>` +
      `<span class="u-lv">Lv${lv}</span>`;
    const up = document.createElement("button");
    up.className = "u-btn";
    up.textContent = `強化 (${cost})`;
    up.disabled = !game.canUpgrade(base.id);
    up.addEventListener("click", () => {
      if (game.upgrade(base.id)) buildControls();
    });
    row.appendChild(up);
    wrap.appendChild(row);
  }
  return wrap;
}

function primaryButton(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "guard-btn";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

// ===== キーボード操作（PC向け） =====
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (game.screen === "battle") {
    if (e.code === "Space") {
      e.preventDefault();
      game.battle.guard();
      return;
    }
    const n = parseInt(e.key, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= SKILLS.length) {
      game.battle.useSkill(game.effectiveSkills()[n - 1]);
    }
    return;
  }
  if (game.screen === "reward" && (e.key === "n" || e.code === "Enter")) {
    game.next();
    buildControls();
  } else if ((game.screen === "gameover" || game.screen === "clear") && e.key === "r") {
    game.restartRun();
    buildControls();
  }
});

// ===== メインループ =====
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(50, now - last);
  last = now;

  game.update(dt);

  // 画面遷移を検知してUIを作り直す
  if (game.screen !== renderedScreen) buildControls();

  // 戦闘中はEN不足のスキルをグレーアウト
  if (game.screen === "battle") {
    for (const { btn, skill } of skillButtons) {
      const lack = game.battle.playerEn < skill.enCost;
      btn.classList.toggle("disabled", lack);
    }
  }

  render(ctx, game.battle, { index: game.stageIndex, count: STAGE_COUNT });
  requestAnimationFrame(loop);
}

buildControls();
requestAnimationFrame(loop);
