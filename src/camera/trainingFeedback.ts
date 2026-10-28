import type { Tracking } from './pose'

export type SoundMode = 'ready' | 'speech' | 'tone' | 'blocked' | 'unsupported'
export interface CuePlayer {
  unlock(): Promise<SoundMode>
  play(status: Tracking, sample?: boolean): void
  silence(): void
  dispose(): void
}
const SPOKEN = {
  tracked: '识别成功', waiting: '等待用户入镜，请让全身进入画面',
  partial: '请让全身进入画面', lost: '未检测到人体，请回到画面',
} as const

export function findLocalChineseVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find(voice => voice.localService && /^zh(?:-|_|$)/i.test(voice.lang))
}

// No remote TTS: use a local Chinese voice, otherwise synthesize short tones in the browser.
export class LocalCuePlayer implements CuePlayer {
  private context: AudioContext | null = null
  private nodes: OscillatorNode[] = []
  private utterance: SpeechSynthesisUtterance | null = null
  constructor(private onMode: (mode: SoundMode) => void) {}

  async unlock(): Promise<SoundMode> {
    try {
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Audio && (!this.context || this.context.state === 'closed')) this.context = new Audio()
      if (this.context?.state === 'suspended') {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([this.context.resume(), new Promise<void>(resolve => { timer = setTimeout(resolve, 1500) })])
        } finally { clearTimeout(timer) }
      }
    } catch { /* Local speech may still be available when Web Audio is blocked. */ }
    const local = this.localVoice()
    const mode: SoundMode = local ? 'speech' : this.context?.state === 'running' ? 'tone' :
      this.context ? 'blocked' : 'unsupported'
    this.onMode(mode)
    return mode
  }

  private localVoice() {
    if (typeof window.SpeechSynthesisUtterance === 'undefined' || !window.speechSynthesis) return undefined
    try { return findLocalChineseVoice(window.speechSynthesis.getVoices()) } catch { return undefined }
  }

  play(status: Tracking, sample = false) {
    this.silence()
    const voice = this.localVoice()
    if (voice) {
      const utterance = new SpeechSynthesisUtterance(sample ? '这是声音提示示例' : SPOKEN[status])
      this.utterance = utterance
      utterance.voice = voice
      utterance.lang = voice.lang
      utterance.rate = .95
      utterance.volume = .8
      utterance.onerror = () => { if (this.utterance === utterance) { this.utterance = null; this.tone(status) } }
      try { window.speechSynthesis.speak(utterance); this.onMode('speech') }
      catch { this.utterance = null; this.tone(status) }
    } else this.tone(status)
  }

  private tone(status: Tracking) {
    const context = this.context
    if (!context || context.state !== 'running') { this.onMode(context ? 'blocked' : 'unsupported'); return }
    const pitches = status === 'tracked' ? [784, 1046] : [440, 330]
    pitches.forEach((pitch, i) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = pitch
      const start = context.currentTime + i * .19
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(.12, start + .025)
      gain.gain.exponentialRampToValueAtTime(.001, start + .17)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + .18)
      this.nodes.push(oscillator)
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect()
        this.nodes = this.nodes.filter(node => node !== oscillator)
      }
    })
    this.onMode('tone')
  }

  silence() {
    // Clear the reference before cancel(): a cancellation must not trigger an error fallback beep.
    if (this.utterance) { this.utterance = null; window.speechSynthesis?.cancel() }
    this.nodes.forEach(node => { try { node.stop() } catch { /* Already ended. */ } })
    this.nodes = []
  }

  dispose() {
    this.silence()
    if (this.context) void this.context.close().catch(() => {})
    this.context = null
  }
}

// Presentation-only stability/cooldown; does not change MediaPipe or pose assessment.
export class StableStatusAnnouncer {
  private timer: ReturnType<typeof setTimeout> | undefined
  private candidate: Tracking | null = null
  private last: Tracking | null = null
  private lastAt = -Infinity
  constructor(private player: CuePlayer) {}

  update(status: Tracking | null) {
    if (status === this.candidate) return
    clearTimeout(this.timer)
    this.candidate = status
    if (status === null) {
      this.last = null; this.lastAt = -Infinity
      this.player.silence()
      return
    }
    if (status === this.last) return
    const delay = Math.max(1200, 4500 - (Date.now() - this.lastAt))
    this.timer = setTimeout(() => {
      if (this.candidate !== status) return
      this.last = status
      this.lastAt = Date.now()
      this.player.play(status)
    }, delay)
  }

  dispose() {
    clearTimeout(this.timer)
    this.candidate = null; this.last = null; this.lastAt = -Infinity
    this.player.dispose()
  }
}
