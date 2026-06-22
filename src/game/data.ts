import type {
  Skill, EnemyDef, WeaponClass, EnemyKind, Weapon, Rarity, WeaponInstance, StageDef,
} from "./types.ts";

// ===== 表示名・相性 =====
export const WEAPON_LABEL: Record<WeaponClass, string> = { slash: "斬撃", pierce: "刺突", crush: "打撃" };
export const KIND_LABEL: Record<EnemyKind, string> = { carapace: "甲殻種", phantom: "霊体種", aerial: "飛翔種" };
export const WEAKNESS: Record<EnemyKind, WeaponClass> = { carapace: "crush", phantom: "slash", aerial: "pierce" };
export const WEAKNESS_MULTIPLIER = 1.8;

// ===== レアリティ =====
export const RARITY_ORDER: Rarity[] = ["normal", "uncommon", "rare", "superrare", "ultrarare"];
export const RARITY_LABEL: Record<Rarity, string> = {
  normal: "ノーマル", uncommon: "アンコモン", rare: "レア", superrare: "スーパーレア", ultrarare: "ウルトラレア",
};
/** レアリティによる武器性能の倍率（パラメータ・スキル共通） */
export const RARITY_MULT: Record<Rarity, number> = {
  normal: 1.0, uncommon: 1.25, rare: 1.55, superrare: 1.95, ultrarare: 2.5,
};
export const RARITY_COLOR: Record<Rarity, string> = {
  normal: "#b8b8c8", uncommon: "#6fd07f", rare: "#5fa8ff", superrare: "#c98aff", ultrarare: "#ffcf3f",
};

// ===== スキル =====
function skill(s: Partial<Skill> & Pick<Skill, "id" | "name" | "weapon" | "kind" | "enCost">): Skill {
  return { power: 0, breakPower: 0, heal: 0, ...s };
}

export const SKILLS: Skill[] = [
  // 斬撃
  skill({ id: "edge_slash", name: "エッジスラッシュ", weapon: "slash", kind: "attack", enCost: 16, power: 15, breakPower: 10 }),
  skill({ id: "cross_edge", name: "クロスエッジ（全体）", weapon: "slash", kind: "aoe", enCost: 34, power: 16, breakPower: 9 }),
  skill({ id: "quick_slash", name: "クイックスラッシュ", weapon: "slash", kind: "attack", enCost: 11, power: 11, breakPower: 8 }),
  skill({ id: "mend_edge", name: "メンドエッジ（回復）", weapon: "slash", kind: "heal", enCost: 28, heal: 32 }),
  skill({ id: "heavy_slash", name: "ヘヴィスラッシュ", weapon: "slash", kind: "attack", enCost: 28, power: 30, breakPower: 14 }),
  // 刺突
  skill({ id: "lance_thrust", name: "ランススラスト", weapon: "pierce", kind: "attack", enCost: 16, power: 14, breakPower: 9 }),
  skill({ id: "pierce_combo", name: "ピアスコンボ", weapon: "pierce", kind: "attack", enCost: 22, power: 21, breakPower: 12 }),
  skill({ id: "wind_thrust", name: "ウィンドスラスト", weapon: "pierce", kind: "attack", enCost: 16, power: 12, breakPower: 17 }),
  skill({ id: "gale_pierce", name: "ゲイルピアス（全体）", weapon: "pierce", kind: "aoe", enCost: 36, power: 14, breakPower: 15 }),
  skill({ id: "void_thrust", name: "ヴォイドスラスト", weapon: "pierce", kind: "attack", enCost: 28, power: 28, breakPower: 14 }),
  // 打撃
  skill({ id: "mallet_smash", name: "マレットスマッシュ", weapon: "crush", kind: "attack", enCost: 18, power: 16, breakPower: 20 }),
  skill({ id: "hammer_blow", name: "ハンマーブロウ", weapon: "crush", kind: "attack", enCost: 20, power: 18, breakPower: 24 }),
  skill({ id: "quake_aoe", name: "クエイクウェイブ（全体）", weapon: "crush", kind: "aoe", enCost: 42, power: 18, breakPower: 20 }),
  skill({ id: "titan_smash", name: "タイタンスマッシュ", weapon: "crush", kind: "attack", enCost: 32, power: 34, breakPower: 22 }),
  // 共通：ためる
  skill({ id: "focus_charge", name: "フォーカス（ためる）", weapon: "slash", kind: "charge", enCost: 8 }),
];
const SKILL_MAP: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export function getSkill(id: string): Skill { return SKILL_MAP[id]; }

