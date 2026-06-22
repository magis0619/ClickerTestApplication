import "./style.css";
import { render, enemySlots } from "./render/canvas.ts";
import { Game, CLASSES } from "./game/game.ts";
import { STAGE_COUNT, WEAPON_LABEL } from "./game/data.ts";
import { audio } from "./audio/audio.ts";
import type { SkillKind, WeaponClass } from "./game/types.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const controls = document.getElementById("controls") as HTMLDivElement;

const game = new Game();

let weaponButtons: { btn: HTMLButtonElement; cls: WeaponClass }[] = [];
let renderedScreen = "";

const KIND_ICON: Record<SkillKind, string> = { attack: "⚔", aoe: "✸", heal: "✚", charge: "▲" };

// ===== オーディオ起動 =====
window.addEventListener("pointerdown", () => audio.init());
const muteBtn = document.createElement("button");
muteBtn.className = "mute-btn";
muteBtn.textContent = "♪ ON";
muteBtn.addEventListener("click", () => {
  audio.init();
  muteBtn.textContent = audio.toggleMute() ? "♪ OFF" : "♪ ON";
});
document.querySelector(".topbar")?.appendChild(muteBtn);

// ===== 敵タップで対象選択 =====
canvas.addEventListener("pointerdown", (e) => {
  if (game.screen !== "battle") return;
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const slots = enemySlots(game.battle.enemies.length);
  let best = -1;
  let bestD = 45 * 45;
  slots.forEach((s, i) => {
    if (!game.battle.enemies[i].alive) return;
    const d = (s.x - cx) ** 2 + (s.y - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best >= 0) game.battle.selectTarget(best);
});

// ===== 画面ごとのUI =====
function buildControls(): void {
  controls.innerHTML = "";
  weaponButtons = [];
  renderedScreen = game.screen;
  if (game.screen === "battle") buildBattleControls();
  else buildResultControls();
}

function buildBattleControls(): void {
  const row = document.createElement("div");
  row.className = "skills";
  for (const cls of CLASSES) {
    const w = game.equippedWeapon(cls);
    const col = document.createElement("div");
    col.className = `wclass wclass-${cls}`;
    const label = document.createElement("div");
    label.className = "wlabel";
    label.innerHTML = `${WEAPON_LABEL[cls]}<span class="weq">${w?.name ?? "-"}</span>`;
    col.appendChild(label);

    const btn = document.createElement("button");
    btn.className = "skill-btn weapon-btn";
    btn.addEventListener("click", () => {
      const used = game.useWeapon(cls);
      if (used) audio.sfxAttack();
    });
    col.appendChild(btn);
    row.appendChild(col);
    weaponButtons.push({ btn, cls });
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  const guardBtn = document.createElement("button");
  guardBtn.className = "guard-btn";
  guardBtn.textContent = "ガード (Space)";
  guardBtn.addEventListener("click", () => {
    game.battle.guard();
    audio.sfxGuard();
  });
  const restBtn = document.createElement("button");
  restBtn.className = "rest-btn";
  restBtn.textContent = "休憩 (R)";
  restBtn.addEventListener("click", () => {
    game.battle.rest();
    audio.sfxGuard();
  });
  actions.appendChild(guardBtn);
  actions.appendChild(restBtn);

  controls.appendChild(row);
  controls.appendChild(actions);
  updateWeaponButtons();
}

/** 武器ボタンのラベル/活性をローテーション・ENに合わせて更新 */
function updateWeaponButtons(): void {
  for (const { btn, cls } of weaponButtons) {
    const s = game.currentSkill(cls);
    if (!s) {
      btn.textContent = "-";
      btn.classList.add("disabled");
      continue;
    }
    const cost = s.kind === "heal" || s.kind === "charge" ? `EN ${s.enCost}` : `威力${s.power} / EN ${s.enCost}`;
    btn.innerHTML = `<span class="sname">${KIND_ICON[s.kind]} ${s.name}</span><span class="scost">${cost}</span>`;
    btn.classList.toggle("disabled", game.battle.playerEn < s.enCost);
  }
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
  else if (game.screen === "clear") info.textContent = `全${STAGE_COUNT}ステージ制覇！　所持霊片: ${game.save.shards}`;
  else info.textContent = `到達: STAGE ${game.stageIndex + 1}　所持霊片: ${game.save.shards}`;
  panel.appendChild(info);

  if (game.lastDrops.length > 0 && game.screen !== "gameover") {
    const drop = document.createElement("p");
    drop.className = "r-drop";
    drop.textContent = `🗡 新しい武器を入手: ${game.lastDrops.map((w) => w.name).join("、")}！`;
    panel.appendChild(drop);
  }

  panel.appendChild(buildEquipPanel());
  panel.appendChild(buildUpgradePanel());

  const actions = document.createElement("div");
  actions.className = "actions";
  if (game.screen === "reward") {
    actions.appendChild(primaryButton("次のステージへ (N)", () => { game.next(); buildControls(); }));
  } else {
    actions.appendChild(primaryButton("ダンジョンに再挑戦 (R)", () => { game.restartRun(); buildControls(); }));
  }
  panel.appendChild(actions);
  controls.appendChild(panel);
}

function buildEquipPanel(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "equip-panel";
  const head = document.createElement("div");
  head.className = "u-head";
  head.textContent = "武器の付け替え（スキルは順番に発動）";
  wrap.appendChild(head);

  for (const cls of CLASSES) {
    const group = document.createElement("div");
    group.className = "eq-group";
    const lbl = document.createElement("div");
    lbl.className = `eq-label wclass-${cls}`;
    lbl.textContent = WEAPON_LABEL[cls];
    group.appendChild(lbl);

    const list = document.createElement("div");
    list.className = "eq-list";
    for (const w of game.ownedWeaponsOf(cls)) {
      const isEq = game.save.equipped[cls] === w.id;
      const b = document.createElement("button");
      b.className = "eq-btn" + (isEq ? " eq-on" : "");
      const skillNames = w.skills.map((id) => game.upgradableSkills().find((s) => s.id === id)?.name ?? "ためる").join(" → ");
      b.innerHTML = `<span class="eq-name">${w.name}${isEq ? " ✔" : ""}</span><span class="eq-stat">${skillNames}</span>`;
      b.title = w.desc;
      b.addEventListener("click", () => { if (game.equip(w.id)) buildControls(); });
      list.appendChild(b);
    }
    group.appendChild(list);
    wrap.appendChild(group);
  }
  return wrap;
}

function buildUpgradePanel(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "upgrade-panel";
  const head = document.createElement("div");
  head.className = "u-head";
  head.textContent = "スキル強化（霊片を消費）";
  wrap.appendChild(head);

  for (const base of game.upgradableSkills()) {
    const lv = game.skillLevel(base.id);
    const cost = game.costFor(base.id);
    const row = document.createElement("div");
    row.className = "u-row";
    row.innerHTML = `<span class="u-name">${KIND_ICON[base.kind]} ${base.name}</span><span class="u-lv">Lv${lv}</span>`;
    const up = document.createElement("button");
    up.className = "u-btn";
    up.textContent = `強化 (${cost})`;
    up.disabled = !game.canUpgrade(base.id);
    up.addEventListener("click", () => { if (game.upgrade(base.id)) buildControls(); });
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

// ===== キーボード =====
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  audio.init();
  if (game.screen === "battle") {
    if (e.code === "Space") { e.preventDefault(); game.battle.guard(); audio.sfxGuard(); return; }
    if (e.key === "r") { game.battle.rest(); audio.sfxGuard(); return; }
    if (e.key === "t") {
      const alive = game.battle.enemies.map((en, i) => ({ en, i })).filter((x) => x.en.alive);
      if (alive.length) {
        const cur = alive.findIndex((x) => x.i === game.battle.targetIndex);
        game.battle.selectTarget(alive[(cur + 1) % alive.length].i);
      }
      return;
    }
    const map: Record<string, WeaponClass> = { "1": "slash", "2": "pierce", "3": "crush" };
    if (map[e.key] && game.useWeapon(map[e.key])) audio.sfxAttack();
    return;
  }
  if (game.screen === "reward" && (e.key === "n" || e.code === "Enter")) { game.next(); buildControls(); }
  else if ((game.screen === "gameover" || game.screen === "clear") && e.key === "r") { game.restartRun(); buildControls(); }
});

// ===== メインループ =====
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(50, now - last);
  last = now;

  const prev = game.screen;
  game.update(dt);
  if (game.screen !== prev) {
    if (game.screen === "gameover") audio.sfxLose();
    else if (game.screen === "reward" || game.screen === "clear") audio.sfxWin();
  }
  if (game.screen !== renderedScreen) buildControls();
  if (game.screen === "battle") updateWeaponButtons();

  render(ctx, game.battle, { index: game.stageIndex, count: STAGE_COUNT });
  requestAnimationFrame(loop);
}

buildControls();
requestAnimationFrame(loop);
