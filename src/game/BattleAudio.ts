// Short procedural effects only. No audio upload, microphone or remote assets.
export class BattleAudio {
  private context: AudioContext | null = null
  private nodes: OscillatorNode[] = []
  async unlock() {
    try {
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Audio) return false
      if (!this.context || this.context.state === 'closed') this.context = new Audio()
      if (this.context.state !== 'running') {
        let timeout: ReturnType<typeof setTimeout> | undefined
        try { await Promise.race([this.context.resume(),new Promise<void>(resolve=>{timeout=setTimeout(resolve,1500)})]) }
        finally {clearTimeout(timeout)}
      }
      return this.context?.state === 'running'
    } catch {return false}
  }
  private note(frequency: number, endFrequency: number, duration: number, delay = 0, type: OscillatorType = 'sine') {
    const context = this.context
    if (!context || context.state !== 'running') return false
    try {
      const oscillator = context.createOscillator(), gain = context.createGain(), time=context.currentTime+delay
      oscillator.type=type
      oscillator.frequency.setValueAtTime(frequency,time)
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency,time+duration)
      gain.gain.setValueAtTime(0,time)
      gain.gain.linearRampToValueAtTime(.12,time+.008)
      gain.gain.exponentialRampToValueAtTime(.001,time+duration)
      oscillator.connect(gain);gain.connect(context.destination)
      oscillator.start(time);oscillator.stop(time+duration+.01)
      this.nodes.push(oscillator)
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.nodes=this.nodes.filter(node=>node!==oscillator)}
      return true
    } catch {return false}
  }
  strike() {return this.note(220,70,.12,0,'triangle')}
  countdown() {return this.note(660,660,.09)}
  victory() { [523,659,784].forEach((pitch,i)=>this.note(pitch,pitch,.22,.14+i*.15)) }
  silence() {this.nodes.forEach(node=>{try{node.stop()}catch{/* already ended */}});this.nodes=[]}
  dispose() {this.silence();if(this.context)void this.context.close().catch(()=>{});this.context=null}
}