export const CHARGE_MULT = 2.3;

/** レアリティ倍率を反映した実効スキル */
export function effectiveSkill(base: Skill, rarityMult: number): Skill {
  return {
    ...base,
    power: Math.round(base.power * rarityMult),
    breakPower: Math.round(base.breakPower * rarityMult),
    heal: Math.round(base.heal * rarityMult),
  };
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

// ===== 武器インスタンス生成・ドロップ抽選 =====
let uidCounter = 0;
function newUid(): string {
  uidCounter += 1;
  return `wi_${Date.now().toString(36)}_${uidCounter}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
export function makeInstance(baseId: string, rarity: Rarity): WeaponInstance {
  return { uid: newUid(), baseId, rarity };
}

function weightedRarity(weights: number[]): Rarity {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return RARITY_ORDER[i];
  }
  return "normal";
}

/** ステージのドロップを抽選（武器はランダム、レアリティはステージ重みで） */
export function rollDrops(stage: StageDef): WeaponInstance[] {
  const out: WeaponInstance[] = [];
  for (let i = 0; i < stage.drops; i++) {
    const base = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
    out.push(makeInstance(base.id, weightedRarity(stage.rarityWeights)));
  }
  return out;
}

// ===== 敵 =====
const E: Record<string, EnemyDef> = {
  straw_golem: { id: "straw_golem", name: "ストローゴーレム", kind: "carapace", maxHp: 80, attack: 10, telegraphMs: 1300, intervalMs: 4600, breakThreshold: 35 },
  shell_crawler: { id: "shell_crawler", name: "シェルクローラー", kind: "carapace", maxHp: 130, attack: 16, telegraphMs: 1150, intervalMs: 4000, breakThreshold: 45 },
  wraith_feather: { id: "wraith_feather", name: "レイスフェザー", kind: "aerial", maxHp: 150, attack: 19, telegraphMs: 1000, intervalMs: 3600, breakThreshold: 52 },
  gloom_shade: { id: "gloom_shade", name: "グルームシェイド", kind: "phantom", maxHp: 170, attack: 22, telegraphMs: 950, intervalMs: 3300, breakThreshold: 58 },
  carapace_tyrant: { id: "carapace_tyrant", name: "カラペイス・タイラント", kind: "carapace", maxHp: 480, attack: 32, telegraphMs: 820, intervalMs: 2500, breakThreshold: 100, boss: true },
};

// ===== ステージ（3つ） =====
export const STAGES: StageDef[] = [
  {
    name: "練習の間",
    desc: "チュートリアル。弱い敵1体。攻撃・ガード・休憩を試そう",
    enemies: [E.straw_golem],
    rarityWeights: [82, 16, 2, 0, 0],
    drops: 1,
  },
  {
    name: "双影の回廊",
    desc: "弱点の異なる敵が2体。武器の使い分けを意識",
    enemies: [E.wraith_feather, E.gloom_shade],
    rarityWeights: [45, 32, 17, 5, 1],
    drops: 2,
  },
  {
    name: "獣王の広間",
    desc: "ボスを含む強敵3体。総力戦",
    enemies: [E.carapace_tyrant, E.wraith_feather, E.gloom_shade],
    rarityWeights: [22, 30, 28, 15, 5],
    drops: 3,
  },
];
export const STAGE_COUNT = STAGES.length;

// ===== プレイヤー =====
export const PLAYER_MAX_HP = 130;
export const PLAYER_MAX_EN = 100;

// ===== EN回復（自動回復なし。休憩・ガード成功のみ） =====
export const REST_EN_RECOVER = 18;
export const GUARD_EN_RECOVER = 24;
export const JUST_EN_RECOVER = 38;
export const PARRY_EN_RECOVER = 46;

// ===== ガード判定の窓 =====
export const GUARD_WINDOW_MS = 380;
export const JUST_WINDOW_MS = 185;
export const PARRY_WINDOW_MS = 85;

// ===== ガード効果 =====
export const GUARD_DAMAGE_MULT = 0.5;
export const JUST_DAMAGE_MULT = 0.1;
export const PARRY_HP_RECOVER = 14;

// ===== ブレイク =====
export const BREAK_DURATION_MS = 4500;
export const BREAK_CRIT_MULT = 1.6;

/** 初期インベントリ（系統ごとの標準武器をノーマルで1本ずつ） */
export function starterInventory(): WeaponInstance[] {
  return [
    makeInstance("w_iron_edge", "normal"),
    makeInstance("w_steel_lance", "normal"),
    makeInstance("w_war_mallet", "normal"),
  ];
}
