import "./style.css";
import { render, enemySlots, makeSpriteCanvas } from "./render/canvas.ts";
import { SHIELD, SLEEP, WARDEN, getWeaponSprite, chestSprite } from "./render/sprites.ts";
import { Game, CLASSES, STAGE_COUNT } from "./game/game.ts";
import {
  STAGES, WEAPON_LABEL, RARITY_LABEL, RARITY_COLOR, SKILL_KIND_LABEL, RARITY_ORDER,
  getWeapon, getSkill, skillDescription, isRainbowRarity, matchCombo, stageDropPreview,
  PLAYER_MAX_HP, PLAYER_MAX_EN, SHOP_ITEMS, SHOP_CHESTS,
  effectiveWeapon, expForNext, levelCap, materialExp, awakenCost, MAX_AWAKEN,
} from "./game/data.ts";
import { audio } from "./audio/audio.ts";
import type {
  Rarity, SfxEvent, SkillKind, WeaponClass, WeaponInstance, Weapon, ShopItem, ShopChest,
} from "./game/types.ts";

/** インスタンスの武器名・レアリティ（テンプレートから取得） */
function instName(inst: WeaponInstance): string { return getWeapon(inst.baseId)?.name ?? "???"; }
function instRarity(inst: WeaponInstance): Rarity { return getWeapon(inst.baseId)?.rarity ?? "common"; }

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const controls = document.getElementById("controls") as HTMLDivElement;

const game = new Game();
/** 戦闘中の武器カード（カード本体＋コンボ各段＋移動するフォーカス枠を保持） */
let weaponButtons: {
  card: HTMLButtonElement; cls: WeaponClass; steps: HTMLElement[];
  focus: HTMLElement; focusIdx: number;
}[] = [];
/** 戦闘中のHP/ENバー（攻撃ボタンの上に配置。毎フレーム更新する） */
let battleHud: {
  root: HTMLElement; hpFill: HTMLElement; hpText: HTMLElement; enFill: HTMLElement; enText: HTMLElement;
} | null = null;
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

const KIND_ICON: Record<SkillKind, string> = { attack: "⚔", charge: "▲", focus: "◎" };
const WEAPON_ICON: Record<WeaponClass, string> = { slash: "⚔", pierce: "🗡", crush: "🔨" };

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
/** 削除確認中の武器UID（2タップ目で確定） */
let pendingDeleteUid: string | null = null;
/** インベントリ：レアリティフィルタ（all=すべて） */
let invRarity: Rarity | "all" = "all";
/** インベントリ：レア度の並び（true=降順） */
let invSortDesc = true;
/** インベントリ：ロック中のみ表示 */
let invLockedOnly = false;
/** 鍛冶屋：強化対象に選んだ武器UID（null=一覧から選ぶ画面） */
let forgeTargetUid: string | null = null;
/** 鍛冶屋：素材に選んだ武器UID */
const forgeMaterials = new Set<string>();

/** レベル・覚醒バッジ（Lv表記＋覚醒の星） */
function levelTag(inst: WeaponInstance): string {
  const lv = inst.level ?? 1;
  const aw = inst.awakened ?? 0;
  const awStar = aw > 0 ? ` <span class="wpn-awaken">✦${aw}</span>` : "";
  return `<span class="wpn-lv">Lv.${lv}</span>${awStar}`;
}

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
  battleHud = null;
  renderedScreen = game.screen;
  // バトル枠（canvas）は戦闘・リザルトのみ表示し、メニュー系画面では隠す
  canvas.style.display = (game.screen === "battle" || game.screen === "result") ? "block" : "none";
  switch (game.screen) {
    case "title": buildTitle(); break;
    case "stageSelect": buildStageSelect(); break;
    case "inventory": buildInventory(); break;
    case "forge": buildForge(); break;
    case "shop": buildShop(); break;
    case "battle": buildBattle(); break;
    case "result": buildResult(); break;
  }
}

function buildTitle(): void {
  controls.appendChild(topBar());
  const hero = document.createElement("div");
  hero.className = "title-hero";
  const spr = makeSpriteCanvas(WARDEN, 6);
  spr.className = "title-sprite";
  hero.appendChild(spr);
  const cap = document.createElement("div");
  cap.innerHTML = `<div class="title-logo">ASTRAL WARDEN</div><div class="title-sub">タイミングアクションRPG</div>`;
  hero.appendChild(cap);
  controls.appendChild(hero);
  controls.appendChild(bigButton("⚔ 冒険に出る", () => { game.goStageSelect(); buildControls(); }));
  controls.appendChild(bottomNav());
}

/** 上部の情報バー（戦闘力＋所持ゴールド） */
function topBar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "top-bar";
  const power = (["slash", "pierce", "crush"] as WeaponClass[])
    .reduce((s, c) => s + (game.equippedWeapon(c)?.attack ?? 0), 0);
  bar.innerHTML =
    `<span class="tb-power">⚔ 戦闘力 <b>${power}</b></span>` +
    `<span class="tb-gold"><span class="gold-amt">${game.gold.toLocaleString()}</span><span class="gold-unit">G</span></span>`;
  return bar;
}

/** 下部ナビゲーション（ホーム/ダンジョン/インベントリ/ショップ） */
function bottomNav(): HTMLElement {
  const nav = document.createElement("div");
  nav.className = "bottom-nav";
  const items: [string, string, string, () => void][] = [
    ["🏠", "ホーム", "title", () => game.goTitle()],
    ["🗺️", "ダンジョン", "stageSelect", () => game.goStageSelect()],
    ["🎒", "インベントリ", "inventory", () => game.goInventory()],
    ["🔨", "鍛冶屋", "forge", () => game.goForge()],
    ["🛒", "ショップ", "shop", () => game.goShop()],
  ];
  for (const [icon, label, scr, act] of items) {
    const b = document.createElement("button");
    b.className = "nav-item" + (game.screen === scr ? " nav-on" : "");
    b.innerHTML = `<span class="nav-ico">${icon}</span><span class="nav-lbl">${label}</span>`;
    b.addEventListener("click", () => { act(); buildControls(); });
    nav.appendChild(b);
  }
  return nav;
}

