import type {
  Skill, EnemyDef, WeaponClass, EnemyKind, Weapon, Rarity, WeaponInstance, StageDef, SkillKind,
} from "./types.ts";
import weaponsJson from "./weapons.json";
import skillsJson from "./skills.json";

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

// ===== 敵 =====
const E: Record<string, EnemyDef> = {
  // countStart で攻撃リズムを、dropWeaponId/dropRate でドロップを設定
  straw_golem: { id: "straw_golem", name: "ストローゴーレム", kind: "carapace", maxHp: 80, attack: 10, telegraphMs: 1300, countStart: 3, breakThreshold: 35, dropWeaponId: "w_iron_edge", dropRate: 70 },
  shell_crawler: { id: "shell_crawler", name: "シェルクローラー", kind: "carapace", maxHp: 130, attack: 16, telegraphMs: 1150, countStart: 5, breakThreshold: 45, dropWeaponId: "w_quake_hammer", dropRate: 45 },
  wraith_feather: { id: "wraith_feather", name: "レイスフェザー", kind: "aerial", maxHp: 150, attack: 19, telegraphMs: 1000, countStart: 4, breakThreshold: 52, dropWeaponId: "w_wind_pike", dropRate: 50 },
  gloom_shade: { id: "gloom_shade", name: "グルームシェイド", kind: "phantom", maxHp: 170, attack: 22, telegraphMs: 950, countStart: 2, breakThreshold: 58, dropWeaponId: "w_storm_saber", dropRate: 45 },
  carapace_tyrant: { id: "carapace_tyrant", name: "カラペイス・タイラント", kind: "carapace", maxHp: 480, attack: 32, telegraphMs: 820, countStart: 3, breakThreshold: 100, boss: true, dropWeaponId: "w_astral_edge", dropRate: 100 },
};

// ===== ステージ（3つ） =====
export const STAGES: StageDef[] = [
  {
    name: "練習の間",
    desc: "チュートリアル。弱い敵1体。攻撃・ガード・休憩を試そう",
    enemies: [E.straw_golem],
  },
  {
    name: "双影の回廊",
    desc: "弱点の異なる敵が2体。武器の使い分けを意識",
    enemies: [E.wraith_feather, E.gloom_shade],
  },
  {
    name: "獣王の広間",
    desc: "ボスを含む強敵3体。総力戦",
    enemies: [E.carapace_tyrant, E.wraith_feather, E.gloom_shade],
  },
];
export const STAGE_COUNT = STAGES.length;

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
