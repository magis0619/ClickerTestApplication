// ===== 戦闘システムの型定義 =====
// すべてオリジナルの名称・概念で構成。元ネタの固有名詞・素材は一切使用しない。

/** 武器系統（3すくみの相性を持つ）。斬 / 突 / 打 */
export type WeaponClass = "slash" | "pierce" | "crush";

/** 敵の種別。それぞれ弱点となる武器系統を持つ */
export type EnemyKind = "carapace" | "phantom" | "aerial";

/** スキルの種類。attack=攻撃 / charge=ためる / focus=集中 */
export type SkillKind = "attack" | "charge" | "focus";

/**
 * スキル。攻撃の「やり方」を決める（攻撃力は持たず、武器本体が持つ）。
 * ドロップ時に武器レアリティ以下のプールから抽選される。
 */
export interface Skill {
  id: string;
  name: string;
  rarity: Rarity;
  enCost: number;
  kind: SkillKind;
  /** ヒット回数（attack時、既定1） */
  hits: number;
  /** 対象数（attack時、既定1） */
  targets: number;
  /** 会心率への加算(%) */
  critAdd: number;
  /** 会心ダメージ倍率（既定1.5） */
  critMult: number;
  /** ブレイク蓄積倍率（既定1） */
  breakMult: number;
}

/** 敵データ */
export interface EnemyDef {
  id: string;
  name: string;
  kind: EnemyKind;
  maxHp: number;
  attack: number;
  telegraphMs: number;
  /** 攻撃カウントの開始値（5なら 5→4→…→1→攻撃）。敵ごとにリズムを変える */
  countStart: number;
  breakThreshold: number;
  /** 撃破時に落とす武器ID */
  dropWeaponId?: string;
  /** ドロップ率(%) */
  dropRate?: number;
  boss?: boolean;
}

/** レアリティ（高いほど強く、出にくい） */
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legend" | "astral";

/**
 * 武器テンプレート。攻撃力・会心・ブレイク値・レアリティを持つ（レアリティは武器ごとに固定）。
 * 実際の所持品は WeaponInstance（抽選されたスキル付き）。
 */
export interface Weapon {
  id: string;
  name: string;
  weapon: WeaponClass;
  rarity: Rarity;
  /** 基礎攻撃力（ダメージの源） */
  attack: number;
  /** 会心率(%)。0なら会心なし */
  critChance: number;
  /** ブレイク蓄積の基礎値 */
  breakPower: number;
  desc: string;
}

/** 所持している武器1本（テンプレ＋ドロップ時に抽選されたスキル） */
export interface WeaponInstance {
  uid: string;
  baseId: string;
  /** 抽選されたスキルID（レアリティで1〜2個）。コンボとして順番に発動 */
  skillIds: string[];
}

/** 武器インスタンス由来の補正（攻撃時に戦闘へ渡す＝武器本体のステータス） */
export interface WeaponMods {
  weapon: WeaponClass;
  attack: number;
  critChance: number;
  breakPower: number;
}

/** ステージ定義 */
export interface StageDef {
  name: string;
  desc: string;
  enemies: EnemyDef[];
}

/** ガード判定の結果段階。none=失敗(被弾) / guard=通常ガード / just=中間 / perfect=パーフェクトガード */
export type GuardResult = "none" | "guard" | "just" | "perfect";

/** 戦闘から発火する効果音イベント（mainがフレームごとに回収して再生する） */
export type SfxEvent = "warn" | "perfect" | "just" | "guard" | "hurt" | "break" | "die";

/** 戦闘のフェーズ */
export type BattlePhase = "fighting" | "won" | "lost";

/** 画面（ゲーム全体の状態遷移） */
export type Screen = "title" | "stageSelect" | "inventory" | "battle" | "result";

/** セーブデータ */
export interface SaveData {
  /** 所持武器（過去の冒険で入手したものすべて） */
  inventory: WeaponInstance[];
  /** 系統ごとに装備中の武器インスタンスUID */
  equipped: Record<WeaponClass, string>;
  /** これまでにクリアした最深ステージ番号(1始まり、0=未クリア) */
  bestStage: number;
}
