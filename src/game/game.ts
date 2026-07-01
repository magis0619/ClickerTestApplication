import { Battle } from "./engine.ts";
import {
  STAGES, STAGE_COUNT, getWeapon, getSkill, PLAYER_MAX_HP, makeInstance, endlessFloorEnemies,
  effectiveWeapon, expForNext, materialExp, levelCap, awakenCost, MAX_AWAKEN, rollChestWeapon,
  withRareSpawn, getShield, SHIELDS, DEFAULT_SHIELD_ID, scaleWaveForWorld,
  playerMaxHpAt, playerExpForNext, MAX_PLAYER_LEVEL, ambushBoss, AMBUSH_CHANCE,
  socketBonuses, socketCount, rollGemDrop,
} from "./data.ts";
import { loadSave, writeSave } from "./save.ts";
import { progress, saveProgress, addMissionProgress } from "./progress.ts";
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
  /** この冒険で入手した秘石ID（result表示用） */
  lastGems: string[] = [];
  /** この冒険で得たゴールド合計（result画面用） */
  lastGold = 0;
  /** 無限の回廊：現在の階 */
  endlessFloor = 1;
  /** 無限の回廊：今回到達した階（result表示用） */
  lastFloor = 0;
  /** 戦績（result表示用）：最大ダメージ／パーフェクト回数／ノーダメージ達成 */
  lastMaxHit = 0;
  lastPerfects = 0;
  lastFlawless = true;
  /** 直近クリアの戦闘評価ランク（S/A/B/C。未クリア時は空） */
  lastRank = "";
  /** 直近クリアで獲得したスター数（1..3） */
  lastStars = 0;
  /** この冒険で得た経験値合計（result表示用） */
  lastExp = 0;
  /** この冒険で上がったレベル数（result表示用） */
  lastLevelUps = 0;
  /** 蓄積した経験値を既にプレイヤーへ反映したか（ダンジョン終了時に一度だけ反映する） */
  private expBanked = false;
  /** 乱入ボス戦の最中か */
  inAmbush = false;
  /** 乱入が発生したか（result表示用） */
  lastAmbush = false;
  /** 乱入ボスを倒したか（result表示用） */
  lastAmbushWon = false;
  /** 乱入ボス討伐時にアストラル級武器が実際にドロップしたか（result表示用） */
  lastAmbushDrop = false;
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
  goAchievements(): void { this.screen = "achievements"; }
  goCodex(): void { this.screen = "codex"; }

  /** ゴールドを加算して保存（実績・デイリー報酬の受け取り用） */
  addGold(n: number): void { this.save.gold += n; writeSave(this.save); }

  // ===== プレイヤーレベル（経験値で最大HPが上昇） =====
  /** 現在の最大HP（レベル依存） */
  get playerMaxHp(): number { return playerMaxHpAt(this.save.playerLevel); }
  /** 次のレベルに必要な経験値 */
  expForNextLevel(): number { return playerExpForNext(this.save.playerLevel); }
  /**
   * 経験値を加算してレベルアップ処理。上がったレベル数を返す。
   * 上限レベルでは経験値を蓄積しない。
   */
  addPlayerExp(n: number): number {
    if (n <= 0) return 0;
    if (this.save.playerLevel >= MAX_PLAYER_LEVEL) { this.save.playerExp = 0; return 0; }
    this.save.playerExp += n;
    let ups = 0;
    while (this.save.playerLevel < MAX_PLAYER_LEVEL) {
      const need = playerExpForNext(this.save.playerLevel);
      if (this.save.playerExp < need) break;
      this.save.playerExp -= need;
      this.save.playerLevel += 1;
      ups += 1;
    }
    if (this.save.playerLevel >= MAX_PLAYER_LEVEL) this.save.playerExp = 0;
    writeSave(this.save);
    return ups;
  }

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
    this.lastGems = [];
    this.lastGold = 0;
    this.lastFloor = 0;
    this.lastMaxHit = 0;
    this.lastPerfects = 0;
    this.lastFlawless = true;
    this.lastRank = "";
    this.lastStars = 0;
    this.lastExp = 0;
    this.lastLevelUps = 0;
    this.expBanked = false;
    this.inAmbush = false;
    this.lastAmbush = false;
    this.lastAmbushWon = false;
    this.lastAmbushDrop = false;
    this.rotation = { slash: 0, pierce: 0, crush: 0 };
    if (this.isEndless) {
      this.endlessFloor = 1;
      this.battle = new Battle(withRareSpawn(endlessFloorEnemies(1), false), undefined, undefined, this.playerMaxHp);
      this.battle.playerDefense = this.defense;
      this.battle.shieldPassive = this.equippedShield()?.passive ?? null;
      this.battle.announce("FLOOR 1", "#9fd9ff");
    } else {
      this.battle = new Battle(scaleWaveForWorld(withRareSpawn(this.currentStage.waves[0], this.isBossWave), this.currentStage.world), undefined, undefined, this.playerMaxHp);
      this.battle.playerDefense = this.defense;
      this.battle.shieldPassive = this.equippedShield()?.passive ?? null;
      // 最終ウェーブ（＝このステージ＝ダンジョンの完了）でだけ STAGE CLEAR バナーを出す
      this.battle.isFinalWave = this.isBossWave;
      // ボス戦は暗転＋BOSS BATTLE の警告演出。通常は「ステージN」のポップを出す
      if (this.isBossWave) this.battle.beginBossIntro();
      else this.battle.announce(`STAGE ${this.waveIndex + 1}`, "#ffd35f");
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
    // 秘石の会心威力は Weapon に乗らないため、装着分を mods.critMult として渡す
    const inst = this.equippedInstance(cls);
    const critMult = inst ? socketBonuses(inst).critMult : 0;
    const mods = { weapon: w.weapon, attack: w.attack, critChance: w.critChance, breakPower: w.breakPower, critMult };
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
    // 戦闘中なら即座に防御力・パッシブへ反映
    if (this.battle) {
      this.battle.playerDefense = this.defense;
      this.battle.shieldPassive = this.equippedShield()?.passive ?? null;
    }
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
    this.accumulateStats();

    // 乱入ボス撃破：アストラル級ドロップ＋ゴールド＋EXPを上乗せしてリザルトへ
    if (this.inAmbush) {
      const drops = this.battle.collectedDrops();
      this.save.inventory.push(...drops);
      this.save.gold += this.battle.goldEarned;
      this.lastDrops.push(...drops);
      this.lastGold += this.battle.goldEarned;
      this.lastExp += this.battle.expEarned; // 反映はリザルト遷移時に一括（下のbankPlayerExp）
      writeSave(this.save);
      this.inAmbush = false;
      this.lastAmbushWon = true;
      this.lastAmbushDrop = drops.length > 0;
      progress.ambushWins += 1; saveProgress(); // 実績：乱入ボス討伐
      this.awardGem(rollGemDrop(this.currentStage.world, true)); // 乱入ボスは確定で上位秘石
      this.lastWon = true;
      this.bankPlayerExp();
      this.screen = "result";
      return;
    }

    // 無限の回廊：1階クリアごとに報酬を即確定し、次の階へ（HP/EN引き継ぎ）
    if (this.isEndless) {
      const drops = this.battle.collectedDrops();
      this.save.inventory.push(...drops);
      this.save.gold += this.battle.goldEarned;
      this.lastDrops.push(...drops);
      this.lastGold += this.battle.goldEarned;
      if (this.endlessFloor > this.save.bestFloor) this.save.bestFloor = this.endlessFloor;
      // 経験値は階ごとに即確定（回廊は各階で報酬確定のため）。レベルアップで全回復
      const ups = this.addPlayerExp(this.battle.expEarned);
      this.lastExp += this.battle.expEarned;
      this.lastLevelUps += ups;
      writeSave(this.save);
      const hp = ups > 0 ? this.playerMaxHp : this.battle.playerHp;
      const en = this.battle.playerEn;
      this.endlessFloor += 1;
      this.rotation = { slash: 0, pierce: 0, crush: 0 };
      this.battle = new Battle(withRareSpawn(endlessFloorEnemies(this.endlessFloor), this.endlessFloor % 5 === 0), hp, en, this.playerMaxHp);
      this.battle.playerDefense = this.defense;
      this.battle.shieldPassive = this.equippedShield()?.passive ?? null;
      this.battle.announce(`FLOOR ${this.endlessFloor}`, this.endlessFloor % 5 === 0 ? "#ff6b6b" : "#9fd9ff");
      return;
    }

    // この戦闘のドロップ・ゴールド・経験値を蓄積（経験値はステージクリア時にまとめて反映）
    this.lastDrops.push(...this.battle.collectedDrops());
    this.lastGold += this.battle.goldEarned;
    this.lastExp += this.battle.expEarned;

    if (this.waveIndex < this.waveCount - 1) {
      // まだ戦闘が残る：HP/ENを引き継いで次の戦闘へ
      const hp = this.battle.playerHp;
      const en = this.battle.playerEn;
      this.waveIndex += 1;
      this.rotation = { slash: 0, pierce: 0, crush: 0 };
      this.battle = new Battle(scaleWaveForWorld(withRareSpawn(this.currentStage.waves[this.waveIndex], this.isBossWave), this.currentStage.world), hp, en, this.playerMaxHp);
      this.battle.playerDefense = this.defense;
      this.battle.shieldPassive = this.equippedShield()?.passive ?? null;
      // 最終ウェーブ（＝ダンジョン完了）でだけ STAGE CLEAR バナーを出す
      this.battle.isFinalWave = this.isBossWave;
      // ボス戦は暗転＋BOSS BATTLE の警告演出。通常は「ステージN」のポップを出す
      if (this.isBossWave) this.battle.beginBossIntro();
      else this.battle.announce(`STAGE ${this.waveIndex + 1}`, "#ffd35f");
      return;
    }

    // 最終戦闘クリア＝ステージクリア
    this.lastWon = true;
    const stageNum = this.stageIndex + 1;
    if (stageNum > this.save.bestStage) this.save.bestStage = stageNum;
    // 戦闘評価ランク＆スター（無傷・パーフェクトの多さで決まる攻略度）
    this.computeStageRank();
    const prevStars = this.save.stageStars[this.stageIndex] ?? 0;
    if (this.lastStars > prevStars) this.save.stageStars[this.stageIndex] = this.lastStars;
    // デイリーミッション／実績：クリア回数・ランク達成
    addMissionProgress("dm_clear", 1);
    if (this.lastRank === "S" || this.lastRank === "A") addMissionProgress("dm_rank", 1);
    if (this.lastRank === "S") { progress.rankSClears += 1; saveProgress(); }
    // 秘石ドロップ：ボス（最終戦）撃破で中確率
    this.awardGem(rollGemDrop(this.currentStage.world, false));
    this.save.inventory.push(...this.lastDrops);
    this.save.gold += this.lastGold; // 獲得ゴールドを確定
    writeSave(this.save);
    // 実績：ノーダメージ達成（ステージ全体を無傷でクリア）
    if (this.lastFlawless) { progress.flawlessClears += 1; saveProgress(); }
    // 乱入イベント：低確率でレアボスが乱入。宝は確保済みなので、ここから割り込む。
    // 経験値の反映は乱入も含めてダンジョン完全終了（リザルト遷移）時に一括で行う。
    if (Math.random() < AMBUSH_CHANCE) { this.startAmbush(); return; }
    this.bankPlayerExp();
    this.screen = "result";
  }

  /**
   * 蓄積した経験値をプレイヤーへ一括反映する（ダンジョン終了＝リザルト遷移時に一度だけ）。
   * 戦闘中にレベルアップ＝最大HPが増えるのを防ぐため、途中では反映しない。
   */
  private bankPlayerExp(): void {
    if (this.expBanked) return;
    this.expBanked = true;
    this.lastLevelUps += this.addPlayerExp(this.lastExp);
  }

  /**
   * ステージクリアの戦闘評価を算出する。
   * S＝無傷かつパーフェクト多数 / A＝無傷 or パーフェクト多数 / B＝パーフェクトあり / C＝クリア。
   * スターは攻略度（S=3 / A=2 / B・C=1）。lastRank・lastStars に格納。
   */
  private computeStageRank(): void {
    const flawless = this.lastFlawless;
    const perfects = this.lastPerfects;
    let rank: string;
    if (flawless && perfects >= 3) rank = "S";
    else if (flawless || perfects >= 3) rank = "A";
    else if (perfects >= 1) rank = "B";
    else rank = "C";
    this.lastRank = rank;
    this.lastStars = rank === "S" ? 3 : rank === "A" ? 2 : 1;
  }

  // ===== 秘石（ジェム） =====
  /** 秘石を1個入手（所持加算＋result記録＋保存）。idがundefinedなら何もしない */
  private awardGem(id: string | undefined): void {
    if (!id) return;
    this.save.gems[id] = (this.save.gems[id] ?? 0) + 1;
    this.lastGems.push(id);
    writeSave(this.save);
  }
  /** 武器のソケット配列をレアリティ依存の長さに整える */
  private ensureSockets(inst: WeaponInstance): (string | null)[] {
    const n = socketCount(inst);
    if (!inst.sockets) inst.sockets = [];
    while (inst.sockets.length < n) inst.sockets.push(null);
    if (inst.sockets.length > n) inst.sockets.length = n;
    return inst.sockets;
  }
  /** 武器の現在のソケット（長さ正規化済みのコピー） */
  weaponSockets(inst: WeaponInstance): (string | null)[] {
    return this.ensureSockets(inst).slice();
  }
  /** 秘石を装着。slotに既存があればインベントリに戻す。成功でtrue */
  socketGem(weaponUid: string, slot: number, gemId: string): boolean {
    const inst = this.save.inventory.find((it) => it.uid === weaponUid);
    if (!inst || (this.save.gems[gemId] ?? 0) <= 0) return false;
    const sockets = this.ensureSockets(inst);
    if (slot < 0 || slot >= sockets.length) return false;
    const prev = sockets[slot];
    if (prev) this.save.gems[prev] = (this.save.gems[prev] ?? 0) + 1; // 既存は戻す
    sockets[slot] = gemId;
    this.save.gems[gemId] -= 1;
    if (this.save.gems[gemId] <= 0) delete this.save.gems[gemId];
    writeSave(this.save);
    return true;
  }
  /** 秘石を外してインベントリに戻す */
  unsocketGem(weaponUid: string, slot: number): boolean {
    const inst = this.save.inventory.find((it) => it.uid === weaponUid);
    if (!inst || !inst.sockets) return false;
    const prev = inst.sockets[slot];
    if (!prev) return false;
    this.save.gems[prev] = (this.save.gems[prev] ?? 0) + 1;
    inst.sockets[slot] = null;
    writeSave(this.save);
    return true;
  }

  /** 乱入ボス戦を開始（STAGE CLEAR の後に WARNING 演出で割り込む） */
  private startAmbush(): void {
    this.inAmbush = true;
    this.lastAmbush = true;
    this.rotation = { slash: 0, pierce: 0, crush: 0 };
    // 乱入ボスはフルHP/ENの特別戦（負けてもダンジョンの宝は確保済み）
    this.battle = new Battle([ambushBoss(this.currentStage.world)], this.playerMaxHp, undefined, this.playerMaxHp);
    this.battle.playerDefense = this.defense;
    this.battle.shieldPassive = this.equippedShield()?.passive ?? null;
    this.battle.enemies.forEach((e) => { e.spawnT = 0; }); // 登場は WARNING 演出に任せる
    this.battle.beginAmbushWarning();
    // 画面は battle のまま（UIは流用）
  }

  private onLose(): void {
    this.accumulateStats();
    // 乱入ボスに敗北：ダンジョンの宝は確保済み。クリア扱いのままリザルトへ（ボーナスのみ取り逃し）
    if (this.inAmbush) {
      this.inAmbush = false;
      this.lastAmbushWon = false;
      this.lastWon = true; // ステージはクリア済み
      this.bankPlayerExp(); // ステージ分の経験値はここで一括反映
      this.screen = "result";
      return;
    }
    this.lastWon = false;
    if (this.isEndless) {
      // 回廊では各階の報酬は確定済み。到達階を記録して結果へ
      this.lastFloor = this.endlessFloor;
    } else {
      this.lastDrops = [];
    }
    this.screen = "result";
  }

  /** 現在の戦闘の戦績を冒険全体の集計＋累計進捗へ反映する */
  private accumulateStats(): void {
    if (!this.battle) return;
    this.lastMaxHit = Math.max(this.lastMaxHit, this.battle.maxHit);
    this.lastPerfects += this.battle.perfectCount;
    if (this.battle.tookDamage) this.lastFlawless = false;
    // 実績用の累計（パーフェクト・撃破数）。デイリーとは別に常時加算
    progress.perfectsTotal += this.battle.perfectCount;
    progress.killsTotal += this.battle.killCount;
    saveProgress();
    // デイリーミッション：当日のパーフェクト／撃破数を加算
    addMissionProgress("dm_perfect", this.battle.perfectCount);
    addMissionProgress("dm_kill", this.battle.killCount);
  }

  /** result画面用：現在の戦闘の敵数（描画維持用） */
  get displayBattle(): Battle | null { return this.battle; }
}

export { CLASSES, PLAYER_MAX_HP, STAGE_COUNT };
