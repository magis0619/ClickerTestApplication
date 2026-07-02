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

// ===================================================================
// 敵キャラごとの固有ドット絵
// 種別共通スプライト（CARAPACE/AERIAL/PHANTOM/BOSS）の使い回しでは
// 名前と見た目が合わない敵を、1体ずつ専用に描き起こす。
// 各敵は base（待機）と tel（予兆/攻撃）の2フレームを持つ。
// ===================================================================

// --- 甲殻種（carapace） ---

const STRAW_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#d6b24a", S: "#f2d878", d: "#9a7a2a", e: "#3a2810",
};
/** ストローゴーレム：藁束を編んだ人形 */
export const STRAW_GOLEM: Sprite = {
  palette: STRAW_PAL,
  rows: [
    "..s.o..o.s..",
    "...ossso....",
    "..osSSSso...",
    "..oseoeso...",
    "..ossSsso...",
    "s.oosssoo.s.",
    ".sosSSSos.s.",
    "...osSso....",
    "...osSso....",
    "..osoosoo...",
    "..o.s..s.o..",
  ],
};
export const STRAW_GOLEM_TEL: Sprite = {
  palette: STRAW_PAL,
  rows: [
    "o.s.o..o.s.o",
    "o..ossso..o.",
    ".s.osSSso.s.",
    "...oseeeso..",
    "...osSsSso..",
    "..oosssooo..",
    "..osSSSso...",
    "...osSso....",
    "...osSso....",
    "..osoosoo...",
    "..o.s..s.o..",
  ],
};

const STONE_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#8a8f9c", S: "#c2c7d4", d: "#565b68", e: "#9fe8ff",
};
/** ストーンセンチネル：石塊の門番 */
export const STONE_SENTINEL: Sprite = {
  palette: STONE_PAL,
  rows: [
    "..oooooooo..",
    "..osSSSSso..",
    "..oseooeso..",
    "..osSSSSso..",
    "..odSSSSdo..",
    "o.oosssoo.o.",
    "ososSSSosos.",
    "o.odSSSdo.o.",
    "...osSso....",
    "..oss.sso...",
    "..oo...oo...",
  ],
};
export const STONE_SENTINEL_TEL: Sprite = {
  palette: STONE_PAL,
  rows: [
    "o.oooooooo.o",
    "o.osSSSSso.o",
    "..oseeeeso..",
    "..osSSSSso..",
    "..odSSSSdo..",
    "oooosssoooo.",
    "ososSSSosos.",
    "o.odSSSdo.o.",
    "...osSso....",
    "..oss.sso...",
    "..oo...oo...",
  ],
};

const SANDCRAB_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#e58a3a", S: "#ffb86a", d: "#a85518", e: "#2a1408",
};
/** サンドクラブ：砂地の蟹（大きな鋏） */
export const SAND_CRAB: Sprite = {
  palette: SANDCRAB_PAL,
  rows: [
    "............",
    "oo......oo..",
    "doo....ood..",
    ".doo..ood.eo",
    "..oddddoo.o.",
    ".odsSSSSdo..",
    "odsSSeeSSsdo",
    "odsSSSSSSsdo",
    ".oddddddddo.",
    "o.o.o..o.o.o",
    ".o.o.oo.o.o.",
  ],
};
export const SAND_CRAB_TEL: Sprite = {
  palette: SANDCRAB_PAL,
  rows: [
    "oo........oo",
    "soo......oos",
    "dsoo....oosd",
    "..oo....oo..",
    "...oddddo...",
    ".odsSSSSdo..",
    "odsSeeeeSsdo",
    "odsSSSSSSsdo",
    ".oddddddddo.",
    "o.o.o..o.o.o",
    ".o.o.oo.o.o.",
  ],
};

const MUD_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#7c5a2e", S: "#a8854a", d: "#4a3418", e: "#ffe08a",
};
/** マッドビートル：泥にまみれた甲虫 */
export const MUD_BEETLE: Sprite = {
  palette: MUD_PAL,
  rows: [
    "...o....o...",
    "....o..o....",
    "..oodssdoo..",
    ".odsSeeSsdo.",
    "odsSSssSSsdo",
    "osSsssssSSso",
    "odsSssssSsdo",
    ".oddddddddo.",
    "obo.oooo.obo",
    ".o.o....o.o.",
    "............",
  ],
};
export const MUD_BEETLE_TEL: Sprite = {
  palette: MUD_PAL,
  rows: [
    ".o......o...",
    "..o....o....",
    "...o..o.....",
    "..oodssdoo..",
    ".odsSeeSsdo.",
    "odsSSeeSSsdo",
    "osSsssssSSso",
    ".oddddddddo.",
    "obo.oooo.obo",
    "o.o......o.o",
    "............",
  ],
};