/** レアリティに応じた発光クラス（エピック以上のみ光らせる） */
function rarityGlowClass(r: Rarity): string {
  if (r === "astral") return "glow-astral";
  if (r === "legend") return "glow-legend";
  if (r === "epic") return "glow-epic";
  return "";
}

// ===== 鍛冶屋（武器強化） =====
function buildForge(): void {
  controls.appendChild(topBar());
  const head = document.createElement("h2");
  head.className = "screen-title";
  head.textContent = "🔨 鍛冶屋";
  controls.appendChild(head);

  const target = forgeTargetUid
    ? game.save.inventory.find((it) => it.uid === forgeTargetUid)
    : undefined;

  if (!target) {
    forgeTargetUid = null;
    forgeMaterials.clear();
    const hint = document.createElement("div");
    hint.className = "forge-hint";
    hint.textContent = "強化する武器を選ぼう";
    controls.appendChild(hint);
    const list = document.createElement("div");
    list.className = "forge-list";
    const items = game.save.inventory.slice().sort((a, b) => -rarityDesc(a, b));
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "（武器がありません）";
      list.appendChild(empty);
    }
    for (const inst of items) list.appendChild(forgeTargetRow(inst));
    controls.appendChild(list);
    controls.appendChild(bottomNav());
    return;
  }

  buildForgePanel(target);
  controls.appendChild(bottomNav());
}

/** 強化対象を選ぶための行（タップで対象に設定） */
function forgeTargetRow(inst: WeaponInstance): HTMLElement {
  const w = getWeapon(inst.baseId)!;
  const eff = effectiveWeapon(inst) ?? w;
  const r = instRarity(inst);
  const row = document.createElement("button");
  row.className = ("forge-row " + rarityGlowClass(r)).trim();
  if (game.isEquippedAny(inst.uid)) row.classList.add("forge-row-eq");
  row.innerHTML =
    `<span class="forge-row-icon"></span>` +
    `<span class="forge-row-info">` +
    `<span class="forge-row-name">${instName(inst)}${game.isEquippedAny(inst.uid) ? ` <span class="wpn-eqtag">装備</span>` : ""}</span>` +
    `<span ${rarityAttr(r, "forge-row-stars")}>${rarityStars(r)}</span>` +
    `<span class="forge-row-meta">${levelTag(inst)}　⚔ <b>${eff.attack}</b></span></span>` +
    `<span class="forge-row-go">強化 ▶</span>`;
  row.querySelector(".forge-row-icon")?.appendChild(weaponSpriteEl(inst.baseId, w.weapon, 3));
  row.addEventListener("click", () => { forgeTargetUid = inst.uid; forgeMaterials.clear(); buildControls(); });
  return row;
}

/** 選択中の武器の強化パネル（経験値バー＋素材選択 or 覚醒） */
function buildForgePanel(target: WeaponInstance): void {
  const w = getWeapon(target.baseId)!;
  const eff = effectiveWeapon(target) ?? w;
  const r = instRarity(target);
  const lv = target.level ?? 1;
  const cap = game.levelCapOf(target);
  const aw = target.awakened ?? 0;

  // 対象カード（大きく）
  const card = document.createElement("div");
  card.className = ("forge-target " + rarityGlowClass(r)).trim();
  const icon = document.createElement("div");
  icon.className = "forge-target-icon";
  icon.appendChild(weaponSpriteEl(target.baseId, w.weapon, 4));
  card.appendChild(icon);
  const info = document.createElement("div");
  info.className = "forge-target-info";
  info.innerHTML =
    `<div class="forge-target-name">${instName(target)}</div>` +
    `<div ${rarityAttr(r, "forge-target-stars")}>${rarityStars(r)} ` +
    `<span class="wpn-rlabel">${RARITY_LABEL[r]}・${WEAPON_LABEL[w.weapon]}</span></div>` +
    `<div class="forge-target-meta">${levelTag(target)} <span class="forge-cap">/ 上限 ${cap}</span></div>` +
    `<div class="forge-target-stat">⚔ 攻撃力 <b>${eff.attack}</b>　Break <b>${eff.breakPower}</b>${eff.critChance ? `　会心 ${eff.critChance}%` : ""}</div>`;
  card.appendChild(info);
  controls.appendChild(card);

  // 経験値バー
  const atWall = game.atAwakenWall(target);
  const maxed = lv >= cap && aw >= MAX_AWAKEN;
  const expBox = document.createElement("div");
  expBox.className = "forge-exp";
  if (maxed) {
    expBox.innerHTML = `<div class="forge-exp-label">最大強化に到達しました</div>`;
  } else if (atWall) {
    expBox.innerHTML = `<div class="forge-exp-label">レベル上限。覚醒で限界突破しよう</div>`;
  } else {
    const need = expForNext(r, lv);
    const cur = target.exp ?? 0;
    const pct = Math.max(0, Math.min(100, (cur / need) * 100));
    expBox.innerHTML =
      `<div class="forge-exp-label">EXP ${cur} / ${need}（次のレベルまで）</div>` +
      `<div class="forge-exp-bar"><div class="forge-exp-fill" style="width:${pct}%"></div></div>`;
  }
  controls.appendChild(expBox);

  // 別の武器を選ぶ
  const back = document.createElement("button");
  back.className = "forge-back";
  back.textContent = "← 別の武器を選ぶ";
  back.addEventListener("click", () => { forgeTargetUid = null; forgeMaterials.clear(); buildControls(); });
  controls.appendChild(back);

  if (maxed) return;

  if (atWall) {
    buildAwakenSection(target);
  } else {
    buildEnhanceSection(target);
  }
}

