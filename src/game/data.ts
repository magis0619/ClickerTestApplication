import type {
  Skill, EnemyDef, WeaponClass, EnemyKind, Weapon, Rarity, WeaponInstance, StageDef, SkillKind,
  LastSkill, ComboDef, ShopItem, ShopChest,
} from "./types.ts";
import weaponsJson from "./weapons.json";
import skillsJson from "./skills.json";
import enemiesJson from "./enemies.json";
import stagesJson from "./stages.json";

// ===== 表示名・相性 =====
export const WEAPON_LABEL: Record<WeaponClass, string> = { slash: "斬撃", pierce: "刺突", crush: "打撃" };
export const KIND_LABEL: Record<EnemyKind, string> = { carapace: "甲殻種", phantom: "霊体種", aerial: "飛翔種" };
export const WEAKNESS: Record<EnemyKind, WeaponClass> = { carapace: "crush", phantom: "slash", aerial: "pierce" };
export const WEAKNESS_MULTIPLIER = 1.8;

// ===== レアリティ =====
export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legend", "astral"];
export const RARITY_LABEL: Record<Rarity, string> = {
  common: "コモン", uncommon: "アンコモン", rare: "レア", epic: "エピック", legend: "レジェンド", astral: "アストラル",
};
/** レアリティ色。common=グレー / uncommon=エメラルド / rare=ブルー / epic=パープル / legend=ゴールド / astral=虹色 */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#b8b8c8", uncommon: "#2ecc71", rare: "#4aa3ff", epic: "#b96bff", legend: "#ffcf3f", astral: "#ff7de9",
};
/** アストラルは単色でなく虹色で表現する */
export function isRainbowRarity(r: Rarity): boolean { return r === "astral"; }
function rarityIndex(r: Rarity): number { return RARITY_ORDER.indexOf(r); }

export const CHARGE_MULT = 2.3;
/** 会心ダメージの既定倍率 */
export const CRIT_MULT_DEFAULT = 1.5;

// ===== スキル（skills.json から読み込み。攻撃力は持たず「やり方」のみ） =====
interface RawSkill {
  id: string; name: string; rarity: Rarity; enCost: number; kind: SkillKind;
  hits?: number; targets?: number; critAdd?: number; critMult?: number; breakMult?: number;
}
export const SKILLS: Skill[] = (skillsJson as RawSkill[]).map((s) => ({
  id: s.id, name: s.name, rarity: s.rarity, enCost: s.enCost, kind: s.kind,
  hits: s.hits ?? 1, targets: s.targets ?? 1,
  critAdd: s.critAdd ?? 0, critMult: s.critMult ?? CRIT_MULT_DEFAULT, breakMult: s.breakMult ?? 1,
}));
const SKILL_MAP: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export function getSkill(id: string): Skill { return SKILL_MAP[id]; }

export const SKILL_KIND_LABEL: Record<SkillKind, string> = {
  attack: "攻撃", charge: "ためる", focus: "集中",
};

/** スキルが何をするかの説明文 */
export function skillDescription(s: Skill): string {
  if (s.kind === "charge") return `次に当てる攻撃の威力を${CHARGE_MULT}倍にする`;
  if (s.kind === "focus") return "次のターンのEN消費をなくす";
  const parts: string[] = [];
  parts.push(s.targets > 1 ? `${s.targets}体に` : "1体に");
  parts.push(s.hits > 1 ? `${s.hits}回攻撃` : "攻撃");
  if (s.critAdd) parts.push(`会心率+${s.critAdd}%`);
  if (s.critMult !== CRIT_MULT_DEFAULT) parts.push(`会心${s.critMult}倍`);
  if (s.breakMult !== 1) parts.push(`ブレイク${s.breakMult}倍`);
  return parts.join("・");
}

// ===== スキル連携（連携技：a→bの順で発動すると追撃が発生する） =====
// スキルは抽選でランダムに入手するため、連携は「スキル種類」で定義して
// どんな武器構成でも成立しうるようにする。
export const COMBOS: ComboDef[] = [
  { id: "smite",  name: "連携・渾身", first: "charge", second: "attack", bonusHits: 1, desc: "ためる → 攻撃 で追撃1" },
  { id: "ambush", name: "連携・奇襲", first: "focus",  second: "attack", bonusHits: 2, desc: "集中 → 攻撃 で追撃2" },
  { id: "rush",   name: "連携・連撃", first: "attack", second: "attack", diffClass: true, bonusHits: 1, desc: "別系統の攻撃を続けて追撃1" },
];

