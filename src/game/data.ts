import type {
  Skill, EnemyDef, WeaponClass, EnemyKind, Weapon, Rarity, WeaponInstance, StageDef, SkillKind,
  LastSkill, ComboDef, ShopItem,
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
/** スキル抽選の重み（低レアほど出やすい） */
const SKILL_DRAW_WEIGHT: Record<Rarity, number> = {
  common: 100, uncommon: 55, rare: 30, epic: 16, legend: 8, astral: 4,
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
  return { uid: newUid(), baseId, skillIds };
}

/** 敵の撃破ドロップを判定（率で外れあり） */
export function rollEnemyDrop(def: EnemyDef): WeaponInstance | undefined {
  if (!def.dropWeaponId || !def.dropRate) return undefined;
  if (Math.random() * 100 >= def.dropRate) return undefined;
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
/** ヒットストップ後のスローモーション時間 */
export const SLOWMO_MS = 520;
/** スローモーション中の時間倍率（小さいほど遅い） */
export const SLOWMO_SCALE = 0.3;
/** パーフェクト時の画面ホワイトアウト時間 */
export const WHITE_FLASH_MS = 240;
/** パーフェクトで敵に与える怯み（次の攻撃を遅らせる）時間 */
export const PERFECT_FLINCH_MS = 650;
/** パーフェクトで敵のブレイクゲージに加算する蓄積量 */
export const PERFECT_BREAK_BONUS = 14;

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
