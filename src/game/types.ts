// ===== 戦闘システムの型定義 =====
// すべてオリジナルの名称・概念で構成。元ネタの固有名詞・素材は一切使用しない。

/** 武器系統（3すくみの相性を持つ）。斬 / 突 / 打 */
export type WeaponClass = "slash" | "pierce" | "crush";

/** 敵の種別。それぞれ弱点となる武器系統を持つ */
export type EnemyKind = "carapace" | "phantom" | "aerial";

/** スキルの種類 */
export type SkillKind =
  | "attack" // 単体攻撃
  | "aoe" // 全体攻撃（敵全体）
  | "heal" // 自己HP回復
  | "charge"; // ためる（次の攻撃を強化）

/** プレイヤーが使えるスキル */
export interface Skill {
  id: string;
  name: string;
  weapon: WeaponClass;
  kind: SkillKind;
  /** 消費EN（エナジー） */
  enCost: number;
  /** 基礎ダメージ（attack/aoe） */
  power: number;
  /** ブレイク蓄積量（attack/aoe） */
  breakPower: number;
  /** 回復量（heal） */
  heal: number;
}

/** 敵データ */
export interface EnemyDef {
  id: string;
  name: string;
  kind: EnemyKind;
  maxHp: number;
  /** 攻撃力 */
  attack: number;
  /** 攻撃の予兆〜着弾までの時間(ms)。短いほど反応が難しい */
  telegraphMs: number;
  /** 攻撃と攻撃の間隔(ms)。小さいほど攻撃頻度が高い */
  intervalMs: number;
  /** ブレイクまでに必要な蓄積量 */
  breakThreshold: number;
  /** 撃破報酬（霊片） */
  reward: number;
  /** ボス敵かどうか（演出・難度用） */
  boss?: boolean;
  /** 撃破時に入手できる武器ID（未所持なら入手） */
  dropWeapon?: string;
}

/**
 * 武器。各武器は1つの系統に属し、固有のスキルを順番に繰り出す（収集要素）。
 * 例: スキルが2つなら、攻撃ボタンを押すたびに交互に発動する。
 */
export interface Weapon {
  id: string;
  name: string;
  weapon: WeaponClass;
  /** この武器が順番に繰り出すスキルID（ローテーション） */
  skills: string[];
  /** フレーバー説明 */
  desc: string;
}

/** ガード判定の結果段階 */
export type GuardResult = "none" | "guard" | "just" | "parry";

/** 戦闘のフェーズ */
export type BattlePhase = "fighting" | "won" | "lost";

/** 画面（ゲーム全体の状態遷移） */
export type Screen = "battle" | "reward" | "clear" | "gameover";

/** セーブデータ（育成の永続化） */
export interface SaveData {
  /** 所持している霊片（強化通貨） */
  shards: number;
  /** スキルIDごとの強化レベル（1始まり） */
  skillLevels: Record<string, number>;
  /** これまでに到達した最深ステージ番号(1始まり) */
  bestStage: number;
  /** 所持している武器ID一覧 */
  ownedWeapons: string[];
  /** 系統ごとに装備中の武器ID */
  equipped: Record<WeaponClass, string>;
}
