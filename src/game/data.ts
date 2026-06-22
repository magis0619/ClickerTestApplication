import type {
  Skill, EnemyDef, WeaponClass, EnemyKind, Weapon, Rarity, WeaponInstance, StageDef, SkillKind, Passive,
} from "./types.ts";

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

// ===== スキル =====
function skill(s: Partial<Skill> & Pick<Skill, "id" | "name" | "weapon" | "kind" | "enCost">): Skill {
  return { power: 0, breakPower: 0, heal: 0, ...s };
}

// EN最大10に合わせ、各スキルのコストは 1〜10 に収める
export const SKILLS: Skill[] = [
  // 斬撃
  skill({ id: "edge_slash", name: "エッジスラッシュ", weapon: "slash", kind: "attack", enCost: 3, power: 15, breakPower: 10 }),
  skill({ id: "cross_edge", name: "クロスエッジ（全体）", weapon: "slash", kind: "aoe", enCost: 6, power: 16, breakPower: 9 }),
  skill({ id: "quick_slash", name: "クイックスラッシュ", weapon: "slash", kind: "attack", enCost: 2, power: 11, breakPower: 8 }),
  skill({ id: "mend_edge", name: "メンドエッジ（回復）", weapon: "slash", kind: "heal", enCost: 5, heal: 32 }),
  skill({ id: "heavy_slash", name: "ヘヴィスラッシュ", weapon: "slash", kind: "attack", enCost: 5, power: 30, breakPower: 14 }),
  // 刺突
  skill({ id: "lance_thrust", name: "ランススラスト", weapon: "pierce", kind: "attack", enCost: 3, power: 14, breakPower: 9 }),
  skill({ id: "pierce_combo", name: "ピアスコンボ", weapon: "pierce", kind: "attack", enCost: 4, power: 21, breakPower: 12 }),
  skill({ id: "wind_thrust", name: "ウィンドスラスト", weapon: "pierce", kind: "attack", enCost: 3, power: 12, breakPower: 17 }),
  skill({ id: "gale_pierce", name: "ゲイルピアス（全体）", weapon: "pierce", kind: "aoe", enCost: 6, power: 14, breakPower: 15 }),
  skill({ id: "void_thrust", name: "ヴォイドスラスト", weapon: "pierce", kind: "attack", enCost: 5, power: 28, breakPower: 14 }),
  // 打撃
  skill({ id: "mallet_smash", name: "マレットスマッシュ", weapon: "crush", kind: "attack", enCost: 3, power: 16, breakPower: 20 }),
  skill({ id: "hammer_blow", name: "ハンマーブロウ", weapon: "crush", kind: "attack", enCost: 4, power: 18, breakPower: 24 }),
  skill({ id: "quake_aoe", name: "クエイクウェイブ（全体）", weapon: "crush", kind: "aoe", enCost: 7, power: 18, breakPower: 20 }),
  skill({ id: "titan_smash", name: "タイタンスマッシュ", weapon: "crush", kind: "attack", enCost: 6, power: 34, breakPower: 22 }),
  // 共通：ためる
  skill({ id: "focus_charge", name: "フォーカス（ためる）", weapon: "slash", kind: "charge", enCost: 2 }),
];
/**
 * レアリティで付与される「追加スキル」のプール。
 * 性能倍率はかけず、レアリティが上がるほど攻略に役立つレアなスキルが付く。
 * weapon系統は装備武器に合わせて実行時に上書きされる（プレースホルダ）。
 */
export const BONUS_SKILLS: Skill[] = [
  // アンコモン：ちょい便利
  skill({ id: "b_recover", name: "リカバリ", weapon: "slash", kind: "heal", enCost: 4, heal: 30 }),
  skill({ id: "b_quick_focus", name: "クイックフォーカス", weapon: "slash", kind: "charge", enCost: 1 }),
  // レア：戦術の幅
  skill({ id: "b_wide_blow", name: "ワイドブロウ（全体）", weapon: "slash", kind: "aoe", enCost: 6, power: 22, breakPower: 14 }),
  skill({ id: "b_power_smash", name: "パワースマッシュ", weapon: "slash", kind: "attack", enCost: 5, power: 36, breakPower: 18 }),
  // スーパーレア：強力
  skill({ id: "b_mega_heal", name: "メガヒール", weapon: "slash", kind: "heal", enCost: 7, heal: 78 }),
  skill({ id: "b_tempest", name: "テンペスト（全体）", weapon: "slash", kind: "aoe", enCost: 8, power: 40, breakPower: 28 }),
  // ウルトラレア：切り札
  skill({ id: "b_catastrophe", name: "カタストロフ（全体）", weapon: "slash", kind: "aoe", enCost: 10, power: 58, breakPower: 44 }),
  skill({ id: "b_resurrection", name: "リザレクション", weapon: "slash", kind: "heal", enCost: 9, heal: 999 }),
];

