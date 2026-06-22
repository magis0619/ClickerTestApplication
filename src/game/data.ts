import type { Skill, EnemyDef, WeaponClass, EnemyKind } from "./types.ts";

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

/** 序盤の敵（プロトタイプではこの1体と戦う） */
export const ENEMIES: EnemyDef[] = [
  {
    id: "carapace_crawler",
    name: "シェルクローラー",
    kind: "carapace",
    maxHp: 220,
    attack: 26,
    telegraphMs: 1100,
    intervalMs: 2600,
    breakThreshold: 60,
  },
];

// ===== プレイヤーの初期パラメータ =====
export const PLAYER_MAX_HP = 120;
export const PLAYER_MAX_EN = 100;
/** EN自然回復（毎秒） */
export const EN_REGEN_PER_SEC = 14;

// ===== ガード判定のタイミング窓（着弾時刻からの差の絶対値, ms） =====
export const GUARD_WINDOW_MS = 350; // これ以内でガード成立（軽減）
export const JUST_WINDOW_MS = 160; // これ以内でJUST（大軽減+EN回復）
export const PARRY_WINDOW_MS = 70; // これ以内でPARRY（無効化+HP回復）

// ===== ガード効果 =====
export const GUARD_DAMAGE_MULT = 0.5; // 通常ガード：被ダメ50%
export const JUST_DAMAGE_MULT = 0.1; // JUST：被ダメ10%
export const JUST_EN_RECOVER = 25; // JUST時EN回復
export const PARRY_HP_RECOVER = 12; // PARRY時HP回復

// ===== ブレイク（気絶）関連 =====
export const BREAK_DURATION_MS = 4000; // ブレイク継続時間
export const BREAK_CRIT_MULT = 1.6; // ブレイク中ヒットのダメージ倍率（必ず会心）
export const BREAK_EN_RECOVER = 6; // ブレイク中ヒットごとのEN回復
