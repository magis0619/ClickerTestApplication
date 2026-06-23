import { Battle } from "./engine.ts";
import {
  STAGES, STAGE_COUNT, getWeapon, getSkill, PLAYER_MAX_HP, makeInstance,
} from "./data.ts";
import { loadSave, writeSave } from "./save.ts";
import type { Screen, SaveData, Skill, Weapon, WeaponClass, WeaponInstance, StageDef } from "./types.ts";

const CLASSES: WeaponClass[] = ["slash", "pierce", "crush"];

/** ゲーム全体の進行管理 */
export class Game {
  save: SaveData;
  screen: Screen = "title";
  stageIndex = 0;
  /** ステージ内の現在の戦闘番号（0始まり。最後がボス戦） */
  waveIndex = 0;
  battle: Battle | null = null;
  /** 直近の戦闘結果（result画面用） */
  lastWon = false;
  lastDrops: WeaponInstance[] = [];
  /** この冒険で得たゴールド合計（result画面用） */
  lastGold = 0;
  private rotation: Record<WeaponClass, number> = { slash: 0, pierce: 0, crush: 0 };

  constructor() {
    this.save = loadSave();
  }

  // ===== 画面遷移 =====
  goTitle(): void { this.screen = "title"; }
  goStageSelect(): void { this.screen = "stageSelect"; }
  goInventory(): void { this.screen = "inventory"; }
  goShop(): void { this.screen = "shop"; }

  /** 所持ゴールド */
  get gold(): number { return this.save.gold; }

  /** ショップで武器を購入。成功でtrue（ゴールド不足/不正ID時はfalse） */
  buyWeapon(baseId: string, price: number): boolean {
    if (this.save.gold < price || !getWeapon(baseId)) return false;
    this.save.gold -= price;
    this.save.inventory.push(makeInstance(baseId));
    writeSave(this.save);
    return true;
  }

  /** ステージが選択可能か（前ステージクリアで解放） */
  stageUnlocked(i: number): boolean {
    return i === 0 || this.save.bestStage >= i;
  }

  startStage(i: number): void {
    if (!this.stageUnlocked(i)) return;
    this.stageIndex = i;
    this.waveIndex = 0;
    this.lastDrops = [];
    this.lastGold = 0;
    this.rotation = { slash: 0, pierce: 0, crush: 0 };
    this.battle = new Battle(this.currentStage.waves[0]);
    this.screen = "battle";
  }

  retryStage(): void { this.startStage(this.stageIndex); }

  get currentStage(): StageDef { return STAGES[this.stageIndex]; }
  /** このステージの総戦闘数 */
  get waveCount(): number { return this.currentStage.waves.length; }
  /** 現在の戦闘がボス戦か */
  get isBossWave(): boolean { return this.waveIndex === this.waveCount - 1; }

  // ===== 武器・装備（インスタンスベース） =====
  equippedInstance(cls: WeaponClass): WeaponInstance | undefined {
    return this.save.inventory.find((it) => it.uid === this.save.equipped[cls]);
  }
  equippedWeapon(cls: WeaponClass): Weapon | undefined {
    const inst = this.equippedInstance(cls);
    return inst ? getWeapon(inst.baseId) : undefined;
  }

  /** インスタンスが持つ（抽選された）スキルID列 */
  instanceSkillIds(inst: WeaponInstance): string[] {
    return inst.skillIds;
  }

  /** その系統の「次に出るスキル」 */
  currentSkill(cls: WeaponClass): Skill | null {
    const inst = this.equippedInstance(cls);
    if (!inst || inst.skillIds.length === 0) return null;
    const id = inst.skillIds[this.rotation[cls] % inst.skillIds.length];
    return getSkill(id) ?? null;
  }

  /** その系統のコンボ（全スキルを順番通りに） */
  comboSkills(cls: WeaponClass): Skill[] {
    const inst = this.equippedInstance(cls);
    if (!inst) return [];
    return inst.skillIds.map((id) => getSkill(id)).filter((s): s is Skill => !!s);
  }

  /** その系統で次に発動するコンボ段のインデックス（0始まり） */
  comboIndex(cls: WeaponClass): number {
    const len = this.comboSkills(cls).length;
    return len === 0 ? 0 : this.rotation[cls] % len;
  }

  useWeapon(cls: WeaponClass): Skill | null {
    if (!this.battle) return null;
    const skill = this.currentSkill(cls);
    const w = this.equippedWeapon(cls);
    if (!skill || !w) return null;
    const mods = { weapon: w.weapon, attack: w.attack, critChance: w.critChance, breakPower: w.breakPower };
    if (this.battle.useSkill(skill, mods)) {
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

  /** 装備中でない武器を削除する（装備中は不可） */
  canDelete(uid: string): boolean {
    const inst = this.save.inventory.find((it) => it.uid === uid);
    const w = inst ? getWeapon(inst.baseId) : undefined;
    if (!inst || !w) return false;
    return this.save.equipped[w.weapon] !== uid;
  }
  deleteWeapon(uid: string): boolean {
    if (!this.canDelete(uid)) return false;
    this.save.inventory = this.save.inventory.filter((it) => it.uid !== uid);
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
    if (!this.battle) return;
    // この戦闘のドロップ・ゴールドを蓄積
    this.lastDrops.push(...this.battle.collectedDrops());
    this.lastGold += this.battle.goldEarned;

    if (this.waveIndex < this.waveCount - 1) {
      // まだ戦闘が残る：HP/ENを引き継いで次の戦闘へ
      const hp = this.battle.playerHp;
      const en = this.battle.playerEn;
      this.waveIndex += 1;
      this.rotation = { slash: 0, pierce: 0, crush: 0 };
      this.battle = new Battle(this.currentStage.waves[this.waveIndex], hp, en);
      this.battle.announce(
        this.isBossWave ? "BOSS BATTLE" : `WAVE ${this.waveIndex + 1} / ${this.waveCount}`,
        this.isBossWave ? "#ff6b6b" : "#ffd35f",
      );
      return;
    }

    // 最終戦闘クリア＝ステージクリア
    this.lastWon = true;
    const stageNum = this.stageIndex + 1;
    if (stageNum > this.save.bestStage) this.save.bestStage = stageNum;
    this.save.inventory.push(...this.lastDrops);
    this.save.gold += this.lastGold; // 獲得ゴールドを確定
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
