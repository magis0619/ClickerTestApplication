import type { Skill, EnemyDef, GuardResult, BattlePhase, SfxEvent, WeaponInstance, WeaponMods, LastSkill, ComboDef, SkillStatus, ShieldPassive } from "./types.ts";
import {
  matchCombo,
  FLOAT_TTL,
  DAMAGE_TTL,
  GUARD_BADGE_MS,
  WEAKNESS,
  WEAKNESS_MULTIPLIER,
  PLAYER_MAX_HP,
  PLAYER_MAX_EN,
  CHARGE_MULT,
  REST_EN_RECOVER,
  GUARD_EN_RECOVER,
  JUST_EN_RECOVER,
  KILL_EN_RECOVER,
  GUARD_WINDOW_MS,
  JUST_WINDOW_MS,
  PERFECT_WINDOW_MS,
  GUARD_DAMAGE_MULT,
  JUST_DAMAGE_MULT,
  PERFECT_HP_RECOVER,
  HITSTOP_MS,
  SLOWMO_MS,
  SLOWMO_SCALE,
  WHITE_FLASH_MS,
  PERFECT_FLINCH_MS,
  PERFECT_BREAK_BONUS,
  ATTACK_WINDUP_MS,
  SKILL_BANNER_MS,
  LOSE_ANIM_MS,
  WIN_HOLD_MS,
  STAGE_CLEAR_HOLD_MS,
  STAGE_CLEAR_SLOWMO_MS,
  BOSS_INTRO_MS,
  WARN_TOTAL_MS,
  WARN_BLACK_MS,
  WARN_SHOW_MS,
  WARN_FADE_MS,
  READY_WAIT_MIN_MS,
  READY_WAIT_MAX_MS,
  TELEGRAPH_SCALE,
  TELEGRAPH_MIN_MS,
  SPAWN_LOCK_MS,
  BREAK_TURNS,
  BREAK_CRIT_MULT,
  BREAK_RATE_MULT,
  BREAK_WEAK_MULT,
  POISON_PCT,
  VULNERABLE_MULT,
  RAGE_MULT,
  rollEnemyDrop,
  rollEnemyGold,
  enemyExp,
} from "./data.ts";
import { settings } from "./settings.ts";

/** 敵撃破アニメ（ノックバック→フェードアウト）の長さ */
export const DEATH_ANIM_MS = 720;

/**
 * ヒット種別に応じたヒットストップ長(ms)。手応えを段階的に強める。
 * 通常20〜30 / 弱点35〜45 / 会心45〜60 / BREAK60〜80 / ボスフィニッシュ80〜100。
 * 複数該当時は最も強い区分を採用（範囲内でわずかに揺らす）。
 */
function hitstopFor(crit: boolean, weak: boolean, causedBreak: boolean, bossFinish: boolean): number {
  const rng = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
  if (bossFinish) return rng(80, 100);
  if (causedBreak) return rng(60, 80);
  if (crit) return rng(45, 60);
  if (weak) return rng(35, 45);
  return rng(20, 30);
}

/** 撃破時に飛び散るコイン（金貨）粒子 */
export interface Coin {
  /** 基準にする敵スロットのインデックス */
  anchor: number;
  ox: number; oy: number;
  vx: number; vy: number;
  ttl: number;
  spin: number;
}

export interface FloatText {
  text: string;
  color: string;
  ttl: number;
  /** 生成時の寿命(ms)。フェード・出現アニメの基準に使う */
  max: number;
  /** 出現位置（enemyの場合はインデックス） */
  anchor: "player" | "center" | number;
  rise: number;
  /** 表示種別。damage=爆発エフェクト付きの数値 / text=通常テキスト / announce=中央の大型バナー */
  kind?: "damage" | "text" | "announce";
  /** ダメージ強調（会心/弱点/渾身）＝爆発を大きく */
  big?: boolean;
  /** 会心ヒット＝吹き出しの色を変える */
  crit?: boolean;
  /** 横方向のばらつき(px)。連続ヒットの数値が重ならないように */
  dx?: number;
}

/** 戦闘中の敵1体の状態 */
export class EnemyState {
  def: EnemyDef;
  hp: number;
  breakGauge = 0;
  /** ブレイク残りターン数（プレイヤーの行動ごとに減少）。>0でブレイク中 */
  breakTurns = 0;
  /** 攻撃までの残りカウント。プレイヤーの行動ごとに1減り、0で予兆へ */
  count: number;
  /** 予兆（!）の残り時間(ms)。>0 の間だけガード可能、0で着弾 */
  telegraphT = 0;
  /** 今回の予兆の総時間(ms)。danger（緊張度）計算の分母に使う */
  telegraphMax = 0;
  /**
   * カウント0到達後、!（予兆）が出るまでのランダムな待ち時間(ms)。
   * -1=未抽選（まだ「攻撃の順番」が回ってきていない）。順番が回った敵だけ抽選して消化する。
   */
  readyWaitT = -1;
  /** 被弾フラッシュ演出の残り時間(ms) */
  hitFlash = 0;
  /** 撃破アニメの残り時間(ms)。>0 の間は撃破演出を描画 */
  deathT = 0;
  /** 撃破ノックバックの向き(-1/+1) */
  deathDir = 1;
  /** パーフェクトで弾かれた怯み演出の残り時間(ms) */
  flinchT = 0;
  /** 登場アニメ（横からスライドイン）の残り時間(ms) */
  spawnT = 420;
  /** アニメ位相（個体ごとに揺れをずらす） */
  phase = Math.random() * Math.PI * 2;
  /** 攻撃モーション（着弾時に前へ踏み込む）の残り時間(ms) */
  atkAnimT = 0;
  /** 撃破時に確定したドロップ（宝箱の色＝レアリティ表示に使う） */
  drop?: WeaponInstance;
  /** 状態異常の残りターン（プレイヤーの行動ごとに減少） */
  poisonTurns = 0;
  frozenTurns = 0;
  vulnerableTurns = 0;
  /** 凍結中（行動が進まない）か */
  get frozen(): boolean { return this.frozenTurns > 0; }