const ICECR_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#6fc8e0", S: "#d4f4ff", d: "#357f9c", e: "#ffffff",
};
/** アイスクローラー：氷殻の這うもの */
export const ICE_CRAWLER: Sprite = {
  palette: ICECR_PAL,
  rows: [
    "....S..S....",
    "..S.oo.oo.S.",
    "...odssdo...",
    "..odSSSSdo..",
    ".odSSeeSSdo.",
    "odSSSSSSSSdo",
    "odsSSSSSSsdo",
    ".oddddddddo.",
    "obo.oo.o.obo",
    ".o.o.oo.o.o.",
    "S..........S",
  ],
};
export const ICE_CRAWLER_TEL: Sprite = {
  palette: ICECR_PAL,
  rows: [
    "S.S.oo.oo.S.",
    "..S.oo.o.S..",
    "...odssdo...",
    "..odSSSSdo..",
    ".odSeeeeSdo.",
    "odSSSSSSSSdo",
    "odsSSSSSSsdo",
    ".oddddddddo.",
    "obo.oo.o.obo",
    "o.o.o..o.o.o",
    "S.S......S.S",
  ],
};

const IRON_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#7a818c", S: "#b0b6c0", d: "#474d57", g: "#4a8c5a", G: "#74c887", e: "#ffe08a",
};
/** アイアントータス：鉄甲の亀 */
export const IRON_TORTOISE: Sprite = {
  palette: IRON_PAL,
  rows: [
    "............",
    "...oooooo...",
    "..odSSSSdo..",
    ".odSdSSdSdo.",
    "odSSSSSSSSdo",
    "ogo.dssd.ogo",
    "oGgodssdoggo",
    ".oo.oddo.oo.",
    "...oGeeGo...",
    "....oggo....",
    "............",
  ],
};
export const IRON_TORTOISE_TEL: Sprite = {
  palette: IRON_PAL,
  rows: [
    "............",
    "...oooooo...",
    "..odSSSSdo..",
    ".odSdSSdSdo.",
    "odSSSSSSSSdo",
    "ggo.dssd.ogg",
    "Gggodssdoggg",
    ".oo.oddo.oo.",
    "..oGeeeeGo..",
    "...ogGGgo...",
    "....o..o....",
  ],
};

// --- 霊体種（phantom） ---

const DUSTIMP_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#c9954f", S: "#e6b977", d: "#8a5e2a", h: "#5a3a1a", e: "#ff5a3a",
};
/** ダストインプ：埃まみれの小鬼 */
export const DUST_IMP: Sprite = {
  palette: DUSTIMP_PAL,
  rows: [
    "..h......h..",
    "..ho....oh..",
    "...osssso...",
    "..osSeeSso..",
    "..osSSSSso..",
    "..oosddoo...",
    "h.osSSSSso.h",
    "oso.osso.oso",
    "....osso....",
    "...oo..oo...",
    "...o....o...",
  ],
};
export const DUST_IMP_TEL: Sprite = {
  palette: DUSTIMP_PAL,
  rows: [
    "h.h......h.h",
    ".oho....oho.",
    "...osssso...",
    "..oseeeeso..",
    "..osSSSSso..",
    "o.ooseeoo.o.",
    "oso.SSSS.oso",
    "...ososo....",
    "....osso....",
    "...oo..oo...",
    "...o....o...",
  ],
};

const HOUND_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#e0622a", S: "#ff9a4a", d: "#9a2c10", f: "#ffd35f", e: "#fff0a0",
};
/** エンバーハウンド：燃える猟犬 */
export const EMBER_HOUND: Sprite = {
  palette: HOUND_PAL,
  rows: [
    "f.f.........",
    ".fof....f.f.",
    "ofSfo..fofo.",
    "osSSsooofo..",
    "osSeSSSSSso.",
    "odSSSSSSSSdo",
    ".osSSSSSSso.",
    "..oo.oo.oo..",
    "..o..o..o.o.",
    "............",
    "............",
  ],
};
export const EMBER_HOUND_TEL: Sprite = {
  palette: HOUND_PAL,
  rows: [
    "f.f...f.f...",
    "fofo.fofo...",
    "ofSfofofo.f.",
    "osSSsoooofof",
    "oseeSSSSSSso",
    "odSSffffSSdo",
    ".osSSSSSSso.",
    "..oo.oo.oo..",
    "..o..o..o.o.",
    "............",
    "............",
  ],
};

