import type { Skill, EnemyDef, WeaponClass, EnemyKind, Weapon } from "./types.ts";

// ===== オリジナルのゲームデータ =====

/** 武器系統の表示名 */
export const WEAPON_LABEL: Record<WeaponClass, string> = {
  slash: "斬撃",
  pierce: "刺突",
  crush: "打撃",
};

/** 敵種別の表示名 */
export const KIND_LABEL: Record<EnemyKind, string> = {
  carapace: "甲殻種",
  phantom: "霊体種",
  aerial: "飛翔種",
};

/** 種別ごとの弱点武器（弱点ヒットでダメージ増加） */
export const WEAKNESS: Record<EnemyKind, WeaponClass> = {
  carapace: "crush", // 硬い甲殻は打撃で砕く
  phantom: "slash", // 実体の薄い霊体は斬撃が通る
  aerial: "pierce", // 飛翔する敵は刺突で射抜く
};

/** 弱点ヒット時のダメージ倍率 */
export const WEAKNESS_MULTIPLIER = 1.8;

/** プレイヤーのスキル一覧（武器系統ごとに2種） */
export const SKILLS: Skill[] = [
  { id: "edge_slash", name: "エッジスラッシュ", weapon: "slash", enCost: 20, power: 14, breakPower: 10 },
  { id: "cross_edge", name: "クロスエッジ", weapon: "slash", enCost: 45, power: 30, breakPower: 16 },
  { id: "lance_thrust", name: "ランススラスト", weapon: "pierce", enCost: 20, power: 13, breakPower: 9 },
  { id: "sky_pierce", name: "スカイピアス", weapon: "pierce", enCost: 45, power: 28, breakPower: 22 },
  { id: "mallet_smash", name: "マレットスマッシュ", weapon: "crush", enCost: 22, power: 16, breakPower: 20 },
  { id: "ground_break", name: "グランドブレイク", weapon: "crush", enCost: 50, power: 34, breakPower: 30 },
];

/**
 * 武器一覧（収集要素）。系統ごとに「初期武器」＋「強い/個性的なドロップ武器」を用意。
 * 付け替えでその系統スキルの 威力 / 消費EN / ブレイク蓄積 が変化する。
 */
export const WEAPONS: Weapon[] = [
  // --- 斬撃 ---
  { id: "w_iron_edge", name: "アイアンエッジ", weapon: "slash", powerMult: 1.0, enMult: 1.0, breakMult: 1.0, desc: "標準的な片手剣。クセがない" },
  { id: "w_storm_saber", name: "ストームセイバー", weapon: "slash", powerMult: 0.9, enMult: 0.75, breakMult: 1.1, desc: "軽量で省EN。手数で攻める" },
  { id: "w_dragoon_blade", name: "ドラグーンブレイド", weapon: "slash", powerMult: 1.35, enMult: 1.2, breakMult: 0.9, desc: "重い大剣。一撃が重い" },
  // --- 刺突 ---
  { id: "w_steel_lance", name: "スチールランス", weapon: "pierce", powerMult: 1.0, enMult: 1.0, breakMult: 1.0, desc: "標準的な槍。安定" },
  { id: "w_wind_pike", name: "ウィンドパイク", weapon: "pierce", powerMult: 0.95, enMult: 0.8, breakMult: 1.25, desc: "ブレイクを稼ぎやすい" },
  { id: "w_void_glaive", name: "ヴォイドグレイブ", weapon: "pierce", powerMult: 1.3, enMult: 1.15, breakMult: 1.0, desc: "高威力の戦槍" },
  // --- 打撃 ---
  { id: "w_war_mallet", name: "ウォーマレット", weapon: "crush", powerMult: 1.0, enMult: 1.0, breakMult: 1.0, desc: "標準的な戦槌" },
  { id: "w_quake_hammer", name: "クエイクハンマー", weapon: "crush", powerMult: 1.1, enMult: 1.05, breakMult: 1.4, desc: "ブレイク特化の大槌" },
  { id: "w_titan_breaker", name: "タイタンブレイカー", weapon: "crush", powerMult: 1.45, enMult: 1.3, breakMult: 1.1, desc: "最重量。ロマンの一撃" },
];

/** 初期所持武器（系統ごとの標準武器） */
export const STARTER_WEAPONS = ["w_iron_edge", "w_steel_lance", "w_war_mallet"];

/** 系統ごとの初期装備 */
export const DEFAULT_EQUIPPED: Record<WeaponClass, string> = {
  slash: "w_iron_edge",
  pierce: "w_steel_lance",
  crush: "w_war_mallet",
};

