import type {
  Skill, EnemyDef, WeaponClass, EnemyKind, Weapon, Rarity, WeaponInstance, StageDef, SkillKind,
  LastSkill, ComboDef, ShopItem, ShopChest, Shield, SkillStatus, StatusKind, Gem, GemKind, EnemyMove,
} from "./types.ts";
import weaponsJson from "./weapons.json";
import skillsJson from "./skills.json";
import enemiesJson from "./enemies.json";
import stagesJson from "./stages.json";

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
  status?: SkillStatus;
}
export const SKILLS: Skill[] = (skillsJson as RawSkill[]).map((s) => ({
  id: s.id, name: s.name, rarity: s.rarity, enCost: s.enCost, kind: s.kind,
  hits: s.hits ?? 1, targets: s.targets ?? 1,
  critAdd: s.critAdd ?? 0, critMult: s.critMult ?? CRIT_MULT_DEFAULT, breakMult: s.breakMult ?? 1,
  status: s.status,
}));

// ===== 状態異常・バフ =====
/** 毒：1ターンに敵の最大HPのこの割合だけ継続ダメージ */
export const POISON_PCT = 0.05;
/** 弱体（防御down）：被ダメージ倍率 */
export const VULNERABLE_MULT = 1.5;
/** 激昂（攻撃up）：与ダメージ倍率 */
export const RAGE_MULT = 1.5;
/** 状態異常の表示情報（名称・色・記号） */
export const STATUS_INFO: Record<StatusKind, { label: string; color: string; mark: string }> = {
  poison: { label: "毒", color: "#57d36b", mark: "毒" },
  freeze: { label: "凍結", color: "#5fe0ff", mark: "凍" },
  vulnerable: { label: "弱体", color: "#b96bff", mark: "弱" },
  rage: { label: "激昂", color: "#ff6b6b", mark: "激" },
};
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
  if (s.status) {
    const i = STATUS_INFO[s.status.kind];
    if (s.status.kind === "rage") parts.push(`自身に${i.label}(攻撃up)${s.status.turns}T`);
    else if (s.status.kind === "vulnerable") parts.push(`${i.label}(防御down)${s.status.turns}T付与`);
    else parts.push(`${i.label}${s.status.turns}T付与`);
  }
  return parts.join("・");
}

// ===== スキル連携（連携技：a→bの順で発動すると追撃が発生する） =====
// スキルは抽選でランダムに入手するため、連携は「スキルの並び」で定義する。
// 攻撃どうしの連携は“特定スキルの並び”に限定し、簡単に出過ぎないようにする。
export const COMBOS: ComboDef[] = [
  // 攻撃どうしの連携（特定スキル限定）
  { id: "spread", name: "連携・拡散", firstId: "single_hit", secondId: "double_target", bonusHits: 1, desc: "1回攻撃 → 2体攻撃 で追撃1" },
  { id: "twin",   name: "連携・連斬", firstId: "double_hit",  secondId: "double_hit",    bonusHits: 2, desc: "2回攻撃 → 2回攻撃 で追撃2" },
  { id: "rush",   name: "連携・連撃", firstId: "single_hit", secondId: "double_hit", bonusHits: 1, desc: "1回攻撃 → 2回攻撃 で追撃1" },
  { id: "storm",  name: "連携・乱舞", firstId: "double_hit", secondId: "triple_hit", bonusHits: 2, desc: "2回攻撃 → 3回攻撃 で追撃2" },
  { id: "pierce", name: "連携・連環", firstId: "crit_up",    secondId: "crit_double", bonusHits: 1, desc: "会心40% → 会心2倍 で追撃1" },
  // 汎用連携（kindベース：スキル構成に依らず誰でも狙える）。特定スキル連携が優先
  { id: "g_shift",  name: "連携・転技", first: "attack", second: "attack", diffClass: true, bonusHits: 1, desc: "別系統の攻撃を続けて追撃1" },
  { id: "g_charge", name: "連携・怒涛", first: "charge", second: "attack", bonusHits: 1, desc: "ためる → 攻撃 で追撃1" },
  { id: "g_focus",  name: "連携・静心", first: "focus",  second: "attack", bonusHits: 1, desc: "集中 → 攻撃 で追撃1" },
];

