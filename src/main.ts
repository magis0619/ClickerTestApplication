import "./style.css";
import { render, enemySlots, makeSpriteCanvas } from "./render/canvas.ts";
import {
  SHIELD, SLEEP, WARDEN, getWeaponSprite, chestSprite,
  CARAPACE, AERIAL, PHANTOM, BOSS, type Sprite,
} from "./render/sprites.ts";
import { Game, CLASSES, STAGE_COUNT } from "./game/game.ts";
import {
  STAGES, WEAPON_LABEL, RARITY_LABEL, RARITY_COLOR, KIND_LABEL, WEAKNESS, WEAKNESS_MULTIPLIER,
  getWeapon, getSkill, skillDescription, isRainbowRarity, matchCombo, stageDropPreview, COMBOS,
  PLAYER_MAX_HP, PLAYER_MAX_EN, REST_EN_RECOVER, PERFECT_HP_RECOVER, PERFECT_EN_RECOVER, SHOP_ITEMS, SHOP_CHESTS,
  effectiveWeapon, expForNext, levelCap, materialExp, awakenCost, MAX_AWAKEN,
} from "./game/data.ts";
import { audio } from "./audio/audio.ts";
import type {
  Rarity, SfxEvent, SkillKind, WeaponClass, WeaponInstance, Weapon, ShopItem, ShopChest,
  EnemyKind, StageDef,
} from "./game/types.ts";

/** インスタンスの武器名・レアリティ（テンプレートから取得） */
function instName(inst: WeaponInstance): string { return getWeapon(inst.baseId)?.name ?? "???"; }
function instRarity(inst: WeaponInstance): Rarity { return getWeapon(inst.baseId)?.rarity ?? "common"; }

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const controls = document.getElementById("controls") as HTMLDivElement;
const app = document.getElementById("app") as HTMLDivElement;
// 戦闘画面の上部バー（タイトル＋設定＋ポートレート）。canvasの上に配置する
const battleTop = document.createElement("div");
battleTop.className = "bt-top";
battleTop.style.display = "none";
app.insertBefore(battleTop, canvas);

const game = new Game();
/** 戦闘中の武器カード（2スキルを段表示し、クリック毎にフォーカスが移動） */
let battleCards: {
  card: HTMLButtonElement; cls: WeaponClass;
  steps: HTMLElement[]; focus: HTMLElement; link: HTMLElement; focusIdx: number;
}[] = [];
/** 戦闘中のガードカード（敵の予兆中に強調する） */
let guardCard: HTMLButtonElement | null = null;
/** 戦闘中の休憩ボタン（敵の予兆中は無効化する） */
let restCard: HTMLButtonElement | null = null;
/** 戦闘中の戦況ログバー（COMBAT_LOG） */
let battleLog: HTMLElement | null = null;
/** 戦闘中のHP/AP（セグメント）バー。毎フレーム更新する */
let battleHud: {
  hpLabel: HTMLElement; hpSegs: HTMLElement[]; crit: HTMLElement; hpFill: HTMLElement;
  enLabel: HTMLElement; enSegs: HTMLElement[]; enWrap: HTMLElement; enFill: HTMLElement;
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

/** 直近に描画していた戦闘インスタンス。ウェーブ切替の検知に使う */
let lastBattleRef: typeof game.battle = null;
/** 次ウェーブへ移った瞬間、黒からぬるっと明転させる（フェードイン） */
function fadeInBattle(): void {
  fadeEl.style.transition = "none";
  fadeEl.classList.add("show"); // いったん即座に真っ黒へ
  requestAnimationFrame(() => {
    fadeEl.style.transition = ""; // CSS既定の0.34sへ戻す
    requestAnimationFrame(() => fadeEl.classList.remove("show"));
  });
}

const KIND_ICON: Record<SkillKind, string> = { attack: "⚔", charge: "▲", focus: "◎" };
const WEAPON_ICON: Record<WeaponClass, string> = { slash: "⚔", pierce: "🗡", crush: "🔨" };
/** 戦闘スキルカードの英字見出し（モックに合わせた SLASH / PIERCE / STRIKE） */
const CLASS_EN: Record<WeaponClass, string> = { slash: "SLASH", pierce: "PIERCE", crush: "STRIKE" };
/** HPセグメントバーの分割数 */
const HP_SEGMENTS = 14;

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

/** 削除確認中の武器UID（2タップ目で確定） */
let pendingDeleteUid: string | null = null;
/** インベントリ：系統フィルタ（all=すべて） */
let invClass: WeaponClass | "all" = "all";
/** インベントリ：レア度の並び（true=降順） */
let invSortDesc = true;
/** インベントリ：ロック中のみ表示 */
let invLockedOnly = false;
/** ダンジョン選択：選択中のゾーン番号 */
let stageSel = 0;
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
const topbarEl = document.querySelector(".topbar") as HTMLElement;

// 規定フォントを先読み（canvasの文字が初回からデザイン通りに描画されるように）
if (document.fonts) {
  for (const f of ["900 16px Anybody", "700 16px 'Space Mono'", "800 16px 'Hanken Grotesk'"]) {
    document.fonts.load(f).catch(() => {});
  }
}

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
  battleCards = [];
  battleHud = null;
  guardCard = null;
  restCard = null;
  battleLog = null;
  const screenChanged = renderedScreen !== game.screen;
  renderedScreen = game.screen;
  // バトル枠（canvas）は戦闘中のみ表示。それ以外（リザルト含む）はDOMで構成
  canvas.style.display = game.screen === "battle" ? "block" : "none";
  // 戦闘中はバトル専用テーマ、それ以外（リザルト含む）はターミナル風ライトテーマ
  const inBattle = game.screen === "battle";
  const menuThemed = !inBattle;
  document.body.classList.toggle("in-battle", inBattle);
  document.body.classList.toggle("theme-nb", menuThemed);
  battleTop.style.display = inBattle ? "" : "none";
  if (!inBattle) battleTop.innerHTML = "";
  if (menuThemed) buildTopHeader();
  else { topbarEl.innerHTML = ""; topbarEl.className = "topbar"; }
  switch (game.screen) {
    case "title": buildTitle(); break;
    case "stageSelect": buildStageSelect(); break;
    case "inventory": buildInventory(); break;
    case "forge": buildForge(); break;
    case "shop": buildShop(); break;
    case "battle": buildBattle(); break;
    case "result": buildResult(); break;
    case "howto": buildHowTo(); break;
  }
  // 画面が切り替わったら縦スクロールを先頭へ戻す（前画面のスクロール残りを防ぐ）
  if (screenChanged) {
    window.scrollTo(0, 0);
    // 各画面移動はフェードイン(0.1秒)。ただしバトルへの遷移は演出を挟まず即表示
    if (game.screen !== "battle") {
      controls.style.setProperty("--screen-tdur", "100ms");
      controls.classList.remove("screen-enter");
      void controls.offsetWidth; // リフローでアニメーションを再生し直す
      controls.classList.add("screen-enter");
    } else {
      controls.classList.remove("screen-enter");
    }
  }
}

