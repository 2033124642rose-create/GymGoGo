import type { Tracking } from './pose'

export type SoundMode = 'ready' | 'starting' | 'speech' | 'tone' | 'blocked' | 'unsupported'
export type ChallengeCue = 'countdown' | 'started' | 'won'
export type FeedbackCue = Tracking | ChallengeCue
export interface CuePlayer {
  unlock(): Promise<SoundMode>
  play(status: FeedbackCue, sample?: boolean): void
  silence(): void
  dispose(): void
}
const SPOKEN: Record<FeedbackCue, string> = {
  tracked: '识别成功', waiting: '请让全身进入画面',
  partial: '请调整站位，让全身进入画面', lost: '未检测到人体，请回到画面',
  countdown: '准备开始', started: '挑战开始，下蹲后起立', won: '挑战完成，怪兽已击败',
}
export function findLocalChineseVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find(voice => voice.localService && /^zh(?:-|_|$)/i.test(voice.lang))
}

// Only device-local Chinese speech. Tones are an explicit, visible fallback.
export class LocalCuePlayer implements CuePlayer {
  private context: AudioContext | null = null
  private nodes: OscillatorNode[] = []
  private utterance: SpeechSynthesisUtterance | null = null
  private startTimer: ReturnType<typeof setTimeout> | undefined
  private disposed = false
  private generation = 0
  private voicesChanged = () => {
    if (!this.disposed && !this.utterance && this.localVoice())
      this.onMode('ready', '本地中文语音已加载，请点击「测试语音」确认声音。')
  }
  constructor(private onMode: (mode: SoundMode, detail?: string) => void) {
    window.speechSynthesis?.addEventListener?.('voiceschanged', this.voicesChanged)
    this.localVoice() // Some browsers load the list asynchronously after the first query.
  }
  async unlock(): Promise<SoundMode> {
    if (this.disposed) return 'unsupported'
    try {
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Audio && (!this.context || this.context.state === 'closed')) this.context = new Audio()
      if (this.context?.state === 'suspended') {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([this.context.resume(), new Promise<void>(resolve => { timer = setTimeout(resolve, 1500) })])
        } finally { clearTimeout(timer) }
      }
    } catch { /* Speech can still work independently of Web Audio. */ }
    const mode: SoundMode = this.localVoice() ? 'ready' : this.context?.state === 'running' ? 'tone' :
      this.context ? 'blocked' : 'unsupported'
    if (!this.disposed && !this.utterance) this.onMode(mode, mode === 'tone' ? '未检测到本地中文语音，暂用提示音；可稍后点击「测试语音」重试。' : undefined)
    return mode
  }
  private localVoice() {
    if (typeof window.SpeechSynthesisUtterance === 'undefined' || !window.speechSynthesis) return undefined
    try { return findLocalChineseVoice(window.speechSynthesis.getVoices()) } catch { return undefined }
  }
  testVoice() {
    if (this.disposed) return
    // Keep speech synchronous with the actual click, rather than waiting on AudioContext.resume().
    if (this.localVoice()) { void this.unlock(); this.play('tracked', true); return }
    const generation = this.generation
    void this.unlock().then(() => {
      if (!this.disposed && generation === this.generation) this.play('tracked', true)
    })
  }
  play(status: FeedbackCue, sample = false) {
    if (this.disposed) return
    this.silence()
    const voice = this.localVoice()
    if (!voice) { this.tone(status, '未检测到本地中文语音，暂用提示音；请稍后测试或检查系统中文语音包。'); return }
    const utterance = new SpeechSynthesisUtterance(sample ? '语音提示已开启，识别成功后会提醒你' : SPOKEN[status])
    this.utterance = utterance
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = 1.05
    utterance.volume = 1
    const fail = (reason: string) => {
      if (this.utterance !== utterance) return
      clearTimeout(this.startTimer)
      this.utterance = null
      window.speechSynthesis.cancel()
      this.tone(status, reason)
    }
    utterance.onstart = () => {
      if (this.utterance !== utterance) return
      clearTimeout(this.startTimer)
      this.onMode('speech', '中文语音已开始播放；若仍听不到，请检查标签页静音及系统音量。')
    }
    utterance.onend = () => {
      if (this.utterance === utterance) { clearTimeout(this.startTimer); this.utterance = null }
    }
    utterance.onerror = event => fail(event.error === 'not-allowed' ?
      '浏览器阻止了语音，请点击「测试语音」重新启用；暂用提示音。' :
      '中文语音播放失败，暂用提示音；请点击「测试语音」重试。')
    this.onMode('starting', '正在等待中文语音启动…')
    this.startTimer = setTimeout(() => fail('中文语音未能启动，暂用提示音；请点击「测试语音」重试。'), 2500)
    try { window.speechSynthesis.speak(utterance) }
    catch { fail('中文语音启动失败，暂用提示音；请点击「测试语音」重试。') }
  }
  private tone(status: FeedbackCue, detail: string) {
    const context = this.context
    if (!context || context.state !== 'running') {
      this.onMode(context ? 'blocked' : 'unsupported', `${detail} 提示音也不可用，请点击「测试语音」启用或查看屏幕状态。`)
      return
    }
    try {
      const pitches = ['tracked', 'countdown', 'started', 'won'].includes(status) ? [784, 1046] : [440, 330]
      pitches.forEach((pitch, i) => {
        const oscillator = context.createOscillator(), gain = context.createGain()
        oscillator.type = 'sine'; oscillator.frequency.value = pitch
        const start = context.currentTime + i * .12
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(.12, start + .025)
        gain.gain.exponentialRampToValueAtTime(.001, start + .1)
        oscillator.connect(gain); gain.connect(context.destination)
        oscillator.start(start); oscillator.stop(start + .11)
        this.nodes.push(oscillator)
        oscillator.onended = () => {
          oscillator.disconnect(); gain.disconnect()
          this.nodes = this.nodes.filter(node => node !== oscillator)
        }
      })
      this.onMode('tone', detail)
    } catch { this.onMode('blocked', '语音和提示音暂时不可用，请点击「测试语音」重试或查看屏幕状态。') }
  }
  silence() {
    this.generation++
    clearTimeout(this.startTimer)
    // Clear before cancel: an intentional mute/stop must never trigger fallback audio.
    if (this.utterance) { this.utterance = null; window.speechSynthesis?.cancel() }
    this.nodes.forEach(node => { try { node.stop() } catch { /* Already ended. */ } })
    this.nodes = []
  }
  dispose() {
    this.disposed = true
    this.silence()
    window.speechSynthesis?.removeEventListener?.('voiceschanged', this.voicesChanged)
    if (this.context) void this.context.close().catch(() => {})
    this.context = null
  }
}

// Presentation only: pose stability and game phases remain unchanged.
export class StableStatusAnnouncer {
  private timer: ReturnType<typeof setTimeout> | undefined
  private candidate: FeedbackCue | null = null
  private last: FeedbackCue | null = null
  private lastAt = -Infinity
  constructor(private player: CuePlayer) {}
  update(status: FeedbackCue | null) {
    if (status === this.candidate) return
    clearTimeout(this.timer)
    this.candidate = status
    if (status === null) {
      this.last = null; this.lastAt = -Infinity
      this.player.silence()
      return
    }
    if (this.last === 'countdown' && status !== 'countdown') this.player.silence()
    if (status === this.last) return
    // A game phase is already confirmed by ReadyGate; do not delay it past its countdown.
    const phaseCue = status === 'countdown' || status === 'started' || status === 'won'
    const play = () => {
      if (this.candidate !== status) return
      this.last = status; this.lastAt = Date.now(); this.player.play(status)
    }
    if (phaseCue) play()
    else this.timer = setTimeout(play, Math.max(1200, 4500 - (Date.now() - this.lastAt)))
  }
  dispose() {
    clearTimeout(this.timer)
    this.candidate = null; this.last = null; this.lastAt = -Infinity
    this.player.dispose()
  }
}
