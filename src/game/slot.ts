// ===== セーブスロット（本番データ ⇄ 開発用の空データ を行き来する） =====
// セーブ・進捗のlocalStorageキーにサフィックスを付けてスロットを分離する。
// 切り替えはページリロードを伴う（各モジュールが読み込み時にキーを確定するため）。

const SLOT_KEY = "astral-warden-slot";
export type Slot = "main" | "dev";

/** 現在アクティブなスロット */
export function activeSlot(): Slot {
  try {
    return localStorage.getItem(SLOT_KEY) === "dev" ? "dev" : "main";
  } catch {
    return "main";
  }
}
/** スロットを設定（実際の切り替えは呼び出し側でリロードする） */
export function setSlot(s: Slot): void {
  try { localStorage.setItem(SLOT_KEY, s); } catch { /* 無視 */ }
}
/** キーに付けるサフィックス（devのみ "-dev"） */
export function slotSuffix(): string {
  return activeSlot() === "dev" ? "-dev" : "";
}
