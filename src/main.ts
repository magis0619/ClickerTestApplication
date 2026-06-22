import "./style.css";
import { render, drawBackdrop, enemySlots } from "./render/canvas.ts";
import { Game, CLASSES, STAGE_COUNT } from "./game/game.ts";
import {
  STAGES, WEAPON_LABEL, RARITY_LABEL, RARITY_COLOR, SKILL_KIND_LABEL,
  getWeapon, getSkill, skillDescription, isBonusSkill, isRainbowRarity, REST_EN_RECOVER,
} from "./game/data.ts";
import { audio } from "./audio/audio.ts";
import type { SfxEvent, SkillKind, WeaponClass, WeaponInstance } from "./game/types.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const controls = document.getElementById("controls") as HTMLDivElement;

const game = new Game();
/** 戦闘中の武器カード（カード本体＋コンボ各段の要素を保持） */
let weaponButtons: { card: HTMLButtonElement; cls: WeaponClass; steps: HTMLElement[] }[] = [];
let renderedScreen = "";

// ===== 画面遷移の暗転オーバーレイ =====
const fadeEl = document.createElement("div");
fadeEl.className = "fade-overlay";
document.body.appendChild(fadeEl);

/** 暗転 → action実行 → 明転、の順で画面遷移する */
function withFade(action: () => void): void {
  fadeEl.classList.add("show");
  window.setTimeout(() => {
    action();
    buildControls();
    window.setTimeout(() => fadeEl.classList.remove("show"), 60);
  }, 340);
}

const KIND_ICON: Record<SkillKind, string> = { attack: "⚔", aoe: "✸", heal: "✚", charge: "▲" };
const WEAPON_ICON: Record<WeaponClass, string> = { slash: "⚔", pierce: "🗡", crush: "🔨" };
const CIRCLE = ["①", "②", "③", "④", "⑤", "⑥"];

const RARITY_STAR: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, epic: 4, legend: 5, astral: 6,
};
function rarityStars(r: string): string { return "★".repeat(RARITY_STAR[r] ?? 1); }

/** 戦闘から飛んでくる効果音イベントを実際の音に割り当てる */
function playSfx(ev: SfxEvent): void {
  switch (ev) {
    case "warn": audio.sfxWarn(); break;
    case "perfect": audio.sfxPerfect(); break;
    case "just": audio.sfxJust(); break;
    case "guard": audio.sfxGuardHit(); break;
    case "hurt": audio.sfxHurt(); break;
    case "break": audio.sfxBreak(); break;
    case "die": audio.sfxEnemyDie(); break;
  }
}

/** ボタンに「押した瞬間カチッ＋少し縮んで戻る」手応えを付ける */
function pressFx(btn: HTMLElement): void {
  const down = () => { audio.init(); audio.sfxClick(); btn.classList.add("btn-press"); };
  const up = () => btn.classList.remove("btn-press");
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointerleave", up);
  btn.addEventListener("pointercancel", up);
}

/** レアリティ色を span に適用する class/style 属性（アストラルは虹色クラス） */
function rarityAttr(r: string, baseClass: string): string {
  if (isRainbowRarity(r as never)) return `class="${baseClass} rainbow-text"`;
  return `class="${baseClass}" style="color:${RARITY_COLOR[r as never]}"`;
}

/** 攻撃入力（武器使用）。即座に攻撃SEを鳴らして手応えを出す */
function attackWith(cls: WeaponClass): void {
  if (game.useWeapon(cls)) audio.sfxAttack();
}

/** ガード入力。判定結果に応じたSEは戦闘側のイベントで鳴る（空振りのみ軽い音） */
function doGuard(): void {
  const res = game.battle?.guard();
  if (res === "none") audio.sfxGuard();
}

/** 詳細を開いている武器UID（再描画後も維持） */
const expandedWeapons = new Set<string>();
/** インベントリで表示中の系統タブ */
let invClass: WeaponClass = "slash";

// ===== オーディオ =====
window.addEventListener("pointerdown", () => audio.init());
const muteBtn = document.createElement("button");
muteBtn.className = "mute-btn";
muteBtn.textContent = "♪ ON";
muteBtn.addEventListener("click", () => { audio.init(); muteBtn.textContent = audio.toggleMute() ? "♪ OFF" : "♪ ON"; });
document.querySelector(".topbar")?.appendChild(muteBtn);

/** 対象を前後に切り替える（左右矢印・Tキー共通） */
function cycleTarget(dir: number): void {
  if (!game.battle) return;
  const alive = game.battle.enemies.map((en, i) => ({ en, i })).filter((x) => x.en.alive);
  if (!alive.length) return;
  const cur = alive.findIndex((x) => x.i === game.battle!.targetIndex);
  const ni = ((cur < 0 ? 0 : cur) + dir + alive.length) % alive.length;
  game.battle.selectTarget(alive[ni].i);
}

