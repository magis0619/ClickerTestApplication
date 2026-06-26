import { Battle } from "./engine.ts";
import {
  STAGES, STAGE_COUNT, getWeapon, getSkill, PLAYER_MAX_HP, makeInstance, endlessFloorEnemies,
  effectiveWeapon, expForNext, materialExp, levelCap, awakenCost, MAX_AWAKEN, rollChestWeapon,
  withRareSpawn, getShield, SHIELDS, DEFAULT_SHIELD_ID,
} from "./data.ts";
import { loadSave, writeSave } from "./save.ts";
import type {
  Screen, SaveData, Skill, Weapon, WeaponClass, WeaponInstance, StageDef, ShopChest, Shield,
} from "./types.ts";

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
  /** 無限の回廊：現在の階 */
  endlessFloor = 1;
  /** 無限の回廊：今回到達した階（result表示用） */
  lastFloor = 0;
  private rotation: Record<WeaponClass, number> = { slash: 0, pierce: 0, crush: 0 };

  constructor() {
    this.save = loadSave();
  }

  // ===== 画面遷移 =====
  goTitle(): void { this.screen = "title"; }
  goStageSelect(): void { this.screen = "stageSelect"; }
  goInventory(): void { this.screen = "inventory"; }
  goForge(): void { this.screen = "forge"; }
  goShop(): void { this.screen = "shop"; }
  goWorldSelect(): void { this.screen = "worldSelect"; }
  goHowTo(): void { this.screen = "howto"; }

  /** 所持ゴールド */
  get gold(): number { return this.save.gold; }

  /** その武器が購入済み（売り切れ）か */
  isSoldOut(baseId: string): boolean {
    return this.save.purchased.includes(baseId);
  }

  /** ショップで武器を購入。成功でtrue（ゴールド不足/売切/不正ID時はfalse） */
  buyWeapon(baseId: string, price: number): boolean {
    if (this.save.gold < price || !getWeapon(baseId) || this.isSoldOut(baseId)) return false;
    this.save.gold -= price;
    this.save.inventory.push(makeInstance(baseId));
    this.save.purchased.push(baseId);
    writeSave(this.save);
    return true;
  }

  /** 宝箱を購入＝即開封。成功なら中身の武器インスタンスを返す（ゴールド不足はnull） */
  buyChest(chest: ShopChest): WeaponInstance | null {
    if (this.save.gold < chest.price) return null;
    this.save.gold -= chest.price;
    const inst = rollChestWeapon(chest.rarity);
    this.save.inventory.push(inst);
    writeSave(this.save);
    return inst;
  }

  // ===== 鍛冶屋（武器強化：経験値レベル・覚醒） =====
  /** 強化対象に出来る他の武器（素材候補）。対象自身・装備中・ロック中は除外 */
  forgeMaterials(targetUid: string): WeaponInstance[] {
    return this.save.inventory.filter((it) =>
      it.uid !== targetUid &&
      !this.isLocked(it.uid) &&
      !this.isEquippedAny(it.uid));
  }
  /** いずれかの系統で装備中か */
  isEquippedAny(uid: string): boolean {
    return (["slash", "pierce", "crush"] as WeaponClass[]).some((c) => this.save.equipped[c] === uid);
  }
  /** 対象武器のレベル上限（覚醒回数で決まる） */
  levelCapOf(inst: WeaponInstance): number {
    return levelCap(inst.awakened ?? 0);
  }
  /** 覚醒の壁に到達しているか（レベル上限で、まだ覚醒余地がある） */
  atAwakenWall(inst: WeaponInstance): boolean {
    return (inst.level ?? 1) >= this.levelCapOf(inst) && (inst.awakened ?? 0) < MAX_AWAKEN;
  }
  /** 覚醒に必要な「同一武器」の素材候補（対象自身・装備中・ロック中は除外） */
  awakenCandidates(inst: WeaponInstance): WeaponInstance[] {
    return this.forgeMaterials(inst.uid).filter((m) => m.baseId === inst.baseId);
  }
  /** 覚醒可能か（壁に到達＆必要数の同一武器がある） */
  canAwaken(inst: WeaponInstance): boolean {
    if (!this.atAwakenWall(inst)) return false;
    return this.awakenCandidates(inst).length >= awakenCost(inst.awakened ?? 0);
  }
  /** 覚醒を実行：必要数の同一武器を消費し、覚醒回数+1・レベル上限を解放 */
  awaken(uid: string): boolean {
    const inst = this.save.inventory.find((it) => it.uid === uid);
    if (!inst || !this.canAwaken(inst)) return false;
    const need = awakenCost(inst.awakened ?? 0);
    const mats = this.awakenCandidates(inst).slice(0, need).map((m) => m.uid);
    this.save.inventory = this.save.inventory.filter((it) => !mats.includes(it.uid));
    inst.awakened = (inst.awakened ?? 0) + 1;
    writeSave(this.save);
    return true;
  }
  /** 素材として選んだ武器の合計経験値 */
  materialExpTotal(uids: string[]): number {
    return uids.reduce((s, uid) => {
      const m = this.save.inventory.find((it) => it.uid === uid);
      return s + (m ? materialExp(m) : 0);
    }, 0);
  }
  /**
   * 素材武器を消費して対象に経験値を与え、可能な限りレベルアップ（壁で停止）。
   * 返り値：上昇したレベル数（0なら強化なし）
   */
  enhance(targetUid: string, materialUids: string[]): number {
    const inst = this.save.inventory.find((it) => it.uid === targetUid);
    if (!inst || materialUids.length === 0) return 0;
    const w = getWeapon(inst.baseId);
    if (!w) return 0;
    const before = inst.level ?? 1;
    inst.level = before;
    inst.exp = inst.exp ?? 0;
    inst.exp += this.materialExpTotal(materialUids);
    // 経験値が溜まる限りレベルアップ（覚醒の壁＝レベル上限で停止）
    while (inst.level < this.levelCapOf(inst)) {
      const need = expForNext(w.rarity, inst.level);
      if (inst.exp < need) break;
      inst.exp -= need;
      inst.level += 1;
    }
    // 上限に達したら端数の経験値は持ち越さない
    if (inst.level >= this.levelCapOf(inst)) inst.exp = 0;
    // 素材を消費
    this.save.inventory = this.save.inventory.filter((it) => !materialUids.includes(it.uid));
    writeSave(this.save);
    return inst.level - before;
  }

  /** ステージが選択可能か（前ステージクリアで解放。無限の回廊は常に開放） */
  stageUnlocked(i: number): boolean {
    if (STAGES[i]?.endless) return true;
    return i === 0 || this.save.bestStage >= i;
  }
  /** ワールドが解放済みか（先頭ダンジョンが解放されていれば見られる） */
  worldUnlocked(stageIndices: number[]): boolean {
    return stageIndices.length > 0 && this.stageUnlocked(stageIndices[0]);
  }

  startStage(i: number): void {
    if (!this.stageUnlocked(i)) return;
    this.stageIndex = i;
    this.waveIndex = 0;
    this.lastDrops = [];
    this.lastGold = 0;
    this.lastFloor = 0;
    this.rotation = { slash: 0, pierce: 0, crush: 0 };
    if (this.isEndless) {
      this.endlessFloor = 1;
      this.battle = new Battle(withRareSpawn(endlessFloorEnemies(1), false));
      this.battle.playerDefense = this.defense;
      this.battle.announce("1階", "#9fd9ff");
    } else {
      this.battle = new Battle(withRareSpawn(this.currentStage.waves[0], this.isBossWave));
      this.battle.playerDefense = this.defense;
      // 最終ウェーブ（＝このステージ＝ダンジョンの完了）でだけ STAGE CLEAR バナーを出す
      this.battle.isFinalWave = this.isBossWave;
      // ボス戦は暗転＋BOSS BATTLE の警告演出。通常は「ステージN」のポップを出す
      if (this.isBossWave) this.battle.beginBossIntro();
      else this.battle.announce(`ステージ${this.waveIndex + 1}`, "#ffd35f");
    }
    this.screen = "battle";
  }

  retryStage(): void { this.startStage(this.stageIndex); }

  get currentStage(): StageDef { return STAGES[this.stageIndex]; }
  /** このステージの総戦闘数 */
  get waveCount(): number { return this.currentStage.waves.length; }
  /** 現在の戦闘がボス戦か */
  get isBossWave(): boolean { return this.waveIndex === this.waveCount - 1; }
  /** 無限の回廊か */
  get isEndless(): boolean { return !!this.currentStage.endless; }

  // ===== 武器・装備（インスタンスベース） =====
  equippedInstance(cls: WeaponClass): WeaponInstance | undefined {
    return this.save.inventory.find((it) => it.uid === this.save.equipped[cls]);
  }
  equippedWeapon(cls: WeaponClass): Weapon | undefined {
    const inst = this.equippedInstance(cls);
    // 強化レベル・覚醒を反映した実効ステータスを返す（戦闘・戦闘力表示で使用）
    return inst ? effectiveWeapon(inst) : undefined;
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

  // ===== 盾（防具） =====
  /** 所持している盾（現状は全種を最初から所持） */
  get shields(): Shield[] { return SHIELDS; }
  /** 装備中の盾。未設定・不正なら既定の盾にフォールバック */
  equippedShield(): Shield | undefined {
    return getShield(this.save.equippedShield) ?? getShield(DEFAULT_SHIELD_ID);
  }
  /** 盾を装備する。成功で true */
  equipShield(id: string): boolean {
    if (!getShield(id)) return false;
    this.save.equippedShield = id;
    writeSave(this.save);
    // 戦闘中なら即座に防御力へ反映
    if (this.battle) this.battle.playerDefense = this.defense;
    return true;
  }
  /** 現在の防御力（装備盾の defense） */
  get defense(): number { return this.equippedShield()?.defense ?? 0; }

  /** 削除ロック中か */
  isLocked(uid: string): boolean {
    return this.save.locked.includes(uid);
  }
  /** 削除ロックの切替 */
  toggleLock(uid: string): boolean {
    if (this.isLocked(uid)) this.save.locked = this.save.locked.filter((u) => u !== uid);
    else this.save.locked.push(uid);
    writeSave(this.save);
    return this.isLocked(uid);
  }

  /** 装備中・ロック中でない武器を削除できる */
  canDelete(uid: string): boolean {
    const inst = this.save.inventory.find((it) => it.uid === uid);
    const w = inst ? getWeapon(inst.baseId) : undefined;
    if (!inst || !w) return false;
    return this.save.equipped[w.weapon] !== uid && !this.isLocked(uid);
  }
  deleteWeapon(uid: string): boolean {
    if (!this.canDelete(uid)) return false;
    this.save.inventory = this.save.inventory.filter((it) => it.uid !== uid);
    writeSave(this.save);
    return true;
  }
  /** 複数の武器をまとめて削除（削除可能なものだけ）。削除した本数を返す */
  deleteMany(uids: string[]): number {
    const del = new Set(uids.filter((u) => this.canDelete(u)));
    if (del.size === 0) return 0;
    this.save.inventory = this.save.inventory.filter((it) => !del.has(it.uid));
    writeSave(this.save);
    return del.size;
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

    // 無限の回廊：1階クリアごとに報酬を即確定し、次の階へ（HP/EN引き継ぎ）
    if (this.isEndless) {
      const drops = this.battle.collectedDrops();
      this.save.inventory.push(...drops);
      this.save.gold += this.battle.goldEarned;
      this.lastDrops.push(...drops);
      this.lastGold += this.battle.goldEarned;
      if (this.endlessFloor > this.save.bestFloor) this.save.bestFloor = this.endlessFloor;
      writeSave(this.save);
      const hp = this.battle.playerHp;
      const en = this.battle.playerEn;
      this.endlessFloor += 1;
      this.rotation = { slash: 0, pierce: 0, crush: 0 };
      this.battle = new Battle(withRareSpawn(endlessFloorEnemies(this.endlessFloor), this.endlessFloor % 5 === 0), hp, en);
      this.battle.playerDefense = this.defense;
      this.battle.announce(`${this.endlessFloor}階`, this.endlessFloor % 5 === 0 ? "#ff6b6b" : "#9fd9ff");
      return;
    }

    // この戦闘のドロップ・ゴールドを蓄積
    this.lastDrops.push(...this.battle.collectedDrops());
    this.lastGold += this.battle.goldEarned;

    if (this.waveIndex < this.waveCount - 1) {
      // まだ戦闘が残る：HP/ENを引き継いで次の戦闘へ
      const hp = this.battle.playerHp;
      const en = this.battle.playerEn;
      this.waveIndex += 1;
      this.rotation = { slash: 0, pierce: 0, crush: 0 };
      this.battle = new Battle(withRareSpawn(this.currentStage.waves[this.waveIndex], this.isBossWave), hp, en);
      this.battle.playerDefense = this.defense;
      // 最終ウェーブ（＝ダンジョン完了）でだけ STAGE CLEAR バナーを出す
      this.battle.isFinalWave = this.isBossWave;
      // ボス戦は暗転＋BOSS BATTLE の警告演出。通常は「ステージN」のポップを出す
      if (this.isBossWave) this.battle.beginBossIntro();
      else this.battle.announce(`ステージ${this.waveIndex + 1}`, "#ffd35f");
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
    if (this.isEndless) {
      // 回廊では各階の報酬は確定済み。到達階を記録して結果へ
      this.lastFloor = this.endlessFloor;
    } else {
      this.lastDrops = [];
    }
    this.screen = "result";
  }

  /** result画面用：現在の戦闘の敵数（描画維持用） */
  get displayBattle(): Battle | null { return this.battle; }
}

export { CLASSES, PLAYER_MAX_HP, STAGE_COUNT };