  constructor(def: EnemyDef) {
    this.def = def;
    this.hp = def.maxHp;
    this.count = def.countStart;
  }

  get alive(): boolean {
    return this.hp > 0;
  }
  /** 撃破アニメ中（まだ画面に残して演出する） */
  get dying(): boolean {
    return this.hp <= 0 && this.deathT > 0;
  }
  get isBroken(): boolean {
    return this.breakTurns > 0;
  }
  /** 予兆中（!が出て着弾を待っている）か。この間だけガードが成立する */
  get inTelegraph(): boolean {
    return this.alive && !this.isBroken && this.flinchT <= 0 && this.telegraphT > 0;
  }
  /**
   * 緊張度 0..1。予兆中のみ立ち上がり、着弾が近いほど高い。
   * 震え・赤点滅の強さに使う。
   */
  get danger(): number {
    if (!this.inTelegraph) return 0;
    const max = this.telegraphMax || this.def.telegraphMs;
    return Math.max(0, Math.min(1, 1 - this.telegraphT / max));
  }
}

export class Battle {
  phase: BattlePhase = "fighting";
  playerHp: number;
  playerEn: number;
  /** ためる中の倍率（1なら通常） */
  charge = 1;
  /** プレイヤーの防御力（装備盾由来）。被ダメージから減算する */
  playerDefense = 0;
  /** 装備盾のパッシブ効果（なければ null） */
  shieldPassive: ShieldPassive | null = null;
  /** 激昂（攻撃up）の残りターン。>0 の間は与ダメージ上昇 */
  rageTurns = 0;

  enemies: EnemyState[];
  targetIndex = 0;

  floats: FloatText[] = [];
  /** 撃破時に飛び散るコイン粒子 */
  coins: Coin[] = [];
  /** 撃破時の爆発エフェクト（敵スロットを基準に描画） */
  explosions: { anchor: number; ttl: number; max: number }[] = [];
  lastGuard: GuardResult = "none";
  lastGuardTtl = 0;
  /** 画面シェイク残り時間(ms) */
  shakeT = 0;
  /** 画面シェイクの強さ(px) */
  shakeMag = 0;
  /** プレイヤーの踏み込み演出残り時間(ms) */
  lungeT = 0;
  /** 攻撃の溜め（クリック→着弾までのラグ）残り時間(ms)。>0 の間は構え中で次の行動を受け付けない */
  windupT = 0;
  /** 溜め中の攻撃。windupT が 0 になった瞬間に解決（着弾）する */
  private pendingAttack: { skill: Skill; mods?: WeaponMods; combo?: ComboDef } | null = null;
  /**
   * スキル発動時に出す「スキル名バナー」。プレイヤー右に左からフェードインする。
   * combo=true の連携スキルは金色の特別演出にする。
   */
  skillBanner: { text: string; combo: boolean; ttl: number; max: number } | null = null;
  /** プレイヤーの被弾リアクション（のけぞり＋フラッシュ）残り時間(ms) */
  playerHitT = 0;
  /** ヒットストップ（一瞬の静止）残り時間(ms)。>0 の間ゲーム進行を凍結 */
  hitstopT = 0;
  /** スローモーション残り時間(ms)。>0 の間ゲーム進行を遅くする */
  slowT = 0;
  /** 画面ホワイトアウト残り時間(ms) */
  whiteFlashT = 0;
  /** パーフェクト弾きエフェクトの残り時間(ms) */
  perfectFxT = 0;
  /** パーフェクト弾きエフェクトを出す敵インデックス */
  perfectFxIndex = -1;
  /** 効果音イベントのキュー（mainが毎フレーム回収して鳴らす） */
  sfx: SfxEvent[] = [];
  /** 「集中」発動中：次の行動のEN消費をなくす */
  freeNextEn = false;
  /** 直近に発動したスキル（連携＝コンボ判定に使う） */
  lastSkill: LastSkill | null = null;
  /** この戦闘で敵を倒して得たゴールド合計 */
  goldEarned = 0;
  /** 戦績：この戦闘で与えた最大ダメージ（リザルト統計用） */
  maxHit = 0;
  /** 戦績：パーフェクトガード成功回数 */
  perfectCount = 0;
  /** 戦績：被弾したか（false のままならノーダメージ達成） */
  tookDamage = false;
  /** この戦闘で撃破した敵の数（実績集計用） */
  killCount = 0;
  /** 決着後の経過時間(ms)。リザルト演出の出現アニメに使う */
  resultT = 0;
  /** 全滅後、撃破アニメ完了を待ってからwonにするためのフラグ */
  private winPending = false;
  /** クリア表示を見せてからwonに移すための待機タイマー(ms) */
  private winHoldT = 0;
  /** winHoldT の初期値（演出の経過時間計算に使う） */
  private winHoldMax = 0;
  /** ボス戦開始の警告演出（暗転＋BOSS BATTLE）の残り時間(ms)。>0の間は操作・進行を凍結 */
  introT = 0;
  introMax = 0;
  /** 乱入ボスの WARNING 演出の残り時間(ms)。>0の間は操作・進行を凍結 */
  warnT = 0;
  warnMax = 0;
  /** この戦闘が乱入（レアボス）戦か */
  isAmbush = false;
  /** 戦闘開始直後の行動禁止時間(ms)。敵が出てくる瞬間は操作不可（>0の間） */
  spawnLockT = SPAWN_LOCK_MS;
  /** 敗北演出中フラグ。スロー＋敗北宣言を見せてから lost へ移す */
  losePending = false;
  /** 敗北演出の残り時間(ms)。0 で phase=lost に確定 */
  loseAnimT = 0;
  /** 敗北演出の総時間(ms)。バナーの出現アニメ計算に使う */
  loseAnimMax = LOSE_ANIM_MS;
  /**
   * この戦闘がダンジョン（ステージ）の最終ウェーブか。
   * true のときだけ全滅時に「STAGE CLEAR」バナーを出す（途中ウェーブでは出さない）。
   */
  isFinalWave = false;

