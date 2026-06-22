import type { SaveData } from "./types.ts";
import { SKILLS } from "./data.ts";

const KEY = "astral-warden-save-v1";

/** 初期セーブデータ（全スキルLv1・霊片0） */
export function defaultSave(): SaveData {
  const skillLevels: Record<string, number> = {};
  for (const s of SKILLS) skillLevels[s.id] = 1;
  return { shards: 0, skillLevels, bestStage: 0 };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    // 既存スキルにマージ（新スキル追加時もLv1で補完）
    const skillLevels = { ...base.skillLevels, ...(parsed.skillLevels ?? {}) };
    return {
      shards: typeof parsed.shards === "number" ? parsed.shards : 0,
      skillLevels,
      bestStage: typeof parsed.bestStage === "number" ? parsed.bestStage : 0,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ストレージ不可環境では黙って無視（セッション内のみ進行）
  }
}