function buildTitle(): void {
  const hero = document.createElement("div");
  hero.className = "title-hero";
  const spr = makeSpriteCanvas(WARDEN, 6);
  spr.className = "title-sprite";
  hero.appendChild(spr);
  const cap = document.createElement("div");
  cap.innerHTML = `<div class="title-logo">ASTRAL WARDEN</div><div class="title-sub">タイミングアクションRPG</div>`;
  hero.appendChild(cap);
  controls.appendChild(hero);
  controls.appendChild(bigButton("▶ 冒険に出る", () => { game.goStageSelect(); buildControls(); }));
  const howBtn = bigButton("📖 遊び方を見る", () => { game.goHowTo(); buildControls(); });
  howBtn.classList.add("menu-btn-sec");
  controls.appendChild(howBtn);
  controls.appendChild(bottomNav());
}

/** 共通の最上部バー（BATTLE_ROYALE_V1 ＋ 所持ゴールド ＋ 設定/ヘルプ） */
function buildTopHeader(): void {
  topbarEl.innerHTML = "";
  topbarEl.className = "topbar nb-topbar";
  const brand = document.createElement("div");
  brand.className = "nb-brand";
  brand.textContent = "BATTLE_ROYALE_V1";
  const right = document.createElement("div");
  right.className = "nb-top-right";
  const gold = document.createElement("span");
  gold.className = "nb-top-gold";
  gold.innerHTML = `<span class="gold-amt">${game.gold.toLocaleString()}</span><span class="gold-unit">G</span>`;
  const gear = document.createElement("button");
  gear.className = "nb-icon-btn";
  gear.textContent = "⚙";
  gear.addEventListener("click", () => { audio.init(); gear.classList.toggle("muted", audio.toggleMute()); });
  const help = document.createElement("button");
  help.className = "nb-icon-btn";
  help.textContent = "?";
  help.addEventListener("click", () => { game.goHowTo(); buildControls(); });
  right.appendChild(gold);
  right.appendChild(gear);
  right.appendChild(help);
  topbarEl.appendChild(brand);
  topbarEl.appendChild(right);
}

/** 画面見出し（任意のSCREENタグ＋大きな斜体タイトル） */
function screenHead(title: string, tag?: string, titleClass = ""): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "nb-head";
  let html = "";
  if (tag) html += `<span class="nb-screen-tag">${tag}</span>`;
  html += `<h2 class="nb-title ${titleClass}">${title}</h2>`;
  wrap.innerHTML = html;
  return wrap;
}