/** 経験値を与える素材選択セクション */
function buildEnhanceSection(target: WeaponInstance): void {
  const w = getWeapon(target.baseId)!;
  const cap = game.levelCapOf(target);
  const sect = document.createElement("div");
  sect.className = "forge-section";
  sect.innerHTML = `<div class="forge-sect-head">素材にする武器を選ぶ（経験値になり消費されます）</div>`;
  controls.appendChild(sect);

  // 選択中サマリ＋強化ボタン
  const sel = [...forgeMaterials].filter((uid) => game.save.inventory.some((it) => it.uid === uid));
  const gained = game.materialExpTotal(sel);
  // 強化後レベルをプレビュー
  let pvLevel = target.level ?? 1;
  let pvExp = (target.exp ?? 0) + gained;
  while (pvLevel < cap) {
    const need = expForNext(w.rarity, pvLevel);
    if (pvExp < need) break;
    pvExp -= need; pvLevel += 1;
  }
  const gainedLv = pvLevel - (target.level ?? 1);

  const summary = document.createElement("div");
  summary.className = "forge-summary";
  summary.innerHTML =
    `<span class="forge-sum-exp">+${gained} EXP</span>` +
    (gainedLv > 0 ? `<span class="forge-sum-lv">Lv.${target.level ?? 1} → Lv.${pvLevel}</span>` : "");
  controls.appendChild(summary);

  const apply = document.createElement("button");
  apply.className = "forge-apply";
  apply.textContent = "強化する";
  apply.disabled = sel.length === 0;
  apply.addEventListener("click", () => {
    const ups = game.enhance(target.uid, sel);
    if (ups > 0) audio.sfxPerfect(); else audio.sfxGuard();
    forgeMaterials.clear();
    buildControls();
  });
  controls.appendChild(apply);

  // 素材候補一覧
  const list = document.createElement("div");
  list.className = "forge-mat-list";
  const mats = game.forgeMaterials(target.uid).sort((a, b) => -rarityDesc(a, b));
  if (mats.length === 0) {
    const empty = document.createElement("div");
    empty.className = "inv-empty";
    empty.textContent = "（素材にできる武器がありません。装備中・ロック中は使えません）";
    list.appendChild(empty);
  }
  for (const m of mats) list.appendChild(forgeMatRow(m));
  controls.appendChild(list);
}

/** 素材候補1行（タップで選択トグル） */
function forgeMatRow(inst: WeaponInstance): HTMLElement {
  const w = getWeapon(inst.baseId)!;
  const r = instRarity(inst);
  const on = forgeMaterials.has(inst.uid);
  const row = document.createElement("button");
  row.className = "forge-mat" + (on ? " forge-mat-on" : "");
  row.innerHTML =
    `<span class="forge-mat-check">${on ? "✓" : ""}</span>` +
    `<span class="forge-mat-icon"></span>` +
    `<span class="forge-mat-info">` +
    `<span class="forge-mat-name">${instName(inst)}</span>` +
    `<span ${rarityAttr(r, "forge-mat-stars")}>${rarityStars(r)} ${levelTag(inst)}</span></span>` +
    `<span class="forge-mat-exp">+${materialExp(inst)}</span>`;
  row.querySelector(".forge-mat-icon")?.appendChild(weaponSpriteEl(inst.baseId, w.weapon, 2));
  row.addEventListener("click", () => {
    if (forgeMaterials.has(inst.uid)) forgeMaterials.delete(inst.uid);
    else forgeMaterials.add(inst.uid);
    buildControls();
  });
  return row;
}

/** 覚醒セクション（同一武器を消費してレベル上限を解放） */
function buildAwakenSection(target: WeaponInstance): void {
  const need = awakenCost(target.awakened ?? 0);
  const cands = game.awakenCandidates(target);
  const ok = game.canAwaken(target);
  const sect = document.createElement("div");
  sect.className = "forge-section forge-awaken";
  sect.innerHTML =
    `<div class="forge-sect-head">✦ 覚醒（限界突破）</div>` +
    `<div class="forge-awaken-desc">同じ「${instName(target)}」を <b>${need}本</b> 合成してレベル上限を解放します` +
    `（次の上限 ${levelCap((target.awakened ?? 0) + 1)}）</div>` +
    `<div class="forge-awaken-count ${ok ? "ok" : "ng"}">所持できる素材：${cands.length} / ${need} 本</div>`;
  controls.appendChild(sect);

  const apply = document.createElement("button");
  apply.className = "forge-apply forge-awaken-btn";
  apply.textContent = ok ? "✦ 覚醒する" : "素材が足りません";
  apply.disabled = !ok;
  apply.addEventListener("click", () => {
    if (game.awaken(target.uid)) { audio.sfxPerfect(); buildControls(); }
  });
  controls.appendChild(apply);

  if (cands.length > 0) {
    const list = document.createElement("div");
    list.className = "forge-mat-list";
    const head = document.createElement("div");
    head.className = "forge-sect-sub";
    head.textContent = "合成に使われる同一武器";
    list.appendChild(head);
    for (const m of cands.slice(0, need)) {
      const r = instRarity(m);
      const row = document.createElement("div");
      row.className = "forge-mat forge-mat-fixed";
      row.innerHTML =
        `<span class="forge-mat-icon"></span>` +
        `<span class="forge-mat-info"><span class="forge-mat-name">${instName(m)}</span>` +
        `<span ${rarityAttr(r, "forge-mat-stars")}>${rarityStars(r)} ${levelTag(m)}</span></span>`;
      row.querySelector(".forge-mat-icon")?.appendChild(weaponSpriteEl(m.baseId, getWeapon(m.baseId)!.weapon, 2));
      list.appendChild(row);
    }
    controls.appendChild(list);
  }
}

function buildShop(): void {
  controls.appendChild(topBar());
  const head = document.createElement("h2");
  head.className = "screen-title";
  head.textContent = "🛒 ショップ";
  controls.appendChild(head);

  // 宝箱（購入＝即開封。レアリティ帯の武器がランダムで出る）
  const chestHead = document.createElement("div");
  chestHead.className = "shop-subhead";
  chestHead.textContent = "🎁 宝箱（購入で即開封）";
  controls.appendChild(chestHead);
  const chestList = document.createElement("div");
  chestList.className = "shop-list";
  for (const chest of SHOP_CHESTS) chestList.appendChild(chestRow(chest));
  controls.appendChild(chestList);

  // 武器（直接購入。一度買うと売り切れ）
  const wpnHead = document.createElement("div");
  wpnHead.className = "shop-subhead";
  wpnHead.textContent = "🗡 武器";
  controls.appendChild(wpnHead);
  const list = document.createElement("div");
  list.className = "shop-list";
  for (const item of SHOP_ITEMS) {
    const w = getWeapon(item.baseId);
    if (w) list.appendChild(shopRow(item, w));
  }
  controls.appendChild(list);
  controls.appendChild(bottomNav());
}