const FIMP_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#7fd0e8", S: "#d8f4ff", d: "#357f9c", h: "#2a4a5a", e: "#bfffff",
};
/** フロストインプ：氷の小鬼 */
export const FROST_IMP: Sprite = {
  palette: FIMP_PAL,
  rows: [
    "..h......h..",
    "..ho....oh..",
    "...osssso...",
    "..osSeeSso..",
    "..osSSSSso..",
    "..oosddoo...",
    "h.osSSSSso.h",
    "oso.osso.oso",
    "....osso....",
    "...oo..oo...",
    "...o....o...",
  ],
};
export const FROST_IMP_TEL: Sprite = {
  palette: FIMP_PAL,
  rows: [
    "h.h......h.h",
    ".oho....oho.",
    "...osssso...",
    "..oseeeeso..",
    "..osSSSSso..",
    "o.ooseeoo.o.",
    "oso.SSSS.oso",
    "...ososo....",
    "....osso....",
    "...oo..oo...",
    "...o....o...",
  ],
};

const BONE_PAL: Record<string, string> = {
  o: "#0c0a18", w: "#e8e8f0", W: "#ffffff", d: "#9a9ab0", e: "#ff6f3f",
};
/** ボーンゴースト：骸骨の亡霊 */
export const BONE_GHOST: Sprite = {
  palette: BONE_PAL,
  rows: [
    "...oooo...",
    "..owwwwo..",
    ".owWWWWwo.",
    "owweooewo.",
    "owWeooeWwo",
    "owwwddwwwo",
    ".owwwwwwo.",
    ".odwwwwdo.",
    "..o.oo.o..",
    ".o..oo..o.",
  ],
};
export const BONE_GHOST_TEL: Sprite = {
  palette: BONE_PAL,
  rows: [
    "...oooo...",
    "..owwwwo..",
    ".owWWWWwo.",
    "oweeooeewo",
    "oweeooeewo",
    "owwoddowwo",
    ".owwwwwwo.",
    ".odwwwwdo.",
    ".o.o..o.o.",
    "o..o..o..o",
  ],
};

const SLURK_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#2a2440", S: "#4a3a6a", d: "#15101f", e: "#ff5a8a",
};
/** シャドウラーカー：闇に潜むもの */
export const SHADOW_LURKER: Sprite = {
  palette: SLURK_PAL,
  rows: [
    "............",
    "..oo....oo..",
    ".oSso..osSo.",
    "osSSsooosSso",
    "osSeSSSSeSso",
    "osSSSSSSSSso",
    ".odSSSSSSdo.",
    "..oddddddo..",
    ".o.o.oo.o.o.",
    "o..o....o..o",
  ],
};
export const SHADOW_LURKER_TEL: Sprite = {
  palette: SLURK_PAL,
  rows: [
    "..o......o..",
    ".oSo....oSo.",
    "oSSso..osSSo",
    "osSSsooosSso",
    "oseeSSSSeeso",
    "osSSSSSSSSso",
    ".odSSSSSSdo.",
    "..oddddddo..",
    "o.o.o..o.o.o",
    ".o..o..o..o.",
  ],
};

const SPEC_PAL: Record<string, string> = {
  o: "#0c0a18", g: "#5aa85a", G: "#a0e0a0", d: "#2f6a3a", e: "#d8ff8a",
};
/** ヴァイルスペクター：邪悪な妖霊 */
export const VILE_SPECTER: Sprite = {
  palette: SPEC_PAL,
  rows: [
    "...oooo...",
    "..oGGGGo..",
    ".oGGGGGGo.",
    "oGGeGGeGGo",
    "oGddGGddGo",
    "oGGGGGGGGo",
    "odGGGGGGdo",
    ".odGGGGdo.",
    "..o.oo.o..",
    ".o.o..o.o.",
  ],
};
export const VILE_SPECTER_TEL: Sprite = {
  palette: SPEC_PAL,
  rows: [
    "...oooo...",
    "..oGGGGo..",
    ".oGeGGeGo.",
    "oGeeGGeeGo",
    "oGGGddGGGo",
    "oGGddddGGo",
    "odGGGGGGdo",
    ".odGGGGdo.",
    ".o.o..o.o.",
    "o..o..o..o",
  ],
};

// --- 飛翔種（aerial） ---

const VENOM_PAL: Record<string, string> = {
  o: "#0c0a18", g: "#7ab83a", G: "#bfe86a", d: "#4a6a1a", e: "#eaff8a", w: "#c8ff5a",
};
/** ヴェノムラーカー：毒を滴らせる飛行体 */
export const VENOM_LURKER: Sprite = {
  palette: VENOM_PAL,
  rows: [
    "o..........o",
    "Go........oG",
    "Ggo..oo..oGg",
    "dGgodggdoGgd",
    ".dgdgeegdgd.",
    "..odggggdo..",
    "...odggdo...",
    "....oddo....",
    ".....ww.....",
    "...w....w...",
  ],
};
export const VENOM_LURKER_TEL: Sprite = {
  palette: VENOM_PAL,
  rows: [
    "Go........oG",
    "Ggo......oGg",
    "GGgo.oo.oGGg",
    "dGGgdggdGGgd",
    ".dgdgeegdgd.",
    "..odggggdo..",
    "...odggdo...",
    "....oddo....",
    "..w..ww..w..",
    ".w..w..w..w.",
  ],
};