/** 確認ダイアログ（はい／いいえ）。はいで onYes を実行 */
function confirmModal(message: string, onYes: () => void): void {
  const overlay = document.createElement("div");
  overlay.className = "confirm-modal";
  const box = document.createElement("div");
  box.className = "confirm-box";
  const msg = document.createElement("div");
  msg.className = "confirm-msg";
  msg.textContent = message;
  const acts = document.createElement("div");
  acts.className = "confirm-acts";
  const no = document.createElement("button");
  no.className = "confirm-no";
  no.textContent = "いいえ";
  no.addEventListener("click", () => overlay.remove());
  const yes = document.createElement("button");
  yes.className = "confirm-yes";
  yes.textContent = "はい";
  yes.addEventListener("click", () => { overlay.remove(); onYes(); });
  acts.appendChild(no);
  acts.appendChild(yes);
  box.appendChild(msg);
  box.appendChild(acts);
  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

/** セクション見出し（左に大文字ラベル、右に任意の要素） */
function sectionLabel(text: string, right?: HTMLElement): HTMLElement {
  const row = document.createElement("div");
  row.className = "nb-section";
  const lbl = document.createElement("span");
  lbl.className = "nb-section-lbl";
  lbl.textContent = text;
  row.appendChild(lbl);
  if (right) row.appendChild(right);
  return row;
}

/** プレイヤーの戦闘力（装備中3系統の実効攻撃合計） */
function playerPower(): number {
  return (["slash", "pierce", "crush"] as WeaponClass[])
    .reduce((s, c) => s + (game.equippedWeapon(c)?.attack ?? 0), 0);
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
  controls.appendChild(screenHead("MASTER FORGE", "🔧 SCREEN_21"));

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
  controls.appendChild(screenHead("GRAND BAZAAR", "SCREEN_19"));

  // FLASH DEALS = 宝箱（横スクロールの大カード／購入で即開封）
  controls.appendChild(sectionLabel("FLASH DEALS", timerChip()));
  const deals = document.createElement("div");
  deals.className = "deal-row";
  for (const chest of SHOP_CHESTS) deals.appendChild(dealCard(chest));
  controls.appendChild(deals);

  // DAILY ARMORY = 武器（行リスト／一度買うと売り切れ）
  controls.appendChild(sectionLabel("DAILY ARMORY"));
  const list = document.createElement("div");
  list.className = "armory-list";
  for (const item of SHOP_ITEMS) {
    const w = getWeapon(item.baseId);
    if (w) list.appendChild(armoryRow(item, w));
  }
  controls.appendChild(list);
  controls.appendChild(bottomNav());
}

/** FLASH DEALS の締切タイマー（その日の終わりまで・装飾） */
function timerChip(): HTMLElement {
  const now = new Date();
  const end = new Date(now); end.setHours(24, 0, 0, 0);
  const sec = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const chip = document.createElement("span");
  chip.className = "deal-timer";
  chip.textContent = `⏱ ${hh}:${mm}:${ss}`;
  return chip;
}

/** FLASH DEAL（宝箱）の大カード。購入で即開封 */
function dealCard(chest: ShopChest): HTMLElement {
  const color = isRainbowRarity(chest.rarity) ? "#ff7de9" : RARITY_COLOR[chest.rarity];
  const card = document.createElement("div");
  card.className = ("deal-card " + rarityGlowClass(chest.rarity)).trim();

  const img = document.createElement("div");
  img.className = "deal-img";
  const cv = makeSpriteCanvas(chestSprite(color, false), 5);
  cv.className = "wpn-sprite";
  img.appendChild(cv);
  const ribbon = document.createElement("span");
  ribbon.className = "deal-ribbon" + (isRainbowRarity(chest.rarity) ? " rainbow-text" : "");
  ribbon.textContent = RARITY_LABEL[chest.rarity];
  img.appendChild(ribbon);
  card.appendChild(img);

  const name = document.createElement("div");
  name.className = "deal-name";
  name.textContent = chest.name;
  card.appendChild(name);

  const sub = document.createElement("div");
  sub.className = "deal-sub";
  sub.textContent = `${RARITY_LABEL[chest.rarity]}帯 ランダム`;
  card.appendChild(sub);

  const foot = document.createElement("div");
  foot.className = "deal-foot";
  const price = document.createElement("span");
  price.className = "deal-price";
  price.textContent = `${chest.price.toLocaleString()} G`;
  const buy = document.createElement("button");
  buy.className = "deal-buy";
  buy.textContent = "🛒";
  buy.disabled = game.gold < chest.price;
  buy.addEventListener("click", () => { const inst = game.buyChest(chest); if (inst) openChestModal(inst); });
  foot.appendChild(price);
  foot.appendChild(buy);
  card.appendChild(foot);
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

/** DAILY ARMORY の1行（武器アイコン＋情報＋BUY/SOLD） */
function armoryRow(item: ShopItem, w: Weapon): HTMLElement {
  const sold = game.isSoldOut(item.baseId);
  const row = document.createElement("div");
  row.className = "armory-row" + (sold ? " sold" : "");

  const icon = document.createElement("div");
  icon.className = "armory-icon";
  icon.appendChild(weaponSpriteEl(item.baseId, w.weapon, 2));
  row.appendChild(icon);

  const info = document.createElement("div");
  info.className = "armory-info";
  info.innerHTML =
    `<div class="armory-name">${w.name}</div>` +
    `<div class="armory-sub">${RARITY_LABEL[w.rarity]}・${WEAPON_LABEL[w.weapon]}　ATK ${w.attack}${w.critChance ? `　CRIT ${w.critChance}%` : ""}</div>` +
    `<div class="armory-price">${item.price.toLocaleString()} G</div>`;
  row.appendChild(info);

  const buy = document.createElement("button");
  buy.className = "armory-buy";
  buy.textContent = sold ? "SOLD" : "BUY";
  buy.disabled = sold || game.gold < item.price;
  buy.addEventListener("click", () => {
    if (game.buyWeapon(item.baseId, item.price)) { audio.sfxPerfect(); buildControls(); }
  });
  row.appendChild(buy);
  return row;
}

/** 敵種別→ダンジョンの属性タグ（色つきチップ）と代表スプライト */
const KIND_TAG: Record<EnemyKind, { label: string; cls: string }> = {
  carapace: { label: "🛡 ARMOR", cls: "tag-armor" },
  phantom: { label: "👻 PHANTOM", cls: "tag-phantom" },
  aerial: { label: "🌪 AERIAL", cls: "tag-aerial" },
};
const KIND_SPRITE: Record<EnemyKind, Sprite> = { carapace: CARAPACE, phantom: PHANTOM, aerial: AERIAL };

function stageKinds(s: StageDef): EnemyKind[] {
  const set = new Set<EnemyKind>();
  for (const wave of s.waves) for (const e of wave) set.add(e.kind);
  return [...set];
}
function stageThumbSprite(s: StageDef): Sprite {
  for (let i = s.waves.length - 1; i >= 0; i--) {
    if (s.waves[i].some((e) => e.boss)) return BOSS;
  }
  const last = s.waves[s.waves.length - 1]?.[0];
  return last ? KIND_SPRITE[last.kind] : BOSS;
}

function buildStageSelect(): void {
  controls.appendChild(screenHead("DUNGEON HUB"));
  if (!game.stageUnlocked(stageSel)) stageSel = 0;

  const list = document.createElement("div");
  list.className = "zone-list";
  STAGES.forEach((s, i) => list.appendChild(zoneCard(s, i)));
  controls.appendChild(list);

  controls.appendChild(powerPanel());

  controls.appendChild(bottomNav());
}

/** ゾーン（ステージ）カード。タップで選択 */
function zoneCard(s: StageDef, i: number): HTMLElement {
  const unlocked = game.stageUnlocked(i);
  const cleared = game.save.bestStage > i;
  const card = document.createElement("div");
  card.className = "zone-card" + (unlocked ? "" : " locked") + (i === stageSel ? " sel" : "");
  const zno = String(i + 1).padStart(2, "0");

  if (!unlocked) {
    card.innerHTML =
      `<div class="zone-top"><span class="zone-tag">ZONE ${zno}</span>` +
      `<span class="zone-status st-locked">🔒 LOCKED</span></div>` +
      `<div class="zone-locked-name">??? LOCKED ZONE</div>`;
    return card;
  }

  const statusTxt = cleared ? "CLEAR" : s.endless ? `${game.save.bestFloor}F` : "OPEN";
  const top = document.createElement("div");
  top.className = "zone-top";
  top.innerHTML =
    `<span class="zone-tag">ZONE ${zno}</span>` +
    `<span class="zone-status-wrap"><span class="zone-status-lbl">STATUS</span>` +
    `<span class="zone-status">${statusTxt}</span></span>`;
  card.appendChild(top);

  const name = document.createElement("div");
  name.className = "zone-name";
  name.textContent = s.name;
  card.appendChild(name);

  const body = document.createElement("div");
  body.className = "zone-body";
  const thumb = document.createElement("div");
  thumb.className = "zone-thumb";
  thumb.appendChild(makeSpriteCanvas(stageThumbSprite(s), 4));
  body.appendChild(thumb);

  const meta = document.createElement("div");
  meta.className = "zone-meta";
  const tags = document.createElement("div");
  tags.className = "zone-tags";
  for (const k of stageKinds(s)) {
    const chip = document.createElement("span");
    chip.className = "zone-chip " + KIND_TAG[k].cls;
    chip.textContent = KIND_TAG[k].label;
    tags.appendChild(chip);
  }
  if (s.endless) {
    const chip = document.createElement("span");
    chip.className = "zone-chip tag-endless";
    chip.textContent = "♾ ENDLESS";
    tags.appendChild(chip);
  }
  meta.appendChild(tags);
  const drops = stageDropPreview(i);
  if (drops.length) {
    const loot = document.createElement("div");
    loot.className = "zone-loot";
    loot.innerHTML = `<span class="zone-loot-lbl">LOOT:</span>`;
    for (const id of drops.slice(0, 4)) {
      const w = getWeapon(id);
      if (!w) continue;
      const sl = document.createElement("span");
      sl.className = "zone-loot-item";
      sl.appendChild(weaponSpriteEl(id, w.weapon, 2));
      loot.appendChild(sl);
    }
    meta.appendChild(loot);
  }
  body.appendChild(meta);
  card.appendChild(body);

  // 各ダンジョンに「入る」ボタンを設置（下部の大ボタンは廃止）
  const enter = document.createElement("button");
  enter.className = "zone-enter";
  enter.innerHTML = "▶ ENTER";
  enter.addEventListener("click", (e) => {
    e.stopPropagation();
    stageSel = i;
    withFade(() => game.startStage(i));
  });
  card.appendChild(enter);

  // カード本体タップは選択（Power Comparison を更新）
  card.addEventListener("click", () => { stageSel = i; buildControls(); });
  return card;
}

/** Power Comparison パネル（プレイヤー戦闘力 vs ステージ推奨） */
function powerPanel(): HTMLElement {
  const s = STAGES[stageSel];
  const rec = s?.recommendLv ?? (stageSel + 1) * 5;
  const power = playerPower();
  const ref = Math.max(1, rec * 3);
  const pct = Math.max(5, Math.min(100, Math.round((power / ref) * 100)));
  const chance = pct >= 80 ? "HIGH" : pct >= 50 ? "MED" : "LOW";
  const chanceCls = pct >= 80 ? "sv-high" : pct >= 50 ? "sv-med" : "sv-low";
  const segN = 12;
  const filled = Math.round((pct / 100) * segN);
  let segs = "";
  for (let k = 0; k < segN; k++) segs += `<span class="bt-seg${k < filled ? " on" : ""}"></span>`;
  const panel = document.createElement("div");
  panel.className = "power-panel";
  panel.innerHTML =
    `<div class="power-head"><span class="power-title">Power Comparison</span>` +
    `<span class="power-vs">LV ${power} vs ${s?.name ?? ""} (LV ${rec})</span></div>` +
    `<div class="bt-seg-bar bt-seg-hp">${segs}</div>` +
    `<div class="power-foot"><span class="power-surv ${chanceCls}">SURVIVAL CHANCE: ${chance}</span>` +
    `<span class="power-pct">${pct}%</span></div>`;
  return panel;
}

function buildInventory(): void {
  controls.appendChild(screenHead("ARSENAL"));

  // 所持容量バー（INVENTORY CAPACITY）
  const count = game.save.inventory.length;
  const max = 100, segN = 20;
  const filled = Math.min(segN, Math.round((count / max) * segN));
  let segs = "";
  for (let k = 0; k < segN; k++) segs += `<span class="bt-seg${k < filled ? " on" : ""}"></span>`;
  const cap = document.createElement("div");
  cap.className = "ars-cap";
  cap.innerHTML =
    `<div class="ars-cap-row"><span class="ars-cap-lbl">INVENTORY CAPACITY</span>` +
    `<span class="ars-cap-num">${count} / ${max}</span></div>` +
    `<div class="bt-seg-bar bt-seg-en">${segs}</div>`;
  controls.appendChild(cap);

  // 系統タブ（ALL / 斬 / 突 / 打）
  const tabs = document.createElement("div");
  tabs.className = "ars-tabs";
  tabs.appendChild(classTab("all", "ALL"));
  tabs.appendChild(classTab("slash", "斬撃"));
  tabs.appendChild(classTab("pierce", "刺突"));
  tabs.appendChild(classTab("crush", "打撃"));
  controls.appendChild(tabs);

  // ツール（ソート・ロックのみ）
  const tools = document.createElement("div");
  tools.className = "ars-tools";
  const sortBtn = document.createElement("button");
  sortBtn.className = "ars-tool";
  sortBtn.textContent = invSortDesc ? "レア度 ▼" : "レア度 ▲";
  sortBtn.addEventListener("click", () => { invSortDesc = !invSortDesc; buildControls(); });
  const lockBtn = document.createElement("button");
  lockBtn.className = "ars-tool" + (invLockedOnly ? " on" : "");
  lockBtn.textContent = invLockedOnly ? "🔒 ロックのみ" : "🔓 すべて";
  lockBtn.addEventListener("click", () => { invLockedOnly = !invLockedOnly; buildControls(); });
  tools.appendChild(sortBtn);
  tools.appendChild(lockBtn);
  controls.appendChild(tools);

  // グリッド（フィルタ＋ソート）
  let items = game.save.inventory.slice();
  if (invClass !== "all") items = items.filter((it) => getWeapon(it.baseId)?.weapon === invClass);
  if (invLockedOnly) items = items.filter((it) => game.isLocked(it.uid));
  items.sort((a, b) => (invSortDesc ? rarityDesc(a, b) : -rarityDesc(a, b)));

  const grid = document.createElement("div");
  grid.className = "ars-grid";
  for (const inst of items) grid.appendChild(arsenalCard(inst));
  // CRAFT NEW（ショップへ）
  const craft = document.createElement("button");
  craft.className = "ars-craft";
  craft.innerHTML = `<span class="ars-craft-plus">＋</span><span>CRAFT NEW</span>`;
  craft.addEventListener("click", () => { game.goShop(); buildControls(); });
  grid.appendChild(craft);
  controls.appendChild(grid);

  controls.appendChild(bottomNav());
}

/** 系統フィルタタブ */
function classTab(cls: WeaponClass | "all", label: string): HTMLElement {
  const b = document.createElement("button");
  b.className = "ars-tab" + (invClass === cls ? " on" : "");
  b.textContent = label;
  b.addEventListener("click", () => { invClass = cls; buildControls(); });
  return b;
}

/** ARSENAL グリッドの武器カード。タップで詳細モーダル */
function arsenalCard(inst: WeaponInstance): HTMLElement {
  const w = getWeapon(inst.baseId)!;
  const eff = effectiveWeapon(inst) ?? w;
  const r = instRarity(inst);
  const equipped = game.save.equipped[w.weapon] === inst.uid;
  const locked = game.isLocked(inst.uid);
  const card = document.createElement("button");
  card.className = ("ars-card wclass-" + w.weapon + " " + rarityGlowClass(r)).trim();
  card.innerHTML =
    `<div class="ars-card-top"><span ${rarityAttr(r, "ars-card-rar")}>${RARITY_LABEL[r]}</span>` +
    `<span class="ars-card-fav">${locked ? "★" : ""}</span></div>` +
    `<div class="ars-card-img"></div>` +
    `<div class="ars-card-name">${instName(inst)}</div>` +
    (equipped
      ? `<div class="ars-card-eq">EQUIPPED</div>`
      : `<div class="ars-card-stats"><span>ATK ${eff.attack}</span><span>Lv ${inst.level ?? 1}</span></div>`);
  card.querySelector(".ars-card-img")?.appendChild(weaponSpriteEl(inst.baseId, w.weapon, 3));
  card.addEventListener("click", () => openWeaponModal(inst.uid));
  return card;
}

/** 武器詳細モーダル（PLASMA RIPPER 風：画像・ステータス・改造ログ・操作） */
function openWeaponModal(uid: string): void {
  const inst = game.save.inventory.find((it) => it.uid === uid);
  if (!inst) return;
  const w = getWeapon(inst.baseId)!;
  const eff = effectiveWeapon(inst) ?? w;
  const r = instRarity(inst);
  const equipped = game.save.equipped[w.weapon] === inst.uid;
  const locked = game.isLocked(inst.uid);

  const overlay = document.createElement("div");
  overlay.className = "wpn-modal";
  const sheet = document.createElement("div");
  sheet.className = ("wpn-sheet " + rarityGlowClass(r)).trim();

  const head = document.createElement("div");
  head.className = "wpn-sheet-head";
  head.innerHTML =
    `<div class="wpn-sheet-title">${instName(inst)}</div><button class="wpn-sheet-x">×</button>`;
  sheet.appendChild(head);

  const chips = document.createElement("div");
  chips.className = "wpn-sheet-chips";
  chips.innerHTML =
    `<span ${rarityAttr(r, "wpn-chip")}>${RARITY_LABEL[r]}</span>` +
    `<span class="wpn-chip wpn-chip-cls">${WEAPON_LABEL[w.weapon]}</span>` +
    `<span class="wpn-chip wpn-chip-lv">${levelTag(inst)}</span>` +
    (equipped ? `<span class="wpn-chip wpn-chip-eq">EQUIPPED</span>` : "");
  sheet.appendChild(chips);

  const img = document.createElement("div");
  img.className = "wpn-sheet-img";
  img.appendChild(weaponSpriteEl(inst.baseId, w.weapon, 6));
  sheet.appendChild(img);

  const stats = document.createElement("div");
  stats.className = "wpn-sheet-stats";
  stats.innerHTML =
    statBox("ATK", `${eff.attack}`) + statBox("CRIT", `${eff.critChance}%`) + statBox("BREAK", `${eff.breakPower}`);
  sheet.appendChild(stats);

  // Modification Log = スキル
  const log = document.createElement("div");
  log.className = "wpn-sheet-log";
  log.innerHTML = `<div class="wpn-log-head">Modification Log</div>`;
  inst.skillIds.forEach((id, i) => {
    const s = getSkill(id); if (!s) return;
    const row = document.createElement("div");
    row.className = "wpn-log-row";
    row.innerHTML =
      `<span class="wpn-log-no">${i + 1}</span>` +
      `<span class="wpn-log-name">${KIND_ICON[s.kind]} ${s.name}</span>` +
      `<span class="wpn-log-desc">${skillDescription(s)}</span>` +
      `<span class="wpn-log-en">EN ${s.enCost}</span>`;
    log.appendChild(row);
  });
  if (inst.skillIds.length === 0) {
    const row = document.createElement("div");
    row.className = "wpn-log-row";
    row.textContent = "（スキルなし）";
    log.appendChild(row);
  }
  sheet.appendChild(log);

  // アクション
  const acts = document.createElement("div");
  acts.className = "wpn-sheet-acts";
  const eq = document.createElement("button");
  eq.className = "nb-cta wpn-act-eq";
  eq.textContent = equipped ? "装備中" : "装備する";
  eq.disabled = equipped;
  eq.addEventListener("click", () => { if (game.equip(inst.uid)) { overlay.remove(); buildControls(); openWeaponModal(uid); } });
  acts.appendChild(eq);
  const mini = document.createElement("div");
  mini.className = "wpn-sheet-mini";
  const lock = document.createElement("button");
  lock.className = "wpn-mini" + (locked ? " on" : "");
  lock.textContent = locked ? "🔒 ロック中" : "🔓 ロック";
  lock.addEventListener("click", () => { game.toggleLock(inst.uid); overlay.remove(); buildControls(); openWeaponModal(uid); });
  mini.appendChild(lock);
  if (game.canDelete(inst.uid)) {
    const del = document.createElement("button");
    del.className = "wpn-mini wpn-mini-del";
    const confirming = pendingDeleteUid === inst.uid;
    del.textContent = confirming ? "本当に削除?" : "削除";
    if (confirming) del.classList.add("confirm");
    del.addEventListener("click", () => {
      if (pendingDeleteUid === inst.uid) {
        pendingDeleteUid = null; game.deleteWeapon(inst.uid); overlay.remove(); buildControls();
      } else {
        pendingDeleteUid = inst.uid; overlay.remove(); buildControls(); openWeaponModal(uid);
      }
    });
    mini.appendChild(del);
  }
  acts.appendChild(mini);
  sheet.appendChild(acts);

  overlay.appendChild(sheet);
  head.querySelector(".wpn-sheet-x")?.addEventListener("click", () => { pendingDeleteUid = null; overlay.remove(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) { pendingDeleteUid = null; overlay.remove(); } });
  document.body.appendChild(overlay);
}

/** モーダルのステータスボックス */
function statBox(label: string, val: string): string {
  return `<div class="wpn-stat"><div class="wpn-stat-val">${val}</div><div class="wpn-stat-lbl">${label}</div></div>`;
}

function rarityDesc(a: WeaponInstance, b: WeaponInstance): number {
  const order = ["astral", "legend", "epic", "rare", "uncommon", "common"];
  return order.indexOf(instRarity(a)) - order.indexOf(instRarity(b));
}

/** 戦闘画面の上部バー（タイトル＋設定ギア＋ポートレート） */
function buildBattleTop(): void {
  battleTop.innerHTML = "";
  const title = document.createElement("div");
  title.className = "bt-title";
  const name = game.isEndless ? `THE_CORRIDOR ${game.endlessFloor}F` : game.currentStage.name;
  title.innerHTML = `<span class="bt-title-mark">▶</span> ${name}`;

  const right = document.createElement("div");
  right.className = "bt-top-right";
  // メインメニューへ戻る（確認あり・進行中のバトルは破棄）
  const exit = document.createElement("button");
  exit.className = "bt-exit";
  exit.textContent = "⏏ MENU";
  exit.addEventListener("click", () => {
    confirmModal("メインメニューに戻りますか？\n進行中のバトルは記録されません。", () => {
      game.battle = null;
      game.goTitle();
      buildControls();
    });
  });
  const gear = document.createElement("button");
  gear.className = "bt-gear";
  gear.textContent = "⚙";
  gear.addEventListener("click", () => { audio.init(); gear.textContent = audio.toggleMute() ? "🔇" : "⚙"; });
  const port = document.createElement("div");
  port.className = "bt-portrait";
  port.appendChild(makeSpriteCanvas(WARDEN, 3));
  right.appendChild(exit);
  right.appendChild(gear);
  right.appendChild(port);

  battleTop.appendChild(title);
  battleTop.appendChild(right);
}

function buildBattle(): void {
  lastBattleRef = game.battle; // この戦闘を基準に（ウェーブ切替の二重フェードを防ぐ）
  buildBattleTop();

  // ===== HP / AP セグメントバー =====
  const hud = document.createElement("div");
  hud.className = "bt-stats";
  const hpRow = document.createElement("div");
  hpRow.className = "bt-stat-row";
  const hpLabel = document.createElement("span");
  hpLabel.className = "bt-stat-label";
  const crit = document.createElement("span");
  crit.className = "bt-crit";
  crit.textContent = "CRITICAL!";
  hpRow.appendChild(hpLabel);
  hpRow.appendChild(crit);
  const hpBar = document.createElement("div");
  hpBar.className = "bt-seg-bar bt-seg-hp bt-seg-fluid";
  const hpFill = document.createElement("div");
  hpFill.className = "bt-seg-fill";
  hpBar.appendChild(hpFill);
  const hpSegs: HTMLElement[] = [];
  for (let i = 0; i < HP_SEGMENTS; i++) {
    const s = document.createElement("span");
    s.className = "bt-seg";
    hpBar.appendChild(s);
    hpSegs.push(s);
  }
  const enRow = document.createElement("div");
  enRow.className = "bt-stat-row";
  const enLabel = document.createElement("span");
  enLabel.className = "bt-stat-label";
  enRow.appendChild(enLabel);
  const enBar = document.createElement("div");
  enBar.className = "bt-seg-bar bt-seg-en bt-seg-fluid";
  const enFill = document.createElement("div");
  enFill.className = "bt-seg-fill";
  enBar.appendChild(enFill);
  const enSegs: HTMLElement[] = [];
  for (let i = 0; i < PLAYER_MAX_EN; i++) {
    const s = document.createElement("span");
    s.className = "bt-seg";
    enBar.appendChild(s);
    enSegs.push(s);
  }
  hud.appendChild(hpRow);
  hud.appendChild(hpBar);
  hud.appendChild(enRow);
  hud.appendChild(enBar);
  controls.appendChild(hud);
  battleHud = { hpLabel, hpSegs, crit, hpFill, enLabel, enSegs, enWrap: enBar, enFill };

  // ===== 攻撃カード3つ ＋ ガード/休憩の縦列 を横一列に =====
  const grid = document.createElement("div");
  grid.className = "bt-skills";
  for (const cls of CLASSES) {
    const card = document.createElement("button");
    card.className = `sk-card wclass-${cls}`;
    // 攻撃は指を当てた瞬間（pointerdown）に即反応。押し込み演出は pressFx のまま
    card.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;   // 左クリック／タッチのみ
      e.preventDefault();           // 直後の click 二重発火・フォーカス移動を防ぐ
      attackWith(cls);
    });
    pressFx(card);
    const inst = game.equippedInstance(cls);

    // ヘッダー：系統名＋装備武器のドット絵
    const top = document.createElement("div");
    top.className = "sk-card-top";
    const title = document.createElement("div");
    title.className = "sk-title";
    title.textContent = CLASS_EN[cls];
    const icon = document.createElement("span");
    icon.className = "sk-icon";
    if (inst) icon.appendChild(weaponSpriteEl(inst.baseId, cls, 2));
    top.appendChild(title);
    top.appendChild(icon);
    card.appendChild(top);

    // スキルを「コンボ」として段で表示（クリック毎にフォーカスが切り替わる）
    const wrap = document.createElement("div");
    wrap.className = "sk-steps";
    const steps: HTMLElement[] = [];
    const combo = game.comboSkills(cls);
    if (combo.length === 0) {
      const step = document.createElement("div");
      step.className = "sk-step";
      step.innerHTML = `<span class="sk-step-name">未装備</span>`;
      wrap.appendChild(step);
      steps.push(step);
    } else {
      for (const s of combo) {
        const step = document.createElement("div");
        step.className = "sk-step";
        step.innerHTML =
          `<span class="sk-step-name">${s.name}</span>` +
          `<span class="sk-step-cost">${s.enCost}</span>`;
        wrap.appendChild(step);
        steps.push(step);
      }
    }
    const focus = document.createElement("div");
    focus.className = "sk-focus";
    wrap.appendChild(focus);
    const link = document.createElement("div");
    link.className = "sk-link";
    link.textContent = "⚡連携";
    wrap.appendChild(link);
    card.appendChild(wrap);

    grid.appendChild(card);
    battleCards.push({ card, cls, steps, focus, link, focusIdx: -1 });
  }

  // ガード（上）／休憩（下）を縦に並べた列
  const grCol = document.createElement("div");
  grCol.className = "bt-gr-col";
  const gbtn = document.createElement("button");
  gbtn.className = "bt-act bt-guard";
  gbtn.innerHTML = `<span class="bt-act-ico"></span><span class="bt-act-lbl">GUARD</span>`;
  gbtn.querySelector(".bt-act-ico")?.appendChild(actionIcon(SHIELD));
  gbtn.addEventListener("click", doGuard);
  pressFx(gbtn);
  guardCard = gbtn;
  const rbtn = document.createElement("button");
  rbtn.className = "bt-act bt-rest2";
  rbtn.innerHTML = `<span class="bt-act-ico"></span><span class="bt-act-lbl">REST</span>`;
  rbtn.querySelector(".bt-act-ico")?.appendChild(actionIcon(SLEEP));
  rbtn.addEventListener("click", () => { if (game.battle?.rest()) audio.sfxGuard(); });
  pressFx(rbtn);
  restCard = rbtn;
  grCol.appendChild(gbtn);
  grCol.appendChild(rbtn);
  grid.appendChild(grCol);
  controls.appendChild(grid);

  // ===== COMBAT_LOG バー =====
  const log = document.createElement("div");
  log.className = "bt-log";
  log.innerHTML = `<span class="bt-log-title">COMBAT_LOG_V2</span><span class="bt-log-line"></span>`;
  controls.appendChild(log);
  battleLog = log.querySelector(".bt-log-line") as HTMLElement;

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

/** HP/AP（セグメントバー）を現在値で更新する */
function updateBattleHud(): void {
  if (!battleHud || !game.battle) return;
  const b = game.battle;
  const hp = Math.max(0, Math.ceil(b.playerHp));
  const hpRatio = Math.max(0, Math.min(1, b.playerHp / PLAYER_MAX_HP));
  battleHud.hpLabel.textContent = `HP [${hp}/${PLAYER_MAX_HP}]`;
  // 連続フィルの幅を更新（CSSのtransitionでぬるっと増減）
  battleHud.hpFill.style.width = `${hpRatio * 100}%`;
  battleHud.crit.style.visibility = hpRatio <= 0.25 ? "visible" : "hidden";
  const en = Math.floor(b.playerEn);
  const enRatio = Math.max(0, Math.min(1, b.playerEn / PLAYER_MAX_EN));
  battleHud.enLabel.textContent = `AP [${en}/${PLAYER_MAX_EN}]`;
  battleHud.enFill.style.width = `${enRatio * 100}%`;
  battleHud.enWrap.classList.toggle("focus", b.freeNextEn);
}

/** スキルカード（段＋フォーカス）・GUARD・ログを毎フレーム更新 */
function updateWeaponButtons(): void {
  if (!game.battle) return;
  updateBattleHud();
  const b = game.battle;
  const last = b.lastSkill;
  // 敵の予兆中（!表示）はガードのみ。攻撃カード・休憩は無効化（ターン制）
  const telegraph = b.anyTelegraph;
  for (const entry of battleCards) {
    const { card, cls, steps, focus, link } = entry;
    const active = game.comboIndex(cls);
    const cur = game.currentSkill(cls);
    // 次に出る段を強調
    steps.forEach((step, i) => step.classList.toggle("sk-step-on", i === active));
    // ENが足りなければ無効表示（「集中」発動中は次の消費が0なので有効）。予兆中も無効
    const cost = cur ? (b.freeNextEn ? 0 : cur.enCost) : 0;
    const broke = !cur || b.playerEn < cost;
    card.classList.toggle("disabled", broke || telegraph);
    // 連携候補：直近スキルと次の段で連携が成立し、撃てるなら光らせる
    const combo = cur && !broke && !telegraph ? matchCombo(last, cur, cls) : undefined;
    card.classList.toggle("combo-ready", !!combo);
    // フォーカス枠を次に出る段へ「ぬるっと」移動（位置が変わった時だけ更新）
    const target = steps[active];
    if (target) {
      if (entry.focusIdx !== active) {
        focus.style.transform = `translateY(${target.offsetTop}px)`;
        focus.style.height = `${target.offsetHeight}px`;
        link.style.top = `${target.offsetTop - 9}px`;
        entry.focusIdx = active;
      }
      focus.classList.add("on");
    } else {
      focus.classList.remove("on");
    }
    link.classList.toggle("on", !!combo);
  }
  // GUARD：敵の予兆中は強調。休憩は予兆中は無効
  if (guardCard) guardCard.classList.toggle("guard-now", telegraph);
  if (restCard) restCard.classList.toggle("disabled", telegraph);
  // COMBAT_LOG：直近の味方ログを表示
  if (battleLog) {
    const logs = b.floats.filter((fl) => fl.anchor === "player");
    battleLog.textContent = logs.length ? logs[logs.length - 1].text : "READY";
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
  const endless = game.isEndless;
  const won = game.lastWon;
  const good = won || endless;
  // 他画面と同じ：大きな斜体タイトル＋タグ
  const headTitle = endless ? "RESULT" : (won ? "VICTORY" : "DEFEAT");
  const tag = endless ? `${game.lastFloor}F 到達` : (won ? `STAGE ${game.stageIndex + 1}` : "RETRY?");
  controls.appendChild(screenHead(headTitle, tag, won ? "r-win" : endless ? "r-win" : "r-lose"));

  const panel = document.createElement("div");
  panel.className = "result-panel " + (good ? "result-win" : "result-lose");

  // 見出し詳細
  const sub = document.createElement("div");
  sub.className = "result-sub";
  if (endless) sub.textContent = `最高到達 ${game.save.bestFloor} 階 ・ 入手宝箱 ${game.lastDrops.length} 個`;
  else if (won) sub.textContent = game.lastDrops.length > 0 ? `🎁 入手した宝箱 ${game.lastDrops.length} 個` : "入手した武器はありませんでした";
  else sub.textContent = "倒れてしまった…… 装備を見直して再挑戦しよう";
  panel.appendChild(sub);

  // ゴールド・ドロップ（勝利／回廊時）
  if (good) {
    const goldLine = document.createElement("div");
    goldLine.className = "result-gold";
    goldLine.innerHTML =
      `<span class="gold-amt">+${game.lastGold.toLocaleString()}</span><span class="gold-unit">G</span>` +
      `<span class="result-gold-total">（所持 ${game.gold.toLocaleString()} G）</span>`;
    panel.appendChild(goldLine);
    if (game.lastDrops.length > 0) panel.appendChild(buildChestReveal(game.lastDrops));
  }

  // アクション
  const actions = document.createElement("div");
  actions.className = "actions";
  if (!won) actions.appendChild(primaryButton("もう一度", () => withFade(() => game.retryStage())));
  const hasNext = won && game.stageIndex + 1 < STAGE_COUNT && game.stageUnlocked(game.stageIndex + 1);
  if (hasNext) actions.appendChild(primaryButton("次のステージへ", () => withFade(() => game.startStage(game.stageIndex + 1))));
  actions.appendChild(secondaryButton("ダンジョン選択", () => { game.goStageSelect(); buildControls(); }));
  actions.appendChild(secondaryButton("インベントリ", () => { game.goInventory(); buildControls(); }));
  panel.appendChild(actions);
  controls.appendChild(panel);
}

// ===== UI部品 =====
// ===== チュートリアル（遊び方） =====
/** 遊び方の1セクション（番号付き見出し＋本文ノード） */
function howSection(no: string, title: string, body: HTMLElement): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "howto-sec";
  const head = document.createElement("div");
  head.className = "howto-sec-head";
  head.innerHTML = `<span class="howto-sec-no">${no}</span><span class="howto-sec-title">${title}</span>`;
  sec.appendChild(head);
  body.classList.add("howto-sec-body");
  sec.appendChild(body);
  return sec;
}

/** アイコン＋見出し＋説明の1ステップ行 */
function howStep(icon: string, label: string, desc: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "howto-step";
  row.innerHTML =
    `<span class="howto-step-ico">${icon}</span>` +
    `<span class="howto-step-text"><b class="howto-step-lbl">${label}</b>` +
    `<span class="howto-step-desc">${desc}</span></span>`;
  return row;
}

/** プレーンな説明段落 */
function howText(html: string): HTMLElement {
  const p = document.createElement("div");
  p.className = "howto-text";
  p.innerHTML = html;
  return p;
}

function buildHowTo(): void {
  controls.appendChild(screenHead("HOW TO PLAY", "📖 SCREEN_00", "howto-title"));

  controls.appendChild(howText(
    "<b>ASTRAL WARDEN</b> はターン制のタイミングアクションRPG。" +
    "弱点を突いて攻撃し、敵の合図に合わせてガードしながら戦い抜こう。",
  ));

  // 1. 戦闘の流れ
  const flow = document.createElement("div");
  flow.appendChild(howStep("⚔", "自分のターン：攻撃する", "武器カードをタップしてスキルを発動。武器は斬撃・刺突・打撃の3系統を切り替えて使える。"));
  flow.appendChild(howStep("❗", "敵の予兆：ガードする", "敵に「！」が出たら攻撃の合図。このあいだは<b>ガードしかできない</b>（ターン制）。"));
  flow.appendChild(howStep("🛡", "受け切って反撃へ", "ガードが成功したら、また自分のターン。これを繰り返して敵を倒す。"));
  controls.appendChild(howSection("01", "戦闘の流れ", flow));

  // 2. 弱点（3すくみ）
  const weak = document.createElement("div");
  weak.appendChild(howText(`武器の系統には得意な相手がいる。弱点を突くとダメージ<b>×${WEAKNESS_MULTIPLIER}</b>！`));
  const triangle = document.createElement("div");
  triangle.className = "howto-weak";
  // WEAKNESS は「敵種 → 弱点の武器系統」。表示は「武器系統 → 強い敵種」に並べ替える
  (["slash", "pierce", "crush"] as WeaponClass[]).forEach((cls) => {
    const kind = (Object.keys(WEAKNESS) as EnemyKind[]).find((k) => WEAKNESS[k] === cls)!;
    const row = document.createElement("div");
    row.className = "howto-weak-row";
    const left = document.createElement("span");
    left.className = "howto-weak-cls";
    left.innerHTML = `${WEAPON_ICON[cls]} ${WEAPON_LABEL[cls]}`;
    const arrow = document.createElement("span");
    arrow.className = "howto-weak-arrow";
    arrow.textContent = "→";
    const right = document.createElement("span");
    right.className = "howto-weak-enemy";
    const spr = makeSpriteCanvas(KIND_SPRITE[kind], 3);
    right.appendChild(spr);
    const enLbl = document.createElement("span");
    enLbl.textContent = KIND_LABEL[kind];
    right.appendChild(enLbl);
    row.appendChild(left);
    row.appendChild(arrow);
    row.appendChild(right);
    triangle.appendChild(row);
  });
  weak.appendChild(triangle);
  weak.appendChild(howText("敵カード（または画面左右の矢印）をタップして<b>狙う相手を選択</b>できる。"));
  controls.appendChild(howSection("02", "弱点を突く", weak));

  // 3. AP（スキルコスト）と休憩
  const ap = document.createElement("div");
  ap.appendChild(howStep("✦", `AP（最大${PLAYER_MAX_EN}）`, "スキルの発動にはAPを消費する。強力なスキルほど多く必要。"));
  ap.appendChild(howStep("💤", "REST（休憩）", `攻撃せずに休むと AP が <b>+${REST_EN_RECOVER}</b> 回復。AP切れになる前に休もう（休憩中も敵は動く）。`));
  controls.appendChild(howSection("03", "APとスキル", ap));

  // 4. ガードのタイミング
  const guard = document.createElement("div");
  guard.appendChild(howText("ガードは<b>タイミング</b>で結果が変わる。引きつけるほど見返りが大きい。"));
  guard.appendChild(howStep("✨", "PERFECT（直前）", `被ダメージ0、HP <b>+${PERFECT_HP_RECOVER}</b>・AP <b>+${PERFECT_EN_RECOVER}</b> 回復し、敵をひるませる。`));
  guard.appendChild(howStep("⭐", "JUST（早め）", "被ダメージを大きく軽減しAPも少し回復。"));
  guard.appendChild(howStep("🛡", "GUARD（通常）", "被ダメージを軽減。タイミングを逃しても守りにはなる。"));
  controls.appendChild(howSection("04", "ガードのコツ", guard));

  // 5. ブレイク
  const brk = document.createElement("div");
  brk.appendChild(howText(
    "敵には体力ゲージの下に<b>ブレイクゲージ</b>がある。攻撃で削り切ると<b>ブレイク状態</b>になり、" +
    "大きな隙ができて与ダメージが伸びる。パーフェクトガードもブレイクを蓄積させる。",
  ));
  controls.appendChild(howSection("05", "ブレイク", brk));

  // 6. 連携技
  const combo = document.createElement("div");
  combo.appendChild(howText("特定のスキルを<b>続けて</b>出すと<span class='howto-gold'>連携技</span>が発動し、追撃が入る。"));
  const clist = document.createElement("div");
  clist.className = "howto-combo-list";
  for (const c of COMBOS) {
    const item = document.createElement("div");
    item.className = "howto-combo";
    item.innerHTML =
      `<span class="howto-combo-name">${c.name}</span>` +
      `<span class="howto-combo-desc">${c.desc}</span>`;
    clist.appendChild(item);
  }
  combo.appendChild(clist);
  controls.appendChild(howSection("06", "連携技", combo));

  // 7. レアモンスター
  const rare = document.createElement("div");
  rare.appendChild(howText(
    "ときどき<span class='howto-gold'>煌びやかなレアモンスター</span>が出現する。手強いが、" +
    "倒すと<b>レア武器</b>を確実に落とす。見かけたら積極的に狙おう。",
  ));
  controls.appendChild(howSection("07", "レアモンスター", rare));

  // 8. 育成
  const grow = document.createElement("div");
  grow.appendChild(howStep("🎒", "インベントリ", "手に入れた武器を確認・装備。系統ごとに1本ずつ装備できる。"));
  grow.appendChild(howStep("🔨", "鍛冶屋", "余った武器を素材にしてレベルアップ。上限に達したら同じ武器で「覚醒」して限界突破。"));
  grow.appendChild(howStep("🛒", "ショップ", "ゴールドで武器や宝箱を購入。宝箱からはレアリティ帯のランダム武器が出る。"));
  controls.appendChild(howSection("08", "武器を育てる", grow));

  // 9. 操作（キーボード）
  const keys = document.createElement("div");
  keys.className = "howto-keys";
  const kmap: [string, string][] = [
    ["1 / 2 / 3", "斬撃 / 刺突 / 打撃で攻撃"],
    ["Space", "ガード"],
    ["R", "休憩（AP回復）"],
    ["T", "ターゲット切替"],
  ];
  for (const [k, d] of kmap) {
    const row = document.createElement("div");
    row.className = "howto-key-row";
    row.innerHTML = `<kbd class="howto-key">${k}</kbd><span class="howto-key-desc">${d}</span>`;
    keys.appendChild(row);
  }
  controls.appendChild(howSection("09", "キーボード操作（PC）", keys));

  // 出発ボタン
  const go = bigButton("▶ 冒険に出る", () => { game.goStageSelect(); buildControls(); });
  go.classList.add("howto-go");
  controls.appendChild(go);

  controls.appendChild(bottomNav());
}

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
    if (e.key === "r") { if (game.battle.rest()) audio.sfxGuard(); return; }
    if (e.key === "t") { cycleTarget(1); return; }
    const map: Record<string, WeaponClass> = { "1": "slash", "2": "pierce", "3": "crush" };
    if (map[e.key]) attackWith(map[e.key]);
  }
});

// ===== メインループ =====
/** 全体のゲームスピード（1未満で全体的にゆったり動く） */
const GAME_SPEED = 0.8;
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(50, now - last) * GAME_SPEED;
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

  // ウェーブが切り替わった（新しい戦闘に入れ替わった）瞬間は黒からぬるっと明転
  if (game.screen === "battle" && game.battle && game.battle !== lastBattleRef) {
    lastBattleRef = game.battle;
    fadeInBattle();
  }

  // バトル枠（canvas）は戦闘中のみ描画
  if (game.screen === "battle" && game.battle) {
    updateWeaponButtons();
    render(ctx, game.battle, {
      index: game.stageIndex, count: STAGE_COUNT,
      wave: game.waveIndex, waves: game.waveCount, boss: game.isBossWave,
      floor: game.isEndless ? game.endlessFloor : undefined,
    });
  }
  requestAnimationFrame(loop);
}

buildControls();
requestAnimationFrame(loop);