  /** プレイヤーの最大HP（レベルで変動。HUD・回復上限に使う） */
  maxHp: number = PLAYER_MAX_HP;
  /** この戦闘で得た経験値（リザルト集計用） */
  expEarned = 0;

  constructor(
    defs: EnemyDef[],
    startHp?: number,
    startEn: number = PLAYER_MAX_EN,
    maxHp: number = PLAYER_MAX_HP,
  ) {
    this.enemies = defs.map((d) => new EnemyState(d));
    this.maxHp = maxHp;
    this.playerHp = startHp == null ? maxHp : Math.max(1, Math.min(maxHp, startHp));
    this.playerEn = Math.max(0, Math.min(PLAYER_MAX_EN, startEn));
  }

  /** 撃破した敵が落としたドロップ一覧（リザルト用） */
  collectedDrops(): WeaponInstance[] {
    return this.enemies.flatMap((e) => (e.drop ? [e.drop] : []));
  }

  get aliveEnemies(): EnemyState[] {
    return this.enemies.filter((e) => e.alive);
  }

  /** 現在の攻撃対象（死亡していれば自動で次へ） */
  get target(): EnemyState | null {
    const t = this.enemies[this.targetIndex];
    if (t && t.alive) return t;
    const next = this.aliveEnemies[0];
    if (next) this.targetIndex = this.enemies.indexOf(next);
    return next ?? null;
  }

  selectTarget(i: number): void {
    if (this.enemies[i]?.alive) this.targetIndex = i;
  }

  /** いずれかの敵が予兆中（!表示）か。この間プレイヤーはガードしかできない */
  get anyTelegraph(): boolean {
    return this.enemies.some((e) => e.inTelegraph);
  }

  /**
   * 敵の攻撃フェーズ中（カウント0＝攻撃前待機 もしくは 予兆中）か。
   * この間プレイヤーは攻撃・ためる・集中・休憩ができず、ガード（!に反応）だけ。
   */
  get inEnemyAttackPhase(): boolean {
    return this.enemies.some((e) => e.alive && !e.isBroken && e.count <= 0);
  }

  /**
   * プレイヤーが一切行動できない状態か。
   * ・戦闘開始直後（敵が出てくる瞬間の行動禁止時間）
   * ・勝利確定待ち（全滅後の撃破演出中。休憩連打などを防ぐ）
   * ・敗北演出中
   */
  get actionsLocked(): boolean {
    return this.warnT > 0 || this.spawnLockT > 0 || this.winPending || this.losePending || this.aliveEnemies.length === 0;
  }

  // ===== プレイヤー行動 =====

  /** スキル使用。成功でtrue。mods=装備武器のステータス（攻撃力・会心・ブレイク） */
  useSkill(skill: Skill, mods?: WeaponMods): boolean {
    if (this.phase !== "fighting" || this.introT > 0 || this.warnT > 0) return false;
    if (this.actionsLocked) return false; // 開始直後・勝敗演出中は不可
    if (this.windupT > 0) return false; // 攻撃の溜め中は新しい行動を受け付けない
    // 敵の攻撃フェーズ（カウント0＝攻撃前待機／予兆中）はガードのみ。攻撃・ためる・集中は不可
    if (this.inEnemyAttackPhase) {
      this.pushFloat(this.anyTelegraph ? "ガードで受けろ！" : "敵が来るぞ…構えろ！", "#ffcc55", "player");
      return false;
    }
    const free = this.freeNextEn; // 「集中」発動中はEN消費なし
    const cost = free ? 0 : skill.enCost;
    if (this.playerEn < cost) {
      this.pushFloat("ENが足りない", "#ffcc55", "player");
      return false;
    }
    // 連携判定：直近スキル → 今のスキル の並びで成立するか
    const cls = mods?.weapon;
    const combo = cls ? matchCombo(this.lastSkill, skill, cls) : undefined;

    this.playerEn -= cost;
    this.freeNextEn = false; // 消費（集中はこの後に再セット）
    // 直近スキルを記録（次の連携判定に使う）。攻撃は着弾を待たずチェーンを確定
    this.lastSkill = cls ? { kind: skill.kind, cls, id: skill.id } : null;
    // スキル名バナーを表示（連携成立時は金色の特別演出）。溜め中から出して期待感を煽る
    this.skillBanner = { text: skill.name, combo: !!combo, ttl: SKILL_BANNER_MS, max: SKILL_BANNER_MS };

    switch (skill.kind) {
      case "charge":
        this.charge = CHARGE_MULT;
        this.pushFloat("ためる！", "#ffd35f", "player");
        break;
      case "focus":
        this.freeNextEn = true;
        this.pushFloat("集中！ 次の行動EN0", "#9fd9ff", "player");
        break;
      case "attack":
        // 溜め（ラグ）を挟んでから着弾。ダメージと敵カウント進行は resolvePendingAttack で行う
        this.pendingAttack = { skill, mods, combo };
        this.windupT = ATTACK_WINDUP_MS;
        return true;
    }

    this.advanceCounts(); // 行動したので敵カウントを進める（攻撃は着弾時に進める）
    this.checkWin();
    return true;
  }

  /** 溜め完了：保留していた攻撃を着弾させ、敵カウントを進める */
  private resolvePendingAttack(): void {
    const p = this.pendingAttack;
    this.pendingAttack = null;
    if (!p || this.phase !== "fighting") return;
    this.performAttack(p.skill, p.mods, p.combo);
    this.advanceCounts(); // 行動したので敵カウントを進める
    this.checkWin();
  }

