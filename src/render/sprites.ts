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