// ===== 敵タップで対象選択／左右矢印で切替（戦闘中のみ） =====
canvas.addEventListener("pointerdown", (e) => {
  if (game.screen !== "battle" || !game.battle) return;
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;

  // 左右の矢印エリア（対象切替）
  if (cy > 120 && cy < 220) {
    if (cx < 40) { cycleTarget(-1); return; }
    if (cx > canvas.width - 40) { cycleTarget(1); return; }
  }

  // 敵カードのある帯（y）内なら、x が最も近い生存敵を対象に
  if (cy > 70 && cy < 262) {
    const slots = enemySlots(game.battle.enemies.length);
    let best = -1, bestD = 90;
    slots.forEach((s, i) => {
      if (!game.battle!.enemies[i].alive) return;
      const d = Math.abs(s.x - cx);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) game.battle.selectTarget(best);
  }
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
    if (unlocked) card.addEventListener("click", () => withFade(() => game.startStage(i)));
    list.appendChild(card);
  });
  controls.appendChild(list);
  controls.appendChild(backRow(() => { game.goTitle(); buildControls(); }));
}

function buildInventory(): void {
  // 系統タブ
  const tabs = document.createElement("div");
  tabs.className = "inv-tabs";
  for (const cls of CLASSES) {
    const t = document.createElement("button");
    t.className = "inv-tab wclass-" + cls + (invClass === cls ? " inv-tab-on" : "");
    t.textContent = WEAPON_LABEL[cls];
    t.addEventListener("click", () => { invClass = cls; buildControls(); });
    tabs.appendChild(t);
  }
  controls.appendChild(tabs);

  // 選択中の系統だけを表示
  const group = document.createElement("div");
  group.className = "inv-group";
  const head = document.createElement("div");
  head.className = `inv-head wclass-${invClass}`;
  head.textContent = `${WEAPON_LABEL[invClass]}　装備中: ${game.equippedWeapon(invClass)?.name ?? "なし"}`;
  group.appendChild(head);

  const items = game.inventoryOf(invClass).slice().sort(rarityDesc);
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "inv-empty";
    empty.textContent = "（この系統の武器はまだありません）";
    group.appendChild(empty);
  }
  for (const inst of items) group.appendChild(weaponRow(inst, true));
  controls.appendChild(group);

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
  const ids = game.instanceSkillIds(inst);
  const skills = ids.map((id) => getSkill(id).name).join(" → ");
  head.innerHTML =
    `<span class="wpn-icon wclass-${w.weapon}">${WEAPON_ICON[w.weapon]}</span>` +
    `<span class="wpn-main">` +
    `<span class="wpn-name">${w.name}${equipped ? ` <span class="wpn-eqtag">装備中</span>` : ""}</span>` +
    `<span ${rarityAttr(inst.rarity, "wpn-stars")}>${rarityStars(inst.rarity)} ` +
    `<span class="wpn-rlabel">${RARITY_LABEL[inst.rarity]}</span></span>` +
    `<span class="wpn-sub">コンボ${ids.length}段：${skills}</span></span>`;
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
  const box = document.createElement("div");
  box.className = "wpn-detail";

  const meta = document.createElement("div");
  meta.className = "wd-meta";
  meta.innerHTML =
    `<div ${rarityAttr(inst.rarity, "wd-stars")}>${rarityStars(inst.rarity)} ` +
    `<span class="wd-rlabel">${RARITY_LABEL[inst.rarity]}</span>　<span class="wd-cls">${WEAPON_LABEL[w.weapon]}</span></div>` +
    `<div>${w.desc}</div>` +
    `<div class="wd-note">武器を押すたびに ①→②→… の順でコンボが発動します</div>`;
  box.appendChild(meta);

  const ids = game.instanceSkillIds(inst);
  ids.forEach((id, i) => {
    const s = getSkill(id);
    const bonus = isBonusSkill(id);
    const row = document.createElement("div");
    row.className = "wd-skill" + (bonus ? " wd-bonus" : "");
    row.innerHTML =
      `<div class="wd-sk-head">${i + 1}. ${KIND_ICON[s.kind]} ${s.name} ` +
      `<span class="wd-kind">[${SKILL_KIND_LABEL[s.kind]}]</span> <span class="wd-cost">EN ${s.enCost}</span></div>` +
      (bonus ? `<div class="wd-bonus-tag">★ レアリティ特典スキル</div>` : "") +
      `<div class="wd-sk-desc">${skillDescription(s)}</div>`;
    box.appendChild(row);
  });
  return box;
}