const FDRAKE_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#6fc8e8", S: "#cfeeff", d: "#357f9c", e: "#ffffff",
};
/** フロストドレイク：氷の幼竜 */
export const FROST_DRAKE: Sprite = {
  palette: FDRAKE_PAL,
  rows: [
    "So........oS",
    "Sso......osS",
    "dSsooooooSsd",
    ".dSsSSSSsSd.",
    "..oSSeeSSo..",
    "...oSSSSo..S",
    "..oSSSSSSoSs",
    ".oSso..osSso",
    ".oo......oo.",
    ".........dd.",
  ],
};
export const FROST_DRAKE_TEL: Sprite = {
  palette: FDRAKE_PAL,
  rows: [
    "Sso......osS",
    "dSso....osSd",
    "dSSsoooosSSd",
    ".dSSSSSSSSd.",
    "..oSeeeeSo..",
    "..oSSeeSSo.S",
    ".oSSSSSSSSSs",
    "oSso....osSo",
    ".oo......oo.",
    "........ddd.",
  ],
};

const MOTH_PAL: Record<string, string> = {
  o: "#0c0a18", w: "#c9a8e6", W: "#ecdcff", b: "#6a4a3a", d: "#7a5a9a", e: "#ffd35f",
};
/** スカイモス：天翔ける大蛾 */
export const SKY_MOTH: Sprite = {
  palette: MOTH_PAL,
  rows: [
    ".d......d...",
    "oWwo.b.oWwo.",
    "owWWoboowWWo",
    "owWWWbbWWWwo",
    ".owWobbowWo.",
    "ow.obeebo.wo",
    "owwobbbbowwo",
    ".owobbbbowo.",
    "..o.obbo.o..",
    ".....bb.....",
  ],
};
export const SKY_MOTH_TEL: Sprite = {
  palette: MOTH_PAL,
  rows: [
    "d.d....d.d..",
    "oWWwob.oWWwo",
    "owWWWboowWWWo",
    "owWWWbbWWWwo",
    "owWWobboWWwo",
    "o.obeeeebo.o",
    "owobbbbbbowo",
    ".oobbbbboo..",
    "...obbbbo...",
    "....obbo....",
  ],
};

const HAWK_PAL: Record<string, string> = {
  o: "#0c0a18", f: "#c89a4a", F: "#ecc878", b: "#3a2a10", k: "#ffcf3f", e: "#fff0a0",
};
/** サンダーホーク：雷をまとう鷹 */
export const THUNDER_HAWK: Sprite = {
  palette: HAWK_PAL,
  rows: [
    "o..........o",
    "Fo...ff...oF",
    "FFo.fFFf.oFF",
    "fFFoFeeFoFFf",
    ".fFofkkfoFf.",
    "..oFFFFFFo..",
    "...oFFFFo...",
    "...ofFFfo...",
    "....obbo....",
    "...ob..bo...",
  ],
};
export const THUNDER_HAWK_TEL: Sprite = {
  palette: HAWK_PAL,
  rows: [
    "Fo........oF",
    "FFo..ff..oFF",
    "FFFofFFfoFFF",
    "fFFoFeeFoFFf",
    "..ofkkkkfo..",
    "..oFFFFFFo..",
    "...oFFFFo...",
    "...ofFFfo...",
    "....obbo....",
    "..ob....bo..",
  ],
};

const WYV_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#6a86b0", S: "#a6c2e0", d: "#3a526f", e: "#aef0ff",
};
/** ストームワイバーン：嵐を呼ぶ飛竜 */
export const STORM_WYVERN: Sprite = {
  palette: WYV_PAL,
  rows: [
    "o....ss....o",
    "do..sSSs..od",
    "dSo.sSSs.oSd",
    "dSSosSSsoSSd",
    ".dSSSeeSSSd.",
    "..oSSSSSSo..",
    "...oSSSSo..o",
    "..oSso.osSos",
    ".oo......ooS",
    "..........dd",
  ],
};
export const STORM_WYVERN_TEL: Sprite = {
  palette: WYV_PAL,
  rows: [
    "do...ss...od",
    "dSo.sSSs.oSd",
    "dSSosSSsoSSd",
    "dSSSsSSsSSSd",
    ".dSSeeeeSSd.",
    "..oSSSSSSo..",
    "..oSSSSSSo.o",
    ".oSso..osSos",
    "oo........ooS",
    "...........dd",
  ],
};

// --- ボス（boss）：種族・属性ごとに描き分ける ---

