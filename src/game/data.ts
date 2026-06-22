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

// ===== スキル定義 =====
// 1つの定義ヘルパー（未指定値を補完）
function skill(s: Partial<Skill> & Pick<Skill, "id" | "name" | "weapon" | "kind" | "enCost">): Skill {
  return { power: 0, breakPower: 0, heal: 0, ...s };
}

export const SKILLS: Skill[] = [
  // --- 斬撃 ---
  skill({ id: "edge_slash", name: "エッジスラッシュ", weapon: "slash", kind: "attack", enCost: 16, power: 15, breakPower: 10 }),
  skill({ id: "cross_edge", name: "クロスエッジ（全体）", weapon: "slash", kind: "aoe", enCost: 34, power: 16, breakPower: 9 }),
  skill({ id: "quick_slash", name: "クイックスラッシュ", weapon: "slash", kind: "attack", enCost: 11, power: 11, breakPower: 8 }),
  skill({ id: "mend_edge", name: "メンドエッジ（回復）", weapon: "slash", kind: "heal", enCost: 28, heal: 32 }),
  skill({ id: "heavy_slash", name: "ヘヴィスラッシュ", weapon: "slash", kind: "attack", enCost: 28, power: 30, breakPower: 14 }),
  // --- 刺突 ---
  skill({ id: "lance_thrust", name: "ランススラスト", weapon: "pierce", kind: "attack", enCost: 16, power: 14, breakPower: 9 }),
  skill({ id: "pierce_combo", name: "ピアスコンボ", weapon: "pierce", kind: "attack", enCost: 22, power: 21, breakPower: 12 }),
  skill({ id: "wind_thrust", name: "ウィンドスラスト", weapon: "pierce", kind: "attack", enCost: 16, power: 12, breakPower: 17 }),
  skill({ id: "gale_pierce", name: "ゲイルピアス（全体）", weapon: "pierce", kind: "aoe", enCost: 36, power: 14, breakPower: 15 }),
  skill({ id: "void_thrust", name: "ヴォイドスラスト", weapon: "pierce", kind: "attack", enCost: 28, power: 28, breakPower: 14 }),
  // --- 打撃 ---
  skill({ id: "mallet_smash", name: "マレットスマッシュ", weapon: "crush", kind: "attack", enCost: 18, power: 16, breakPower: 20 }),
  skill({ id: "hammer_blow", name: "ハンマーブロウ", weapon: "crush", kind: "attack", enCost: 20, power: 18, breakPower: 24 }),
  skill({ id: "quake_aoe", name: "クエイクウェイブ（全体）", weapon: "crush", kind: "aoe", enCost: 42, power: 18, breakPower: 20 }),
  skill({ id: "titan_smash", name: "タイタンスマッシュ", weapon: "crush", kind: "attack", enCost: 32, power: 34, breakPower: 22 }),
  // --- 共通：ためる ---
  skill({ id: "focus_charge", name: "フォーカス（ためる）", weapon: "slash", kind: "charge", enCost: 8 }),
];

const SKILL_MAP: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export function getSkill(id: string): Skill {
  return SKILL_MAP[id];
}

/** ためる使用時、次の攻撃にかかる倍率 */
export const CHARGE_MULT = 2.3;

// ===== 武器（収集要素）。各武器は固有のスキルローテーションを持つ =====
export const WEAPONS: Weapon[] = [
  // 斬撃
  { id: "w_iron_edge", name: "アイアンエッジ", weapon: "slash", skills: ["edge_slash", "cross_edge"], desc: "斬撃＋全体斬り。バランス型" },
  { id: "w_storm_saber", name: "ストームセイバー", weapon: "slash", skills: ["quick_slash", "mend_edge"], desc: "速攻と自己回復のサポート型" },
  { id: "w_dragoon_blade", name: "ドラグーンブレイド", weapon: "slash", skills: ["focus_charge", "heavy_slash"], desc: "ためて大斬撃。ロマン型" },
  // 刺突
  { id: "w_steel_lance", name: "スチールランス", weapon: "pierce", skills: ["lance_thrust", "pierce_combo"], desc: "安定した連続突き" },
  { id: "w_wind_pike", name: "ウィンドパイク", weapon: "pierce", skills: ["wind_thrust", "gale_pierce"], desc: "ブレイク稼ぎ＋全体突き" },
  { id: "w_void_glaive", name: "ヴォイドグレイブ", weapon: "pierce", skills: ["focus_charge", "void_thrust"], desc: "ためて高威力の戦槍" },
  // 打撃
  { id: "w_war_mallet", name: "ウォーマレット", weapon: "crush", skills: ["mallet_smash", "quake_aoe"], desc: "打撃＋全体震動" },
  { id: "w_quake_hammer", name: "クエイクハンマー", weapon: "crush", skills: ["hammer_blow", "quake_aoe"], desc: "ブレイク特化の大槌" },
  { id: "w_titan_breaker", name: "タイタンブレイカー", weapon: "crush", skills: ["focus_charge", "titan_smash"], desc: "ためて最大火力の一撃" },
];

export const STARTER_WEAPONS = ["w_iron_edge", "w_steel_lance", "w_war_mallet"];

export const DEFAULT_EQUIPPED: Record<WeaponClass, string> = {
  slash: "w_iron_edge",
  pierce: "w_steel_lance",
  crush: "w_war_mallet",
};

