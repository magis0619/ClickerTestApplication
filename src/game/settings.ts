// ===== ユーザー設定（音量・演出・難易度補助）。localStorageに永続化 =====

export interface Settings {
  /** BGM音量 0..1 */
  bgm: number;
  /** 効果音音量 0..1 */
  sfx: number;
  /** 画面シェイクの強さ倍率 0..1.5（0で無効） */
  shake: number;
  /** ガード判定の猶予倍率 1.0..1.6（大きいほど易しい） */
  leniency: number;
}

const KEY = "astral-warden-settings-v1";
const DEFAULTS: Settings = { bgm: 1, sfx: 1, shake: 1, leniency: 1 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    const num = (v: unknown, d: number, min: number, max: number): number =>
      typeof v === "number" && isFinite(v) ? Math.max(min, Math.min(max, v)) : d;
    return {
      bgm: num(p.bgm, DEFAULTS.bgm, 0, 1),
      sfx: num(p.sfx, DEFAULTS.sfx, 0, 1),
      shake: num(p.shake, DEFAULTS.shake, 0, 1.5),
      leniency: num(p.leniency, DEFAULTS.leniency, 1, 1.6),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** 全体で共有する設定オブジェクト（参照で読む） */
export const settings: Settings = load();

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 無視 */ }
}
