// ===== 戦闘システムの型定義 =====
// すべてオリジナルの名称・概念で構成。元ネタの固有名詞・素材は一切使用しない。

/** 武器系統（3すくみの相性を持つ）。斬 / 突 / 打 */
export type WeaponClass = "slash" | "pierce" | "crush";

/** 敵の種別。それぞれ弱点となる武器系統を持つ */
export type EnemyKind = "carapace" | "phantom" | "aerial";

/** スキルの種類 */
export type SkillKind = "attack" | "aoe" | "heal" | "charge";

/** スキル */
export interface Skill {
  id: string;
  name: string;
  weapon: WeaponClass;
  kind: SkillKind;
  enCost: number;
  power: number;
  breakPower: number;
  heal: number;
}

/** 敵データ */
export interface EnemyDef {
  id: string;
  name: string;
  kind: EnemyKind;
  maxHp: number;
  attack: number;
  telegraphMs: number;
  intervalMs: number;
  breakThreshold: number;
  boss?: boolean;
}

/** 武器の種別（テンプレート）。実際の所持品は WeaponInstance */
export interface Weapon {
  id: string;
  name: string;
  weapon: WeaponClass;
  /** 順番に繰り出すスキルID（ローテーション） */
  skills: string[];
  desc: string;
}

/** レアリティ（高いほど強く、出にくい） */
export type Rarity = "normal" | "uncommon" | "rare" | "superrare" | "ultrarare";

/** 所持している武器1本（テンプレ＋レアリティ＋固有ID） */
export interface WeaponInstance {
  uid: string;
  baseId: string;
  rarity: Rarity;
  /** レアリティで付与される追加スキルID（ノーマルは無し） */
  bonusSkillId?: string;
}

/** ステージ定義 */
export interface StageDef {
  name: string;
  desc: string;
  enemies: EnemyDef[];
  /** ドロップ時のレアリティ抽選の重み [normal, uncommon, rare, superrare, ultrarare] */
  rarityWeights: number[];
  /** クリア時のドロップ本数 */
  drops: number;
}

/** ガード判定の結果段階。none=失敗(被弾) / guard=通常ガード / perfect=パーフェクトガード */
export type GuardResult = "none" | "guard" | "perfect";

/** 戦闘から発火する効果音イベント（mainがフレームごとに回収して再生する） */
export type SfxEvent = "warn" | "perfect" | "guard" | "hurt" | "break" | "die";

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