export function getWeapon(id: string): Weapon | undefined {
  return WEAPONS.find((w) => w.id === id);
}

/**
 * ダンジョンのステージ順（先頭から順に戦う）。
 * 種別を散らすことで武器相性の付け替えが意味を持つように設計。
 * 各敵は撃破時に武器をドロップする。
 */
export const ENEMIES: EnemyDef[] = [
  {
    id: "carapace_crawler",
    name: "シェルクローラー",
    kind: "carapace",
    maxHp: 180,
    attack: 22,
    telegraphMs: 1150,
    intervalMs: 2700,
    breakThreshold: 55,
    reward: 18,
    dropWeapon: "w_storm_saber",
  },
  {
    id: "wraith_feather",
    name: "レイスフェザー",
    kind: "aerial",
    maxHp: 210,
    attack: 25,
    telegraphMs: 1000,
    intervalMs: 2400,
    breakThreshold: 60,
    reward: 24,
    dropWeapon: "w_wind_pike",
  },
  {
    id: "gloom_shade",
    name: "グルームシェイド",
    kind: "phantom",
    maxHp: 240,
    attack: 28,
    telegraphMs: 950,
    intervalMs: 2200,
    breakThreshold: 70,
    reward: 30,
    dropWeapon: "w_quake_hammer",
  },
  {
    id: "carapace_tyrant",
    name: "カラペイス・タイラント",
    kind: "carapace",
    maxHp: 460,
    attack: 34,
    telegraphMs: 900,
    intervalMs: 2100,
    breakThreshold: 95,
    reward: 70,
    boss: true,
    dropWeapon: "w_titan_breaker",
  },
];

/** 総ステージ数 */
export const STAGE_COUNT = ENEMIES.length;

// ===== 育成（スキル強化） =====
/** レベルごとのダメージ上昇率（+15%/Lv） */
export const SKILL_POWER_PER_LEVEL = 0.15;
/** レベルごとのブレイク蓄積上昇率（+10%/Lv） */
export const SKILL_BREAK_PER_LEVEL = 0.1;
/** スキル強化の必要霊片（次レベルへ上げる費用 = base * level） */
export const UPGRADE_BASE_COST = 12;

/** あるレベルのスキルを次のレベルへ上げる費用 */
export function upgradeCost(currentLevel: number): number {
  return UPGRADE_BASE_COST * currentLevel;
}

/** 強化レベルと装備武器を反映した実効スキルを返す */
export function effectiveSkill(base: Skill, level: number, weapon?: Weapon): Skill {
  const lv = Math.max(1, level);
  const pMult = weapon?.powerMult ?? 1;
  const eMult = weapon?.enMult ?? 1;
  const bMult = weapon?.breakMult ?? 1;
  return {
    ...base,
    power: Math.max(1, Math.round(base.power * (1 + SKILL_POWER_PER_LEVEL * (lv - 1)) * pMult)),
    breakPower: Math.max(1, Math.round(base.breakPower * (1 + SKILL_BREAK_PER_LEVEL * (lv - 1)) * bMult)),
    enCost: Math.max(1, Math.round(base.enCost * eMult)),
  };
}

// ===== ステージ間の回復 =====
/** 勝利後に回復する最大HPの割合 */
export const STAGE_HEAL_RATIO = 0.45;

// ===== プレイヤーの初期パラメータ =====
export const PLAYER_MAX_HP = 120;
export const PLAYER_MAX_EN = 100;
/** EN自然回復（毎秒） */
export const EN_REGEN_PER_SEC = 16;

// ===== ガード判定のタイミング窓（着弾時刻からの差の絶対値, ms） =====
export const GUARD_WINDOW_MS = 360; // これ以内でガード成立（軽減）
export const JUST_WINDOW_MS = 175; // これ以内でJUST（大軽減+EN回復）
export const PARRY_WINDOW_MS = 80; // これ以内でPARRY（無効化+HP回復）

// ===== ガード効果 =====
export const GUARD_DAMAGE_MULT = 0.5; // 通常ガード：被ダメ50%
export const JUST_DAMAGE_MULT = 0.1; // JUST：被ダメ10%
export const JUST_EN_RECOVER = 25; // JUST時EN回復
export const PARRY_HP_RECOVER = 12; // PARRY時HP回復

// ===== ブレイク（気絶）関連 =====
export const BREAK_DURATION_MS = 4000; // ブレイク継続時間
export const BREAK_CRIT_MULT = 1.6; // ブレイク中ヒットのダメージ倍率（必ず会心）
export const BREAK_EN_RECOVER = 6; // ブレイク中ヒットごとのEN回復
