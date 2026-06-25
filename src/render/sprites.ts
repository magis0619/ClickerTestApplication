// ===== ドット絵スプライト（すべてコード内で定義したオリジナル） =====
// 各行の1文字が1ピクセル。"." は透明。文字→色は palette で対応。

export interface Sprite {
  rows: string[];
  palette: Record<string, string>;
}

const KNIGHT_PAL: Record<string, string> = {
  o: "#0c0a18", // 輪郭
  m: "#c2cdf2", // 兜メタル(明)
  d: "#6f7bb0", // メタル(暗)
  s: "#f0c8a0", // 肌
  c: "#2c6fb8", // 濃青
  b: "#5fa8ff", // 装甲青
  y: "#ffd35f", // 金
  w: "#eaeaf6", // 刃
};

/** プレイヤー：青の守人（剣を構える） */
export const WARDEN: Sprite = {
  palette: KNIGHT_PAL,
  rows: [
    "....oooo...w",
    "...ommmmo..w",
    "..ommddmmo.w",
    "..omdssdmo.w",
    "..osssssso.w",
    "...osssso..o",
    "..occbbcco..",
    ".occbbbbcco.",
    ".ocbyyyybco.",
    ".occbbbbcco.",
    "..ocbbbbco..",
    "..ocb..bco..",
    "..odb..bdo..",
    "..oo....oo..",
  ],
};

/** プレイヤー：攻撃フレーム（剣を前方へ突き出す） */
export const WARDEN_ATTACK: Sprite = {
  palette: KNIGHT_PAL,
  rows: [
    "....oooo....",
    "...ommmmo...",
    "..ommddmmo..",
    "..omdssdmo..",
    "..osssssso..",
    "...osssso...",
    "..occbbcco..",
    ".occbbbbccoo",
    ".ocbyyyybcww",
    ".occbbbbccoo",
    "..ocbbbbco..",
    "..ocb.bco...",
    "..odb.bdo...",
    "..oo..oo....",
  ],
};

/** プレイヤー：被弾フレーム（のけぞって両腕を上げる） */
export const WARDEN_HURT: Sprite = {
  palette: KNIGHT_PAL,
  rows: [
    "...oooo....w",
    "..ommmmo...o",
    ".ommddmmo...",
    ".omdssdmo...",
    ".osssssso...",
    "..osssso....",
    "o.ccbbcc.o..",
    "ooccbbbbcoo.",
    ".ocbyyyybco.",
    ".occbbbbcco.",
    "..ocbbbbco..",
    "..ocb..bco..",
    "..odb..bdo..",
    "..oo....oo..",
  ],
};

const CARAPACE_PAL: Record<string, string> = {
  o: "#0c0a18",
  s: "#4a8c5a", // 甲殻(緑)
  S: "#6fd07f", // 甲殻ハイライト
  d: "#2f5c3a", // 甲殻(暗)
  b: "#d8b070", // 体(茶)
  e: "#ffe08a", // 目
};

/** 甲殻種：シェルクローラー */
export const CARAPACE: Sprite = {
  palette: CARAPACE_PAL,
  rows: [
    "....oooo....",
    "..oodssdoo..",
    ".odsSSSSsdo.",
    ".osSSssSSso.",
    "odsSssssSsdo",
    "osSssssssSso",
    "odssssssssdo",
    ".oddddddddo.",
    "obo.oooo.obo",
    " obo....obo .",
  ],
};

/** 甲殻種：予兆/攻撃フレーム（爪を上げて構える） */
export const CARAPACE_TEL: Sprite = {
  palette: CARAPACE_PAL,
  rows: [
    "..o.oooo.o..",
    "..oodssdoo..",
    ".odsSSSSsdo.",
    ".osSeeeeSso.",
    "odsSssssSsdo",
    "osSssssssSso",
    "odssssssssdo",
    ".oddddddddo.",
    "obo.oooo.obo",
    "o.o......o.o",
  ],
};

const AERIAL_PAL: Record<string, string> = {
  o: "#0c0a18",
  p: "#8a5ad0", // 翼(紫)
  P: "#b98aff", // 翼ハイライト
  d: "#5a3a8a", // 暗紫
  b: "#3a2a55", // 胴
  e: "#ff6f9f", // 目
};