export function getWeapon(id: string): Weapon | undefined {
  return WEAPONS.find((w) => w.id === id);
}

// ===== 敵テンプレート =====
const ENEMY_DEFS: Record<string, EnemyDef> = {
  shell_crawler: {
    id: "shell_crawler", name: "シェルクローラー", kind: "carapace",
    maxHp: 120, attack: 16, telegraphMs: 1150, intervalMs: 4200, breakThreshold: 45, reward: 12,
    dropWeapon: "w_storm_saber",
  },
  wraith_feather: {
    id: "wraith_feather", name: "レイスフェザー", kind: "aerial",
    maxHp: 130, attack: 18, telegraphMs: 1000, intervalMs: 3800, breakThreshold: 50, reward: 16,
    dropWeapon: "w_wind_pike",
  },
  gloom_shade: {
    id: "gloom_shade", name: "グルームシェイド", kind: "phantom",
    maxHp: 150, attack: 20, telegraphMs: 950, intervalMs: 3500, breakThreshold: 55, reward: 20,
    dropWeapon: "w_quake_hammer",
  },
  carapace_tyrant: {
    id: "carapace_tyrant", name: "カラペイス・タイラント", kind: "carapace",
    maxHp: 460, attack: 30, telegraphMs: 820, intervalMs: 2500, breakThreshold: 95, reward: 80,
    boss: true, dropWeapon: "w_titan_breaker",
  },
  void_dragon: {
    id: "void_dragon", name: "ヴォイドドラゴン", kind: "aerial",
    maxHp: 560, attack: 34, telegraphMs: 780, intervalMs: 2300, breakThreshold: 110, reward: 120,
    boss: true, dropWeapon: "w_void_glaive",
  },
};

/**
 * ダンジョン構成。各ステージに 2〜3 体（最終はボス＋お供）が出現。
 * 種別を散らして武器の付け替えが活きるよう設計。
 */
export const STAGES: EnemyDef[][] = [
  // STAGE 1: 甲殻種2体（打撃・全体攻撃を学ぶ）
  [ENEMY_DEFS.shell_crawler, ENEMY_DEFS.shell_crawler],
  // STAGE 2: 飛翔＋霊体（弱点の異なる2体）
  [ENEMY_DEFS.wraith_feather, ENEMY_DEFS.gloom_shade],
  // STAGE 3: 3種混成（武器の使い分けが重要）
  [ENEMY_DEFS.shell_crawler, ENEMY_DEFS.wraith_feather, ENEMY_DEFS.gloom_shade],
  // STAGE 4: ボス＋お供
  [ENEMY_DEFS.carapace_tyrant, ENEMY_DEFS.gloom_shade],
  // STAGE 5: 最終ボス
  [ENEMY_DEFS.void_dragon, ENEMY_DEFS.shell_crawler, ENEMY_DEFS.shell_crawler],
];

export const STAGE_COUNT = STAGES.length;

// ===== 育成（スキル強化） =====
export const SKILL_POWER_PER_LEVEL = 0.15;
export const SKILL_BREAK_PER_LEVEL = 0.1;
export const SKILL_HEAL_PER_LEVEL = 0.15;
export const UPGRADE_BASE_COST = 12;

export function upgradeCost(currentLevel: number): number {
  return UPGRADE_BASE_COST * currentLevel;
}

/** 強化レベルを反映した実効スキルを返す */
export function effectiveSkill(base: Skill, level: number): Skill {
  const lv = Math.max(1, level);
  return {
    ...base,
    power: Math.round(base.power * (1 + SKILL_POWER_PER_LEVEL * (lv - 1))),
    breakPower: Math.round(base.breakPower * (1 + SKILL_BREAK_PER_LEVEL * (lv - 1))),
    heal: Math.round(base.heal * (1 + SKILL_HEAL_PER_LEVEL * (lv - 1))),
  };
}

// ===== ステージ間の回復 =====
export const STAGE_HEAL_RATIO = 0.4;

// ===== プレイヤーの初期パラメータ =====
export const PLAYER_MAX_HP = 130;
export const PLAYER_MAX_EN = 100;

// ===== EN回復（自動回復は無し。ガード成功・休憩でのみ回復） =====
export const REST_EN_RECOVER = 18; // 休憩での回復
export const GUARD_EN_RECOVER = 24; // 通常ガード成功
export const JUST_EN_RECOVER = 38; // JUST成功
export const PARRY_EN_RECOVER = 46; // PARRY成功（最大）

// ===== ガード判定のタイミング窓（着弾までの残り時間, ms） =====
export const GUARD_WINDOW_MS = 380;
export const JUST_WINDOW_MS = 185;
export const PARRY_WINDOW_MS = 85;

// ===== ガード効果 =====
export const GUARD_DAMAGE_MULT = 0.5; // 通常ガード：被ダメ50%
export const JUST_DAMAGE_MULT = 0.1; // JUST：被ダメ10%
export const PARRY_HP_RECOVER = 14; // PARRY時HP回復

// ===== ブレイク（気絶）関連 =====
export const BREAK_DURATION_MS = 4500;
export const BREAK_CRIT_MULT = 1.6; // ブレイク中ヒットのダメージ倍率（必ず会心）