function rarityDesc(a: WeaponInstance, b: WeaponInstance): number {
  const order = ["astral", "legend", "epic", "rare", "uncommon", "common"];
  return order.indexOf(a.rarity) - order.indexOf(b.rarity);
}

function buildBattle(): void {
  const row = document.createElement("div");
  row.className = "weapons";
  for (const cls of CLASSES) {
    const w = game.equippedWeapon(cls);
    const card = document.createElement("button");
    card.className = `weapon-card wclass-${cls}`;
    card.addEventListener("click", () => attackWith(cls));
    pressFx(card);

    // ヘッダー：系統を主役に、武器名を併記
    const head = document.createElement("div");
    head.className = "wc-head";
    head.innerHTML =
      `<span class="wc-kind">${WEAPON_ICON[cls]} ${WEAPON_LABEL[cls]}</span>` +
      `<span class="wc-name">${w?.name ?? "（未装備）"}</span>`;
    card.appendChild(head);

    // スキルは「コンボ」として①②…で表示
    const combo = document.createElement("div");
    combo.className = "wc-combo";
    const steps: HTMLElement[] = [];
    game.comboSkills(cls).forEach((s, i) => {
      const step = document.createElement("div");
      step.className = "wc-step";
      step.innerHTML =
        `<span class="wc-no">${CIRCLE[i] ?? i + 1}</span>` +
        `<span class="wc-sk">${KIND_ICON[s.kind]} ${s.name}</span>` +
        `<span class="wc-cost"><span class="wc-cost-num">${s.enCost}</span><span class="wc-cost-lbl">EN</span></span>`;
      combo.appendChild(step);
      steps.push(step);
    });
    card.appendChild(combo);
    row.appendChild(card);
    weaponButtons.push({ card, cls, steps });
  }
  controls.appendChild(row);

  // ガード／休憩（大きめのアクションボタン）
  const actions = document.createElement("div");
  actions.className = "battle-actions";

  const guardBtn = document.createElement("button");
  guardBtn.className = "act-btn guard-act";
  guardBtn.innerHTML =
    `<span class="act-title">🛡 ガード</span><span class="act-key">(Space)</span>` +
    `<span class="act-sub">タイミングでEN大回復！</span>`;
  guardBtn.addEventListener("click", doGuard);
  pressFx(guardBtn);

  const restBtn = document.createElement("button");
  restBtn.className = "act-btn rest-act";
  restBtn.innerHTML =
    `<span class="act-title">🧘 休憩</span><span class="act-key">(R)</span>` +
    `<span class="act-sub">EN +${REST_EN_RECOVER} 回復</span>`;
  restBtn.addEventListener("click", () => { game.battle?.rest(); audio.sfxGuard(); });
  pressFx(restBtn);

  actions.appendChild(guardBtn);
  actions.appendChild(restBtn);
  controls.appendChild(actions);
  updateWeaponButtons();
}

function updateWeaponButtons(): void {
  if (!game.battle) return;
  for (const { card, cls, steps } of weaponButtons) {
    const active = game.comboIndex(cls);
    const cur = game.currentSkill(cls);
    // 次に出る段をハイライト
    steps.forEach((step, i) => step.classList.toggle("wc-step-on", i === active));
    // ENが足りなければカードを無効表示
    const broke = !cur || game.battle!.playerEn < cur.enCost;
    card.classList.toggle("disabled", broke);
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
  if (!game.lastWon) actions.appendChild(primaryButton("もう一度", () => withFade(() => game.retryStage())));
  const hasNext = game.lastWon && game.stageIndex + 1 < STAGE_COUNT && game.stageUnlocked(game.stageIndex + 1);
  if (hasNext) actions.appendChild(primaryButton("次のステージへ", () => withFade(() => game.startStage(game.stageIndex + 1))));
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
    if (e.code === "Space") { e.preventDefault(); doGuard(); return; }
    if (e.key === "r") { game.battle.rest(); audio.sfxGuard(); return; }
    if (e.key === "t") { cycleTarget(1); return; }
    const map: Record<string, WeaponClass> = { "1": "slash", "2": "pierce", "3": "crush" };
    if (map[e.key]) attackWith(map[e.key]);
  }
});

// ===== メインループ =====
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(50, now - last);
  last = now;

  const prev = game.screen;
  game.update(dt);
  // 戦闘から発火した効果音を回収して鳴らす
  if (game.battle && game.battle.sfx.length) {
    for (const ev of game.battle.sfx) playSfx(ev);
    game.battle.sfx.length = 0;
  }
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