/** 飛翔種：レイスフェザー */
export const AERIAL: Sprite = {
  palette: AERIAL_PAL,
  rows: [
    "o..........o",
    "Po........oP",
    "PPo..oo..oPP",
    "dPPodbbdoPPd",
    ".dPdbeebdPd.",
    "..odbbbbdo..",
    "...odbbdo...",
    "....oddo....",
    ".....oo.....",
  ],
};

/** 飛翔種：予兆/攻撃フレーム（翼を大きく広げる） */
export const AERIAL_TEL: Sprite = {
  palette: AERIAL_PAL,
  rows: [
    "oo........oo",
    "PPo......oPP",
    "PPPo.oo.oPPP",
    "dPPPdbbdPPPd",
    ".dPdbeebdPd.",
    "..odbbbbdo..",
    "...odbbdo...",
    "....oddo....",
    ".....oo.....",
  ],
};

const PHANTOM_PAL: Record<string, string> = {
  o: "#0c0a18",
  g: "#8fd0ff", // 霊体(淡青)
  G: "#cfeaff", // ハイライト
  d: "#4a78b0", // 暗
  e: "#1a2a4a", // 目
};

/** 霊体種：グルームシェイド */
export const PHANTOM: Sprite = {
  palette: PHANTOM_PAL,
  rows: [
    "...oooo...",
    "..oGGGGo..",
    ".oGGGGGGo.",
    "oGGddGGddo", // ※目の表現
    "oGGeeGGeeo",
    "oGGGGGGGGo",
    "oGGGGGGGGo",
    "odGGGGGGdo",
    ".o.oo.oo.o",
  ],
};

/** 霊体種：予兆/攻撃フレーム（目を見開く） */
export const PHANTOM_TEL: Sprite = {
  palette: PHANTOM_PAL,
  rows: [
    "...oooo...",
    "..oGGGGo..",
    ".oGeeGeGo.",
    "oGeeGGeeGo",
    "oGeeGGeeGo",
    "oGGGGGGGGo",
    "oGGGGGGGGo",
    "odGGGGGGdo",
    ".oo.oo.oo.",
  ],
};

const BOSS_PAL: Record<string, string> = {
  o: "#0c0a18",
  s: "#b5443a", // 甲殻(赤)
  S: "#ff7a64", // ハイライト
  d: "#7a241c", // 暗
  b: "#caa15a", // 体
  e: "#ffe08a", // 目
  y: "#ffcf3f", // 角
};

/** ボス：カラペイス・タイラント（大型） */
export const BOSS: Sprite = {
  palette: BOSS_PAL,
  rows: [
    "y....oooo....y",
    "yo..odssdo..oy",
    ".odssSSSSssdo.",
    "odsSSSssSSSsdo",
    "osSSsssssSSSso",
    "osSssseessSSso",
    "odssssssssssdo",
    "odssssssssssdo",
    ".odddddddddo .",
    "obbo.oooo.obbo",
    ".obo......obo.",
  ],
};

/** ボス：予兆/攻撃フレーム（口を開き威嚇） */
export const BOSS_TEL: Sprite = {
  palette: BOSS_PAL,
  rows: [
    "y...oooooo...y",
    "yo.odssssdo.oy",
    ".odsSSSSSSsdo.",
    "odsSSSssSSSsdo",
    "osSSsssssSSSso",
    "oseeeeeeeeesso",
    "odsSSSSSSSSsdo",
    "odssssssssssdo",
    ".odddddddddo .",
    "obbo.oooo.obbo",
    "o.bo......ob.o",
  ],
};

// ===== レアモンスター（煌びやかな宝玉竜）=====
const RARE_PAL: Record<string, string> = {
  o: "#0c0a18", // 輪郭
  G: "#ffd95c", // 金（明）
  d: "#b8860b", // 金（暗）
  b: "#8a6510", // 脚
  c: "#5fe0ff", // 宝石シアン
  m: "#ff7de9", // 宝石マゼンタ
  e: "#ff3b6b", // 目
  E: "#ffd5e0", // 目（威嚇・発光）
  w: "#ffffff", // きらめき・牙
};

/** レアモンスター：ジュエルドレイク（宝石をまとった竜） */
export const RARE: Sprite = {
  palette: RARE_PAL,
  rows: [
    ".w..ooooo..w.",
    "..odGGGGGdo..",
    ".odGcGmGcGdo.",
    "odGGGGGGGGGdo",
    "oGcGGeeGGcGGo",
    "oGGGGGGGGGGGo",
    "odGmGGGGGmGdo",
    ".odGGGGGGGdo.",
    "..oddGGGddo..",
    "w..obo.obo..w",
    "...oo...oo...",
  ],
};