  /** 攻撃スキルを実行：対象数ぶんの敵に、ヒット数ぶん攻撃する。combo成立時は追撃を足す */
  private performAttack(skill: Skill, mods?: WeaponMods, combo?: ComboDef): void {
    // 自己バフ（激昂など）はスキル使用時に付与（攻撃の前にかけてこの攻撃から乗せる）
    if (skill.status?.target === "self") this.applySelfStatus(skill.status);
    const targets = this.pickTargets(skill.targets);
    for (const e of targets) {
      for (let h = 0; h < skill.hits; h++) {
        if (!e.alive) break;
        this.hitOne(e, skill, mods);
      }
      // 敵への状態異常は対象ごとに付与（生存している敵のみ）
      if (e.alive && skill.status?.target === "enemy") this.applyEnemyStatus(e, skill.status);
    }
    // 連携成立：現在の対象へ追撃（チャージ倍率が乗ったまま追加で殴る）
    if (combo) {
      const t = this.target;
      const idx = t ? this.enemies.indexOf(t) : -1;
      if (t && t.alive) {
        for (let i = 0; i < combo.bonusHits; i++) {
          if (!t.alive) break;
          this.hitOne(t, skill, mods);
        }
      }
      this.pushFloat(`${combo.name}！`, "#ffd35f", idx >= 0 ? idx : "player");
      this.sfx.push("just");
      this.shake(170, 3);
      this.lungeT = 240;
    }
    this.consumeCharge();
    this.lungeT = Math.max(this.lungeT, 200);
  }

  /** 敵へ状態異常を付与（同種は長い方を採用） */
  private applyEnemyStatus(e: EnemyState, st: SkillStatus): void {
    const idx = this.enemies.indexOf(e);
    if (st.kind === "poison") { e.poisonTurns = Math.max(e.poisonTurns, st.turns); this.pushFloat("毒", "#57d36b", idx); }
    else if (st.kind === "freeze") { e.frozenTurns = Math.max(e.frozenTurns, st.turns); e.readyWaitT = -1; this.pushFloat("凍結", "#5fe0ff", idx); }
    else if (st.kind === "vulnerable") { e.vulnerableTurns = Math.max(e.vulnerableTurns, st.turns); this.pushFloat("弱体", "#b96bff", idx); }
  }

  /** プレイヤーへ自己バフを付与 */
  private applySelfStatus(st: SkillStatus): void {
    if (st.kind === "rage") { this.rageTurns = Math.max(this.rageTurns, st.turns); this.pushFloat("激昂！攻撃up", "#ff6b6b", "player"); }
  }