/** ショップの宝箱1種（レアリティ色＋価格＋開封ボタン） */
function chestRow(chest: ShopChest): HTMLElement {
  const color = isRainbowRarity(chest.rarity) ? "#ff7de9" : RARITY_COLOR[chest.rarity];
  const card = document.createElement("div");
  card.className = ("shop-card chest-card " + rarityGlowClass(chest.rarity)).trim();

  const icon = document.createElement("div");
  icon.className = "shop-icon";
  const cv = makeSpriteCanvas(chestSprite(color, false), 3);
  cv.className = "wpn-sprite";
  icon.appendChild(cv);
  card.appendChild(icon);

  const info = document.createElement("div");
  info.className = "shop-info";
  info.innerHTML =
    `<div class="shop-name">${chest.name}</div>` +
    `<div ${rarityAttr(chest.rarity, "shop-stars")}>${rarityStars(chest.rarity)} ` +
    `<span class="shop-rlabel">${RARITY_LABEL[chest.rarity]}の武器</span></div>` +
    `<div class="shop-stat">${RARITY_LABEL[chest.rarity]}帯の武器がランダムで出現</div>`;
  card.appendChild(info);

  const buy = document.createElement("button");
  buy.className = "shop-buy";
  buy.disabled = game.gold < chest.price;
  buy.innerHTML =
    `<span class="shop-price">${chest.price.toLocaleString()} G</span>` +
    `<span class="shop-buy-lbl">開封</span>`;
  buy.addEventListener("click", () => {
    const inst = game.buyChest(chest);
    if (inst) openChestModal(inst);
  });
  card.appendChild(buy);
  return card;
}

/** 宝箱購入時の開封モーダル（中央に宝箱→開封演出→中身を表示） */
function openChestModal(inst: WeaponInstance): void {
  const rarity = instRarity(inst);
  const color = isRainbowRarity(rarity) ? "#ff7de9" : RARITY_COLOR[rarity];
  const overlay = document.createElement("div");
  overlay.className = "chest-modal";

  const slot = document.createElement("div");
  slot.className = "chest-slot chest-modal-slot";
  const chest = document.createElement("div");
  chest.className = "chest-img";
  chest.appendChild(makeSpriteCanvas(chestSprite(color, false), 7));
  slot.appendChild(chest);
  const reward = rewardCard(inst);
  slot.appendChild(reward);
  overlay.appendChild(slot);

  const close = document.createElement("button");
  close.className = "chest-modal-close";
  close.textContent = "受け取る";
  close.addEventListener("click", () => { overlay.remove(); buildControls(); });
  overlay.appendChild(close);

  document.body.appendChild(overlay);
  window.setTimeout(() => openChest(chest, reward, color, rarity, 7), 350);
}

/** ショップの1商品（武器画像＋情報＋価格/購入ボタン） */
function shopRow(item: ShopItem, w: Weapon): HTMLElement {
  const sold = game.isSoldOut(item.baseId);
  const card = document.createElement("div");
  card.className = ("shop-card wclass-" + w.weapon + " " + rarityGlowClass(w.rarity)).trim();
  if (sold) card.classList.add("shop-sold");

  const icon = document.createElement("div");
  icon.className = "shop-icon";
  icon.appendChild(weaponSpriteEl(item.baseId, w.weapon, 3));
  card.appendChild(icon);

  const info = document.createElement("div");
  info.className = "shop-info";
  info.innerHTML =
    `<div class="shop-name">${w.name}</div>` +
    `<div ${rarityAttr(w.rarity, "shop-stars")}>${rarityStars(w.rarity)} ` +
    `<span class="shop-rlabel">${RARITY_LABEL[w.rarity]}・${WEAPON_LABEL[w.weapon]}</span></div>` +
    `<div class="shop-stat">⚔ 攻撃力 ${w.attack}${w.critChance ? `　会心 ${w.critChance}%` : ""}　Break ${w.breakPower}</div>`;
  card.appendChild(info);

  const buy = document.createElement("button");
  buy.className = "shop-buy";
  buy.disabled = sold || game.gold < item.price;
  buy.innerHTML = sold
    ? `<span class="shop-buy-lbl">売切</span>`
    : `<span class="shop-price">${item.price.toLocaleString()} G</span>` +
      `<span class="shop-buy-lbl">購入</span>`;
  buy.addEventListener("click", () => {
    if (game.buyWeapon(item.baseId, item.price)) { audio.sfxPerfect(); buildControls(); }
  });
  card.appendChild(buy);

  // 売り切れの帯（カード上部に SOLD OUT）
  if (sold) {
    const banner = document.createElement("div");
    banner.className = "shop-sold-banner";
    banner.textContent = "SOLD OUT";
    card.appendChild(banner);
  }
  return card;
}

const STAGE_EMOJI = ["🌲", "🏛️", "👑", "❄️", "♾️", "🔥", "⚔️"];