const SWARDEN_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#4a8c5a", S: "#7fd07f", d: "#2f5c3a", b: "#caa15a", e: "#ffe08a", y: "#cfe8d0",
};
/** シェルウォーデン：緑甲の守将（ボス） */
export const SHELL_WARDEN: Sprite = {
  palette: SWARDEN_PAL,
  rows: [
    "y....oooo....y",
    "yo..odssdo..oy",
    ".odssSSSSssdo.",
    "odsSSSssSSSsdo",
    "osSSseessSSSso",
    "osSssssssssSso",
    "odssssssssssdo",
    "odssSSSSSSssdo",
    ".odddddddddo .",
    "obbo.oooo.obbo",
    ".obo......obo.",
  ],
};
export const SHELL_WARDEN_TEL: Sprite = {
  palette: SWARDEN_PAL,
  rows: [
    "y...oooooo...y",
    "yo.odssssdo.oy",
    ".odsSSSSSSsdo.",
    "odsSSSssSSSsdo",
    "oseeeesseeeeso",
    "osSssssssssSso",
    "odsSSSSSSSSsdo",
    "odssssssssssdo",
    ".odddddddddo .",
    "obbo.oooo.obbo",
    "o.bo......ob.o",
  ],
};

const WMON_PAL: Record<string, string> = {
  o: "#0c0a18", p: "#8a5ad0", P: "#c39aff", d: "#4a2a7a", e: "#ff6f9f", y: "#ffd35f",
};
/** レイスモナーク：冠をいただく幽冥の王（ボス） */
export const WRAITH_MONARCH: Sprite = {
  palette: WMON_PAL,
  rows: [
    ".y.y.yy.y.y.",
    "..oyoooyo...",
    "o.oPPPPPPo.o",
    "Po.oPPPPo.oP",
    "PPodPeePdoPP",
    "dPPoPPPPoPPd",
    ".dPPPPPPPPd.",
    "..oPPPPPPo..",
    "..odPPPPdo..",
    ".o.o.oo.o.o.",
    "o..o....o..o",
  ],
};
export const WRAITH_MONARCH_TEL: Sprite = {
  palette: WMON_PAL,
  rows: [
    "y.y.yyyy.y.y",
    ".oyoooooyo..",
    "ooPPPPPPPPoo",
    "PoPPeePPeePo",
    "PPdPePPePdPP",
    "dPPPPPPPPPPd",
    ".dPPPPPPPPd.",
    "..oPPPPPPo..",
    "..odPPPPdo..",
    "o.o.o..o.o.o",
    ".o..o..o..o.",
  ],
};

const FDRAG_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#6fc8e8", S: "#d4f4ff", d: "#357f9c", e: "#ffffff", y: "#bfffff",
};
/** フロストドラゴン：氷河の竜王（ボス） */
export const FROST_DRAGON: Sprite = {
  palette: FDRAG_PAL,
  rows: [
    "y..o......o..y",
    "Sso.dSSSSd.osS",
    "dSsodSSSSsdosS",
    ".dSsSSSSSSsSd.",
    "..oSSeeeeSSo..",
    "..oSSSSSSSSo.y",
    ".oSSSSSSSSSSos",
    "oSSso....osSSo",
    "oSo........oSo",
    ".oo........oo.",
    "..........ddd.",
  ],
};
export const FROST_DRAGON_TEL: Sprite = {
  palette: FDRAG_PAL,
  rows: [
    "y.o........o.y",
    "Sso.dSSSSd.osS",
    "dSSodSSSSsdoSS",
    ".dSSSSSSSSSSd.",
    "..oSeeeeeeSo..",
    "..oSSeeeeSSo.y",
    ".oSSSSSSSSSSos",
    "oSSso.yy.osSSo",
    "oSo..yyyy..oSo",
    ".oo........oo.",
    ".........dddd.",
  ],
};

const STYR_PAL: Record<string, string> = {
  o: "#0c0a18", s: "#2e2748", S: "#5a4a8a", d: "#14101e", e: "#ff4a7a", y: "#b96bff",
};
/** シャドウタイラント：闇を統べる暴君（ボス） */
export const SHADOW_TYRANT: Sprite = {
  palette: STYR_PAL,
  rows: [
    "y....oooo....y",
    "yo..oSSSSo..oy",
    ".odSSSSSSSSdo.",
    "odSSSssssSSSdo",
    "oSSseeSSeeSSSo",
    "oSSSSSSSSSSSSo",
    "odSSSSSSSSSSdo",
    "odSSSdddSSSSdo",
    ".odddddddddo .",
    "oSSo.oooo.oSSo",
    ".oSo......oSo.",
  ],
};
export const SHADOW_TYRANT_TEL: Sprite = {
  palette: STYR_PAL,
  rows: [
    "y...oooooo...y",
    "yo.oSSSSSSo.oy",
    ".odSSSSSSSSdo.",
    "odSSSssssSSSdo",
    "oSeeeeSSeeeeSo",
    "oSSSSSSSSSSSSo",
    "odSSSeeeSSSSdo",
    "odSSSSSSSSSSdo",
    ".odddddddddo .",
    "oSSo.oooo.oSSo",
    "o.So......oS.o",
  ],
};