const SKILL_MAP: Record<string, Skill> = Object.fromEntries(
  [...SKILLS, ...BONUS_SKILLS].map((s) => [s.id, s]),
);
export function getSkill(id: string): Skill { return SKILL_MAP[id]; }
export function isBonusSkill(id: string): boolean { return id.startsWith("b_"); }

/** レアリティごとの追加スキル候補 */
const BONUS_BY_RARITY: Record<Rarity, string[]> = {
  common: [],
  uncommon: ["b_recover", "b_quick_focus"],
  rare: ["b_wide_blow", "b_power_smash"],
  epic: ["b_mega_heal", "b_tempest"],
  legend: ["b_catastrophe", "b_resurrection"],
  astral: ["b_catastrophe", "b_resurrection"],
};
export function rollBonusSkill(rarity: Rarity): string | undefined {
  const pool = BONUS_BY_RARITY[rarity];
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const CHARGE_MULT = 2.3;

export const SKILL_KIND_LABEL: Record<SkillKind, string> = {
  attack: "単体攻撃", aoe: "全体攻撃", heal: "回復", charge: "ためる",
};

/** スキルが何をするかの説明文（レアリティ反映後の値で生成） */
export function skillDescription(s: Skill): string {
  switch (s.kind) {
    case "attack": return `対象1体に威力${s.power}のダメージ（ブレイク蓄積${s.breakPower}）`;
    case "aoe": return `敵全体に威力${s.power}のダメージ（ブレイク蓄積${s.breakPower}）`;
    case "heal": return `自分のHPを${s.heal}回復する`;
    case "charge": return `次に当てる攻撃の威力を${CHARGE_MULT}倍にする`;
  }
}

/** スキルを指定系統に合わせて返す（追加スキルの弱点判定を装備武器の系統に合わせる） */
export function skillForClass(id: string, cls: WeaponClass): Skill {
  return { ...getSkill(id), weapon: cls };
}

// ===== 武器テンプレート =====
export const WEAPONS: Weapon[] = [
  { id: "w_iron_edge", name: "アイアンエッジ", weapon: "slash", skills: ["edge_slash", "cross_edge"], desc: "斬撃＋全体斬り。バランス型" },
  { id: "w_storm_saber", name: "ストームセイバー", weapon: "slash", skills: ["quick_slash", "mend_edge"], desc: "速攻と自己回復のサポート型" },
  { id: "w_dragoon_blade", name: "ドラグーンブレイド", weapon: "slash", skills: ["focus_charge", "heavy_slash"], desc: "ためて大斬撃。ロマン型" },
  { id: "w_steel_lance", name: "スチールランス", weapon: "pierce", skills: ["lance_thrust", "pierce_combo"], desc: "安定した連続突き" },
  { id: "w_wind_pike", name: "ウィンドパイク", weapon: "pierce", skills: ["wind_thrust", "gale_pierce"], desc: "ブレイク稼ぎ＋全体突き" },
  { id: "w_void_glaive", name: "ヴォイドグレイブ", weapon: "pierce", skills: ["focus_charge", "void_thrust"], desc: "ためて高威力の戦槍" },
  { id: "w_war_mallet", name: "ウォーマレット", weapon: "crush", skills: ["mallet_smash", "quake_aoe"], desc: "打撃＋全体震動" },
  { id: "w_quake_hammer", name: "クエイクハンマー", weapon: "crush", skills: ["hammer_blow", "quake_aoe"], desc: "ブレイク特化の大槌" },
  { id: "w_titan_breaker", name: "タイタンブレイカー", weapon: "crush", skills: ["focus_charge", "titan_smash"], desc: "ためて最大火力の一撃" },
];
export function getWeapon(id: string): Weapon | undefined { return WEAPONS.find((w) => w.id === id); }

// ===== 武器の固有パッシブ（どの武器にもランダムで1つ付く） =====
export const PASSIVES: Passive[] = [
  { id: "rejuvenate", name: "リジェネ", desc: "使うたびに最大HPの5%回復", healPctOnUse: 0.05 },
  { id: "energize", name: "エナジャイズ", desc: "使うたびにEN+1", enOnUse: 1 },
  { id: "vampiric", name: "ヴァンパイア", desc: "与ダメージの25%をHP回復", lifestealPct: 0.25 },
  { id: "crusher", name: "クラッシャー", desc: "ブレイク蓄積1.3倍", breakMult: 1.3 },
  { id: "keen", name: "キーン", desc: "20%で会心（1.5倍ダメージ）", critChance: 0.2 },
];
const PASSIVE_MAP: Record<string, Passive> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
export function getPassive(id: string): Passive | undefined { return PASSIVE_MAP[id]; }
function rollPassive(): string { return PASSIVES[Math.floor(Math.random() * PASSIVES.length)].id; }

// ===== 武器インスタンス生成・ドロップ抽選 =====
let uidCounter = 0;
function newUid(): string {
  uidCounter += 1;
  return `wi_${Date.now().toString(36)}_${uidCounter}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
export function makeInstance(baseId: string, rarity: Rarity): WeaponInstance {
  return {
    uid: newUid(), baseId, rarity, bonusSkillId: rollBonusSkill(rarity),
    atkBonus: 1 + Math.floor(Math.random() * 5), // +1〜5
    passiveId: rollPassive(),
  };
}

/** 表示名：武器名＋攻撃力ボーナス（例: ショートソード+3） */
export function instanceLabel(inst: WeaponInstance): string {
  const w = getWeapon(inst.baseId);
  return `${w?.name ?? "???"}+${inst.atkBonus}`;
}

function weightedRarity(weights: number[]): Rarity {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return RARITY_ORDER[i];
  }
  return "common";
}

/** 1体ぶんのドロップを抽選（武器はランダム、レアリティはステージ重みで） */
export function rollDrop(weights: number[]): WeaponInstance {
  const base = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
  return makeInstance(base.id, weightedRarity(weights));
}

/** ステージのドロップを抽選（武器はランダム、レアリティはステージ重みで） */
export function rollDrops(stage: StageDef): WeaponInstance[] {
  const out: WeaponInstance[] = [];
  for (let i = 0; i < stage.drops; i++) out.push(rollDrop(stage.rarityWeights));
  return out;
}

// ===== 敵 =====
const E: Record<string, EnemyDef> = {
  // countStart で敵ごとに攻撃カウントのリズムを変える（5開始の重い敵、2開始の速い敵 など）
  straw_golem: { id: "straw_golem", name: "ストローゴーレム", kind: "carapace", maxHp: 80, attack: 10, telegraphMs: 1300, countStart: 3, breakThreshold: 35 },
  shell_crawler: { id: "shell_crawler", name: "シェルクローラー", kind: "carapace", maxHp: 130, attack: 16, telegraphMs: 1150, countStart: 5, breakThreshold: 45 },
  wraith_feather: { id: "wraith_feather", name: "レイスフェザー", kind: "aerial", maxHp: 150, attack: 19, telegraphMs: 1000, countStart: 4, breakThreshold: 52 },
  gloom_shade: { id: "gloom_shade", name: "グルームシェイド", kind: "phantom", maxHp: 170, attack: 22, telegraphMs: 950, countStart: 2, breakThreshold: 58 },
  carapace_tyrant: { id: "carapace_tyrant", name: "カラペイス・タイラント", kind: "carapace", maxHp: 480, attack: 32, telegraphMs: 820, countStart: 3, breakThreshold: 100, boss: true },
};

// ===== ステージ（3つ） =====
export const STAGES: StageDef[] = [
  {
    name: "練習の間",
    desc: "チュートリアル。弱い敵1体。攻撃・ガード・休憩を試そう",
    enemies: [E.straw_golem],
    rarityWeights: [82, 16, 2, 0, 0, 0],
    drops: 1,
  },
  {
    name: "双影の回廊",
    desc: "弱点の異なる敵が2体。武器の使い分けを意識",
    enemies: [E.wraith_feather, E.gloom_shade],
    rarityWeights: [45, 32, 17, 5, 1, 0],
    drops: 2,
  },
  {
    name: "獣王の広間",
    desc: "ボスを含む強敵3体。総力戦",
    enemies: [E.carapace_tyrant, E.wraith_feather, E.gloom_shade],
    rarityWeights: [20, 28, 27, 15, 8, 2],
    drops: 3,
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

/** 初期インベントリ（系統ごとの標準武器をノーマルで1本ずつ） */
export function starterInventory(): WeaponInstance[] {
  return [
    makeInstance("w_iron_edge", "common"),
    makeInstance("w_steel_lance", "common"),
    makeInstance("w_war_mallet", "common"),
  ];
}