  /** プレイヤー行動ごとの状態異常・バフの経過処理（毒ダメージ／凍結・弱体・激昂の減少） */
  private tickStatuses(): void {
    if (this.rageTurns > 0) this.rageTurns -= 1; // 激昂は1行動で1ターン消費
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.poisonTurns > 0) {
        const dmg = Math.max(1, Math.round(e.def.maxHp * POISON_PCT));
        const wasAlive = e.alive;
        e.hp = Math.max(0, e.hp - dmg);
        e.poisonTurns -= 1;
        const idx = this.enemies.indexOf(e);
        this.pushDamage(dmg, idx, false, false);
        if (wasAlive && e.hp <= 0) this.killEnemy(e, idx);
      }
      if (e.vulnerableTurns > 0) e.vulnerableTurns -= 1;
      if (e.frozenTurns > 0) e.frozenTurns -= 1;
    }
  }

  /** 攻撃対象を選ぶ：現在のターゲット＋（足りなければ）他の生存敵を左から補う */
  private pickTargets(n: number): EnemyState[] {
    const out: EnemyState[] = [];
    const t = this.target;
    if (t) out.push(t);
    for (const e of this.enemies) {
      if (out.length >= n) break;
      if (e.alive && !out.includes(e)) out.push(e);
    }
    return out.slice(0, n);
  }

  /** 休憩：ENを回復（攻撃はしない）。実行できたら true */
  rest(): boolean {
    if (this.phase !== "fighting" || this.introT > 0 || this.warnT > 0) return false;
    if (this.actionsLocked) return false; // 開始直後・勝敗演出中は休憩不可（連打防止）
    if (this.windupT > 0) return false; // 攻撃の溜め中は休憩できない
    if (this.inEnemyAttackPhase) return false; // 攻撃前待機／予兆中はガードのみ
    const before = this.playerEn;
    this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + REST_EN_RECOVER);
    this.pushFloat(`休憩 +${Math.round(this.playerEn - before)}EN`, "#88ddff", "player");
    this.lastSkill = null; // 休憩で連携チェーンは途切れる
    this.advanceCounts(); // 休憩も「行動」なので敵カウントを進める
    return true;
  }

  /**
   * プレイヤーの行動ごとに敵の状態を1ターン進める。
   * ・ブレイク中：残りターンを減らし、0で待ちターンへ復帰
   * ・通常：攻撃カウントを1減らす（0で「攻撃準備完了」＝待機）
   * 予兆中・怯み中・既に準備完了の敵は進めない。
   */
  private advanceCounts(): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.breakTurns > 0) {
        e.breakTurns -= 1;
        if (e.breakTurns <= 0) e.count = e.def.countStart; // 元の待ちターンに戻る
        continue;
      }
      if (e.flinchT > 0 || e.telegraphT > 0 || e.count <= 0 || e.frozen) continue; // 凍結中は行動が進まない
      e.count -= 1;
      if (e.count < 0) e.count = 0;
    }
    // 盾パッシブ「自己再生」：行動するたびに少量HP回復
    if (this.shieldPassive?.kind === "regen" && this.playerHp > 0) {
      this.playerHp = Math.min(this.maxHp, this.playerHp + this.shieldPassive.value);
    }
    // カウント処理のあとに状態異常を経過させる（毒ダメージ・凍結/弱体/激昂の減少）
    this.tickStatuses();
  }

  /**
   * 攻撃準備完了(count<=0)の敵を「左から順に」1体ずつ攻撃させる。
   * カウント0に達してもすぐには予兆せず、0のままランダムな時間だけ待ってから ! を出す。
   * 待ち時間は敵ごとに個別保持し、「順番が回ってきた1体だけ」消化する。
   * ＝右の敵は左の敵が攻撃し終わるまで 0 のまま待機（順番に攻撃）。
   */
  private tickAttackWait(dtMs: number): void {
    if (this.enemies.some((e) => e.telegraphT > 0)) return; // 既に1体予兆中＝順番待ち
    // 攻撃準備完了の敵を左から1体だけ選ぶ（これが今「攻撃の順番」の敵）
    const e = this.enemies.find(
      (x) => x.alive && !x.isBroken && x.flinchT <= 0 && !x.frozen && x.count <= 0,
    );
    if (!e) return;
    // この敵の0待ち時間が未抽選なら、今ここで抽選（順番が回ってきた瞬間）
    if (e.readyWaitT < 0) {
      e.readyWaitT = READY_WAIT_MIN_MS + Math.random() * (READY_WAIT_MAX_MS - READY_WAIT_MIN_MS);
    }
    e.readyWaitT -= dtMs;
    if (e.readyWaitT <= 0) {
      e.readyWaitT = -1;
      // 待ち終わり → 予兆開始（! が出る）。0待ちで溜めたぶん予兆は短く＝すぐ攻撃
      e.telegraphMax = e.telegraphT = Math.max(TELEGRAPH_MIN_MS, e.def.telegraphMs * TELEGRAPH_SCALE);
      this.sfx.push("warn");
    }
  }

  /** 予兆の決着後、カウント・待ち時間を初期状態に戻す */
  private endTelegraph(e: EnemyState): void {
    e.telegraphT = 0;
    e.readyWaitT = -1;
    e.count = e.def.countStart;
  }

  /** ガード：予兆中の最も着弾が近い敵の攻撃を受け止める。判定結果を返す */
  guard(): GuardResult {
    if (this.phase !== "fighting" || this.introT > 0 || this.warnT > 0) return "none";
    if (this.actionsLocked) return "none"; // 開始直後・勝敗演出中はガードも不可
    // 予兆中の敵のうち、最も着弾が近い（telegraphTが小さい）ものを対象に
    const targets = this.enemies.filter((e) => e.inTelegraph);
    if (targets.length === 0) {
      this.setGuard("none");
      return "none";
    }
    targets.sort((a, b) => a.telegraphT - b.telegraphT);
    const e = targets[0];
    const diff = e.telegraphT; // 着弾までの残り時間
    // 猶予倍率（設定＋盾パッシブ「達人の構え」で各窓を広げられる）
    const ln = settings.leniency + (this.shieldPassive?.kind === "guardWindow" ? this.shieldPassive.value : 0);
    let result: GuardResult;
    if (diff <= PERFECT_WINDOW_MS * ln) result = "perfect";
    else if (diff <= JUST_WINDOW_MS * ln) result = "just";
    else if (diff <= GUARD_WINDOW_MS * ln) result = "guard";
    else {
      this.setGuard("none"); // まだ早い
      return "none";
    }
    if (result !== "perfect") e.atkAnimT = 300; // 弾かれない攻撃は踏み込みモーション
    this.resolveEnemyHit(e, result);
    this.endTelegraph(e); // 受け止めたのでカウントを戻す
    return result;
  }

  // ===== 内部処理 =====

  private consumeCharge(): void {
    this.charge = 1;
  }

  /** 1ヒットぶんのダメージ処理。攻撃力は武器本体(mods)、スキルは倍率・会心・ブレイクを担う */
  private hitOne(e: EnemyState, skill: Skill, mods?: WeaponMods): void {
    const atk = mods?.attack ?? 1;
    let dmg = atk;
    const weak = mods ? WEAKNESS[e.def.kind] === mods.weapon : false;
    if (weak) dmg *= WEAKNESS_MULTIPLIER;
    if (e.isBroken) {
      dmg *= BREAK_CRIT_MULT;
      if (this.shieldPassive?.kind === "breakBonus") dmg *= 1 + this.shieldPassive.value; // 盾「破壊衝動」
    }
    if (this.charge > 1) dmg *= this.charge;
    if (this.rageTurns > 0) dmg *= RAGE_MULT;             // 激昂（攻撃up）
    if (e.vulnerableTurns > 0) dmg *= VULNERABLE_MULT;    // 弱体（防御down）
    // 会心＝武器の会心率＋スキルの加算。発生で (skillの倍率＋秘石の会心威力) 倍
    const critChance = ((mods?.critChance ?? 0) + skill.critAdd) / 100;
    const crit = critChance > 0 && Math.random() < critChance;
    if (crit) dmg *= skill.critMult + (mods?.critMult ?? 0);
    dmg = Math.round(dmg);

    const wasAlive = e.alive;
    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlash = 300;
    const idx = this.enemies.indexOf(e);
    const big = crit || weak || e.isBroken || this.charge > 1;
    this.pushDamage(dmg, idx, big, crit);
    if (dmg > this.maxHit) this.maxHit = dmg; // 最大ダメージ更新
    if (crit) this.sfx.push("crit");
    this.shake(150, crit ? 5 : 3);

    let causedBreak = false;
    if (!e.isBroken) {
      // ブレイク蓄積：全体倍率で上がりやすく、弱点属性ならさらに大きく溜まる
      let breakGain = (mods?.breakPower ?? 0) * skill.breakMult * BREAK_RATE_MULT;
      if (weak) breakGain *= BREAK_WEAK_MULT;
      e.breakGauge += breakGain;
      if (e.breakGauge >= e.def.breakThreshold) {
        e.breakTurns = BREAK_TURNS;
        e.breakGauge = 0;
        e.telegraphT = 0; // 予兆中ならキャンセル
        e.readyWaitT = -1; // 0待ち中ならリセット（ブレイク復帰後に再抽選させる）
        this.pushFloat("BREAK!!", "#ffdd44", idx);
        this.sfx.push("break");
        causedBreak = true;
      }
    }

    const killed = wasAlive && e.hp <= 0;
    const bossFinish = killed && (e.def.boss === true || e.def.bigBoss === true);
    // ヒットストップ：状況ごとに手応えを変える（通常＜弱点＜会心＜BREAK＜ボスフィニッシュ）
    this.hitstopT = Math.max(this.hitstopT, hitstopFor(crit, weak, causedBreak, bossFinish));

    // 撃破：ただ消さず、ノックバック＋フェードの撃破演出を始動
    if (killed) this.killEnemy(e, idx);
  }

  /** 敵を撃破：ノックバック・フェード・ドロップ（宝箱）演出を開始する */
  private killEnemy(e: EnemyState, idx: number): void {
    this.killCount += 1; // 実績集計用
    e.deathT = DEATH_ANIM_MS;
    e.deathDir = 1; // プレイヤーは左、敵は右向きなので右奥へ吹き飛ぶ
    e.breakTurns = 0;
    e.flinchT = 0;
    e.drop = rollEnemyDrop(e.def); // 率で武器ドロップ（外れあり＝撃破時は宝箱で表示）
    const gold = rollEnemyGold(e.def); // 強い敵ほど多い
    this.goldEarned += gold;
    this.expEarned += enemyExp(e.def); // プレイヤー経験値（レベル＝最大HPに反映）
    // 撃破でEN回復（攻め続けるご褒美）
    const enBefore = this.playerEn;
    this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + KILL_EN_RECOVER);
    const enGain = Math.round(this.playerEn - enBefore);
    if (enGain > 0) this.pushFloat(`+${enGain}EN`, "#9fe8ff", "player");
    // 撃破の爆発エフェクト（テキストポップは出さず、爆発＋コイン＋宝箱で魅せる）
    this.explosions.push({ anchor: idx, ttl: 460, max: 460 });
    // コインが弾けて落ちる演出（ゴールドが多いほど多く）
    const coinN = Math.min(14, 5 + Math.round(gold / 25));
    for (let i = 0; i < coinN; i++) {
      this.coins.push({
        anchor: idx,
        ox: (Math.random() * 2 - 1) * 16,
        oy: -8 - Math.random() * 14,
        vx: (Math.random() * 2 - 1) * 2.0,
        vy: -2.4 - Math.random() * 2.2,
        ttl: 850 + Math.random() * 300,
        spin: Math.random() * Math.PI * 2,
      });
    }
    this.shake(280, 7);
    this.sfx.push("die");
  }

  private resolveEnemyHit(e: EnemyState, guard: GuardResult): void {
    let dmg = e.def.attack;
    const idx = this.enemies.indexOf(e);
    this.setGuard(guard);
    switch (guard) {
      case "perfect": {
        // === このゲームで一番気持ちいい瞬間 ===
        dmg = 0;
        this.perfectCount += 1;
        this.playerHp = Math.min(this.maxHp, this.playerHp + PERFECT_HP_RECOVER);
        this.playerEn = PLAYER_MAX_EN; // パーフェクトはENを最大まで全回復
        // 一瞬の静止→ホワイトアウト→スロー＋弾きエフェクト＋軽い揺れ
        this.hitstopT = HITSTOP_MS;
        this.whiteFlashT = WHITE_FLASH_MS;
        this.slowT = SLOWMO_MS;
        this.perfectFxT = 360;
        this.perfectFxIndex = idx;
        this.shake(180, 4);
        this.pushFloat(`+${PERFECT_HP_RECOVER}HP ENMAX`, "#66ffaa", "player");
        // 敵を怯ませる：カウントを戻し、ブレイクゲージも溜める
        e.flinchT = PERFECT_FLINCH_MS;
        if (!e.isBroken) {
          e.breakGauge += PERFECT_BREAK_BONUS;
          if (e.breakGauge >= e.def.breakThreshold) {
            e.breakTurns = BREAK_TURNS;
            e.breakGauge = 0;
            this.pushFloat("BREAK!!", "#ffdd44", idx);
          }
        }
        this.sfx.push("perfect");
        break;
      }
      case "just":
        // 中間：そこそこ軽減＋EN中回復。PERFECT専用演出は付けない。さらに防御力で軽減
        dmg = Math.max(1, Math.round(dmg * JUST_DAMAGE_MULT) - this.playerDefense);
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + JUST_EN_RECOVER);
        this.pushFloat(`JUST -${dmg}`, "#88ddff", "player");
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.tookDamage = true;
        this.shake(140, 3);
        this.sfx.push("just");
        break;
      case "guard":
        // 通常ガード：軽減はするが地味。EN回復もわずか。さらに防御力で軽減
        dmg = Math.max(1, Math.round(dmg * GUARD_DAMAGE_MULT) - this.playerDefense);
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + GUARD_EN_RECOVER);
        this.pushFloat(`-${dmg}`, "#cccccc", "player");
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.tookDamage = true;
        this.shake(120, 2);
        this.sfx.push("guard");
        break;
      case "none":
        // 防御失敗でも防御力ぶんは軽減される（最低1ダメージ）
        dmg = Math.max(1, dmg - this.playerDefense);
        this.pushFloat(`${dmg}`, "#ff5555", "player");
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.tookDamage = true;
        this.shake(340, 7);
        this.sfx.push("hurt");
        break;
    }
    // 盾パッシブ「星の反撃」：被弾した（パーフェクト以外）とき、攻撃してきた敵へ反射ダメージ
    if (guard !== "perfect" && this.shieldPassive?.kind === "thorns" && e.alive) {
      const counter = Math.max(1, Math.round(e.def.attack * this.shieldPassive.value));
      e.hp = Math.max(0, e.hp - counter);
      e.hitFlash = 200;
      this.pushDamage(counter, idx, false, false);
      if (e.hp <= 0) this.killEnemy(e, idx);
    }
    // パーフェクト以外は被弾＝のけぞり演出（生身ガードも軽く反応）
    if (guard !== "perfect") this.playerHitT = guard === "none" ? 320 : 220;
    if (this.playerHp <= 0 && !this.losePending) {
      // 即リザルトにせず、スロー＋敗北宣言を見せてから lost へ
      this.losePending = true;
      this.loseAnimT = LOSE_ANIM_MS;
      this.loseAnimMax = LOSE_ANIM_MS;
      this.hitstopT = Math.max(this.hitstopT, 160); // 一瞬止めてから
      this.slowT = LOSE_ANIM_MS;                    // 以降スローモーション
      this.shake(260, 6);
      this.sfx.push("die");
    }
  }

  private checkWin(): void {
    // 全滅した瞬間に「STAGE CLEAR」表示。ただし撃破アニメを見せてからwonへ移す
    if (this.phase === "fighting" && this.aliveEnemies.length === 0 && !this.winPending) {
      this.winPending = true;
      // ダンジョン完了（最終ウェーブ）はスロー＋STAGE CLEAR＋紙吹雪で盛大に見せてから暗転→リザルト。
      // 途中ウェーブはバナーを出さず短く次へ。
      if (this.isFinalWave) {
        this.winHoldT = this.winHoldMax = STAGE_CLEAR_HOLD_MS;
        this.slowT = Math.max(this.slowT, STAGE_CLEAR_SLOWMO_MS); // ボス撃破をスローで魅せる
        this.whiteFlashT = Math.max(this.whiteFlashT, 180);
        // text "STAGE CLEAR" は描画側で専用のドット絵バナーに差し替えられる
        this.floats.push({ text: "STAGE CLEAR", color: "#ff5db6", kind: "announce", ttl: STAGE_CLEAR_HOLD_MS, max: STAGE_CLEAR_HOLD_MS, anchor: "center", rise: 0 });
      } else {
        this.winHoldT = this.winHoldMax = WIN_HOLD_MS;
      }
    }
  }

  /** 画面シェイクを設定（既存より強い時だけ上書き） */
  private shake(ms: number, mag: number): void {
    if (ms >= this.shakeT) { this.shakeT = ms; this.shakeMag = mag; }
  }

  update(dtMs: number): void {
    const realDt = dtMs; // スロー前の実経過時間（敗北演出の尺は実時間で測る）
    // ホワイトアウトは実時間で減衰させる
    if (this.whiteFlashT > 0) this.whiteFlashT = Math.max(0, this.whiteFlashT - dtMs);

    // ヒットストップ中はゲーム進行を凍結（パーフェクトの一瞬の溜め）。
    if (this.hitstopT > 0) {
      this.hitstopT -= dtMs;
      return;
    }

    // 乱入ボスの WARNING 演出中：進行・操作を凍結（実時間でタイマーだけ進める）
    if (this.warnT > 0) {
      this.warnT = Math.max(0, this.warnT - realDt);
      return;
    }

    // ボス開始警告：暗転＋BOSS BATTLE を見せる間は進行・操作を凍結（バナーだけ進める）
    if (this.introT > 0) {
      this.introT = Math.max(0, this.introT - realDt);
      for (const f of this.floats) { f.ttl -= realDt; f.rise += realDt * 0.03; }
      this.floats = this.floats.filter((f) => f.ttl > 0);
      return;
    }

    // 敗北演出：スロー＋敗北宣言を見せ、尺が終わったら lost を確定（敵の行動は止める）
    if (this.losePending) {
      this.loseAnimT -= realDt;
      // フロート等の演出だけ進める
      if (this.slowT > 0) { this.slowT = Math.max(0, this.slowT - realDt); dtMs = dtMs * SLOWMO_SCALE; }
      for (const f of this.floats) { f.ttl -= dtMs; f.rise += dtMs * 0.03; }
      this.floats = this.floats.filter((f) => f.ttl > 0);
      if (this.shakeT > 0) this.shakeT -= realDt;
      if (this.playerHitT > 0) this.playerHitT -= dtMs;
      if (this.loseAnimT <= 0) this.phase = "lost";
      return;
    }

    // 戦闘開始直後の行動禁止（敵が出てくる瞬間）。実時間で消化する
    if (this.spawnLockT > 0) this.spawnLockT = Math.max(0, this.spawnLockT - realDt);

    // スローモーション：以降の進行を遅い時間で動かす
    if (this.slowT > 0) {
      this.slowT = Math.max(0, this.slowT - dtMs);
      dtMs = dtMs * SLOWMO_SCALE;
    }

    for (const f of this.floats) {
      f.ttl -= dtMs;
      f.rise += dtMs * 0.03;
    }
    this.floats = this.floats.filter((f) => f.ttl > 0);
    // コイン：重力で跳ねて落ちる
    for (const c of this.coins) {
      const k = dtMs / 16;
      c.vy += 0.16 * k;
      c.ox += c.vx * k;
      c.oy += c.vy * k;
      c.spin += 0.22 * k;
      c.ttl -= dtMs;
    }
    this.coins = this.coins.filter((c) => c.ttl > 0);
    // 撃破の爆発エフェクト
    for (const ex of this.explosions) ex.ttl -= dtMs;
    this.explosions = this.explosions.filter((ex) => ex.ttl > 0);
    if (this.lastGuardTtl > 0) this.lastGuardTtl -= dtMs;
    if (this.shakeT > 0) this.shakeT -= dtMs;
    // 攻撃の溜め：0 になった瞬間に着弾（踏み込みモーション＋ダメージ）
    if (this.windupT > 0) {
      this.windupT -= dtMs;
      if (this.windupT <= 0) {
        this.windupT = 0;
        this.resolvePendingAttack();
      }
    }
    if (this.lungeT > 0) this.lungeT -= dtMs;
    if (this.skillBanner) {
      this.skillBanner.ttl -= dtMs;
      if (this.skillBanner.ttl <= 0) this.skillBanner = null;
    }
    if (this.playerHitT > 0) this.playerHitT -= dtMs;
    if (this.perfectFxT > 0) this.perfectFxT -= dtMs;
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash -= dtMs;
      if (e.flinchT > 0) e.flinchT -= dtMs;
      if (e.deathT > 0) e.deathT = Math.max(0, e.deathT - dtMs);
      if (e.spawnT > 0) e.spawnT = Math.max(0, e.spawnT - dtMs);
      if (e.atkAnimT > 0) e.atkAnimT = Math.max(0, e.atkAnimT - dtMs);
    }

    if (this.phase !== "fighting") {
      this.resultT += dtMs; // リザルト演出の出現アニメ用
      return;
    }

    // 全滅していたら、撃破アニメ完了→クリア表示の待機を経て勝利確定
    if (this.winPending) {
      if (this.isFinalWave) {
        // STAGE CLEAR は実時間で進める（スローの影響を受けない）。撃破アニメと並行に演出
        this.winHoldT -= realDt;
        if (this.winHoldT <= 0) this.phase = "won";
      } else if (this.enemies.every((e) => e.deathT <= 0)) {
        this.winHoldT -= dtMs;
        if (this.winHoldT <= 0) this.phase = "won";
      }
      return;
    }

    // 予兆中の敵だけ時間で進み、0になったら着弾（ガードされなければフルダメージ）
    // ブレイクはターン制なので時間では減らさない。
    for (const e of this.enemies) {
      if (!e.alive || e.isBroken) continue;
      if (e.telegraphT > 0) {
        e.telegraphT -= dtMs;
        if (e.telegraphT <= 0) {
          e.telegraphT = 0;
          e.atkAnimT = 300; // 攻撃の踏み込みモーション
          this.resolveEnemyHit(e, "none");
          this.endTelegraph(e);
          if (this.phase !== "fighting") return;
        }
      }
    }

    // 攻撃準備完了の敵を左から1体ずつ、0待ち→! →攻撃の流れで処理（同時攻撃を順番に）
    this.tickAttackWait(dtMs);

    this.checkWin();
  }

  private setGuard(result: GuardResult): void {
    this.lastGuard = result;
    this.lastGuardTtl = GUARD_BADGE_MS;
  }

  /** 同じ位置に出ている表記の数。新しいものを上にずらして重なりを防ぐ */
  private stackOffset(anchor: FloatText["anchor"], step: number): number {
    return this.floats.filter((f) => f.anchor === anchor).length * step;
  }

  private pushFloat(text: string, color: string, anchor: FloatText["anchor"]): void {
    this.floats.push({
      text, color, ttl: FLOAT_TTL, max: FLOAT_TTL, anchor,
      rise: this.stackOffset(anchor, 20),
    });
  }

  /**
   * ダメージ数値（爆発エフェクト付き）。連続ヒット（2回攻撃など）は
   * 同じ敵の上で左右に扇状へ振り分け、数値が重ならないようにする。
   */
  private pushDamage(dmg: number, anchor: FloatText["anchor"], big: boolean, crit: boolean): void {
    // この敵に今出ているダメージ表記の数で、左右交互＋上方向にずらす
    const n = this.floats.filter((f) => f.kind === "damage" && f.anchor === anchor).length;
    const step = Math.ceil(n / 2);          // 0,1,1,2,2,...
    const dir = n % 2 === 1 ? -1 : 1;       // 中央→左→右→左→右
    const dx = n === 0 ? 0 : dir * step * 46;
    this.floats.push({
      text: dmg.toLocaleString(), color: "", kind: "damage", big, crit,
      anchor, ttl: DAMAGE_TTL, max: DAMAGE_TTL,
      rise: n * 18,
      dx,
    });
  }

  /** ウェーブ開始など、画面中央に大きく告知する（大型バナー） */
  announce(text: string, color: string): void {
    this.floats.push({ text, color, kind: "announce", ttl: 1700, max: 1700, anchor: "center", rise: 0 });
    this.whiteFlashT = 120;
  }

  /** ボス戦の開始警告：画面を暗くし BOSS BATTLE バナーを一定時間見せる（操作・進行は凍結） */
  beginBossIntro(): void {
    this.introT = this.introMax = BOSS_INTRO_MS;
    // text "BOSS BATTLE" は描画側で専用のドット絵バナーに差し替えられる
    this.floats.push({ text: "BOSS BATTLE", color: "#ff5a2a", kind: "announce", ttl: BOSS_INTRO_MS, max: BOSS_INTRO_MS, anchor: "center", rise: 0 });
    this.sfx.push("boss");
  }
  /** ボス開始警告の最中か（暗転中・操作不可） */
  get inIntro(): boolean { return this.introT > 0; }

  /** 乱入ボスの WARNING 演出を開始（暗転→WARNING→ボス登場） */
  beginAmbushWarning(): void {
    this.warnT = this.warnMax = WARN_TOTAL_MS;
    this.isAmbush = true;
    this.sfx.push("boss");
  }
  /** WARNING 演出中か */
  get inWarn(): boolean { return this.warnT > 0; }
  /** WARNING 演出の経過時間(ms) */
  get warnAge(): number { return this.warnMax - this.warnT; }
  /** 暗幕の不透明度(0..1)。最後のフェードでボスが現れる */
  get warnBlackAlpha(): number {
    if (this.warnT <= 0) return 0;
    const age = this.warnAge;
    if (age < WARN_BLACK_MS + WARN_SHOW_MS) return 1;
    return Math.max(0, 1 - (age - (WARN_BLACK_MS + WARN_SHOW_MS)) / WARN_FADE_MS);
  }
  /** WARNING ロゴの不透明度(0..1) */
  get warnLogoAlpha(): number {
    if (this.warnT <= 0) return 0;
    const age = this.warnAge;
    if (age < WARN_BLACK_MS) return 0;
    const fadeIn = 400;
    if (age < WARN_BLACK_MS + fadeIn) return (age - WARN_BLACK_MS) / fadeIn;
    if (age < WARN_BLACK_MS + WARN_SHOW_MS) return 1;
    return Math.max(0, 1 - (age - (WARN_BLACK_MS + WARN_SHOW_MS)) / WARN_FADE_MS);
  }

  /** ステージクリア演出中か（最終ボス撃破→STAGE CLEAR表示中）。紙吹雪などを出す */
  get isVictoryFx(): boolean { return this.winPending && this.isFinalWave; }
  /** STAGE CLEAR 演出の経過時間(ms)。バースト→紙吹雪のタイミングに使う */
  get victoryAge(): number { return this.winHoldMax - this.winHoldT; }
  /** STAGE CLEAR 終盤の暗転(0..1)。残り VICTORY_FADE_MS で 0→1 へ。完了で won へ移る */
  get victoryFade(): number {
    if (!this.isVictoryFx) return 0;
    const FADE = 520;
    return Math.max(0, Math.min(1, (FADE - this.winHoldT) / FADE));
  }
}
