// ===== 戦闘システムの型定義 =====
// すべてオリジナルの名称・概念で構成。元ネタの固有名詞・素材は一切使用しない。

/** 武器系統（3すくみの相性を持つ）。斬 / 突 / 打 */
export type WeaponClass = "slash" | "pierce" | "crush";

/** 敵の種別。それぞれ弱点となる武器系統を持つ */
export type EnemyKind = "carapace" | "phantom" | "aerial";

/** スキルの種類。attack=攻撃 / charge=ためる / focus=集中 */
export type SkillKind = "attack" | "charge" | "focus";

/** 状態異常・バフの種類。毒/凍結/弱体(防御down)＝敵, 激昂(攻撃up)＝自分 */
export type StatusKind = "poison" | "freeze" | "vulnerable" | "rage";
/** スキルが付与する状態異常・バフの定義 */
export interface SkillStatus {
  /** 付与対象：enemy=攻撃対象の敵 / self=プレイヤー自身 */
  target: "enemy" | "self";
  kind: StatusKind;
  /** 効果ターン数（プレイヤーの行動ごとに減少） */
  turns: number;
}

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
  /** 付与する状態異常・バフ（任意） */
  status?: SkillStatus;
}

/** 直近に発動したスキル（連携＝コンボ判定に使う） */
export interface LastSkill {
  kind: SkillKind;
  cls: WeaponClass;
  /** スキルID（特定スキル同士の連携判定に使う） */
  id: string;
}

/** スキル連携（連携技）の定義。first → second の順で出すと追撃が発生する */
export interface ComboDef {
  id: string;
  name: string;
  /** 1手目の条件：スキルID（特定スキル）。指定時は first(kind) より優先 */
  firstId?: string;
  /** 2手目の条件：スキルID（特定スキル）。指定時は second(kind) より優先 */
  secondId?: string;
  /** 1手目の条件：スキル種類（ためる/集中などの汎用連携用） */
  first?: SkillKind;
  /** 2手目の条件：スキル種類 */
  second?: SkillKind;
  /** first と別系統の武器で出す必要があるか */
  diffClass?: boolean;
  /** 連携成立時の追撃ヒット数 */
  bonusHits: number;
  desc: string;
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
  /** レアモンスター（強く・煌びやかで、レア武器を落とす特別な敵） */
  rare?: boolean;
  /** 特大ボス（通常ボスより大きなドット絵で描く＝ワールド最終ボスなど） */
  bigBoss?: boolean;
  /** 図鑑用の説明文 */
  desc?: string;
}

/** レアリティ（高いほど強く、出にくい） */
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legend" | "astral";

/**
 * 盾のパッシブ効果。
 * regen=毎行動HP回復 / guardWindow=ガード判定窓拡大 /
 * breakBonus=ブレイク中の敵への与ダメ増 / thorns=被弾時に反撃（敵攻撃力×value）
 */
export type ShieldPassiveKind = "regen" | "guardWindow" | "breakBonus" | "thorns";
export interface ShieldPassive {
  kind: ShieldPassiveKind;
  /** 効果量（regen=HP, guardWindow=判定倍率加算, breakBonus/thorns=割合） */
  value: number;
  /** パッシブ名（UI表示用） */
  name: string;
}

/**
 * 盾。武器とは別枠で装備する防具。スキルは持たず「防御力」とパッシブ効果を持ち、
 * 被ダメージを軽減する（パーフェクト無効化を除く）。
 */
export interface Shield {
  id: string;
  name: string;
  rarity: Rarity;
  /** 防御力（被ダメージから減算する） */
  defense: number;
  desc: string;
  /** パッシブ効果（任意。木盾は無し） */
  passive?: ShieldPassive;
}

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
  /** 強化レベル（1始まり。鍛冶屋で経験値を与えて上昇） */
  level?: number;
  /** 現在のレベル内で蓄積した経験値 */
  exp?: number;
  /** 覚醒回数（10レベルごとの壁を同武器合成で突破した回数） */
  awakened?: number;
  /** 装着した秘石ID列（ソケットごと。null=空きソケット）。長さはレアリティ依存 */
  sockets?: (string | null)[];
}

