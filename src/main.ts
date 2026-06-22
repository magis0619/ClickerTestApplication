import "./style.css";
import { render, drawBackdrop, enemySlots } from "./render/canvas.ts";
import { Game, CLASSES, STAGE_COUNT } from "./game/game.ts";
import {
  STAGES, WEAPON_LABEL, RARITY_LABEL, RARITY_COLOR, RARITY_MULT, SKILL_KIND_LABEL,
  getWeapon, getSkill, effectiveSkill, skillDescription,
} from "./game/data.ts";
import { audio } from "./audio/audio.ts";
import type { SkillKind, WeaponClass, WeaponInstance } from "./game/types.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const controls = document.getElementById("controls") as HTMLDivElement;

const game = new Game();
let weaponButtons: { btn: HTMLButtonElement; cls: WeaponClass }[] = [];
let renderedScreen = "";

const KIND_ICON: Record<SkillKind, string> = { attack: "⚔", aoe: "✸", heal: "✚", charge: "▲" };

/** 詳細を開いている武器UID（再描画後も維持） */
const expandedWeapons = new Set<string>();

// ===== オーディオ =====
window.addEventListener("pointerdown", () => audio.init());
const muteBtn = document.createElement("button");
muteBtn.className = "mute-btn";
muteBtn.textContent = "♪ ON";
muteBtn.addEventListener("click", () => { audio.init(); muteBtn.textContent = audio.toggleMute() ? "♪ OFF" : "♪ ON"; });
document.querySelector(".topbar")?.appendChild(muteBtn);

// ===== 敵タップで対象選択（戦闘中のみ） =====
canvas.addEventListener("pointerdown", (e) => {
  if (game.screen !== "battle" || !game.battle) return;
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const slots = enemySlots(game.battle.enemies.length);
  let best = -1, bestD = 45 * 45;
  slots.forEach((s, i) => {
    if (!game.battle!.enemies[i].alive) return;
    const d = (s.x - cx) ** 2 + (s.y - cy) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best >= 0) game.battle.selectTarget(best);
});

// ===== 画面ごとのUI =====
function buildControls(): void {
  controls.innerHTML = "";
  weaponButtons = [];
  renderedScreen = game.screen;
  switch (game.screen) {
    case "title": buildTitle(); break;
    case "stageSelect": buildStageSelect(); break;
    case "inventory": buildInventory(); break;
    case "battle": buildBattle(); break;
    case "result": buildResult(); break;
  }
}

function buildTitle(): void {
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.appendChild(bigButton("⚔ ステージ選択", () => { game.goStageSelect(); buildControls(); }));
  menu.appendChild(bigButton("🎒 インベントリ", () => { game.goInventory(); buildControls(); }));
  controls.appendChild(menu);
}

function buildStageSelect(): void {
  const list = document.createElement("div");
  list.className = "stage-list";
  STAGES.forEach((s, i) => {
    const unlocked = game.stageUnlocked(i);
    const cleared = game.save.bestStage > i;
    const card = document.createElement("button");
    card.className = "stage-card" + (unlocked ? "" : " locked");
    card.disabled = !unlocked;
    const enemyNames = s.enemies.map((e) => e.name).join("・");
    card.innerHTML =
      `<div class="st-title">STAGE ${i + 1}: ${s.name} ${cleared ? "✔" : ""}${unlocked ? "" : " 🔒"}</div>` +
      `<div class="st-desc">${s.desc}</div>` +
      `<div class="st-enemy">敵: ${enemyNames}（${s.enemies.length}体） / ドロップ${s.drops}本</div>`;
    if (unlocked) card.addEventListener("click", () => { game.startStage(i); buildControls(); });
    list.appendChild(card);
  });
  controls.appendChild(list);
  controls.appendChild(backRow(() => { game.goTitle(); buildControls(); }));
}

function buildInventory(): void {
  const wrap = document.createElement("div");
  wrap.className = "inv-wrap";
  for (const cls of CLASSES) {
    const group = document.createElement("div");
    group.className = "inv-group";
    const head = document.createElement("div");
    head.className = `inv-head wclass-${cls}`;
    head.textContent = `${WEAPON_LABEL[cls]}（装備中: ${game.equippedWeapon(cls)?.name ?? "なし"}）`;
    group.appendChild(head);

    const items = game.inventoryOf(cls).slice().sort(rarityDesc);
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "（所持なし）";
      group.appendChild(empty);
    }
    for (const inst of items) {
      group.appendChild(weaponRow(inst, true));
    }
    wrap.appendChild(group);
  }
  controls.appendChild(wrap);
  controls.appendChild(backRow(() => { game.goTitle(); buildControls(); }));
}

