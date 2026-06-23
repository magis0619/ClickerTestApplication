import type { SaveData, WeaponInstance, WeaponClass } from "./types.ts";
import { starterInventory, getWeapon } from "./data.ts";

const KEY = "astral-warden-save-v6";

/** 初期セーブ：標準武器を1本ずつ所持・装備 */
export function defaultSave(): SaveData {
  const inv = starterInventory();
  const equipped: Record<WeaponClass, string> = { slash: "", pierce: "", crush: "" };
  for (const it of inv) {
    const w = getWeapon(it.baseId);
    if (w && !equipped[w.weapon]) equipped[w.weapon] = it.uid;
  }
  return { inventory: inv, equipped, bestStage: 0, gold: 0, purchased: [] };
}

/** 装備が無効（売却・データ不整合）な系統を、所持品から補完する */
function fixEquipped(save: SaveData): void {
  for (const cls of ["slash", "pierce", "crush"] as WeaponClass[]) {
    const cur = save.inventory.find((it) => it.uid === save.equipped[cls]);
    const curOk = cur && getWeapon(cur.baseId)?.weapon === cls;
    if (!curOk) {
      const alt = save.inventory.find((it) => getWeapon(it.baseId)?.weapon === cls);
      save.equipped[cls] = alt ? alt.uid : "";
    }
  }
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const inventory: WeaponInstance[] = Array.isArray(parsed.inventory) ? parsed.inventory : [];
    if (inventory.length === 0) return defaultSave();
    const save: SaveData = {
      inventory,
      equipped: { slash: "", pierce: "", crush: "", ...(parsed.equipped ?? {}) },
      bestStage: typeof parsed.bestStage === "number" ? parsed.bestStage : 0,
      gold: typeof parsed.gold === "number" ? parsed.gold : 0,
      purchased: Array.isArray(parsed.purchased) ? parsed.purchased : [],
    };
    fixEquipped(save);
    return save;
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ストレージ不可環境では無視
  }
}