// ===== ワールド最終ボス：アビスソブリン（特大・他より大きく描く） =====
const ABYSS_PAL: Record<string, string> = {
  o: "#0c0a18", d: "#1a1330", s: "#3a2a5a", S: "#6a4fa0", H: "#9a78d8",
  e: "#ff2e5c", E: "#ff7da0", y: "#ffcf3f", g: "#b96bff", w: "#ffffff",
};
export const ABYSS: Sprite = {
  palette: ABYSS_PAL,
  rows: [
    "y.y..........y.y",
    "yoyo..yyyy..oyoy",
    ".oyo.ydSSdy.oyo.",
    "..ooyoSSSSoyoo..",
    "..odSHHHHHHSdo..",
    ".odSHeeHHeeHSdo.",
    ".oSSHeeHHeeHSSo.",
    ".oSSHHHwwHHHSSo.",
    ".odSSHHHHHHSSdo.",
    "odSSsSSSSSSsSSdo",
    "oSSsgSSwwSSgsSSo",
    "oSSsSSgwwgSSsSSo",
    "oSSsSSSSSSSSsSSo",
    ".odSSsSSSSsSSdo.",
    ".oo.oSSooSSo.oo.",
    "..o..oo..oo..o..",
    "..o...o..o...o..",
  ],
};
export const ABYSS_TEL: Sprite = {
  palette: ABYSS_PAL,
  rows: [
    "y.y..........y.y",
    "yoyo..yyyy..oyoy",
    ".oyo.ydSSdy.oyo.",
    "..ooyoSSSSoyoo..",
    "..odSHHHHHHSdo..",
    ".odSeeeHHeeeSdo.",
    ".oSSeeeHHeeeSSo.",
    ".oSSHHwwwwHHSSo.",
    ".odSSHwwwwHSSdo.",
    "odSSsSSwwSSsSSdo",
    "oSSsgSwwwwSgsSSo",
    "oSSsSgwwwwgSsSSo",
    "oSSsSSSwwSSSsSSo",
    ".odSSsSSSSsSSdo.",
    ".oo.oSSooSSo.oo.",
    "o.o..oo..oo..o.o",
    "..o...o..o...o..",
  ],
};

// ===== 乱入レアボス：リフトリーバー（次元の裂け目から現れる虚無の刈り取り手）=====
const RIFT_PAL: Record<string, string> = {
  o: "#07060f", // 虚無の輪郭
  v: "#3a1f6e", // 虚無の紫（暗）
  V: "#5a32a0", // 虚無の紫（中）
  p: "#c64bff", // 裂け目の魔光（マゼンタ）
  c: "#3ae6ff", // 裂け目の魔光（シアン）
  e: "#ff3b6b", // 眼光
  E: "#ffd5e6", // 眼光（発光）
  w: "#ffffff", // 火花
};

/** リフトリーバー：待機（鎌を下ろし宙に漂う） */
export const RIFT_REAVER: Sprite = {
  palette: RIFT_PAL,
  rows: [
    "c...........c",
    ".o.........o.",
    ".oc.......co.",
    "..oo.....oo..",
    "...ovVVVvo...",
    "..ovVVVVVvo..",
    "..ovVeVeVvo..",
    "..ovVVVVVvo..",
    "..ovpVVVpvo..",
    "...ovVVVvo...",
    "....ovVvo....",
    ".....ppp.....",
    "......o......",
  ],
};

/** リフトリーバー：予兆/攻撃（鎌を広げ眼光が爆ぜ、裂け目が拡がる） */
export const RIFT_REAVER_TEL: Sprite = {
  palette: RIFT_PAL,
  rows: [
    "c...........c",
    "co.........oc",
    ".oc.......co.",
    "..oovVVVvoo..",
    "..ovVVVVVvo..",
    "..ovVEVEVvo..",
    "..owVVVVVwo..",
    "..ovpVpVpvo..",
    "..ovVVVVVvo..",
    "...ovVVVvo...",
    "....oVpVo....",
    "....pp.pp....",
    "......o......",
  ],
};