/** 武器1本のカード（ヘッダー＋装備/詳細ボタン＋展開する詳細） */
function weaponRow(inst: WeaponInstance, equippable: boolean): HTMLElement {
  const w = getWeapon(inst.baseId)!;
  const equipped = game.save.equipped[w.weapon] === inst.uid;
  const card = document.createElement("div");
  card.className = "wpn-card";

  const head = document.createElement("div");
  head.className = "wpn-row" + (equipped ? " wpn-on" : "");
  const skills = w.skills.map((id) => getSkill(id).name).join(" → ");
  head.innerHTML =
    `<span class="wpn-rarity" style="color:${RARITY_COLOR[inst.rarity]}">●</span>` +
    `<span class="wpn-main"><span class="wpn-name">${w.name}${equipped ? " ✔" : ""}</span>` +
    `<span class="wpn-sub">[${RARITY_LABEL[inst.rarity]}] ${skills}</span></span>`;
  card.appendChild(head);

  const acts = document.createElement("div");
  acts.className = "wpn-acts";
  if (equippable) {
    const eq = document.createElement("button");
    eq.className = "wpn-act";
    eq.textContent = equipped ? "装備中" : "装備";
    eq.disabled = equipped;
    eq.addEventListener("click", () => { if (game.equip(inst.uid)) buildControls(); });
    acts.appendChild(eq);
  }
  const det = document.createElement("button");
  det.className = "wpn-act";
  const open = expandedWeapons.has(inst.uid);
  det.textContent = open ? "詳細 ▲" : "詳細 ▼";
  det.addEventListener("click", () => {
    if (expandedWeapons.has(inst.uid)) expandedWeapons.delete(inst.uid);
    else expandedWeapons.add(inst.uid);
    buildControls();
  });
  acts.appendChild(det);
  card.appendChild(acts);

  if (open) card.appendChild(weaponDetail(inst));
  return card;
}

/** 武器の詳細パラメータ＋スキル説明 */
function weaponDetail(inst: WeaponInstance): HTMLElement {
  const w = getWeapon(inst.baseId)!;
  const mult = RARITY_MULT[inst.rarity];
  const box = document.createElement("div");
  box.className = "wpn-detail";

  const meta = document.createElement("div");
  meta.className = "wd-meta";
  meta.innerHTML =
    `<div>${w.desc}</div>` +
    `<div>レアリティ: <b style="color:${RARITY_COLOR[inst.rarity]}">${RARITY_LABEL[inst.rarity]}</b>（性能 ×${mult}）　系統: ${WEAPON_LABEL[w.weapon]}</div>` +
    `<div class="wd-note">攻撃ボタンを押すと下のスキルを上から順番に発動します</div>`;
  box.appendChild(meta);

  w.skills.forEach((id, i) => {
    const s = effectiveSkill(getSkill(id), mult);
    const row = document.createElement("div");
    row.className = "wd-skill";
    const cost = `EN ${s.enCost}`;
    row.innerHTML =
      `<div class="wd-sk-head">${i + 1}. ${KIND_ICON[s.kind]} ${s.name} ` +
      `<span class="wd-kind">[${SKILL_KIND_LABEL[s.kind]}]</span> <span class="wd-cost">${cost}</span></div>` +
      `<div class="wd-sk-desc">${skillDescription(s)}</div>`;
    box.appendChild(row);
  });
  return box;
}

function rarityDesc(a: WeaponInstance, b: WeaponInstance): number {
  const order = ["ultrarare", "superrare", "rare", "uncommon", "normal"];
  return order.indexOf(a.rarity) - order.indexOf(b.rarity);
}

function buildBattle(): void {
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
    btn.addEventListener("click", () => { if (game.useWeapon(cls)) audio.sfxAttack(); });
    col.appendChild(btn);
    row.appendChild(col);
    weaponButtons.push({ btn, cls });
  }
  const actions = document.createElement("div");
  actions.className = "actions";
  const guardBtn = document.createElement("button");
  guardBtn.className = "guard-btn";
  guardBtn.textContent = "ガード (Space)";
  guardBtn.addEventListener("click", () => { game.battle?.guard(); audio.sfxGuard(); });
  const restBtn = document.createElement("button");
  restBtn.className = "rest-btn";
  restBtn.textContent = "休憩 (R)";
  restBtn.addEventListener("click", () => { game.battle?.rest(); audio.sfxGuard(); });
  actions.appendChild(guardBtn);
  actions.appendChild(restBtn);
  controls.appendChild(row);
  controls.appendChild(actions);
  updateWeaponButtons();
}

