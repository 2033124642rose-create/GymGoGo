import { KnowledgeTurns } from './KnowledgeTurns'
import type { KnowledgePhase, QuizContext, QuizOperation } from './KnowledgeTurns'
import { defaultHat, isHatId } from '../ar/hats'
import type { HatId } from '../ar/hats'
import { ReadyGate } from '../game/ReadyGate'
import { SquatCounter } from '../squat/SquatCounter'
import type { PoseFrame } from '../camera/pose'
import { PARTY_LEVELS } from './levels'
import type { PartyLevel } from './levels'

export type PartyPhase = 'ready' | 'preparing' | 'active' | 'turnComplete' | 'paused' | 'blocked' | 'levelWon' | 'won' | 'exited' | KnowledgePhase | 'levelFailed'
export interface PartyPlayer { id: string; name: string; count: number; hat: HatId; counts: number[]; totalCount: number }
export interface PartySnapshot {
  levelIndex: number; level: PartyLevel; completedLevels: number; rewards: string[]; teamTotal: number;
  phase: PartyPhase; players: PartyPlayer[]; currentId: string; queue: string[];
  total: number; hp: number; maxHp: number; attempt: number; digit: number; stableMs: number;
  message: string; readyPhase: string;
  knowledgeChallenge: boolean; levelAttemptId: number; quiz: ReturnType<KnowledgeTurns['snapshot']>;
  failedAttempts: { levelIndex: number; levelAttemptId: number; counts: number[] }[];
}
export function validateNames(names: string[]): string | null {
  if (names.length < 2 || names.length > 6) return '请选择 2–6 位玩家。'
  if (names.some(name => !name.trim() || Array.from(name.trim()).length > 12)) return '每位玩家的昵称需为 1–12 个字符。'
  return null
}
export const NO_EFFECT = { attack: false, countdown: false, won: false, levelWon: false }
const PHASES: PartyPhase[] = ['ready','preparing','active','turnComplete','paused','blocked','levelWon','won','exited',
  'quizGenerating','quizAnswering','quizJudging','quizUncertain','quizUnavailable','levelFailed']

