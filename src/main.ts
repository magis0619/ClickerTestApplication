import "./style.css";
import { render } from "./render/canvas.ts";
import { Game } from "./game/game.ts";
import { SKILLS, STAGE_COUNT, WEAPON_LABEL } from "./game/data.ts";
import { audio } from "./audio/audio.ts";
import type { Skill, WeaponClass } from "./game/types.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const controls = document.getElementById("controls") as HTMLDivElement;

const game = new Game();

/** 戦闘中のスキルボタン参照（EN不足時のグレーアウト更新用） */
let skillButtons: { btn: HTMLButtonElement; skill: Skill }[] = [];
let renderedScreen = "";

// ===== オーディオ：最初のユーザー操作で起動 =====
function ensureAudio(): void {
  audio.init();
}
window.addEventListener("pointerdown", ensureAudio, { once: false });

// ヘッダーにミュートボタンを追加
const muteBtn = document.createElement("button");
muteBtn.className = "mute-btn";
muteBtn.textContent = "♪ ON";
muteBtn.addEventListener("click", () => {
  audio.init();
  const muted = audio.toggleMute();
  muteBtn.textContent = muted ? "♪ OFF" : "♪ ON";
});
document.querySelector(".topbar")?.appendChild(muteBtn);

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
    const equipped = game.equippedWeapon(weapon);
    const label = document.createElement("div");
    label.className = "wlabel";
    label.innerHTML = `${WEAPON_LABEL[weapon]}<span class="weq">${equipped?.name ?? ""}</span>`;
    col.appendChild(label);

    for (const skill of skills.filter((s) => s.weapon === weapon)) {
      const lv = game.skillLevel(skill.id);
      const btn = document.createElement("button");
      btn.className = "skill-btn";
      btn.innerHTML =
        `<span class="sname">${skill.name} <em>Lv${lv}</em></span>` +
        `<span class="scost">威力${skill.power} / EN ${skill.enCost}</span>`;
      btn.addEventListener("click", () => {
        if (game.battle.useSkill(skill)) audio.sfxAttack();
      });
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
  guardBtn.addEventListener("click", () => {
    game.battle.guard();
    audio.sfxGuard();
  });
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

  // 武器ドロップの告知
  if (game.lastDrop && game.screen !== "gameover") {
    const drop = document.createElement("p");
    drop.className = "r-drop";
    drop.textContent = `🗡 新しい武器を入手: ${game.lastDrop.name}！`;
    panel.appendChild(drop);
  }

  panel.appendChild(buildEquipPanel());
  panel.appendChild(buildUpgradePanel());

  // 次アクション
  const actionRow = document.createElement("div");
  actionRow.className = "actions";
  if (game.screen === "reward") {
    actionRow.appendChild(
      primaryButton("次のステージへ (N)", () => {
        game.next();
        buildControls();
      }),
    );
  } else {
    actionRow.appendChild(
      primaryButton("ダンジョンに再挑戦 (R)", () => {
        game.restartRun();
        buildControls();
      }),
    );
  }
  panel.appendChild(actionRow);

  controls.appendChild(panel);
}

function buildEquipPanel(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "equip-panel";
  const head = document.createElement("div");
  head.className = "u-head";
  head.textContent = "武器の付け替え";
  wrap.appendChild(head);

  const order: WeaponClass[] = ["slash", "pierce", "crush"];
  for (const cls of order) {
    const owned = game.ownedWeaponsOf(cls);
    const group = document.createElement("div");
    group.className = "eq-group";
    const lbl = document.createElement("div");
    lbl.className = `eq-label wclass-${cls}`;
    lbl.textContent = WEAPON_LABEL[cls];
    group.appendChild(lbl);

    const list = document.createElement("div");
    list.className = "eq-list";
    for (const w of owned) {
      const isEq = game.save.equipped[cls] === w.id;
      const b = document.createElement("button");
      b.className = "eq-btn" + (isEq ? " eq-on" : "");
      b.innerHTML =
        `<span class="eq-name">${w.name}${isEq ? " ✔" : ""}</span>` +
        `<span class="eq-stat">攻${pct(w.powerMult)} / EN${pct(w.enMult)} / Brk${pct(w.breakMult)}</span>`;
      b.title = w.desc;
      b.addEventListener("click", () => {
        if (game.equip(w.id)) buildControls();
      });
      list.appendChild(b);
    }
    group.appendChild(list);
    wrap.appendChild(group);
  }
  return wrap;
}

/** 倍率を ±% 表記に */
function pct(mult: number): string {
  const d = Math.round((mult - 1) * 100);
  return d === 0 ? "±0%" : d > 0 ? `+${d}%` : `${d}%`;
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
    row.innerHTML = `<span class="u-name">${base.name}</span><span class="u-lv">Lv${lv}</span>`;
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
  audio.init();
  if (game.screen === "battle") {
    if (e.code === "Space") {
      e.preventDefault();
      game.battle.guard();
      audio.sfxGuard();
      return;
    }
    const n = parseInt(e.key, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= SKILLS.length) {
      if (game.battle.useSkill(game.effectiveSkills()[n - 1])) audio.sfxAttack();
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

  const prev = game.screen;
  game.update(dt);

  // 画面遷移を検知してUIを作り直し＋効果音
  if (game.screen !== prev) {
    if (game.screen === "gameover") audio.sfxLose();
    else if (game.screen === "reward" || game.screen === "clear") audio.sfxWin();
  }
  if (game.screen !== renderedScreen) buildControls();

  // 戦闘中はEN不足のスキルをグレーアウト
  if (game.screen === "battle") {
    for (const { btn, skill } of skillButtons) {
      btn.classList.toggle("disabled", game.battle.playerEn < skill.enCost);
    }
  }

  render(ctx, game.battle, { index: game.stageIndex, count: STAGE_COUNT });
  requestAnimationFrame(loop);
}

buildControls();
requestAnimationFrame(loop);