function updateWeaponButtons(): void {
  if (!game.battle) return;
  for (const { btn, cls } of weaponButtons) {
    const s = game.currentSkill(cls);
    if (!s) { btn.textContent = "-"; btn.classList.add("disabled"); continue; }
    const cost = s.kind === "heal" || s.kind === "charge" ? `EN ${s.enCost}` : `威力${s.power} / EN ${s.enCost}`;
    btn.innerHTML = `<span class="sname">${KIND_ICON[s.kind]} ${s.name}</span><span class="scost">${cost}</span>`;
    btn.classList.toggle("disabled", game.battle.playerEn < s.enCost);
  }
}

function buildResult(): void {
  const panel = document.createElement("div");
  panel.className = "result-panel";
  const title = document.createElement("h2");
  title.textContent = game.lastWon ? `STAGE ${game.stageIndex + 1} CLEAR` : "DEFEATED";
  title.className = game.lastWon ? "r-win" : "r-lose";
  panel.appendChild(title);

  if (game.lastWon) {
    const head = document.createElement("div");
    head.className = "u-head";
    head.textContent = `🗡 入手した武器（${game.lastDrops.length}本）`;
    panel.appendChild(head);
    const drops = document.createElement("div");
    drops.className = "drop-list";
    for (const inst of game.lastDrops) drops.appendChild(weaponRow(inst, false));
    panel.appendChild(drops);
  } else {
    const info = document.createElement("p");
    info.className = "r-info";
    info.textContent = "倒れてしまった……装備を見直して再挑戦しよう";
    panel.appendChild(info);
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  if (!game.lastWon) actions.appendChild(primaryButton("もう一度", () => { game.retryStage(); buildControls(); }));
  const hasNext = game.lastWon && game.stageIndex + 1 < STAGE_COUNT && game.stageUnlocked(game.stageIndex + 1);
  if (hasNext) actions.appendChild(primaryButton("次のステージへ", () => { game.startStage(game.stageIndex + 1); buildControls(); }));
  actions.appendChild(secondaryButton("ステージ選択", () => { game.goStageSelect(); buildControls(); }));
  actions.appendChild(secondaryButton("インベントリ", () => { game.goInventory(); buildControls(); }));
  panel.appendChild(actions);
  controls.appendChild(panel);
}

// ===== UI部品 =====
function bigButton(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "menu-btn";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
function primaryButton(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "guard-btn";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
function secondaryButton(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "reset-btn";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
function backRow(onClick: () => void): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "actions";
  row.appendChild(secondaryButton("← タイトルへ戻る", onClick));
  return row;
}

// ===== キーボード =====
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  audio.init();
  if (game.screen === "battle" && game.battle) {
    if (e.code === "Space") { e.preventDefault(); game.battle.guard(); audio.sfxGuard(); return; }
    if (e.key === "r") { game.battle.rest(); audio.sfxGuard(); return; }
    if (e.key === "t") {
      const alive = game.battle.enemies.map((en, i) => ({ en, i })).filter((x) => x.en.alive);
      if (alive.length) {
        const cur = alive.findIndex((x) => x.i === game.battle!.targetIndex);
        game.battle.selectTarget(alive[(cur + 1) % alive.length].i);
      }
      return;
    }
    const map: Record<string, WeaponClass> = { "1": "slash", "2": "pierce", "3": "crush" };
    if (map[e.key] && game.useWeapon(map[e.key])) audio.sfxAttack();
  }
});

// ===== メインループ =====
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(50, now - last);
  last = now;

  const prev = game.screen;
  game.update(dt);
  if (game.screen !== prev && game.screen === "result") {
    if (game.lastWon) audio.sfxWin(); else audio.sfxLose();
  }
  if (game.screen !== renderedScreen) buildControls();

  switch (game.screen) {
    case "title": drawBackdrop(ctx, "ASTRAL WARDEN", "タイミングアクションRPG"); break;
    case "stageSelect": drawBackdrop(ctx, "ステージ選択"); break;
    case "inventory": drawBackdrop(ctx, "インベントリ"); break;
    case "battle":
    case "result":
      if (game.battle) {
        if (game.screen === "battle") updateWeaponButtons();
        render(ctx, game.battle, { index: game.stageIndex, count: STAGE_COUNT });
      }
      break;
  }
  requestAnimationFrame(loop);
}

buildControls();
requestAnimationFrame(loop);
