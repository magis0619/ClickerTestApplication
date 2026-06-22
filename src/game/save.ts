import type { SaveData } from "./types.ts";
import { SKILLS, STARTER_WEAPONS, DEFAULT_EQUIPPED } from "./data.ts";

const KEY = "astral-warden-save-v1";

/** 初期セーブデータ（全スキルLv1・霊片0・標準武器所持） */
export function defaultSave(): SaveData {
  const skillLevels: Record<string, number> = {};
  for (const s of SKILLS) skillLevels[s.id] = 1;
  return {
    shards: 0,
    skillLevels,
    bestStage: 0,
    ownedWeapons: [...STARTER_WEAPONS],
    equipped: { ...DEFAULT_EQUIPPED },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    // 既存スキルにマージ（新スキル追加時もLv1で補完）
    const skillLevels = { ...base.skillLevels, ...(parsed.skillLevels ?? {}) };
    // 所持武器は標準武器を必ず含める
    const owned = Array.from(new Set([...base.ownedWeapons, ...(parsed.ownedWeapons ?? [])]));
    const equipped = { ...base.equipped, ...(parsed.equipped ?? {}) };
    return {
      shards: typeof parsed.shards === "number" ? parsed.shards : 0,
      skillLevels,
      bestStage: typeof parsed.bestStage === "number" ? parsed.bestStage : 0,
      ownedWeapons: owned,
      equipped,
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