/** 秘石（ジェム）の効果種別：攻撃力／ブレイク蓄積／会心 */
export type GemKind = "attack" | "break" | "crit";

/** 秘石テンプレ。武器のソケットに装着して武器を強化する */
export interface Gem {
  id: string;
  name: string;
  kind: GemKind;
  /** 等級（1..3。高いほど強い） */
  tier: number;
  /** 表示色 */
  color: string;
  desc: string;
  /** 攻撃力の加算割合（例 0.16=+16%） */
  atkPct?: number;
  /** ブレイク蓄積の加算割合 */
  breakPct?: number;
  /** 会心率の加算(%) */
  critAdd?: number;
  /** 会心威力の加算（会心倍率に上乗せ。例 0.3=×倍率+0.3） */
  critMult?: number;
}

/** 武器インスタンス由来の補正（攻撃時に戦闘へ渡す＝武器本体のステータス） */
export interface WeaponMods {
  weapon: WeaponClass;
  attack: number;
  critChance: number;
  breakPower: number;
  /** 会心発生時の倍率に上乗せする加算（秘石由来。0=なし） */
  critMult?: number;
}

/** ステージ定義。各ステージは複数回の戦闘（waves）を持つ。endless=無限の回廊 */
export interface StageDef {
  name: string;
  desc: string;
  /** 各戦闘の敵編成（通常は最後がボス戦）。endless時は未使用 */
  waves: EnemyDef[][];
  /** 無限の回廊（終わりなく敵が出続け、到達階を記録） */
  endless?: boolean;
  /** 推奨レベル（表示用） */
  recommendLv?: number;
  /** 所属ワールド番号（1始まり。endlessは未設定） */
  world?: number;
}

/** ガード判定の結果段階。none=失敗(被弾) / guard=通常ガード / just=中間 / perfect=パーフェクトガード */
export type GuardResult = "none" | "guard" | "just" | "perfect";

/** 戦闘から発火する効果音イベント（mainがフレームごとに回収して再生する） */
export type SfxEvent = "warn" | "perfect" | "just" | "guard" | "hurt" | "break" | "die" | "crit" | "boss";

/** 戦闘のフェーズ */
export type BattlePhase = "fighting" | "won" | "lost";

/** 画面（ゲーム全体の状態遷移） */
export type Screen = "title" | "worldSelect" | "stageSelect" | "inventory" | "forge" | "shop" | "battle" | "result" | "howto" | "achievements" | "codex";

/** ショップで購入できる武器とその価格 */
export interface ShopItem {
  baseId: string;
  price: number;
}

/** ショップで購入できる宝箱（購入＝即開封。指定レアリティ帯の武器がランダムで出る） */
export interface ShopChest {
  id: string;
  name: string;
  /** この宝箱が出す武器のレアリティ帯 */
  rarity: Rarity;
  price: number;
}

/** セーブデータ */
export interface SaveData {
  /** 所持武器（過去の冒険で入手したものすべて） */
  inventory: WeaponInstance[];
  /** 系統ごとに装備中の武器インスタンスUID */
  equipped: Record<WeaponClass, string>;
  /** 装備中の盾ID（盾は固有でなくIDで管理。空文字＝なし） */
  equippedShield: string;
  /** これまでにクリアした最深ステージ番号(1始まり、0=未クリア) */
  bestStage: number;
  /** 所持ゴールド（ショップで使用） */
  gold: number;
  /** ショップで購入済みの武器baseId（売り切れ表示に使う） */
  purchased: string[];
  /** 削除ロック中の武器UID（削除・整理から保護） */
  locked: string[];
  /** 無限の回廊で到達した最高階 */
  bestFloor: number;
  /** プレイヤーレベル（1始まり。最大HPが上がる） */
  playerLevel: number;
  /** 現在レベル内で蓄積した経験値 */
  playerExp: number;
  /** ステージごとの最高スター獲得数（stageIndex → 1..3）。攻略度に使う */
  stageStars: Record<number, number>;
  /** 所持している秘石（gemId → 個数） */
  gems: Record<string, number>;
}