// 敵IDごとの専用スプライト（base=待機 / tel=予兆・攻撃）。
// ここに無い敵は種別共通スプライト（canvas側）にフォールバックする。
export const ENEMY_BY_ID: Record<string, { base: Sprite; tel: Sprite }> = {
  rift_reaver:    { base: RIFT_REAVER,    tel: RIFT_REAVER_TEL },
  abyss_sovereign: { base: ABYSS,         tel: ABYSS_TEL },
  straw_golem:    { base: STRAW_GOLEM,    tel: STRAW_GOLEM_TEL },
  stone_sentinel: { base: STONE_SENTINEL, tel: STONE_SENTINEL_TEL },
  sand_crab:      { base: SAND_CRAB,      tel: SAND_CRAB_TEL },
  mud_beetle:     { base: MUD_BEETLE,     tel: MUD_BEETLE_TEL },
  ice_crawler:    { base: ICE_CRAWLER,    tel: ICE_CRAWLER_TEL },
  iron_tortoise:  { base: IRON_TORTOISE,  tel: IRON_TORTOISE_TEL },
  dust_imp:       { base: DUST_IMP,       tel: DUST_IMP_TEL },
  ember_hound:    { base: EMBER_HOUND,    tel: EMBER_HOUND_TEL },
  frost_imp:      { base: FROST_IMP,      tel: FROST_IMP_TEL },
  bone_ghost:     { base: BONE_GHOST,     tel: BONE_GHOST_TEL },
  shadow_lurker:  { base: SHADOW_LURKER,  tel: SHADOW_LURKER_TEL },
  vile_specter:   { base: VILE_SPECTER,   tel: VILE_SPECTER_TEL },
  venom_lurker:   { base: VENOM_LURKER,   tel: VENOM_LURKER_TEL },
  frost_drake:    { base: FROST_DRAKE,    tel: FROST_DRAKE_TEL },
  sky_moth:       { base: SKY_MOTH,       tel: SKY_MOTH_TEL },
  thunder_hawk:   { base: THUNDER_HAWK,   tel: THUNDER_HAWK_TEL },
  storm_wyvern:   { base: STORM_WYVERN,   tel: STORM_WYVERN_TEL },
  shell_warden:   { base: SHELL_WARDEN,   tel: SHELL_WARDEN_TEL },
  wraith_monarch: { base: WRAITH_MONARCH, tel: WRAITH_MONARCH_TEL },
  frost_dragon:   { base: FROST_DRAGON,   tel: FROST_DRAGON_TEL },
  shadow_tyrant:  { base: SHADOW_TYRANT,  tel: SHADOW_TYRANT_TEL },
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

// ===== 盾（防具）のドット絵：装備IDごとに5種 =====
const O = "#0c0a18"; // 共通輪郭

/** sh_wood：ウッドバックラー（木の丸盾＋鉄鋲） */
export const SHIELD_WOOD: Sprite = {
  palette: { o: O, b: "#a9712f", c: "#74471a", w: "#d7a35c", s: "#3a2410" },
  rows: [
    "...oooo...",
    ".oobwwboo.",
    ".obbbbbco.",
    "obbbssbbbo",
    "obbsssssbo",
    "obbsssssbo",
    "obbbssbbco",
    ".obbbbbco.",
    ".oobbbcoo.",
    "...oooo...",
  ],
};

/** sh_iron：アイアンガード（鉄の角盾＋四隅の鋲） */
export const SHIELD_IRON: Sprite = {
  palette: { o: O, b: "#9aa3b2", c: "#5c6473", w: "#d6dce6", r: "#3a3f4a" },
  rows: [
    "oooooooooo",
    "obwwbbbbco",
    "obrbbbbrco",
    "obbbbbbbco",
    "obbbbbbbco",
    "obbbbbbbco",
    "obbbbbbbco",
    "obrbbbbrco",
    "obbbbbbbco",
    "oooooooooo",
  ],
};

/** sh_knight：ナイトエイジス（青の騎士盾＋金の十字） */
export const SHIELD_KNIGHT: Sprite = {
  palette: { o: O, b: "#5fa8ff", c: "#2c6fb8", w: "#d4ecff", y: "#ffd35f" },
  rows: [
    ".oooooooo.",
    "obwbbbbbbo",
    "obbbyybbco",
    "obbbyybbco",
    "obyyyyyybo",
    "obbbyybbco",
    "obbbyybbco",
    "oobbbbbboo",
    ".oobbbboo.",
    "...obbo...",
    "....oo....",
  ],
};

/** sh_obsidian：オブシディアンウォール（黒曜の重盾＋紫光） */
export const SHIELD_OBSIDIAN: Sprite = {
  palette: { o: O, b: "#3a2d52", c: "#241a36", w: "#7a5fae", y: "#c89bff" },
  rows: [
    "oooooooooo",
    "obwbbbbbco",
    "obbbyybbco",
    "obbyyyybco",
    "obyybbyybo",
    "obyybbyybo",
    "obbyyyybco",
    "obbbyybbco",
    "oobbbbbboo",
    ".oooooooo.",
  ],
};

/** sh_astral：アストラルバリア（星辰の盾＋虹がかった金） */
export const SHIELD_ASTRAL: Sprite = {
  palette: { o: O, b: "#ffcf3f", c: "#c8911a", w: "#fff4c0", y: "#ff7de9", p: "#7df0ff" },
  rows: [
    ".oooooooo.",
    "obwbbbbpbo",
    "obbpbbybbo",
    "obbbyybbco",
    "obyyyyyybo",
    "obbbyybbco",
    "obpbbbbyco",
    "oobbbbbboo",
    ".oobbbboo.",
    "...obbo...",
    "....oo....",
  ],
};

/** sh_aegis：ガーディアンハート（白銀の聖盾＋緑の癒し光。中央にハート紋章） */
export const SHIELD_AEGIS: Sprite = {
  palette: { o: O, b: "#dfe8f2", c: "#9fb2c8", w: "#ffffff", y: "#57d36b" },
  rows: [
    ".oooooooo.",
    "obwbbbbbco",
    "obyybbyyco",
    "obyyyyyyco",
    "obbyyyybco",
    "obbbyybbco",
    "obbbbbbbco",
    "oobbbbbboo",
    ".oobbbboo.",
    "...obbo...",
    "....oo....",
  ],
};

/** sh_tempest：テンペストソウル（蒼嵐の盾＋稲妻紋章） */
export const SHIELD_TEMPEST: Sprite = {
  palette: { o: O, b: "#2c5fb8", c: "#1a3a7a", w: "#8fd6ff", y: "#ffe14d" },
  rows: [
    ".oooooooo.",
    "obwbbbbbco",
    "obbbbyybco",
    "obbbyybbco",
    "obbyyyybco",
    "obbbbyybco",
    "obbbyybbco",
    "oobbybbboo",
    ".oobbbboo.",
    "...obbo...",
    "....oo....",
  ],
};

/** 盾ID → スプライト。未知IDは木盾で代替 */
export const SHIELD_BY_ID: Record<string, Sprite> = {
  sh_wood: SHIELD_WOOD,
  sh_iron: SHIELD_IRON,
  sh_knight: SHIELD_KNIGHT,
  sh_aegis: SHIELD_AEGIS,
  sh_tempest: SHIELD_TEMPEST,
  sh_obsidian: SHIELD_OBSIDIAN,
  sh_astral: SHIELD_ASTRAL,
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

// ===== 下部ナビのドット絵アイコン（ホーム/ワールド/インベントリ/鍛冶屋/ショップ） =====
const OUTL = "#1c1b1b";
/** ホーム：家 */
export const NAV_HOME: Sprite = {
  palette: { o: OUTL, b: "#5fa8ff", y: "#ffd35f" },
  rows: [
    ".....o.....",
    "....obo....",
    "...obbbo...",
    "..obbbbbo..",
    ".obbbbbbbo.",
    "oo.bbbbb.oo",
    ".obbyyybbo.",
    ".obbyyybbo.",
    ".obbyyybbo.",
    ".ooooooooo.",
  ],
};
/** ワールド：地球儀 */
export const NAV_WORLD: Sprite = {
  palette: { o: OUTL, b: "#3fa8a0" },
  rows: [
    "...ooooo...",
    ".oobbbbboo.",
    ".obobbbobo.",
    "oobbbobbboo",
    "obbbbbbbbbo",
    "oobbbobbboo",
    ".obobbbobo.",
    ".oobbbbboo.",
    "...ooooo...",
    "...........",
  ],
};
/** インベントリ：リュック */
export const NAV_BAG: Sprite = {
  palette: { o: OUTL, b: "#e0622a", y: "#ffd35f" },
  rows: [
    "...ooo.....",
    "..oyyyo....",
    ".ooooooo...",
    ".obbbbbo...",
    ".obyyybo...",
    ".obyyybo...",
    ".obbbbbo...",
    ".obbbbbo...",
    ".ooooooo...",
    "..o...o....",
  ],
};
/** 鍛冶屋：ハンマー */
export const NAV_FORGE: Sprite = {
  palette: { o: OUTL, h: "#aab2c4", b: "#8a5a2a" },
  rows: [
    ".oooooo....",
    "ohhhhhho...",
    "ohhhhhho...",
    "ohhhhhho...",
    ".oo.b.oo...",
    "...obo.....",
    "...obo.....",
    "...obo.....",
    "..oboo.....",
    "..oo.......",
  ],
};
/** ショップ：カート */
export const NAV_SHOP: Sprite = {
  palette: { o: OUTL, b: "#ffd35f" },
  rows: [
    "o....oo....",
    "o...obbo...",
    "ooooobboo..",
    "obbbbbbbo..",
    "obbbbbbbo..",
    ".obbbbbo...",
    ".ooooooo...",
    "..o...o....",
    ".ooo.ooo...",
    ".ooo.ooo...",
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
