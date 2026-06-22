import { Battle } from "./engine.ts";
import {
  STAGES, STAGE_COUNT, getWeapon, getSkill, effectiveSkill, rollDrops,
  RARITY_MULT, PLAYER_MAX_HP,
} from "./data.ts";
import { loadSave, writeSave } from "./save.ts";
import type { Screen, SaveData, Skill, Weapon, WeaponClass, WeaponInstance, StageDef } from "./types.ts";

const CLASSES: WeaponClass[] = ["slash", "pierce", "crush"];

/** ゲーム全体の進行管理 */
export class Game {
  save: SaveData;
  screen: Screen = "title";
  stageIndex = 0;
  battle: Battle | null = null;
  /** 直近の戦闘結果（result画面用） */
  lastWon = false;
  lastDrops: WeaponInstance[] = [];
  private rotation: Record<WeaponClass, number> = { slash: 0, pierce: 0, crush: 0 };

  constructor() {
    this.save = loadSave();
  }

  // ===== 画面遷移 =====
  goTitle(): void { this.screen = "title"; }
  goStageSelect(): void { this.screen = "stageSelect"; }
  goInventory(): void { this.screen = "inventory"; }

  /** ステージが選択可能か（前ステージクリアで解放） */
  stageUnlocked(i: number): boolean {
    return i === 0 || this.save.bestStage >= i;
  }

  startStage(i: number): void {
    if (!this.stageUnlocked(i)) return;
    this.stageIndex = i;
    this.rotation = { slash: 0, pierce: 0, crush: 0 };
    this.battle = new Battle(STAGES[i].enemies);
    this.screen = "battle";
  }

  retryStage(): void { this.startStage(this.stageIndex); }

  get currentStage(): StageDef { return STAGES[this.stageIndex]; }

  // ===== 武器・装備（インスタンスベース） =====
  equippedInstance(cls: WeaponClass): WeaponInstance | undefined {
    return this.save.inventory.find((it) => it.uid === this.save.equipped[cls]);
  }
  equippedWeapon(cls: WeaponClass): Weapon | undefined {
    const inst = this.equippedInstance(cls);
    return inst ? getWeapon(inst.baseId) : undefined;
  }

  /** その系統の「次に出るスキル」（レアリティ反映済み） */
  currentSkill(cls: WeaponClass): Skill | null {
    const inst = this.equippedInstance(cls);
    if (!inst) return null;
    const w = getWeapon(inst.baseId);
    if (!w || w.skills.length === 0) return null;
    const id = w.skills[this.rotation[cls] % w.skills.length];
    return effectiveSkill(getSkill(id), RARITY_MULT[inst.rarity]);
  }

  useWeapon(cls: WeaponClass): Skill | null {
    if (!this.battle) return null;
    const skill = this.currentSkill(cls);
    if (!skill) return null;
    if (this.battle.useSkill(skill)) {
      this.rotation[cls] += 1;
      return skill;
    }
    return null;
  }

  /** インベントリ（系統で絞り込み） */
  inventoryOf(cls: WeaponClass): WeaponInstance[] {
    return this.save.inventory.filter((it) => getWeapon(it.baseId)?.weapon === cls);
  }

  equip(uid: string): boolean {
    const inst = this.save.inventory.find((it) => it.uid === uid);
    const w = inst ? getWeapon(inst.baseId) : undefined;
    if (!inst || !w) return false;
    this.save.equipped[w.weapon] = uid;
    this.rotation[w.weapon] = 0;
    writeSave(this.save);
    return true;
  }

  // ===== 進行 =====
  update(dt: number): void {
    if (!this.battle) return;
    this.battle.update(dt);
    if (this.screen !== "battle") return;
    if (this.battle.phase === "won") this.onWin();
    else if (this.battle.phase === "lost") this.onLose();
  }

  private onWin(): void {
    this.lastWon = true;
    const stageNum = this.stageIndex + 1;
    if (stageNum > this.save.bestStage) this.save.bestStage = stageNum;
    this.lastDrops = rollDrops(this.currentStage);
    this.save.inventory.push(...this.lastDrops);
    writeSave(this.save);
    this.screen = "result";
  }

  private onLose(): void {
    this.lastWon = false;
    this.lastDrops = [];
    this.screen = "result";
  }

  /** result画面用：現在の戦闘の敵数（描画維持用） */
  get displayBattle(): Battle | null { return this.battle; }
}

export { CLASSES, PLAYER_MAX_HP, STAGE_COUNT };