// Local rule state only; reuses the accepted pose counter and ready gate unchanged.
export class PartySession {
  private players: {id:string; name:string; hat:HatId; counts:number[]}[]
  private levelIndex = 0
  private completedLevels = 0
  private resumeTo: PartyPhase = 'ready'
  private knowledge: KnowledgeTurns | null
  private partyId: string = crypto.randomUUID()
  private levelAttemptId = 1
  private failedAttempts: { levelIndex: number; levelAttemptId: number; counts: number[] }[] = []
  private get level() { return PARTY_LEVELS[this.levelIndex] }
  private queue: string[]
  private currentId: string
  private phase: PartyPhase = 'ready'
  private skipped = new Set<string>()
  private attempt = 0
  private repIndex = 0
  private cutoff = -Infinity
  private counter: SquatCounter | null = null
  private gate = new ReadyGate()
  private message = '下一位冒险者，请主动准备。'
  constructor(names: string[], hats: HatId[] = names.map((_,index) => defaultHat(index)), options: { knowledgeChallenge?: boolean; partyId?: string } = {}) {
    const error = validateNames(names)
    if (error) throw new Error(error)
    if (hats.length !== names.length || hats.some(hat => !isHatId(hat))) throw new Error('请选择有效的帽子。')
    this.knowledge = options.knowledgeChallenge ? new KnowledgeTurns() : null
    if (options.partyId) this.partyId = options.partyId
    this.players = names.map((name, index) => ({ id: `player-${index + 1}`, name: name.trim(), counts: PARTY_LEVELS.map(() => 0), hat: hats[index] }))
    this.queue = this.players.map(player => player.id)
    this.currentId = this.queue[0]
  }
  checkpoint() {
    return structuredClone({ version: 1, partyId: this.partyId, players: this.players, levelIndex: this.levelIndex,
      completedLevels: this.completedLevels, levelAttemptId: this.levelAttemptId, failedAttempts: this.failedAttempts,
      queue: this.queue, currentId: this.currentId, phase: this.phase, resumeTo: this.resumeTo,
      skipped: [...this.skipped], knowledge: this.knowledge?.export() })
  }
  static restore(raw: string): PartySession {
    if (raw.length > 100000) throw Error('invalid_checkpoint')
    const v = JSON.parse(raw) as ReturnType<PartySession['checkpoint']>
    const validCounts = (counts: number[]) => Array.isArray(counts) && counts.length === 3 && counts.every((c,i) => Number.isInteger(c) && c >= 0 && c <= PARTY_LEVELS[i].target)
    if (!v || v.version !== 1 || typeof v.partyId !== 'string' || !/^[-a-zA-Z0-9]{12,80}$/.test(v.partyId) ||
      !Array.isArray(v.players) || validateNames(v.players.map(p => p.name)) || !v.players.every((p,i) => p.id === `player-${i+1}` && isHatId(p.hat) && validCounts(p.counts)) ||
      !Number.isInteger(v.levelIndex) || v.levelIndex < 0 || v.levelIndex > 2 ||
      !Number.isInteger(v.completedLevels) || v.completedLevels < 0 || v.completedLevels > v.levelIndex + 1 ||
      !Number.isInteger(v.levelAttemptId) || v.levelAttemptId < 1 || v.levelAttemptId > 10 ||
      !PHASES.includes(v.phase) || !['ready','levelWon','quizGenerating','quizAnswering','quizJudging','quizUncertain','quizUnavailable'].includes(v.resumeTo) || !v.knowledge ||
      !Array.isArray(v.failedAttempts) || v.failedAttempts.length > 30 || v.failedAttempts.some(a => !Number.isInteger(a.levelIndex) || a.levelIndex < 0 || a.levelIndex > 2 ||
        !Number.isInteger(a.levelAttemptId) || a.levelAttemptId < 1 || !Array.isArray(a.counts) || a.counts.length !== v.players.length || a.counts.some(c => !Number.isInteger(c) || c < 0 || c > PARTY_LEVELS[a.levelIndex].target))) throw Error('invalid_checkpoint')
    const ids = v.players.map(p => p.id)
    if (!ids.includes(v.currentId) || !Array.isArray(v.queue) || new Set(v.queue).size !== v.queue.length ||
      v.queue.some(id => !ids.includes(id)) || !Array.isArray(v.skipped) || v.skipped.some(id => !ids.includes(id)) ||
      (!v.queue.length && !['levelWon','won','exited'].includes(v.phase))) throw Error('invalid_checkpoint')
    const game = new PartySession(v.players.map(p => p.name),v.players.map(p => p.hat),{knowledgeChallenge:true,partyId:v.partyId})
    game.players = structuredClone(v.players); game.levelIndex = v.levelIndex; game.completedLevels = v.completedLevels
    game.levelAttemptId = v.levelAttemptId; game.failedAttempts = structuredClone(v.failedAttempts)
    game.queue = [...v.queue]; game.currentId = v.currentId; game.skipped = new Set(v.skipped)
    game.knowledge!.restore(v.knowledge,c => c.partyId === v.partyId && PARTY_LEVELS.some(l => l.id === c.levelId) &&
      Number.isInteger(c.levelAttemptId) && c.levelAttemptId >= 1 && c.levelAttemptId <= 10 && ids.includes(c.playerId))
    if (game.players.some(p => p.counts.some((count,i) => i < v.levelIndex ? count !== PARTY_LEVELS[i].target : i > v.levelIndex && count !== 0)) ||
      (['levelWon','won'].includes(v.phase) && (v.completedLevels !== v.levelIndex+1 || game.players.some(p => p.counts[v.levelIndex] !== game.level.target || !game.knowledge!.passed(game.quizContext(p.id))))) ||
      (v.phase === 'won' && v.levelIndex !== 2)) throw Error('invalid_checkpoint')
    game.phase = v.phase; game.resumeTo = v.resumeTo
    if (['active','preparing','ready','blocked'].includes(v.phase) || v.phase.startsWith('quiz')) {
      game.resumeTo = v.phase.startsWith('quiz') ? v.phase : 'ready'; game.phase = 'paused'
    }
    game.invalidate(-Infinity); game.message = '已恢复保存进度，摄像头未自动开启；继续前请确认当前玩家。'
    return game
  }
  pendingQuizOperation() {
    return this.phase.startsWith('quiz') ? this.knowledge?.pending(this.quizContext()) ?? null : null
  }
  snapshot(): PartySnapshot {
    const total = this.players.reduce((sum, player) => sum + player.counts[this.levelIndex], 0)
    const ready = this.gate.snapshot()
    return { knowledgeChallenge: !!this.knowledge, levelAttemptId: this.levelAttemptId, quiz: this.knowledge?.snapshot(this.quizContext()) ?? null,
      failedAttempts: this.failedAttempts.map(a => ({ ...a, counts: [...a.counts] })), levelIndex:this.levelIndex, level:this.level, completedLevels:this.completedLevels,
      rewards:PARTY_LEVELS.slice(0,this.completedLevels).map(level => level.reward),
      teamTotal:this.players.reduce((sum,player) => sum+player.counts.reduce((a,b) => a+b,0),0),
      phase: this.phase, players: this.players.map(player => ({ ...player, counts:[...player.counts], count:player.counts[this.levelIndex], totalCount:player.counts.reduce((a,b) => a+b,0) })), currentId: this.currentId,
      queue: [...this.queue], total, hp: Math.max(0, this.players.length * this.level.target * this.level.damage - total * this.level.damage),
      maxHp: this.players.length * this.level.target * this.level.damage, attempt: this.attempt,
      digit: this.gate.digit, stableMs: Math.floor(ready.stableMs / 100) * 100,
      message: this.message, readyPhase: this.gate.phase }
  }
  private invalidate(now: number) {
    this.attempt++; this.repIndex = 0; this.cutoff = now
    this.counter = null; this.gate.stop()
  }
  prepare(now: number) {
    if (this.phase !== 'ready') return
    this.invalidate(now)
    const remaining = this.level.target - this.players.find(player => player.id === this.currentId)!.counts[this.levelIndex]
    if (this.knowledge && remaining === 0) { this.enterQuiz(); return }
    this.counter = new SquatCounter(remaining)
    this.gate.prepare(); this.phase = 'preparing'
    this.message = '等待当前玩家全身入镜，识别约 2 秒后自动倒计时。'
  }
  cancel(now: number) {
    if (this.phase !== 'preparing') return
    this.invalidate(now); this.phase = 'ready'; this.message = '准备已取消，次数保留。'
  }
  next(now: number) {
    if (this.phase !== 'turnComplete') return
    this.invalidate(now); this.currentId = this.queue[0]; this.phase = 'ready'
    this.message = '下一位冒险者，请主动准备。'
    this.restoreDeferredQuiz()
  }
  skip(now: number) {
    if (!['ready', 'preparing', 'active', 'quizAnswering', 'quizUncertain', 'quizUnavailable'].includes(this.phase)) return
    this.invalidate(now)
    this.skipped.add(this.currentId)
    this.queue = [...this.queue.filter(id => id !== this.currentId), this.currentId]
    this.currentId = this.queue[0]
    const allSkipped = this.queue.every(id => this.skipped.has(id))
    this.phase = allSkipped ? 'blocked' : 'ready'
    this.message = allSkipped ? '本轮所有未完成玩家均已跳过，本关已暂停。' : '上一位进度保留，已排到本关队尾；下一位请准备。'
    if (!allSkipped) this.restoreDeferredQuiz()
  }
  pause(now: number) {
    if (!['ready', 'preparing', 'active', 'blocked', 'turnComplete', 'levelWon', 'quizGenerating', 'quizAnswering', 'quizJudging', 'quizUncertain', 'quizUnavailable'].includes(this.phase)) return
    this.resumeTo = this.phase === 'levelWon' || this.phase.startsWith('quiz') ? this.phase : 'ready'
    if (this.phase === 'turnComplete') this.currentId = this.queue[0]
    this.invalidate(now); this.phase = 'paused'
    this.message = '休息中，所有进度保留。摄像头可随时关闭。'
  }
  resume(now: number) {
    if (this.phase !== 'paused' && this.phase !== 'blocked') return
    const resumeTo = this.phase === 'blocked' ? 'ready' : this.resumeTo
    this.invalidate(now); this.skipped.clear(); this.phase = resumeTo
    this.message = resumeTo === 'levelWon' ? '本关已通关，可主动进入下一关。' : '进度已恢复，请当前玩家重新准备、入镜。'
    return this.restoreDeferredQuiz()
  }
  exit(now: number) {
    if (this.phase === 'won' || this.phase === 'exited') return
    this.invalidate(now); this.phase = 'exited'; this.message = '派对提前结束，未完成三关；已获奖励和实际贡献保留。'
  }
  nextLevel(now: number) {
    // This is a guarded transition, never a manual victory/HP button.
    if (this.phase !== 'levelWon' || this.levelIndex >= PARTY_LEVELS.length-1 ||
      this.completedLevels !== this.levelIndex+1 || this.players.some(player => player.counts[this.levelIndex] !== this.level.target ||
        (this.knowledge && !this.knowledge.passed(this.quizContext(player.id))))) return
    this.invalidate(now); this.levelIndex++; this.levelAttemptId = 1; this.skipped.clear(); this.resumeTo='ready'
    this.queue=this.players.map(player => player.id); this.currentId=this.queue[0]; this.phase='ready'
    this.message=`${this.level.name}已开启，请当前玩家主动准备。`
  }
  // The token + monotonic local sequence prevent a delayed/duplicate event crossing players or attempts.
  acceptRep(attempt: number, index: number): boolean {
    if (this.phase !== 'active' || attempt !== this.attempt || index !== this.repIndex + 1) return false
    const player = this.players.find(value => value.id === this.currentId)!
    if (player.counts[this.levelIndex] >= this.level.target) return false
    this.repIndex = index; player.counts[this.levelIndex]++; this.message = '成功！+1'
    if (player.counts[this.levelIndex] === this.level.target) {
      this.invalidate(this.cutoff)
      if (this.knowledge) this.enterQuiz()
      else this.completePlayer()
    }
    return true
  }
  private completePlayer() {
    this.queue = this.queue.filter(id => id !== this.currentId)
    this.skipped.delete(this.currentId)
    if (!this.queue.length) this.completedLevels = this.levelIndex + 1
    this.phase = this.queue.length ? 'turnComplete' : this.levelIndex === PARTY_LEVELS.length - 1 ? 'won' : 'levelWon'
    this.message = this.queue.length ? '本回合完成，请下一位冒险者接棒。' : `${this.level.name}合作完成！获得${this.level.reward}。`
  }
  private quizContext(playerId = this.currentId): QuizContext {
    return { partyId: this.partyId, levelId: this.level.id, levelAttemptId: this.levelAttemptId, playerId }
  }
  private enterQuiz() {
    this.knowledge!.ensure(this.quizContext())
    this.phase = this.knowledge!.snapshot(this.quizContext())!.phase
    this.message = '动作目标已完成，计数暂停。进入知识挑战，无答题倒计时。'
  }
  private restoreDeferredQuiz() {
    if (!this.knowledge || ['blocked', 'levelWon', 'won', 'exited', 'levelFailed'].includes(this.phase)) return { ...NO_EFFECT }
    const player = this.players.find(p => p.id === this.currentId)!
    if (player.counts[this.levelIndex] !== this.level.target) return { ...NO_EFFECT }
    this.enterQuiz()
    return this.applyQuizResult()
  }
  beginQuestion(): QuizOperation | null {
    if (!this.knowledge || !['quizGenerating', 'quizUnavailable'].includes(this.phase)) return null
    const op = this.knowledge.begin(this.quizContext())
    if (op) this.phase = 'quizGenerating'
    return op
  }
  submitAnswer(answer: string): QuizOperation | null {
    if (!this.knowledge || !['quizAnswering', 'quizUncertain', 'quizUnavailable'].includes(this.phase)) return null
    const op = this.knowledge.begin(this.quizContext(), answer)
    if (op) { this.phase = 'quizJudging'; this.message = 'AI正在判题，动作计数保持暂停。' }
    return op
  }
  receiveQuiz(op: QuizOperation, value: unknown) {
    if (!this.knowledge || ['exited', 'levelFailed', 'won', 'levelWon'].includes(this.phase) ||
      op.partyId !== this.partyId || op.levelId !== this.level.id || op.levelAttemptId !== this.levelAttemptId ||
      !this.knowledge.receive(op, value)) return { ...NO_EFFECT }
    // A paused request may finish, but no gameplay transition/effect happens until explicit resume.
    if (this.phase === 'paused' || op.playerId !== this.currentId) return { ...NO_EFFECT }
    this.phase = this.knowledge.snapshot(this.quizContext())!.phase
    this.message = this.phase === 'quizUnavailable' ? 'AI暂不可用，可有限重试或安全退出，不判失败。' :
      this.phase === 'quizUncertain' ? '无法可靠判断，请补充答案后重试；不会直接判负。' : '知识挑战中，动作计数暂停。'
    return this.applyQuizResult()
  }
  private applyQuizResult() {
    const result = this.knowledge?.consume(this.quizContext())
    if (!result) return { ...NO_EFFECT }
    if (result.verdict === 'incorrect') {
      this.phase = 'levelFailed'; this.message = '挑战失败：' + result.explanation
      this.invalidate(this.cutoff)
      return { ...NO_EFFECT }
    }
    this.completePlayer()
    return { ...NO_EFFECT, levelWon: !this.queue.length, won: this.phase === 'won' }
  }
  retryLevel(now: number) {
    if (!this.knowledge || this.phase !== 'levelFailed') return
    this.failedAttempts.push({ levelIndex: this.levelIndex, levelAttemptId: this.levelAttemptId,
      counts: this.players.map(p => p.counts[this.levelIndex]) })
    this.invalidate(now); this.levelAttemptId++; this.skipped.clear(); this.resumeTo = 'ready'
    for (const player of this.players) player.counts[this.levelIndex] = 0
    this.queue = this.players.map(p => p.id); this.currentId = this.queue[0]; this.phase = 'ready'
    this.message = '重新挑战本关，前关徽章保留；请主动准备。'
  }
  frame(frame: PoseFrame | null) {
    if (!['preparing', 'active'].includes(this.phase)) return NO_EFFECT
    if (frame && (!Number.isFinite(frame.timestamp) || frame.timestamp < this.cutoff)) return NO_EFFECT
    if (this.phase === 'preparing') {
      const previousDigit = this.gate.digit
      const result = this.gate.update(frame)
      this.message = this.gate.snapshot().reason
      if (result.start && frame) {
        this.counter!.reset(); this.counter!.acceptReadyBaseline(frame)
        this.cutoff = frame.timestamp; this.phase = 'active'; this.message = '挑战开始，明显下蹲后起立即可。'
      }
      return { attack: false, countdown: (this.gate.digit > 0 && this.gate.digit !== previousDigit) || result.start, won: false, levelWon: false }
    }
    const result = frame ? this.counter!.update(frame) : this.counter!.interrupt()
    this.message = result.message
    const attack = result.rep && this.acceptRep(this.attempt, result.count)
    return { attack, countdown: false, won: attack && this.phase === 'won', levelWon: attack && (this.phase === 'levelWon' || this.phase === 'won') }
  }
  check(now: number, hidden = false) {
    if (this.phase === 'preparing') {
      if (hidden) this.gate.interrupt('页面在后台，重新等待就位')
      else this.gate.stale(now)
      this.message = this.gate.snapshot().reason
    } else if (this.phase === 'active' && hidden) {
      this.counter?.interrupt('页面在后台，动作暂停；回到页面后重新站立。')
    }
  }
}