/** 直近スキル(last)と今出すスキル(skill/cls)で成立する連携を返す（なければ undefined） */
export function matchCombo(last: LastSkill | null, skill: Skill, cls: WeaponClass): ComboDef | undefined {
  if (!last) return undefined;
  return COMBOS.find((c) => {
    const firstOk = c.firstId ? c.firstId === last.id : c.first === last.kind;
    const secondOk = c.secondId ? c.secondId === skill.id : c.second === skill.kind;
    if (!firstOk || !secondOk) return false;
    if (c.diffClass && last.cls === cls) return false;
    return true;
  });
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

// ===== 盾（防具）：武器とは別枠で装備。スキルなし・防御力のみ =====
// 防御力は被ダメージから減算される（パーフェクトは元々0なので影響なし）。
// プレイヤーは最初から全種を所持し、インベントリで付け替える。
export const SHIELDS: Shield[] = [
  { id: "sh_wood",    name: "ウッドバックラー",     rarity: "common",   defense: 2,  desc: "軽い木の小盾。最低限の備え。" },
  { id: "sh_iron",    name: "アイアンガード",       rarity: "uncommon", defense: 5,  desc: "鉄板を張った頑丈な盾。",
    passive: { kind: "regen", value: 3, name: "自己再生" } },
  { id: "sh_knight",  name: "ナイトエイジス",       rarity: "rare",     defense: 8,  desc: "騎士団の紋章を刻んだ堅盾。",
    passive: { kind: "guardWindow", value: 0.25, name: "達人の構え" } },
  { id: "sh_obsidian",name: "オブシディアンウォール", rarity: "epic",     defense: 12, desc: "黒曜石の壁。重い一撃も受け止める。",
    passive: { kind: "breakBonus", value: 0.3, name: "破壊衝動" } },
  { id: "sh_aegis",   name: "ガーディアンハート",   rarity: "rare",     defense: 7,  desc: "祈りを込めた聖盾。弾いた者を癒す。",
    passive: { kind: "perfectHp", value: 25, name: "癒しの光" } },
  { id: "sh_tempest", name: "テンペストソウル",     rarity: "epic",     defense: 10, desc: "嵐の魂を封じた盾。弾く度に力が滾る。",
    passive: { kind: "perfectEn", value: 0, name: "嵐の心臓" } },
  { id: "sh_astral",  name: "アストラルバリア",     rarity: "legend",   defense: 18, desc: "星辰の力を宿す究極の防壁。",
    passive: { kind: "thorns", value: 0.5, name: "星の反撃" } },
];
/** パッシブ効果の説明文（UI表示用） */
export function shieldPassiveDesc(p: NonNullable<Shield["passive"]>): string {
  switch (p.kind) {
    case "regen": return `行動するたびにHPを${p.value}回復`;
    case "guardWindow": return `ガード判定の猶予が広がる（+${Math.round(p.value * 100)}%）`;
    case "breakBonus": return `ブレイク中の敵への与ダメージ+${Math.round(p.value * 100)}%`;
    case "thorns": return `被弾時、敵の攻撃力の${Math.round(p.value * 100)}%を反射ダメージ`;
    case "perfectHp": return `パーフェクトガード時のHP回復+${p.value}`;
    case "perfectEn": return "パーフェクトガード時にAPを全回復";
  }
}
const SHIELD_MAP: Record<string, Shield> = Object.fromEntries(SHIELDS.map((s) => [s.id, s]));
export function getShield(id: string): Shield | undefined { return SHIELD_MAP[id]; }
/** 初期装備の盾ID（最弱の木盾） */
export const DEFAULT_SHIELD_ID = "sh_wood";

// ===== 武器インスタンス生成・スキル抽選 =====
/** レアリティごとのスキル数：コモン〜レア=1、エピック以上=2 */
export function skillCountForRarity(r: Rarity): number {
  return rarityIndex(r) >= rarityIndex("epic") ? 2 : 1;
}
/**
 * スキル抽選の重み（低レアほど出やすい。レアリティで階段状に変化）。
 * アストラル武器プール（全スキル対象・合計重み100）での1スキルあたり出現率：
 * common 33% / uncommon 9% / rare 6% / epic 4% / legend 2% / astral 1%
 */
const SKILL_DRAW_WEIGHT: Record<Rarity, number> = {
  common: 33, uncommon: 9, rare: 6, epic: 4, legend: 2, astral: 1,
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

/** スキルリロール（鍛冶屋）のゴールドコスト（武器レアリティ依存）。厳選は3倍 */
export const REROLL_COST: Record<Rarity, number> = {
  common: 150, uncommon: 200, rare: 300, epic: 800, legend: 1500, astral: 2500,
};
/** リロール候補を n 個抽選（現在のスキルと重複しない・武器レアリティ以下から） */
export function rollSkillCandidates(weaponRarity: Rarity, exclude: string[], n: number): string[] {
  const max = rarityIndex(weaponRarity);
  const pool = SKILLS.filter((s) => rarityIndex(s.rarity) <= max && !exclude.includes(s.id));
  const out: Skill[] = [];
  for (let i = 0; i < n; i++) {
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
  return { uid: newUid(), baseId, skillIds, level: 1, exp: 0, awakened: 0 };
}

/** 武器ドロップ率の全体倍率（少し下げる） */
const DROP_RATE_MULT = 0.85;
/** レアリティが高い武器ほどドロップ率を下げる倍率。高レアは大幅に絞る（エピックで実効約10%） */
const RARITY_DROP_MULT: Record<Rarity, number> = {
  common: 1.0, uncommon: 0.95, rare: 0.8, epic: 0.5, legend: 0.2, astral: 0.1,
};

/** 敵の撃破ドロップを判定（率で外れあり。高レア武器ほど出にくい） */
export function rollEnemyDrop(def: EnemyDef): WeaponInstance | undefined {
  if (!def.dropWeaponId || !def.dropRate) return undefined;
  // レアモンスターは出会うこと自体が稀なので、絞り込み倍率を無視して dropRate そのままで落とす
  if (def.rare) {
    if (Math.random() * 100 >= def.dropRate) return undefined;
    return makeInstance(def.dropWeaponId);
  }
  const w = getWeapon(def.dropWeaponId);
  const rmult = w ? RARITY_DROP_MULT[w.rarity] : 1;
  const eff = def.dropRate * DROP_RATE_MULT * rmult;
  if (Math.random() * 100 >= eff) return undefined;
  return makeInstance(def.dropWeaponId);
}

/** 敵が落とすゴールド。強い敵（HP・攻撃力が高い／ボス）ほど多い。±10%のゆらぎ */
export function rollEnemyGold(def: EnemyDef): number {
  const base = def.maxHp * 0.4 + def.attack * 2;
  const boss = def.boss ? 1.8 : 1;
  const jitter = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(base * boss * jitter));
}

// ===== ショップ（ゴールドで武器を購入） =====
/** ショップの品揃え。購入時はレアリティに応じてスキルが抽選される */
export const SHOP_ITEMS: ShopItem[] = [
  { baseId: "w_iron_edge",     price: 120 },
  { baseId: "w_steel_lance",   price: 120 },
  { baseId: "w_war_mallet",    price: 140 },
  { baseId: "w_shadow_blade",  price: 240 },
  { baseId: "w_stone_mace",    price: 200 },
  { baseId: "w_wind_pike",     price: 280 },
  { baseId: "w_storm_saber",   price: 560 },
  { baseId: "w_ice_needle",    price: 560 },
  { baseId: "w_quake_hammer",  price: 560 },
  { baseId: "w_dragoon_blade", price: 1500 },
  { baseId: "w_thunder_spear", price: 1200 },
  { baseId: "w_earth_crusher", price: 1500 },
  { baseId: "w_flame_sword",   price: 3200 },
  { baseId: "w_void_glaive",   price: 3400 },
  { baseId: "w_mjolnir",       price: 4000 },
];

// ===== ショップ：宝箱（購入＝即開封。レアリティ帯の武器がランダムで出る） =====
export const SHOP_CHESTS: ShopChest[] = [
  { id: "chest_common",   name: "なめし革の宝箱", rarity: "common",   price: 100 },
  { id: "chest_uncommon", name: "青銅の宝箱",     rarity: "uncommon", price: 260 },
  { id: "chest_rare",     name: "白銀の宝箱",     rarity: "rare",     price: 620 },
  { id: "chest_epic",     name: "魔晶の宝箱",     rarity: "epic",     price: 1400 },
  { id: "chest_legend",   name: "黄金の宝箱",     rarity: "legend",   price: 3000 },
  { id: "chest_astral",   name: "星辰の宝箱",     rarity: "astral",   price: 6000 },
];

/** 指定レアリティ帯の武器を1本ランダムに引く（該当が無ければ近いレアリティで代替） */
export function rollChestWeapon(rarity: Rarity): WeaponInstance {
  let pool = WEAPONS.filter((w) => w.rarity === rarity);
  // 該当レアリティが無ければ、低い方へ繰り下げて探す
  for (let r = rarityIndex(rarity) - 1; pool.length === 0 && r >= 0; r--) {
    pool = WEAPONS.filter((w) => w.rarity === RARITY_ORDER[r]);
  }
  if (pool.length === 0) pool = WEAPONS.slice();
  const w = pool[Math.floor(Math.random() * pool.length)];
  return makeInstance(w.id);
}

/** エピック以上（epic/legend/astral）の武器からランダムに1本（初回クリア報酬など） */
export function rollEpicPlusWeapon(): WeaponInstance {
  const pool = WEAPONS.filter((w) => w.rarity === "epic" || w.rarity === "legend" || w.rarity === "astral");
  if (pool.length === 0) return rollChestWeapon("epic");
  const w = pool[Math.floor(Math.random() * pool.length)];
  return makeInstance(w.id);
}

// ===== 武器の強化（鍛冶屋）：レベル・経験値・覚醒 =====
/** 10レベルごとに「覚醒」の壁。覚醒回数の上限 */
export const AWAKEN_STEP = 10;
export const MAX_AWAKEN = 5;
/** 覚醒回数から現在のレベル上限を求める（覚醒0=10, 1=20, …, 5=60） */
export function levelCap(awakened: number): number {
  return (Math.min(MAX_AWAKEN, awakened) + 1) * AWAKEN_STEP;
}
/** 次の覚醒に必要な「同一武器」の素材数（1,2,3,4,5本） */
export function awakenCost(awakened: number): number {
  return Math.min(MAX_AWAKEN, awakened) + 1;
}

/** レベルL→L+1 に必要な経験値（レアリティが高いほど多く要る） */
const EXP_BASE: Record<Rarity, number> = {
  common: 50, uncommon: 90, rare: 150, epic: 260, legend: 420, astral: 640,
};
export function expForNext(rarity: Rarity, level: number): number {
  return Math.round(EXP_BASE[rarity] * (1 + (level - 1) * 0.45));
}

/** 素材にしたときに与える経験値（レアリティ基準＋これまでの強化分を一部還元） */
const MATERIAL_EXP: Record<Rarity, number> = {
  common: 35, uncommon: 70, rare: 130, epic: 240, legend: 420, astral: 700,
};
export function materialExp(inst: WeaponInstance): number {
  const w = getWeapon(inst.baseId);
  if (!w) return 0;
  const base = MATERIAL_EXP[w.rarity];
  const lvBonus = ((inst.level ?? 1) - 1) * Math.round(base * 0.15);
  const awBonus = (inst.awakened ?? 0) * base;
  return base + lvBonus + awBonus;
}

/** レベル・覚醒を反映した実効ステータス（攻撃・ブレイク・会心が伸びる） */
export function effectiveWeapon(inst: WeaponInstance): Weapon | undefined {
  const w = getWeapon(inst.baseId);
  if (!w) return undefined;
  const lv = inst.level ?? 1;
  const aw = inst.awakened ?? 0;
  const lvMult = 1 + (lv - 1) * 0.06; // 1レベルごとに基礎の+6%
  const awMult = 1 + aw * 0.10;       // 覚醒ごとに+10%
  const gem = socketBonuses(inst);    // 装着した秘石の合計ボーナス
  return {
    ...w,
    attack: Math.round(w.attack * lvMult * awMult * (1 + gem.atkPct)),
    breakPower: Math.round(w.breakPower * lvMult * awMult * (1 + gem.breakPct)),
    critChance: w.critChance + aw * 2 + gem.critAdd,
  };
}

// ===== 秘石（ジェム）：武器のソケットに装着して強化する =====
/** レアリティごとのソケット数（高レアほど多い） */
export const SOCKETS_BY_RARITY: Record<Rarity, number> = {
  common: 1, uncommon: 1, rare: 2, epic: 2, legend: 3, astral: 4,
};
/** その武器インスタンスのソケット数（レアリティ依存） */
export function socketCount(inst: WeaponInstance): number {
  const w = getWeapon(inst.baseId);
  return w ? SOCKETS_BY_RARITY[w.rarity] : 1;
}

/** 効果種別ごとの表示情報 */
export const GEM_KIND_INFO: Record<GemKind, { label: string; color: string }> = {
  attack: { label: "攻撃", color: "#ff4d6a" },
  break: { label: "ブレイク", color: "#ff9e2e" },
  crit: { label: "会心", color: "#ffd34d" },
};
/** 全秘石（3種 × 3等級）。tierが上がるほど効果が高い */
export const GEMS: Gem[] = [
  { id: "gem_atk_1", name: "攻撃の秘石Ⅰ", kind: "attack", tier: 1, color: "#ff8095", desc: "攻撃力 +8%", atkPct: 0.08 },
  { id: "gem_atk_2", name: "攻撃の秘石Ⅱ", kind: "attack", tier: 2, color: "#ff4d6a", desc: "攻撃力 +16%", atkPct: 0.16 },
  { id: "gem_atk_3", name: "攻撃の秘石Ⅲ", kind: "attack", tier: 3, color: "#ff1f47", desc: "攻撃力 +28%", atkPct: 0.28 },
  { id: "gem_brk_1", name: "烈破の秘石Ⅰ", kind: "break", tier: 1, color: "#ffc06b", desc: "ブレイク蓄積 +12%", breakPct: 0.12 },
  { id: "gem_brk_2", name: "烈破の秘石Ⅱ", kind: "break", tier: 2, color: "#ff9e2e", desc: "ブレイク蓄積 +24%", breakPct: 0.24 },
  { id: "gem_brk_3", name: "烈破の秘石Ⅲ", kind: "break", tier: 3, color: "#ff7a00", desc: "ブレイク蓄積 +40%", breakPct: 0.40 },
  { id: "gem_crt_1", name: "会心の秘石Ⅰ", kind: "crit", tier: 1, color: "#ffe27a", desc: "会心率 +6% / 会心威力 +0.15", critAdd: 6, critMult: 0.15 },
  { id: "gem_crt_2", name: "会心の秘石Ⅱ", kind: "crit", tier: 2, color: "#ffd34d", desc: "会心率 +12% / 会心威力 +0.30", critAdd: 12, critMult: 0.30 },
  { id: "gem_crt_3", name: "会心の秘石Ⅲ", kind: "crit", tier: 3, color: "#ffc400", desc: "会心率 +20% / 会心威力 +0.50", critAdd: 20, critMult: 0.50 },
];
const GEM_MAP: Record<string, Gem> = Object.fromEntries(GEMS.map((g) => [g.id, g]));
export function getGem(id: string): Gem | undefined { return GEM_MAP[id]; }

/** 装着済み秘石の合計ボーナス */
export interface SocketBonus { atkPct: number; breakPct: number; critAdd: number; critMult: number; }
export function socketBonuses(inst: WeaponInstance): SocketBonus {
  const b: SocketBonus = { atkPct: 0, breakPct: 0, critAdd: 0, critMult: 0 };
  for (const gid of inst.sockets ?? []) {
    const g = gid ? GEM_MAP[gid] : undefined;
    if (!g) continue;
    b.atkPct += g.atkPct ?? 0;
    b.breakPct += g.breakPct ?? 0;
    b.critAdd += g.critAdd ?? 0;
    b.critMult += g.critMult ?? 0;
  }
  return b;
}

/**
 * ボス/乱入ボス撃破時の秘石ドロップを抽選。落ちなければ undefined。
 * 通常ボスは中確率で低〜中等級、乱入ボスは確定で中〜高等級。ワールドが進むほど等級が上がりやすい。
 */
export function rollGemDrop(world: number | undefined, isAmbush: boolean): string | undefined {
  if (!isAmbush && Math.random() >= 0.6) return undefined; // 通常ボスは60%
  const w = world ?? 1;
  // 等級重み（ambushや高ワールドほど上位が出やすい）
  let tier: number;
  const r = Math.random();
  if (isAmbush) {
    tier = r < 0.45 ? 3 : r < 0.85 ? 2 : 1;
  } else if (w >= 4) {
    tier = r < 0.15 ? 3 : r < 0.55 ? 2 : 1;
  } else if (w >= 2) {
    tier = r < 0.35 ? 2 : 1;
  } else {
    tier = r < 0.15 ? 2 : 1;
  }
  const pool = GEMS.filter((g) => g.tier === tier);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

// ===== 敵（enemies.json から読み込み） =====
interface RawEnemy {
  id: string; name: string; kind: EnemyKind; maxHp: number; attack: number;
  telegraphMs: number; countStart: number; breakThreshold: number;
  dropWeaponId?: string; dropRate?: number; boss?: boolean; rare?: boolean; desc?: string;
  moves?: EnemyMove[]; enrage?: boolean;
}
/** 全敵データ（図鑑用。定義順） */
export const ENEMIES: EnemyDef[] = (enemiesJson as RawEnemy[]).map((e) => e as EnemyDef);
const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
export function getEnemy(id: string): EnemyDef | undefined { return ENEMY_MAP[id]; }

// ===== 乱入イベント（ステージクリア後に低確率でレアボスが乱入） =====
/** 乱入レアボスのID */
export const AMBUSH_BOSS_ID = "rift_reaver";
/** 乱入の発生確率（通常ダンジョンのクリア時） */
export const AMBUSH_CHANCE = 0.1;
/** ワールド係数で強化した乱入ボスのコピーを返す */
export function ambushBoss(world?: number): EnemyDef {
  const base = ENEMY_MAP[AMBUSH_BOSS_ID];
  return scaleWaveForWorld([base], world)[0];
}

// ===== レアモンスター出現 =====
/** レアモンスターのID（煌びやかで強い・レア武器を落とす） */
export const RARE_ENEMY_ID = "gem_drake";
/** 通常戦闘にレアモンスターが混ざる確率（ボス戦を除く） */
export const RARE_SPAWN_CHANCE = 0.1;
/**
 * 通常戦闘の編成に、低確率でレアモンスターを追加する。
 * ボス戦には乱入させない。出現すれば群れに1体加わる。
 */
export function withRareSpawn(enemies: EnemyDef[], isBoss: boolean): EnemyDef[] {
  const rare = ENEMY_MAP[RARE_ENEMY_ID];
  if (isBoss || !rare) return enemies;
  if (Math.random() < RARE_SPAWN_CHANCE) return [...enemies, rare];
  return enemies;
}

// ===== ステージ（stages.json から読み込み） =====
interface RawStage { name: string; desc: string; waves: string[][]; endless?: boolean; recommendLv?: number; world?: number; }
export const STAGES: StageDef[] = (stagesJson as RawStage[]).map((s) => ({
  name: s.name,
  desc: s.desc,
  waves: s.waves.map((wave) => wave.map((id) => ENEMY_MAP[id]).filter(Boolean)),
  endless: s.endless,
  recommendLv: s.recommendLv,
  world: s.world,
}));
export const STAGE_COUNT = STAGES.length;

/** 無限の回廊（endless）のステージ番号。ワールドのダンジョン一覧からは除外する */
export const ENDLESS_INDEX = STAGES.findIndex((s) => s.endless);

/** ワールドごとのコンセプト名（背景テーマと対応） */
export const WORLD_CONCEPTS: Record<number, string> = {
  1: "芽吹きの森",
  2: "業火の火山",
  3: "永久凍土",
  4: "雷鳴の天空",
  5: "星辰の深淵",
};

/** ワールド定義：番号・名前・コンセプト・属するダンジョン（STAGESの添字）の並び */
export interface WorldDef { world: number; name: string; concept: string; stageIndices: number[]; }
export const WORLDS: WorldDef[] = (() => {
  const map = new Map<number, number[]>();
  STAGES.forEach((s, i) => {
    if (s.endless || s.world == null) return;
    if (!map.has(s.world)) map.set(s.world, []);
    map.get(s.world)!.push(i);
  });
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([world, stageIndices]) => ({
      world, name: `WORLD ${world}`, concept: WORLD_CONCEPTS[world] ?? "", stageIndices,
    }));
})();

/** 選択画面で見せる「ドロップしうる武器」一覧（重複なし） */
export function stageDropPreview(stageIndex: number): string[] {
  const st = STAGES[stageIndex];
  if (!st) return [];
  if (st.endless) return ["w_mjolnir", "w_void_glaive", "w_flame_sword", "w_astral_edge", "w_earth_crusher", "w_thunder_spear"];
  const ids: string[] = [];
  for (const wave of st.waves) {
    for (const e of wave) if (e.dropWeaponId && !ids.includes(e.dropWeaponId)) ids.push(e.dropWeaponId);
  }
  return ids;
}

// ===== ワールド難易度カーブ：後のワールドほど敵を強くする =====
// 同じ敵を流用しても、ワールド係数で HP/攻撃/ブレイク閾値を底上げして段階的な難易度に。
// ワールド1は等倍（既存バランス・セーブ感覚を維持）。
export const WORLD_DIFFICULTY: Record<number, number> = { 1: 1.0, 2: 1.35, 3: 1.8, 4: 2.4, 5: 3.1 };
/** 攻撃力だけは係数に上限を設ける（終盤の2発即死ゲー化を防ぐ。HP/ブレイクはフル係数） */
export const WORLD_ATTACK_CAP = 2.2;
export function worldScale(world?: number): number {
  return (world != null && WORLD_DIFFICULTY[world]) || 1;
}
/** ウェーブの敵をワールド係数でスケールした「コピー」を返す（元データは破壊しない） */
export function scaleWaveForWorld(enemies: EnemyDef[], world?: number): EnemyDef[] {
  const m = worldScale(world);
  if (m === 1) return enemies;
  const atkM = Math.min(m, WORLD_ATTACK_CAP);
  return enemies.map((e) => ({
    ...e,
    maxHp: Math.round(e.maxHp * m),
    attack: Math.round(e.attack * atkM),
    breakThreshold: Math.round(e.breakThreshold * m),
  }));
}

// ===== 無限の回廊：階層ごとにランダムな敵を生成（階が深いほど強い） =====
const ENDLESS_POOL = [
  "sand_crab", "bone_ghost", "sky_moth",
  "shell_crawler", "wraith_feather", "gloom_shade", "venom_lurker",
  "mud_beetle", "shadow_lurker", "thunder_hawk",
  "ember_hound", "stone_sentinel", "ice_crawler", "frost_drake", "frost_imp",
  "iron_tortoise", "vile_specter", "storm_wyvern",
];
const ENDLESS_BOSSES = [
  "shell_warden", "wraith_monarch", "carapace_tyrant", "frost_dragon", "shadow_tyrant",
];
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** floor階の敵編成を生成。5階ごとにボス。HP/攻撃/Breakを階層で強化 */
export function endlessFloorEnemies(floor: number): EnemyDef[] {
  const scale = 1 + (floor - 1) * 0.13;
  const buff = (id: string): EnemyDef => {
    const b = ENEMY_MAP[id];
    return {
      ...b,
      maxHp: Math.round(b.maxHp * scale),
      attack: Math.round(b.attack * scale),
      breakThreshold: Math.round(b.breakThreshold * scale),
    };
  };
  if (floor % 5 === 0) return [buff(pick(ENDLESS_BOSSES))];
  const count = floor < 3 ? 1 : floor < 7 ? 2 : 3;
  return Array.from({ length: count }, () => buff(pick(ENDLESS_POOL)));
}

// ===== プレイヤー =====
/** プレイヤー基礎最大HP（レベル1）。レベルで上昇する */
export const PLAYER_MAX_HP = 130;
/** レベルアップ1段ごとの最大HP上昇量（難易度維持のため控えめに） */
export const HP_PER_LEVEL = 4;
/** プレイヤーレベル上限 */
export const MAX_PLAYER_LEVEL = 50;
/** レベル level → level+1 に必要な経験値 */
export function playerExpForNext(level: number): number {
  return Math.round(60 + (level - 1) * 45);
}
/** プレイヤーレベルでの最大HP */
export function playerMaxHpAt(level: number): number {
  return PLAYER_MAX_HP + (Math.max(1, level) - 1) * HP_PER_LEVEL;
}
/** 敵を撃破して得られる経験値（強い敵・ボスほど多い） */
export function enemyExp(def: EnemyDef): number {
  const base = def.maxHp * 0.22 + def.attack * 1.6;
  const boss = def.boss ? 2.2 : def.rare ? 1.8 : 1;
  return Math.max(1, Math.round(base * boss));
}
// ENは最大10のシンプルな管理に。スキルコストは1〜10。
export const PLAYER_MAX_EN = 10;

// ===== EN回復（自動回復なし。休憩・ガード成功のみ） =====
export const REST_EN_RECOVER = 3;
// 通常ガードはわずか、JUSTは中程度、パーフェクトはEN最大まで全回復。
export const GUARD_EN_RECOVER = 1;
export const JUST_EN_RECOVER = 2;
// ※パーフェクトガードはENを最大まで全回復する（固定値ではないため定数なし）
/** 敵を撃破したときのEN回復量 */
export const KILL_EN_RECOVER = 3;

// ===== ガード判定の窓 =====
// 着弾までの残り時間がこの範囲ならガード成立。
// PERFECT は着弾ギリギリ（手応えのある狭さ）、その少し手前がJUST、さらに手前が通常ガード。
export const PERFECT_WINDOW_MS = 140;
export const JUST_WINDOW_MS = 240;
export const GUARD_WINDOW_MS = 430;

// ===== ガード効果 =====
// 通常ガードは「軽減はするが地味」。JUSTは中間。パーフェクトは「完全無効＋回復＋怯ませ」。
// 回復量は控えめにし、盾パッシブ（癒しの光/嵐の心臓）で回復特化・攻め特化を選ばせる。
export const GUARD_DAMAGE_MULT = 0.55;
export const JUST_DAMAGE_MULT = 0.25;
export const PERFECT_HP_RECOVER = 15;
/** パーフェクト時のEN回復量（全回復は盾パッシブ「嵐の心臓」の特権に） */
export const PERFECT_EN_RECOVER = 4;

// ===== パーフェクトガードの演出・怯ませ =====
/** パーフェクト成功時のヒットストップ（完全静止）時間 */
export const HITSTOP_MS = 150;
/** 通常ヒット時の軽いヒットストップ（0.05秒の手応え） */
export const HIT_HITSTOP_MS = 50;
/** ヒットストップ後のスローモーション時間（パーフェクトの余韻を長く） */
export const SLOWMO_MS = 1040;
/** スローモーション中の時間倍率（小さいほど遅い） */
export const SLOWMO_SCALE = 0.3;
/** パーフェクト時の画面ホワイトアウト時間 */
export const WHITE_FLASH_MS = 240;
/** パーフェクトで敵に与える怯み（次の攻撃を遅らせる）時間 */
export const PERFECT_FLINCH_MS = 650;
/** パーフェクトで敵のブレイクゲージに加算する蓄積量 */
export const PERFECT_BREAK_BONUS = 14;

/**
 * 攻撃の「溜め」時間(ms)。攻撃ボタンを押してから実際に着弾するまでのラグ。
 * この間プレイヤーは構えモーションを取り、ダメージ・敵カウント進行は着弾時に発生する。
 */
export const ATTACK_WINDUP_MS = 380;

/** スキル名バナー（発動時にプレイヤー右へ左からフェードイン）の表示時間(ms) */
export const SKILL_BANNER_MS = 1100;

/** 敗北演出（スロー＋敗北宣言）の長さ(ms)。これが終わるとリザルトへ遷移する */
export const LOSE_ANIM_MS = 2500;

/** 戦闘クリア後、CLEARバナーを見せてから次のウェーブ／リザルトへ移すまでの待機(ms) */
export const WIN_HOLD_MS = 500;

/** ステージクリア（最終ボス撃破）演出：STAGE CLEAR を見せてから暗転→リザルトへ移すまでの長さ(ms) */
export const STAGE_CLEAR_HOLD_MS = 2600;
/** ステージクリア時のスローモーション時間(ms)。ボス撃破の瞬間をゆっくり見せる */
export const STAGE_CLEAR_SLOWMO_MS = 1400;

/** ボス戦開始の警告演出（画面を暗くし BOSS BATTLE を見せる）の長さ(ms) */
export const BOSS_INTRO_MS = 2000;

// ===== 乱入ボスの WARNING 演出（暗転→WARNING→ボス登場）の各フェーズ長(ms) =====
export const WARN_BLACK_MS = 1000;   // 完全暗転
export const WARN_SHOW_MS = 3000;    // WARNING 表示
export const WARN_FADE_MS = 800;     // WARNING＋暗転が晴れてボスが現れる
export const WARN_TOTAL_MS = WARN_BLACK_MS + WARN_SHOW_MS + WARN_FADE_MS;

// ===== 攻撃の「溜め待ち」（カウント0到達後、! が出るまでのランダムな間） =====
// カウントが0になった敵は、すぐには攻撃せず 0 のままランダムな時間だけ待ってから
// びっくりマーク（予兆）を出して攻撃する。敵ごとに毎回この待ち時間を抽選するため、
// 同じ編成でも攻撃タイミングが読みにくくなる（フェイント感）。
export const READY_WAIT_MIN_MS = 350;
export const READY_WAIT_MAX_MS = 2200;

// びっくりマーク（予兆）が出てから着弾までの時間スケール。
// 0待ちで十分に溜めを取るため、! が出たら「すぐ攻撃」＝短い反応ガード窓にする。
// 敵ごとの telegraphMs に掛けて使う（速い敵ほど短い）。最低 TELEGRAPH_MIN_MS は確保。
export const TELEGRAPH_SCALE = 0.55;
export const TELEGRAPH_MIN_MS = 480;

/**
 * 戦闘（ウェーブ）開始直後、敵が出てくる瞬間の行動禁止時間(ms)。
 * この間はプレイヤーは攻撃・ガード等ができず、敵の登場を見てから始まる。
 */
export const SPAWN_LOCK_MS = 650;

// ===== 演出の表示時間（発動した表記を1秒ほど画面に残す） =====
/** ダメージ・連携・回復などの浮遊テキストの寿命(ms) */
export const FLOAT_TTL = 1300;
/** ダメージ数値（爆発表記）の寿命(ms)。出したらすぐ消えるよう短め */
export const DAMAGE_TTL = 1000;
/** 浮遊テキスト/バッジが消える直前のフェード時間(ms)。これより前は不透明で読みやすい */
export const FLOAT_FADE_MS = 400;
/** PERFECT/JUST/GUARD バッジの表示時間(ms) */
export const GUARD_BADGE_MS = 1100;

// ===== 敵の行動タイプ =====
/** 種別デフォルトの行動ローテーション（3回に1回だけ特殊行動＝序盤は穏やかに） */
export const DEFAULT_MOVES: Record<EnemyKind, EnemyMove[]> = {
  carapace: ["attack", "attack", "heavy"],
  aerial: ["attack", "attack", "double"],
  phantom: ["attack", "attack", "venom"],
};
/** その敵の行動ローテーション（個別定義があれば優先） */
export function movesFor(def: EnemyDef): EnemyMove[] {
  return def.moves && def.moves.length > 0 ? def.moves : DEFAULT_MOVES[def.kind];
}
/** 行動タイプの表示情報（予兆チップ用）。attackはチップなし */
export const MOVE_INFO: Record<EnemyMove, { mark: string; color: string; label: string } | null> = {
  attack: null,
  heavy: { mark: "強", color: "#ff3b30", label: "強撃" },
  double: { mark: "連", color: "#ff9e2e", label: "連撃" },
  venom: { mark: "毒", color: "#3fae54", label: "毒撃" },
  howl: { mark: "咆", color: "#b96bff", label: "咆哮" },
  heal: { mark: "癒", color: "#2bb69a", label: "回復" },
};
/** 強撃：予兆が遅く（読みやすく）、ダメージが重い */
export const HEAVY_TELEGRAPH_MULT = 1.4;
export const HEAVY_DMG_MULT = 1.8;
/** 連撃：1発ごとの威力は軽いが2発来る。2発目の短い予兆時間 */
export const DOUBLE_DMG_MULT = 0.7;
export const DOUBLE_SECOND_MS = 420;
/** 毒撃：被弾（パーフェクト以外）でプレイヤーが毒に */
export const PLAYER_POISON_TURNS = 2;
export const PLAYER_POISON_PCT = 0.04;
/** 咆哮：敵全体の攻撃バフ */
export const HOWL_ATK_MULT = 1.3;
export const HOWL_TURNS = 3;
/** 回復：最もHPが減った味方を最大HPの15%回復 */
export const HEAL_PCT = 0.15;
/** 発狂：攻撃+25%（カウント-1は engine 側） */
export const ENRAGE_ATK_MULT = 1.25;

// ===== 弱点 =====
/** 非弱点（弱点でない系統）で攻撃したときのダメージ倍率（弱点を突く価値を明確にする） */
export const OFF_WEAK_DMG_MULT = 0.6;
/** 非弱点で攻撃したときのブレイク蓄積倍率（ブレイクは実質「弱点必須」にする） */
export const OFF_WEAK_BREAK_MULT = 0.15;
/** 弱点変化ボス：この行動数ごとに弱点をシフト（1つ前で予告） */
export const WEAK_SHIFT_INTERVAL = 4;

// ===== ブレイク =====
// ブレイクは「ターン制」。この間プレイヤーはENを消費せず行動でき、敵は攻撃しない。
export const BREAK_TURNS = 3;
/** ブレイク中の敵への与ダメージ倍率（弱点で崩す→総攻撃、の見返りを大きく） */
export const BREAK_CRIT_MULT = 2.1;
/** ブレイク蓄積の全体倍率（大きいほどブレイクしやすい） */
export const BREAK_RATE_MULT = 1.2;
/** 弱点属性で攻撃したときのブレイク蓄積の追加倍率 */
export const BREAK_WEAK_MULT = 1.6;

/** 初期インベントリ（各系統の先頭武器を1本ずつ。武器リスト変更にも追従） */
export function starterInventory(): WeaponInstance[] {
  const out: WeaponInstance[] = [];
  for (const cls of ["slash", "pierce", "crush"] as WeaponClass[]) {
    const w = WEAPONS.find((x) => x.weapon === cls);
    if (w) out.push(makeInstance(w.id));
  }
  return out;
}