function buildStageSelect(): void {
  controls.appendChild(topBar());
  const head = document.createElement("h2");
  head.className = "screen-title";
  head.textContent = "⚔ ステージ選択";
  controls.appendChild(head);

  const list = document.createElement("div");
  list.className = "stage-list";
  STAGES.forEach((s, i) => {
    const unlocked = game.stageUnlocked(i);
    const cleared = game.save.bestStage > i;
    const diff = Math.min(5, i + 2);
    const card = document.createElement("div");
    card.className = "stage-card" + (unlocked ? "" : " locked");

    // サムネイル
    const thumb = document.createElement("div");
    thumb.className = "st-thumb";
    thumb.textContent = STAGE_EMOJI[i] ?? "⚔️";
    card.appendChild(thumb);

    // 情報
    const info = document.createElement("div");
    info.className = "st-info";
    const bossName = s.endless
      ? "" : s.waves[s.waves.length - 1]?.find((e) => e.boss)?.name ?? s.waves[s.waves.length - 1]?.[0]?.name ?? "";
    const sub = s.endless
      ? `最高到達 <b>${game.save.bestFloor}</b> 階　/　敵はランダム出現`
      : `ボス: ${bossName}`;
    info.innerHTML =
      `<div class="st-no">STAGE ${i + 1}</div>` +
      `<div class="st-name">${s.name}</div>` +
      `<div class="st-meta"><span class="st-stars">${"★".repeat(diff)}${"☆".repeat(5 - diff)}</span>` +
      `<span class="st-lv">推奨Lv ${s.recommendLv ?? (i + 1) * 5}</span></div>` +
      `<div class="st-desc">${s.desc}</div>` +
      `<div class="st-sub">${sub}</div>`;
    // ドロップ可能性のある武器を画像で表示
    const drops = stageDropPreview(i);
    if (drops.length && unlocked) {
      const dropRow = document.createElement("div");
      dropRow.className = "st-drops";
      const label = document.createElement("span");
      label.className = "st-drops-label";
      label.textContent = "ドロップ";
      dropRow.appendChild(label);
      for (const id of drops.slice(0, 5)) {
        const w = getWeapon(id);
        if (!w) continue;
        const slot = document.createElement("span");
        slot.className = "st-drop";
        slot.appendChild(weaponSpriteEl(id, w.weapon, 2));
        dropRow.appendChild(slot);
      }
      info.appendChild(dropRow);
    }
    card.appendChild(info);

    // 右上バッジ（CLEAR / 未解放）
    if (cleared) {
      const badge = document.createElement("div");
      badge.className = "st-badge st-clear";
      badge.textContent = "CLEAR!";
      card.appendChild(badge);
    } else if (!unlocked) {
      const badge = document.createElement("div");
      badge.className = "st-badge st-locked";
      badge.textContent = "🔒 未解放";
      card.appendChild(badge);
    }

    // 挑戦ボタン
    if (unlocked) {
      const go = document.createElement("button");
      go.className = "st-go";
      go.textContent = "挑戦 ▶";
      go.addEventListener("click", () => withFade(() => game.startStage(i)));
      card.appendChild(go);
    }
    list.appendChild(card);
  });
  controls.appendChild(list);
  controls.appendChild(bottomNav());
}

function buildInventory(): void {
  controls.appendChild(topBar());

  const head = document.createElement("div");
  head.className = "inv-titlebar";
  head.innerHTML =
    `<h2 class="screen-title">🗡 インベントリ</h2>` +
    `<span class="inv-count">所持 ${game.save.inventory.length} / 100</span>`;
  controls.appendChild(head);

  // フィルタ/ソートのツールバー
  const tools = document.createElement("div");
  tools.className = "inv-tools";
  const sortBtn = document.createElement("button");
  sortBtn.className = "inv-tool";
  sortBtn.textContent = invSortDesc ? "レア度 降順 ▼" : "レア度 昇順 ▲";
  sortBtn.addEventListener("click", () => { invSortDesc = !invSortDesc; buildControls(); });
  const lockBtn = document.createElement("button");
  lockBtn.className = "inv-tool" + (invLockedOnly ? " inv-tool-on" : "");
  lockBtn.textContent = invLockedOnly ? "🔒 ロックのみ" : "🔓 すべて表示";
  lockBtn.addEventListener("click", () => { invLockedOnly = !invLockedOnly; buildControls(); });
  tools.appendChild(sortBtn);
  tools.appendChild(lockBtn);
  controls.appendChild(tools);

  // レアリティのフィルタチップ
  const chips = document.createElement("div");
  chips.className = "inv-chips";
  chips.appendChild(rarityChip("all", "すべて"));
  for (const r of [...RARITY_ORDER].reverse()) chips.appendChild(rarityChip(r, rarityStars(r)));
  controls.appendChild(chips);

  // 一覧（全武器を対象にフィルタ＋ソート）
  let items = game.save.inventory.slice();
  if (invRarity !== "all") items = items.filter((it) => instRarity(it) === invRarity);
  if (invLockedOnly) items = items.filter((it) => game.isLocked(it.uid));
  items.sort((a, b) => (invSortDesc ? rarityDesc(a, b) : -rarityDesc(a, b)));

  const group = document.createElement("div");
  group.className = "inv-group";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "inv-empty";
    empty.textContent = "（該当する武器はありません）";
    group.appendChild(empty);
  }
  for (const inst of items) group.appendChild(weaponRow(inst, true));
  controls.appendChild(group);

  controls.appendChild(bottomNav());
}

/** レアリティ絞り込みチップ */
function rarityChip(r: Rarity | "all", label: string): HTMLElement {
  const b = document.createElement("button");
  const on = invRarity === r;
  b.className = "inv-chip" + (on ? " inv-chip-on" : "");
  if (r !== "all") {
    b.classList.add("rarity-chip");
    if (isRainbowRarity(r)) b.classList.add("rainbow-text");
    else b.style.color = RARITY_COLOR[r];
  }
  b.textContent = label;
  b.addEventListener("click", () => { invRarity = r; buildControls(); });
  return b;
}