/** レアモンスター：予兆/攻撃フレーム（牙をむき宝石が輝く） */
export const RARE_TEL: Sprite = {
  palette: RARE_PAL,
  rows: [
    "w...ooooo...w",
    "..odGGGGGdo..",
    ".odGcGmGcGdo.",
    "odGGGGGGGGGdo",
    "oGcGGEEGGcGGo",
    "oGGGwwwwwGGGo",
    "odGmGGGGGmGdo",
    ".odGGGGGGGdo.",
    "..oddGGGddo..",
    "w..obo.obo..w",
    "...oo...oo...",
  ],
};

// ===== UIアイコン（ボタン用のドット絵） =====
const SHIELD_PAL: Record<string, string> = {
  o: "#0c0a18", // 輪郭
  b: "#7fc0ff", // 盾(青)
  c: "#2c6fb8", // 盾(影)
  w: "#dff0ff", // ハイライト
  y: "#ffd35f", // 紋章(金)
};

/** ガードボタン：盾 */
export const SHIELD: Sprite = {
  palette: SHIELD_PAL,
  rows: [
    ".oooooooo.",
    "obbbbbbbbo",
    "obwwbbbbco",
    "obbbbbbbco",
    "obbbyybbco",
    "obbyyyybco",
    "obbbyybbco",
    "obbbbbbbco",
    "oobbbbbboo",
    ".oobbbboo.",
    "...obbo...",
    "....oo....",
  ],
};

const SLEEP_PAL: Record<string, string> = {
  z: "#eafff2", // Zzz(白緑)
};

/** 休憩ボタン：睡眠（Zzz） */
export const SLEEP: Sprite = {
  palette: SLEEP_PAL,
  rows: [
    "............",
    "........zzz.",
    ".........z..",
    "........zzz.",
    ".....zzzz...",
    ".......zz...",
    ".....zz.....",
    ".....zzzz...",
    "zzzzz.......",
    "...zz.......",
    ".zz.........",
    "zzzzz.......",
  ],
};

// ===== 武器アイコン（武器名に見合うドット絵。系統ごとの形＋武器ごとの配色） =====
// 斬撃＝剣（斜めの刃）/ 刺突＝槍 / 打撃＝戦槌。配色で各武器の個性を表現する。
const SWORD_ROWS = [
  "............oo",
  "...........oBo",
  "..........oBbo",
  ".........oBbo.",
  "........oBbo..",
  ".......oBbo...",
  "......oBbo....",
  ".....oBbo.....",
  "....oBbo......",
  "..ogggggo.....",
  "...ohhho......",
  "..ohhho.......",
  ".ohho.........",
  ".oppo.........",
];
const SPEAR_ROWS = [
  "............o.",
  "...........oHo",
  "..........oHHo",
  ".........oHHo.",
  "........oHo...",
  ".......oso....",
  "......oso.....",
  ".....oso......",
  "....oso.......",
  "...oso........",
  "..oso.........",
  ".oso..........",
  "oso...........",
  "Po............",
];
const HAMMER_ROWS = [
  "..............",
  ".....oHHHHo...",
  ".....oHHHHo...",
  ".....oHHHHo...",
  ".....oHHHHo...",
  "......oso.....",
  ".....oso......",
  "....oso.......",
  "...oso........",
  "..oso.........",
  ".oso..........",
  "oso...........",
  "po............",
  "..............",
];

function wpnSprite(rows: string[], palette: Record<string, string>): Sprite {
  return { rows, palette };
}

const OUT = "#0c0a18";