/** 直近スキル(last)と今出すスキル(kind/cls)で成立する連携を返す（なければ undefined） */
export function matchCombo(last: LastSkill | null, kind: SkillKind, cls: WeaponClass): ComboDef | undefined {
  if (!last) return undefined;
  return COMBOS.find((c) =>
    c.first === last.kind && c.second === kind && (!c.diffClass || last.cls !== cls));
}

// ===== 武器テンプレート（weapons.json から読み込み） =====
interface RawWeapon {
  id?: string; name: string; weapon: WeaponClass; rarity: Rarity;
  attack: number; critChance?: number; breakPower?: number; desc?: string;
}
export const WEAPONS: Weapon[] = (weaponsJson as RawWeapon[]).map((w, i) => ({
  id: w.id ?? `w_${i}`, name: w.name, weapon: w.weapon, rarity: w.rarity,
  attack: w.attack, critChance: w.critChance ?? 0, breakPower: w.breakPower ?? 0, desc: w.desc ?? "",
}));
export function getWeapon(id: string): Weapon | undefined { return WEAPONS.find((w) => w.id === id); }

// ===== 武器インスタンス生成・スキル抽選 =====
/** レアリティごとのスキル数：コモン〜レア=1、エピック以上=2 */
export function skillCountForRarity(r: Rarity): number {
  return rarityIndex(r) >= rarityIndex("epic") ? 2 : 1;
}
/** スキル抽選の重み（低レアほど出やすい。高レアは大幅に出にくい） */
const SKILL_DRAW_WEIGHT: Record<Rarity, number> = {
  common: 100, uncommon: 38, rare: 12, epic: 1.6, legend: 0.4, astral: 0.12,
};
/** 武器レアリティ以下のスキルから、低レア寄りの重みで count 個（重複なし）抽選 */
export function rollSkills(weaponRarity: Rarity, count: number): string[] {
  const max = rarityIndex(weaponRarity);
  const pool = SKILLS.filter((s) => rarityIndex(s.rarity) <= max);
  const out: Skill[] = [];
  for (let i = 0; i < count; i++) {
    const avail = pool.filter((s) => !out.includes(s));
    if (avail.length === 0) break;
    const total = avail.reduce((a, s) => a + SKILL_DRAW_WEIGHT[s.rarity], 0);
    let r = Math.random() * total;
    let pick = avail[0];
    for (const s of avail) { r -= SKILL_DRAW_WEIGHT[s.rarity]; if (r < 0) { pick = s; break; } }
    out.push(pick);
  }
  return out.map((s) => s.id);
}