/** 武器1本のカード（ヘッダー＋装備/詳細ボタン＋展開する詳細） */
function weaponRow(inst: WeaponInstance, equippable: boolean): HTMLElement {
  const w = getWeapon(inst.baseId)!;
  const equipped = game.save.equipped[w.weapon] === inst.uid;
  const card = document.createElement("div");
  // エピック以上はカード自体をレアリティ色で発光
  card.className = ("wpn-card " + rarityGlowClass(w.rarity)).trim();

  const head = document.createElement("div");
  head.className = "wpn-row" + (equipped ? " wpn-on" : "");
  const rarity = instRarity(inst);
  const locked = game.isLocked(inst.uid);
  const eff = effectiveWeapon(inst) ?? w;
  const skillNames = inst.skillIds.map((id) => getSkill(id)?.name).filter(Boolean).join(" → ");
  // 左：大きい武器ドット絵 ／ 右（中央より右）：攻撃力・スキルを大きく
  head.innerHTML =
    `<span class="wpn-icon wclass-${w.weapon}"></span>` +
    `<span class="wpn-left">` +
    `<span class="wpn-name">${instName(inst)}${equipped ? ` <span class="wpn-eqtag">装備中</span>` : ""}</span>` +
    `<span ${rarityAttr(rarity, "wpn-stars")}>${rarityStars(rarity)} ` +
    `<span class="wpn-rlabel">${RARITY_LABEL[rarity]}</span></span>` +
    levelTag(inst) + `</span>` +
    `<span class="wpn-right">` +
    `<span class="wpn-atk">⚔ 攻撃力 <b>${eff.attack}</b>${eff.critChance ? `　会心 ${eff.critChance}%` : ""}</span>` +
    `<span class="wpn-skills">${skillNames || "スキルなし"}</span></span>` +
    `<span class="wpn-lock${locked ? " on" : ""}">${locked ? "🔒" : ""}</span>`;
  // 系統の絵文字に代えて、武器ごとのドット絵を大きく表示
  head.querySelector(".wpn-icon")?.appendChild(weaponSpriteEl(inst.baseId, w.weapon, 4));
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

  // 削除ロックの切替（インベントリのみ）
  if (equippable) {
    const lock = document.createElement("button");
    const locked = game.isLocked(inst.uid);
    lock.className = "wpn-act wpn-lockbtn" + (locked ? " on" : "");
    lock.textContent = locked ? "🔒 ロック中" : "🔓 ロック";
    lock.addEventListener("click", () => { game.toggleLock(inst.uid); buildControls(); });
    acts.appendChild(lock);
  }

  // 削除（インベントリのみ・装備中/ロック中は不可・2タップ確認）
  if (equippable && game.canDelete(inst.uid)) {
    const del = document.createElement("button");
    del.className = "wpn-act wpn-del";
    const confirming = pendingDeleteUid === inst.uid;
    del.textContent = confirming ? "本当に削除？" : "削除";
    if (confirming) del.classList.add("wpn-del-confirm");
    del.addEventListener("click", () => {
      if (pendingDeleteUid === inst.uid) {
        pendingDeleteUid = null;
        game.deleteWeapon(inst.uid);
        expandedWeapons.delete(inst.uid);
      } else {
        pendingDeleteUid = inst.uid;
      }
      buildControls();
    });
    acts.appendChild(del);
  }
  card.appendChild(acts);

  if (open) card.appendChild(weaponDetail(inst));
  return card;
}

/** 武器の詳細パラメータ＋スキル説明 */
function weaponDetail(inst: WeaponInstance): HTMLElement {
  const w = getWeapon(inst.baseId)!;
  const box = document.createElement("div");
  box.className = "wpn-detail";

  const rarity = instRarity(inst);
  const meta = document.createElement("div");
  meta.className = "wd-meta";
  meta.innerHTML =
    `<div ${rarityAttr(rarity, "wd-stars")}>${rarityStars(rarity)} ` +
    `<span class="wd-rlabel">${RARITY_LABEL[rarity]}</span>　<span class="wd-cls">${WEAPON_LABEL[w.weapon]}</span></div>` +
    `<div>${w.desc}</div>` +
    `<div class="wd-rand">⚔ 攻撃力 <b>${w.attack}</b>　会心率 <b>${w.critChance}%</b>　Break <b>${w.breakPower}</b></div>` +
    `<div class="wd-note">武器を押すたびに ①→②→… の順でスキルが発動します</div>`;
  box.appendChild(meta);

  inst.skillIds.forEach((id, i) => {
    const s = getSkill(id);
    if (!s) return;
    const row = document.createElement("div");
    row.className = "wd-skill";
    row.innerHTML =
      `<div class="wd-sk-head">${i + 1}. ${KIND_ICON[s.kind]} ${s.name} ` +
      `<span class="wd-kind">[${SKILL_KIND_LABEL[s.kind]}]</span> <span class="wd-cost">EN ${s.enCost}</span></div>` +
      `<div class="wd-sk-desc">${skillDescription(s)}</div>`;
    box.appendChild(row);
  });
  return box;
}

function rarityDesc(a: WeaponInstance, b: WeaponInstance): number {
  const order = ["astral", "legend", "epic", "rare", "uncommon", "common"];
  return order.indexOf(instRarity(a)) - order.indexOf(instRarity(b));
}

