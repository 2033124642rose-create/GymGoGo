import { ReadyGate } from '../game/ReadyGate'
import { SquatCounter } from '../squat/SquatCounter'
import type { PoseFrame } from '../camera/pose'
import { FIRST_LEVEL } from './levels'

export type PartyPhase = 'ready' | 'preparing' | 'active' | 'turnComplete' | 'paused' | 'blocked' | 'won' | 'exited'
export interface PartyPlayer { id: string; name: string; count: number }
export interface PartySnapshot {
  phase: PartyPhase; players: PartyPlayer[]; currentId: string; queue: string[];
  total: number; hp: number; maxHp: number; attempt: number; digit: number; stableMs: number;
  message: string; readyPhase: string;
}
export function validateNames(names: string[]): string | null {
  if (names.length < 2 || names.length > 6) return '请选择 2–6 位玩家。'
  if (names.some(name => !name.trim() || Array.from(name.trim()).length > 12)) return '每位玩家的昵称需为 1–12 个字符。'
  return null
}
export const NO_EFFECT = { attack: false, countdown: false, won: false }

// Local rule state only; reuses the accepted pose counter and ready gate unchanged.
export class PartySession {
  private players: PartyPlayer[]
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
  constructor(names: string[]) {
    const error = validateNames(names)
    if (error) throw new Error(error)
    this.players = names.map((name, index) => ({ id: `player-${index + 1}`, name: name.trim(), count: 0 }))
    this.queue = this.players.map(player => player.id)
    this.currentId = this.queue[0]
  }
  snapshot(): PartySnapshot {
    const total = this.players.reduce((sum, player) => sum + player.count, 0)
    const ready = this.gate.snapshot()
    return { phase: this.phase, players: this.players.map(player => ({ ...player })), currentId: this.currentId,
      queue: [...this.queue], total, hp: Math.max(0, this.players.length * FIRST_LEVEL.target * FIRST_LEVEL.damage - total * FIRST_LEVEL.damage),
      maxHp: this.players.length * FIRST_LEVEL.target * FIRST_LEVEL.damage, attempt: this.attempt,
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
    const remaining = FIRST_LEVEL.target - this.players.find(player => player.id === this.currentId)!.count
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
  }
  skip(now: number) {
    if (!['ready', 'preparing', 'active'].includes(this.phase)) return
    this.invalidate(now)
    this.skipped.add(this.currentId)
    this.queue = [...this.queue.filter(id => id !== this.currentId), this.currentId]
    this.currentId = this.queue[0]
    const allSkipped = this.queue.every(id => this.skipped.has(id))
    this.phase = allSkipped ? 'blocked' : 'ready'
    this.message = allSkipped ? '本轮所有未完成玩家均已跳过，本关已暂停。' : '上一位进度保留，已排到本关队尾；下一位请准备。'
  }
  pause(now: number) {
    if (!['ready', 'preparing', 'active', 'blocked', 'turnComplete'].includes(this.phase)) return
    if (this.phase === 'turnComplete') this.currentId = this.queue[0]
    this.invalidate(now); this.phase = 'paused'
    this.message = '休息中，所有进度保留。摄像头可随时关闭。'
  }
  resume(now: number) {
    if (this.phase !== 'paused' && this.phase !== 'blocked') return
    this.invalidate(now); this.skipped.clear(); this.phase = 'ready'
    this.message = '进度已恢复，请当前玩家重新准备、入镜。'
  }
  exit(now: number) {
    if (this.phase === 'won' || this.phase === 'exited') return
    this.invalidate(now); this.phase = 'exited'; this.message = '本关已退出，未通关；保留本次实际贡献摘要。'
  }
  // The token + monotonic local sequence prevent a delayed/duplicate event crossing players or attempts.
  acceptRep(attempt: number, index: number): boolean {
    if (this.phase !== 'active' || attempt !== this.attempt || index !== this.repIndex + 1) return false
    const player = this.players.find(value => value.id === this.currentId)!
    if (player.count >= FIRST_LEVEL.target) return false
    this.repIndex = index; player.count++; this.message = '成功！+1'
    if (player.count === FIRST_LEVEL.target) {
      this.queue = this.queue.filter(id => id !== player.id)
      this.skipped.delete(player.id)
      this.invalidate(this.cutoff)
      this.phase = this.queue.length ? 'turnComplete' : 'won'
      this.message = this.phase === 'won' ? '第一关合作完成！获得萌芽伙伴徽章。' : '本回合完成，请下一位冒险者接棒。'
    }
    return true
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
      return { attack: false, countdown: (this.gate.digit > 0 && this.gate.digit !== previousDigit) || result.start, won: false }
    }
    const result = frame ? this.counter!.update(frame) : this.counter!.interrupt()
    this.message = result.message
    const attack = result.rep && this.acceptRep(this.attempt, result.count)
    return { attack, countdown: false, won: attack && this.phase === 'won' }
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