let uidCounter = 0;
function newUid(): string {
  uidCounter += 1;
  return `wi_${Date.now().toString(36)}_${uidCounter}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
/** 武器を1本生成（レアリティに応じてスキルを抽選して付与） */
export function makeInstance(baseId: string): WeaponInstance {
  const w = getWeapon(baseId);
  const skillIds = w ? rollSkills(w.rarity, skillCountForRarity(w.rarity)) : [];
  return { uid: newUid(), baseId, skillIds, level: 1, exp: 0, awakened: 0 };
}

/** 武器ドロップ率の全体倍率（少し下げる） */
const DROP_RATE_MULT = 0.85;
/** レアリティが高い武器ほどドロップ率を下げる倍率。高レアは大幅に絞る（エピックで実効約10%） */
const RARITY_DROP_MULT: Record<Rarity, number> = {
  common: 1.0, uncommon: 0.95, rare: 0.8, epic: 0.5, legend: 0.2, astral: 0.1,
};

/** 敵の撃破ドロップを判定（率で外れあり。高レア武器ほど出にくい） */
export function rollEnemyDrop(def: EnemyDef): WeaponInstance | undefined {
  if (!def.dropWeaponId || !def.dropRate) return undefined;
  const w = getWeapon(def.dropWeaponId);
  const rmult = w ? RARITY_DROP_MULT[w.rarity] : 1;
  const eff = def.dropRate * DROP_RATE_MULT * rmult;
  if (Math.random() * 100 >= eff) return undefined;
  return makeInstance(def.dropWeaponId);
}

/** 敵が落とすゴールド。強い敵（HP・攻撃力が高い／ボス）ほど多い。±10%のゆらぎ */
export function rollEnemyGold(def: EnemyDef): number {
  const base = def.maxHp * 0.4 + def.attack * 2;
  const boss = def.boss ? 1.8 : 1;
  const jitter = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(base * boss * jitter));
}

// ===== ショップ（ゴールドで武器を購入） =====
/** ショップの品揃え。購入時はレアリティに応じてスキルが抽選される */
export const SHOP_ITEMS: ShopItem[] = [
  { baseId: "w_iron_edge",     price: 120 },
  { baseId: "w_steel_lance",   price: 120 },
  { baseId: "w_war_mallet",    price: 140 },
  { baseId: "w_shadow_blade",  price: 240 },
  { baseId: "w_stone_mace",    price: 200 },
  { baseId: "w_wind_pike",     price: 280 },
  { baseId: "w_storm_saber",   price: 560 },
  { baseId: "w_ice_needle",    price: 560 },
  { baseId: "w_quake_hammer",  price: 560 },
  { baseId: "w_dragoon_blade", price: 1500 },
  { baseId: "w_thunder_spear", price: 1200 },
  { baseId: "w_earth_crusher", price: 1500 },
  { baseId: "w_flame_sword",   price: 3200 },
  { baseId: "w_void_glaive",   price: 3400 },
  { baseId: "w_mjolnir",       price: 4000 },
];

// ===== ショップ：宝箱（購入＝即開封。レアリティ帯の武器がランダムで出る） =====
export const SHOP_CHESTS: ShopChest[] = [
  { id: "chest_common",   name: "なめし革の宝箱", rarity: "common",   price: 100 },
  { id: "chest_uncommon", name: "青銅の宝箱",     rarity: "uncommon", price: 260 },
  { id: "chest_rare",     name: "白銀の宝箱",     rarity: "rare",     price: 620 },
  { id: "chest_epic",     name: "魔晶の宝箱",     rarity: "epic",     price: 1400 },
  { id: "chest_legend",   name: "黄金の宝箱",     rarity: "legend",   price: 3000 },
  { id: "chest_astral",   name: "星辰の宝箱",     rarity: "astral",   price: 6000 },
];

/** 指定レアリティ帯の武器を1本ランダムに引く（該当が無ければ近いレアリティで代替） */
export function rollChestWeapon(rarity: Rarity): WeaponInstance {
  let pool = WEAPONS.filter((w) => w.rarity === rarity);
  // 該当レアリティが無ければ、低い方へ繰り下げて探す
  for (let r = rarityIndex(rarity) - 1; pool.length === 0 && r >= 0; r--) {
    pool = WEAPONS.filter((w) => w.rarity === RARITY_ORDER[r]);
  }
  if (pool.length === 0) pool = WEAPONS.slice();
  const w = pool[Math.floor(Math.random() * pool.length)];
  return makeInstance(w.id);
}

// ===== 武器の強化（鍛冶屋）：レベル・経験値・覚醒 =====
/** 10レベルごとに「覚醒」の壁。覚醒回数の上限 */
export const AWAKEN_STEP = 10;
export const MAX_AWAKEN = 5;
/** 覚醒回数から現在のレベル上限を求める（覚醒0=10, 1=20, …, 5=60） */
export function levelCap(awakened: number): number {
  return (Math.min(MAX_AWAKEN, awakened) + 1) * AWAKEN_STEP;
}
/** 次の覚醒に必要な「同一武器」の素材数（1,2,3,4,5本） */
export function awakenCost(awakened: number): number {
  return Math.min(MAX_AWAKEN, awakened) + 1;
}

/** レベルL→L+1 に必要な経験値（レアリティが高いほど多く要る） */
const EXP_BASE: Record<Rarity, number> = {
  common: 50, uncommon: 90, rare: 150, epic: 260, legend: 420, astral: 640,
};
export function expForNext(rarity: Rarity, level: number): number {
  return Math.round(EXP_BASE[rarity] * (1 + (level - 1) * 0.45));
}

/** 素材にしたときに与える経験値（レアリティ基準＋これまでの強化分を一部還元） */
const MATERIAL_EXP: Record<Rarity, number> = {
  common: 35, uncommon: 70, rare: 130, epic: 240, legend: 420, astral: 700,
};
export function materialExp(inst: WeaponInstance): number {
  const w = getWeapon(inst.baseId);
  if (!w) return 0;
  const base = MATERIAL_EXP[w.rarity];
  const lvBonus = ((inst.level ?? 1) - 1) * Math.round(base * 0.15);
  const awBonus = (inst.awakened ?? 0) * base;
  return base + lvBonus + awBonus;
}

/** レベル・覚醒を反映した実効ステータス（攻撃・ブレイク・会心が伸びる） */
export function effectiveWeapon(inst: WeaponInstance): Weapon | undefined {
  const w = getWeapon(inst.baseId);
  if (!w) return undefined;
  const lv = inst.level ?? 1;
  const aw = inst.awakened ?? 0;
  const lvMult = 1 + (lv - 1) * 0.06; // 1レベルごとに基礎の+6%
  const awMult = 1 + aw * 0.10;       // 覚醒ごとに+10%
  return {
    ...w,
    attack: Math.round(w.attack * lvMult * awMult),
    breakPower: Math.round(w.breakPower * lvMult * awMult),
    critChance: w.critChance + aw * 2,
  };
}

// ===== 敵（enemies.json から読み込み） =====
interface RawEnemy {
  id: string; name: string; kind: EnemyKind; maxHp: number; attack: number;
  telegraphMs: number; countStart: number; breakThreshold: number;
  dropWeaponId?: string; dropRate?: number; boss?: boolean;
}
const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(
  (enemiesJson as RawEnemy[]).map((e) => [e.id, e as EnemyDef]),
);
export function getEnemy(id: string): EnemyDef | undefined { return ENEMY_MAP[id]; }

// ===== ステージ（stages.json から読み込み） =====
interface RawStage { name: string; desc: string; waves: string[][]; endless?: boolean; recommendLv?: number; }
export const STAGES: StageDef[] = (stagesJson as RawStage[]).map((s) => ({
  name: s.name,
  desc: s.desc,
  waves: s.waves.map((wave) => wave.map((id) => ENEMY_MAP[id]).filter(Boolean)),
  endless: s.endless,
  recommendLv: s.recommendLv,
}));
export const STAGE_COUNT = STAGES.length;

/** 選択画面で見せる「ドロップしうる武器」一覧（重複なし） */
export function stageDropPreview(stageIndex: number): string[] {
  const st = STAGES[stageIndex];
  if (!st) return [];
  if (st.endless) return ["w_mjolnir", "w_void_glaive", "w_flame_sword", "w_astral_edge", "w_earth_crusher", "w_thunder_spear"];
  const ids: string[] = [];
  for (const wave of st.waves) {
    for (const e of wave) if (e.dropWeaponId && !ids.includes(e.dropWeaponId)) ids.push(e.dropWeaponId);
  }
  return ids;
}

// ===== 無限の回廊：階層ごとにランダムな敵を生成（階が深いほど強い） =====
const ENDLESS_POOL = [
  "sand_crab", "bone_ghost", "sky_moth",
  "shell_crawler", "wraith_feather", "gloom_shade", "venom_lurker",
  "mud_beetle", "shadow_lurker", "thunder_hawk",
  "ember_hound", "stone_sentinel", "ice_crawler", "frost_drake", "frost_imp",
  "iron_tortoise", "vile_specter", "storm_wyvern",
];
const ENDLESS_BOSSES = [
  "shell_warden", "wraith_monarch", "carapace_tyrant", "frost_dragon", "shadow_tyrant",
];
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** floor階の敵編成を生成。5階ごとにボス。HP/攻撃/Breakを階層で強化 */
export function endlessFloorEnemies(floor: number): EnemyDef[] {
  const scale = 1 + (floor - 1) * 0.13;
  const buff = (id: string): EnemyDef => {
    const b = ENEMY_MAP[id];
    return {
      ...b,
      maxHp: Math.round(b.maxHp * scale),
      attack: Math.round(b.attack * scale),
      breakThreshold: Math.round(b.breakThreshold * scale),
    };
  };
  if (floor % 5 === 0) return [buff(pick(ENDLESS_BOSSES))];
  const count = floor < 3 ? 1 : floor < 7 ? 2 : 3;
  return Array.from({ length: count }, () => buff(pick(ENDLESS_POOL)));
}

// ===== プレイヤー =====
export const PLAYER_MAX_HP = 130;
// ENは最大10のシンプルな管理に。スキルコストは1〜10。
export const PLAYER_MAX_EN = 10;

// ===== EN回復（自動回復なし。休憩・ガード成功のみ） =====
export const REST_EN_RECOVER = 3;
// 通常ガードはわずか、JUSTは中程度、パーフェクトが大きく報われる。
export const GUARD_EN_RECOVER = 1;
export const JUST_EN_RECOVER = 3;
export const PERFECT_EN_RECOVER = 6;

// ===== ガード判定の窓 =====
// 着弾までの残り時間がこの範囲ならガード成立。
// PERFECT は着弾ギリギリ（手応えのある狭さ）、その少し手前がJUST、さらに手前が通常ガード。
export const PERFECT_WINDOW_MS = 140;
export const JUST_WINDOW_MS = 240;
export const GUARD_WINDOW_MS = 430;

// ===== ガード効果 =====
// 通常ガードは「軽減はするが地味」。JUSTは中間。パーフェクトは「完全無効＋HP/EN大回復」。
export const GUARD_DAMAGE_MULT = 0.55;
export const JUST_DAMAGE_MULT = 0.25;
export const PERFECT_HP_RECOVER = 18;

// ===== パーフェクトガードの演出・怯ませ =====
/** パーフェクト成功時のヒットストップ（完全静止）時間 */
export const HITSTOP_MS = 150;
/** 通常ヒット時の軽いヒットストップ（0.05秒の手応え） */
export const HIT_HITSTOP_MS = 50;
/** ヒットストップ後のスローモーション時間（パーフェクトの余韻を長く） */
export const SLOWMO_MS = 1040;
/** スローモーション中の時間倍率（小さいほど遅い） */
export const SLOWMO_SCALE = 0.3;
/** パーフェクト時の画面ホワイトアウト時間 */
export const WHITE_FLASH_MS = 240;
/** パーフェクトで敵に与える怯み（次の攻撃を遅らせる）時間 */
export const PERFECT_FLINCH_MS = 650;
/** パーフェクトで敵のブレイクゲージに加算する蓄積量 */
export const PERFECT_BREAK_BONUS = 14;

/**
 * 攻撃の「溜め」時間(ms)。攻撃ボタンを押してから実際に着弾するまでのラグ。
 * この間プレイヤーは構えモーションを取り、ダメージ・敵カウント進行は着弾時に発生する。
 */
export const ATTACK_WINDUP_MS = 380;

/** スキル名バナー（発動時にプレイヤー右へ左からフェードイン）の表示時間(ms) */
export const SKILL_BANNER_MS = 1100;

// ===== 演出の表示時間（発動した表記を1秒ほど画面に残す） =====
/** ダメージ・連携・回復などの浮遊テキストの寿命(ms) */
export const FLOAT_TTL = 1300;
/** ダメージ数値（爆発表記）の寿命(ms)。長めに残して手応えを出す */
export const DAMAGE_TTL = 2100;
/** 浮遊テキスト/バッジが消える直前のフェード時間(ms)。これより前は不透明で読みやすい */
export const FLOAT_FADE_MS = 400;
/** PERFECT/JUST/GUARD バッジの表示時間(ms) */
export const GUARD_BADGE_MS = 1100;

// ===== ブレイク =====
// ブレイクは「ターン制」。この間プレイヤーはENを消費せず行動でき、敵は攻撃しない。
export const BREAK_TURNS = 3;
export const BREAK_CRIT_MULT = 1.6;

/** 初期インベントリ（各系統の先頭武器を1本ずつ。武器リスト変更にも追従） */
export function starterInventory(): WeaponInstance[] {
  const out: WeaponInstance[] = [];
  for (const cls of ["slash", "pierce", "crush"] as WeaponClass[]) {
    const w = WEAPONS.find((x) => x.weapon === cls);
    if (w) out.push(makeInstance(w.id));
  }
  return out;
}