/** 武器IDごとのドット絵。weapons.json の id と対応 */
export const WEAPON_SPRITES: Record<string, Sprite> = {
  // --- 斬撃：剣 ---
  w_iron_edge: wpnSprite(SWORD_ROWS,
    { o: OUT, B: "#eef2ff", b: "#aeb8cc", g: "#caa14a", h: "#6b4a2a", p: "#9a7d4a" }),
  w_shadow_blade: wpnSprite(SWORD_ROWS,
    { o: OUT, B: "#d8c0ff", b: "#7a4ab0", g: "#3a1a5a", h: "#200c30", p: "#9a68cc" }),
  w_storm_saber: wpnSprite(SWORD_ROWS,
    { o: OUT, B: "#e6fbff", b: "#6fd3f0", g: "#cdd6e6", h: "#2a5a8a", p: "#7fb0ff" }),
  w_dragoon_blade: wpnSprite(SWORD_ROWS,
    { o: OUT, B: "#ecdcff", b: "#b08af0", g: "#ffd35f", h: "#4a2a6a", p: "#caa14a" }),
  w_flame_sword: wpnSprite(SWORD_ROWS,
    { o: OUT, B: "#fff0a0", b: "#ff8030", g: "#cc3010", h: "#7a1808", p: "#ffd35f" }),
  w_astral_edge: wpnSprite(SWORD_ROWS,
    { o: OUT, B: "#ffffff", b: "#ff9ee6", g: "#7fe0ff", h: "#9a5ad0", p: "#ffd35f" }),
  // --- 刺突：槍 ---
  w_steel_lance: wpnSprite(SPEAR_ROWS,
    { o: OUT, H: "#cfd8e8", s: "#7a5630", P: "#9a7d4a" }),
  w_wind_pike: wpnSprite(SPEAR_ROWS,
    { o: OUT, H: "#cdeccf", s: "#5a8a45", P: "#9ff0a8" }),
  w_ice_needle: wpnSprite(SPEAR_ROWS,
    { o: OUT, H: "#d8f4ff", s: "#4a9ab8", P: "#a0e8ff" }),
  w_thunder_spear: wpnSprite(SPEAR_ROWS,
    { o: OUT, H: "#ffffa0", s: "#8a6800", P: "#ffd35f" }),
  w_void_glaive: wpnSprite(SPEAR_ROWS,
    { o: OUT, H: "#b394e6", s: "#3a2a55", P: "#b96bff" }),
  // --- 打撃：戦槌 ---
  w_war_mallet: wpnSprite(HAMMER_ROWS,
    { o: OUT, H: "#aab2c4", s: "#6b4a2a", p: "#9a7d4a" }),
  w_stone_mace: wpnSprite(HAMMER_ROWS,
    { o: OUT, H: "#c0b8b0", s: "#5a5050", p: "#908888" }),
  w_quake_hammer: wpnSprite(HAMMER_ROWS,
    { o: OUT, H: "#e0a050", s: "#7a5a2a", p: "#caa14a" }),
  w_earth_crusher: wpnSprite(HAMMER_ROWS,
    { o: OUT, H: "#d07840", s: "#6a3818", p: "#b05a28" }),
  w_titan_breaker: wpnSprite(HAMMER_ROWS,
    { o: OUT, H: "#ffcf5f", s: "#5a3a1a", p: "#ffd35f" }),
  w_mjolnir: wpnSprite(HAMMER_ROWS,
    { o: OUT, H: "#ffffff", s: "#4a6a9a", p: "#7fbfff" }),
};

/** 武器IDからドット絵を取得（未定義なら undefined） */
export function getWeaponSprite(id: string): Sprite | undefined {
  return WEAPON_SPRITES[id];
}

// ===== 宝箱（リザルトの開封演出用。レアリティ色で塗る） =====
const CHEST_CLOSED_ROWS = [
  "..............",
  "...ooooooooo..",
  "..oRRRRRRRRo..",
  "..orrrrrrrro..",
  "..oddddddddo..",
  "..orrrrrrrro..",
  "..orrryyyrro..",
  "..orrryyyrro..",
  "..orrrrrrrro..",
  "..oddddddddo..",
  "...ooooooooo..",
  "..............",
];
const CHEST_OPEN_ROWS = [
  ".....oooo.....",
  "....odddddo...",
  "...orrrrrro...",
  "....oooooo....",
  "..L........L..",
  "..oLLLLLLLLo..",
  "..oLLLLLLLLo..",
  "..orrrrrrrro..",
  "..orrryyyrro..",
  "..orrrrrrrro..",
  "..oddddddddo..",
  "...ooooooooo..",
  "..............",
];

/** 16進色を係数で明暗調整（f<1で暗く、f>1で明るく） */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** レアリティ色で塗った宝箱スプライト（open=trueで開封フレーム） */
export function chestSprite(color: string, open = false): Sprite {
  const palette: Record<string, string> = {
    o: "#0c0a18", r: color, R: shade(color, 1.4), d: shade(color, 0.5), y: "#ffd35f", L: "#fff6c8",
  };
  return { rows: open ? CHEST_OPEN_ROWS : CHEST_CLOSED_ROWS, palette };
}