function buildBattle(): void {
  // HP/EN（攻撃ボタンの上に配置）
  const hud = document.createElement("div");
  hud.className = "battle-hud";
  hud.innerHTML =
    `<div class="bh-bar bh-hp"><div class="bh-fill"></div><span class="bh-text"></span></div>` +
    `<div class="bh-bar bh-en"><div class="bh-fill"></div><span class="bh-text"></span></div>`;
  controls.appendChild(hud);
  battleHud = {
    root: hud,
    hpFill: hud.querySelector(".bh-hp .bh-fill") as HTMLElement,
    hpText: hud.querySelector(".bh-hp .bh-text") as HTMLElement,
    enFill: hud.querySelector(".bh-en .bh-fill") as HTMLElement,
    enText: hud.querySelector(".bh-en .bh-text") as HTMLElement,
  };

  const row = document.createElement("div");
  row.className = "weapons";
  for (const cls of CLASSES) {
    const inst = game.equippedInstance(cls);
    const card = document.createElement("button");
    card.className = `weapon-card wclass-${cls}`;
    card.addEventListener("click", () => attackWith(cls));
    pressFx(card);

    // ヘッダー：系統ラベル＋武器のドット絵（武器名の代わりに絵を表示）
    const head = document.createElement("div");
    head.className = "wc-head";
    const kind = document.createElement("span");
    kind.className = "wc-kind";
    kind.textContent = `${WEAPON_ICON[cls]} ${WEAPON_LABEL[cls]}`;
    head.appendChild(kind);
    if (inst) {
      const wrap = document.createElement("div");
      wrap.className = "wc-img-wrap";
      wrap.appendChild(weaponSpriteEl(inst.baseId, cls, 3));
      head.appendChild(wrap);
    } else {
      const nm = document.createElement("span");
      nm.className = "wc-name";
      nm.textContent = "（未装備）";
      head.appendChild(nm);
    }
    card.appendChild(head);

    // スキルは「コンボ」として順番に表示
    const combo = document.createElement("div");
    combo.className = "wc-combo";
    const steps: HTMLElement[] = [];
    game.comboSkills(cls).forEach((s) => {
      const step = document.createElement("div");
      step.className = "wc-step";
      step.innerHTML =
        `<span class="wc-sk">${s.name}</span>` +
        `<span class="wc-link">⚡連携</span>` +
        `<span class="wc-cost"><span class="wc-cost-num">${s.enCost}</span></span>`;
      combo.appendChild(step);
      steps.push(step);
    });
    // 次に出るスキルへ「ぬるっと」移動するフォーカス枠
    const focus = document.createElement("div");
    focus.className = "wc-focus";
    combo.appendChild(focus);
    card.appendChild(combo);
    row.appendChild(card);
    weaponButtons.push({ card, cls, steps, focus, focusIdx: -1 });
  }
  controls.appendChild(row);

  // ガード／休憩（大きめのアクションボタン）
  const actions = document.createElement("div");
  actions.className = "battle-actions";

  const guardBtn = document.createElement("button");
  guardBtn.className = "act-btn guard-act";
  guardBtn.appendChild(actionIcon(SHIELD));
  guardBtn.addEventListener("click", doGuard);
  pressFx(guardBtn);

  const restBtn = document.createElement("button");
  restBtn.className = "act-btn rest-act";
  restBtn.appendChild(actionIcon(SLEEP));
  restBtn.addEventListener("click", () => { game.battle?.rest(); audio.sfxGuard(); });
  pressFx(restBtn);

  actions.appendChild(guardBtn);
  actions.appendChild(restBtn);
  controls.appendChild(actions);
  updateWeaponButtons();
}

/** ボタン用のドット絵アイコン要素を作る */
function actionIcon(sprite: Parameters<typeof makeSpriteCanvas>[0]): HTMLCanvasElement {
  const icon = makeSpriteCanvas(sprite, 4);
  icon.className = "act-icon";
  return icon;
}

/** 武器のドット絵要素を作る（無ければ系統の絵文字でフォールバック） */
function weaponSpriteEl(baseId: string, cls: WeaponClass, scale: number): HTMLElement {
  const sprite = getWeaponSprite(baseId);
  if (sprite) {
    const cv = makeSpriteCanvas(sprite, scale);
    cv.className = "wpn-sprite";
    return cv;
  }
  const span = document.createElement("span");
  span.className = "wpn-emoji";
  span.textContent = WEAPON_ICON[cls];
  return span;
}

/** HP/ENバー（攻撃ボタン上）を現在値で更新する */
function updateBattleHud(): void {
  if (!battleHud || !game.battle) return;
  const b = game.battle;
  const hp = Math.ceil(b.playerHp);
  battleHud.hpFill.style.width = `${Math.max(0, Math.min(100, (b.playerHp / PLAYER_MAX_HP) * 100))}%`;
  battleHud.hpText.textContent = `HP ${hp} / ${PLAYER_MAX_HP}`;
  const en = Math.floor(b.playerEn);
  battleHud.enFill.style.width = `${Math.max(0, Math.min(100, (en / PLAYER_MAX_EN) * 100))}%`;
  const focus = b.freeNextEn;
  battleHud.enText.textContent = focus
    ? `EN ${en} / ${PLAYER_MAX_EN}（次0!）`
    : `EN ${en} / ${PLAYER_MAX_EN}`;
  battleHud.root.classList.toggle("focus", focus);
}

function updateWeaponButtons(): void {
  if (!game.battle) return;
  updateBattleHud();
  const last = game.battle.lastSkill;
  for (const entry of weaponButtons) {
    const { card, cls, steps, focus } = entry;
    const active = game.comboIndex(cls);
    const cur = game.currentSkill(cls);
    // 次に出る段をハイライト
    steps.forEach((step, i) => step.classList.toggle("wc-step-on", i === active));
    // ENが足りなければカードを無効表示
    const broke = !cur || game.battle!.playerEn < cur.enCost;
    card.classList.toggle("disabled", broke);
    // 連携候補：直近スキルと次の段で連携が成立し、かつ撃てるなら明確に光らせる
    const combo = cur && !broke ? matchCombo(last, cur.kind, cls) : undefined;
    card.classList.toggle("combo-ready", !!combo);
    steps.forEach((step, i) => step.classList.toggle("wc-combo-on", !!combo && i === active));
    // フォーカス枠を次に出る段へ「ぬるっと」移動（位置が変わった時だけ更新）
    const target = steps[active];
    if (target) {
      if (entry.focusIdx !== active) {
        focus.style.transform = `translateY(${target.offsetTop}px)`;
        focus.style.height = `${target.offsetHeight}px`;
        entry.focusIdx = active;
      }
      focus.classList.add("on");
    } else {
      focus.classList.remove("on");
    }
  }
}

function buildResult(): void {
  buildResultPanel();
}

/** ドロップ武器の中身（ドット絵＋名前＋レアリティ）の小カード */
function rewardCard(inst: WeaponInstance): HTMLElement {
  const w = getWeapon(inst.baseId)!;
  const r = instRarity(inst);
  const el = document.createElement("div");
  el.className = "reward";
  const img = weaponSpriteEl(inst.baseId, w.weapon, 3);
  img.classList.add("reward-img");
  el.appendChild(img);
  const nm = document.createElement("div");
  nm.className = "reward-name";
  nm.textContent = instName(inst);
  el.appendChild(nm);
  const st = document.createElement("div");
  st.innerHTML = `<span ${rarityAttr(r, "reward-stars")}>${rarityStars(r)}</span>`;
  el.appendChild(st);
  return el;
}

