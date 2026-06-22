import { Battle } from "./engine.ts";
import {
  STAGES,
  STAGE_COUNT,
  SKILLS,
  WEAPONS,
  getWeapon,
  getSkill,
  effectiveSkill,
  upgradeCost,
  STAGE_HEAL_RATIO,
  PLAYER_MAX_HP,
  PLAYER_MAX_EN,
} from "./data.ts";
import { loadSave, writeSave } from "./save.ts";
import type { Screen, SaveData, Skill, Weapon, WeaponClass } from "./types.ts";

const CLASSES: WeaponClass[] = ["slash", "pierce", "crush"];

/** ゲーム全体の進行管理 */
export class Game {
  save: SaveData;
  screen: Screen = "battle";
  stageIndex = 0;
  playerHp = PLAYER_MAX_HP;
  battle: Battle;
  lastReward = 0;
  /** 直近で入手した武器（報酬画面表示用） */
  lastDrops: Weapon[] = [];
  /** 系統ごとの武器スキルローテーション位置 */
  private rotation: Record<WeaponClass, number> = { slash: 0, pierce: 0, crush: 0 };

  constructor() {
    this.save = loadSave();
    this.battle = this.makeBattle();
  }

  private makeBattle(): Battle {
    this.rotation = { slash: 0, pierce: 0, crush: 0 };
    return new Battle(STAGES[this.stageIndex], this.playerHp, PLAYER_MAX_EN);
  }

  // ===== 武器スキルローテーション =====

  equippedWeapon(cls: WeaponClass): Weapon | undefined {
    return getWeapon(this.save.equipped[cls]);
  }

  /** その系統の「次に出るスキル」（強化反映済み） */
  currentSkill(cls: WeaponClass): Skill | null {
    const w = this.equippedWeapon(cls);
    if (!w || w.skills.length === 0) return null;
    const id = w.skills[this.rotation[cls] % w.skills.length];
    return effectiveSkill(getSkill(id), this.skillLevel(id));
  }

  /** 装備武器で攻撃（成功でtrue、ローテーションを進める） */
  useWeapon(cls: WeaponClass): Skill | null {
    const skill = this.currentSkill(cls);
    if (!skill) return null;
    if (this.battle.useSkill(skill)) {
      this.rotation[cls] += 1;
      return skill;
    }
    return null;
  }

  // ===== 武器の所持・装備 =====

  ownedWeaponsOf(cls: WeaponClass): Weapon[] {
    return WEAPONS.filter((w) => w.weapon === cls && this.save.ownedWeapons.includes(w.id));
  }

  equip(weaponId: string): boolean {
    const w = getWeapon(weaponId);
    if (!w || !this.save.ownedWeapons.includes(weaponId)) return false;
    this.save.equipped[w.weapon] = weaponId;
    this.rotation[w.weapon] = 0;
    writeSave(this.save);
    return true;
  }

  // ===== スキル育成 =====

  skillLevel(id: string): number {
    return this.save.skillLevels[id] ?? 1;
  }
  costFor(id: string): number {
    return upgradeCost(this.skillLevel(id));
  }
  canUpgrade(id: string): boolean {
    return this.save.shards >= this.costFor(id);
  }
  upgrade(id: string): boolean {
    if (!this.canUpgrade(id)) return false;
    this.save.shards -= this.costFor(id);
    this.save.skillLevels[id] = this.skillLevel(id) + 1;
    writeSave(this.save);
    return true;
  }
  /** 強化対象として表示するスキル（ためる以外） */
  upgradableSkills(): Skill[] {
    return SKILLS.filter((s) => s.kind !== "charge");
  }

  // ===== 進行 =====

  update(dt: number): void {
    this.battle.update(dt);
    if (this.screen !== "battle") return;
    if (this.battle.phase === "won") this.onWin();
    else if (this.battle.phase === "lost") this.onLose();
  }

  private onWin(): void {
    const defs = STAGES[this.stageIndex];
    this.lastReward = defs.reduce((sum, d) => sum + d.reward, 0);
    this.save.shards += this.lastReward;
    const stageNum = this.stageIndex + 1;
    if (stageNum > this.save.bestStage) this.save.bestStage = stageNum;

    // 武器ドロップ（未所持なら入手、重複排除）
    this.lastDrops = [];
    for (const d of defs) {
      if (d.dropWeapon && !this.save.ownedWeapons.includes(d.dropWeapon)) {
        this.save.ownedWeapons.push(d.dropWeapon);
        const w = getWeapon(d.dropWeapon);
        if (w) this.lastDrops.push(w);
      }
    }

    this.playerHp = Math.min(
      PLAYER_MAX_HP,
      this.battle.playerHp + Math.round(PLAYER_MAX_HP * STAGE_HEAL_RATIO),
    );
    writeSave(this.save);
    this.screen = stageNum >= STAGE_COUNT ? "clear" : "reward";
  }

  private onLose(): void {
    this.screen = "gameover";
  }

  next(): void {
    if (this.screen !== "reward") return;
    this.stageIndex += 1;
    this.battle = this.makeBattle();
    this.screen = "battle";
  }

  restartRun(): void {
    this.stageIndex = 0;
    this.playerHp = PLAYER_MAX_HP;
    this.battle = this.makeBattle();
    this.screen = "battle";
  }
}

export { CLASSES };