/** 宝箱を並べて順番に開封する演出を作る */
function buildChestReveal(drops: WeaponInstance[]): HTMLElement {
  const stage = document.createElement("div");
  stage.className = "chest-stage";
  drops.forEach((inst, i) => {
    const rarity = instRarity(inst);
    const color = isRainbowRarity(rarity) ? "#ff7de9" : RARITY_COLOR[rarity];
    const slot = document.createElement("div");
    slot.className = "chest-slot";

    const chest = document.createElement("div");
    chest.className = "chest-img";
    chest.appendChild(makeSpriteCanvas(chestSprite(color, false), 5));
    slot.appendChild(chest);

    const reward = rewardCard(inst);
    slot.appendChild(reward);
    stage.appendChild(slot);

    // 0.7秒間隔で順番に開封
    window.setTimeout(() => openChest(chest, reward, color, instRarity(inst)), 500 + i * 750);
  });
  return stage;
}

/** 1つの宝箱を開封：揺れ → 光って開く → 中身がポップ。エピック以上は派手な演出 */
function openChest(chest: HTMLElement, reward: HTMLElement, color: string, rarity: Rarity, scale = 5): void {
  if (!chest.isConnected) return;
  const flashy = rarity === "epic" || rarity === "legend" || rarity === "astral";
  // エピック以上は開封前に「溜め」の発光で期待感を出す（通常は単純な揺れ）
  chest.classList.add(flashy ? "chest-charge" : "shake");
  window.setTimeout(() => {
    if (!chest.isConnected) return;
    // 開封フレームに差し替え＋発光
    chest.innerHTML = "";
    chest.appendChild(makeSpriteCanvas(chestSprite(color, true), scale));
    chest.classList.remove("shake", "chest-charge");
    chest.classList.add("burst");
    // レアリティ別のバースト演出
    if (rarity === "astral") chest.classList.add("burst-astral");
    else if (rarity === "legend") chest.classList.add("burst-legend");
    else if (rarity === "epic") chest.classList.add("burst-epic");
    audio.sfxPerfect();
    spawnChestParticles(chest, rarity);
    window.setTimeout(() => {
      chest.classList.add("gone");
      reward.classList.add("show");
    }, flashy ? 360 : 200);
  }, flashy ? 620 : 460);
}

/** 開封時に飛び散る光の粒子（エピック=紫 / レジェンド=金 / アストラル=虹色をふんだんに） */
function spawnChestParticles(chest: HTMLElement, rarity: Rarity): void {
  const tier = rarity === "astral" ? "p-astral" : rarity === "legend" ? "p-legend" : rarity === "epic" ? "p-epic" : "";
  if (!tier) return; // レア以下は粒子なし（通常演出のまま）
  const host = chest.parentElement ?? chest;
  const n = rarity === "astral" ? 30 : rarity === "legend" ? 20 : 14;
  const rainbow = ["#ff5d5d", "#ffcf3f", "#5fe06a", "#4aa3ff", "#b96bff", "#ff7de9"];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "chest-particle " + tier;
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 38 + Math.random() * (rarity === "astral" ? 92 : 58);
    p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
    p.style.animationDelay = `${Math.random() * 140}ms`;
    if (rarity === "astral") p.style.background = rainbow[i % rainbow.length];
    host.appendChild(p);
    window.setTimeout(() => p.remove(), 1300);
  }
  // アストラルは中央に虹色のリングを重ねる
  if (rarity === "astral") {
    const ring = document.createElement("span");
    ring.className = "chest-ring";
    host.appendChild(ring);
    window.setTimeout(() => ring.remove(), 1000);
  }
}

function buildResultPanel(): void {
  const panel = document.createElement("div");
  panel.className = "result-panel";
  const endless = game.isEndless;
  const title = document.createElement("h2");
  title.textContent = endless
    ? `${game.lastFloor} 階 到達`
    : (game.lastWon ? `STAGE ${game.stageIndex + 1} CLEAR` : "DEFEATED");
  title.className = (endless || game.lastWon) ? "r-win" : "r-lose";
  panel.appendChild(title);

  if (endless) {
    const info = document.createElement("div");
    info.className = "u-head";
    info.textContent = `最高到達 ${game.save.bestFloor} 階　/　この回廊で稼いだ宝箱 ${game.lastDrops.length} 個`;
    panel.appendChild(info);
    const goldLine = document.createElement("div");
    goldLine.className = "result-gold";
    goldLine.innerHTML =
      `<span class="gold-amt">+${game.lastGold.toLocaleString()}</span><span class="gold-unit">G 獲得</span>` +
      `<span class="result-gold-total">（所持 ${game.gold.toLocaleString()} G）</span>`;
    panel.appendChild(goldLine);
    if (game.lastDrops.length > 0) panel.appendChild(buildChestReveal(game.lastDrops));
  } else if (game.lastWon) {
    const head = document.createElement("div");
    head.className = "u-head";
    head.textContent = game.lastDrops.length > 0
      ? `🎁 入手した宝箱（${game.lastDrops.length}個）`
      : "🗡 入手した武器はありませんでした";
    panel.appendChild(head);
    const goldLine = document.createElement("div");
    goldLine.className = "result-gold";
    goldLine.innerHTML =
      `<span class="gold-amt">+${game.lastGold.toLocaleString()}</span><span class="gold-unit">G 獲得</span>` +
      `<span class="result-gold-total">（所持 ${game.gold.toLocaleString()} G）</span>`;
    panel.appendChild(goldLine);
    if (game.lastDrops.length > 0) panel.appendChild(buildChestReveal(game.lastDrops));
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

  // バトル枠（canvas）は戦闘・リザルトのみ。メニュー系画面では描画しない
  if (game.screen === "battle" || game.screen === "result") {
    if (game.battle) {
      if (game.screen === "battle") updateWeaponButtons();
      render(ctx, game.battle, {
        index: game.stageIndex, count: STAGE_COUNT,
        wave: game.waveIndex, waves: game.waveCount, boss: game.isBossWave,
        floor: game.isEndless ? game.endlessFloor : undefined,
      });
    }
  }
  requestAnimationFrame(loop);
}

buildControls();
requestAnimationFrame(loop);
