import { afterEach, describe, expect, it, vi } from 'vitest'
import { findLocalChineseVoice, LocalCuePlayer, StableStatusAnnouncer } from '../src/camera/trainingFeedback'
import type { CuePlayer } from '../src/camera/trainingFeedback'

function setup() {
  vi.useFakeTimers()
  const player: CuePlayer = { unlock: vi.fn(), play: vi.fn(), silence: vi.fn(), dispose: vi.fn() }
  return { player, announcer: new StableStatusAnnouncer(player) }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('stable status feedback, independent of pose inference', () => {
  it('announces the first success only after 1200ms, not once per frame', () => {
    const { player, announcer } = setup()
    for (let i = 0; i < 30; i++) announcer.update('tracked')
    vi.advanceTimersByTime(1199)
    expect(player.play).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(player.play).toHaveBeenCalledExactlyOnceWith('tracked')
    for (let i = 0; i < 30; i++) announcer.update('tracked')
    vi.advanceTimersByTime(20_000)
    expect(player.play).toHaveBeenCalledTimes(1)
  })
  it('cancels a briefly lost body instead of announcing status jitter', () => {
    const { player, announcer } = setup()
    announcer.update('tracked'); vi.advanceTimersByTime(1200)
    announcer.update('lost'); vi.advanceTimersByTime(500)
    announcer.update('tracked'); vi.advanceTimersByTime(10_000)
    expect(player.play).toHaveBeenCalledTimes(1)
  })
  it('announces a stable departure and recovery with at least 4500ms between cues', () => {
    const { player, announcer } = setup()
    announcer.update('tracked'); vi.advanceTimersByTime(1200)
    announcer.update('lost'); vi.advanceTimersByTime(4499)
    expect(player.play).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(player.play).toHaveBeenLastCalledWith('lost')
    announcer.update('tracked'); vi.advanceTimersByTime(4500)
    expect(player.play).toHaveBeenLastCalledWith('tracked')
    expect(player.play).toHaveBeenCalledTimes(3)
  })
  it('never plays a stale pending cue after mute, camera shutdown or exit', () => {
    const { player, announcer } = setup()
    announcer.update('tracked'); vi.advanceTimersByTime(400)
    announcer.update(null); vi.advanceTimersByTime(10_000)
    expect(player.play).not.toHaveBeenCalled()
    expect(player.silence).toHaveBeenCalled()
  })
  it('releases timers and audio resources on disposal', () => {
    const { player, announcer } = setup()
    announcer.update('lost'); announcer.dispose()
    vi.advanceTimersByTime(10_000)
    expect(player.play).not.toHaveBeenCalled()
    expect(player.dispose).toHaveBeenCalledOnce()
  })
})

describe('local-only audio policy', () => {
  it('chooses a local Chinese voice and never chooses a remote one', () => {
    const remote = { lang: 'zh-CN', localService: false } as SpeechSynthesisVoice
    const english = { lang: 'en-US', localService: true } as SpeechSynthesisVoice
    const local = { lang: 'zh-CN', localService: true } as SpeechSynthesisVoice
    expect(findLocalChineseVoice([remote, english, local])).toBe(local)
    expect(findLocalChineseVoice([remote, english])).toBeUndefined()
  })
  it('falls back to unavailable feedback instead of using a remote voice when no local audio API exists', async () => {
    const speak = vi.fn()
    vi.stubGlobal('SpeechSynthesisUtterance', class {})
    vi.stubGlobal('speechSynthesis', { getVoices: () => [{ lang: 'zh-CN', localService: false }], speak })
    vi.stubGlobal('AudioContext', undefined)
    const mode = vi.fn()
    const player = new LocalCuePlayer(mode)
    expect(await player.unlock()).toBe('unsupported')
    player.play('tracked')
    expect(speak).not.toHaveBeenCalled()
    player.dispose()
  })
  it('uses local Web Audio tones when Chinese speech is unavailable', async () => {
    const start = vi.fn(), stop = vi.fn()
    const close = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('AudioContext', class {
      state = 'running'; currentTime = 0; destination = {}
      close = close
      createOscillator() { return { type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start, stop, onended: null } }
      createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() } }
    })
    const player = new LocalCuePlayer(vi.fn())
    expect(await player.unlock()).toBe('tone')
    player.play('tracked')
    expect(start).toHaveBeenCalledTimes(2)
    player.dispose()
    expect(close).toHaveBeenCalledOnce()
  })
  it('restores local Chinese speech ahead of tones when both are available',async()=>{
    const speak=vi.fn(),start=vi.fn()
    vi.stubGlobal('SpeechSynthesisUtterance',class{})
    vi.stubGlobal('speechSynthesis',{getVoices:()=>[{lang:'zh-CN',localService:true}],speak,cancel:vi.fn()})
    vi.stubGlobal('AudioContext',class{
      state='running';currentTime=0;destination={};close=vi.fn().mockResolvedValue(undefined)
      createOscillator(){return{type:'',frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start,stop:vi.fn(),onended:null}}
      createGain(){return{gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}}
    })
    const player=new LocalCuePlayer(vi.fn());expect(await player.unlock()).toBe('ready');player.play('tracked')
    expect(start).not.toHaveBeenCalled();expect(speak).toHaveBeenCalledOnce();player.dispose()
  })
  it('reports a suspended audio context when the browser rejects playback', async () => {
    vi.stubGlobal('AudioContext', class {
      state = 'suspended'
      resume = vi.fn().mockRejectedValue(new Error('blocked'))
      close = vi.fn().mockResolvedValue(undefined)
    })
    const player = new LocalCuePlayer(vi.fn())
    expect(await player.unlock()).toBe('blocked')
    player.dispose()
  })
  it('does not hang when autoplay restrictions leave resume pending', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', class {
      state = 'suspended'
      resume = () => new Promise<void>(() => {})
      close = vi.fn().mockResolvedValue(undefined)
    })
    const player = new LocalCuePlayer(vi.fn())
    const mode = player.unlock()
    await vi.advanceTimersByTimeAsync(1500)
    expect(await mode).toBe('blocked')
    player.dispose()
  })
})

function mockSpeech() {
  const engine = new EventTarget()
  const voice = {lang:'zh-CN',localService:true} as SpeechSynthesisVoice
  const getVoices = vi.fn(() => [voice])
  const speak = vi.fn(), cancel = vi.fn()
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text:string) {} })
  vi.stubGlobal('speechSynthesis', Object.assign(engine,{getVoices,speak,cancel}))
  vi.stubGlobal('AudioContext',undefined)
  return {engine,getVoices,speak,cancel}
}

describe('speech startup, failure visibility and phase transitions',()=>{
  it('speaks synchronously on a test click and reports success only on actual start',()=>{
    const {speak}=mockSpeech(), mode=vi.fn()
    const player=new LocalCuePlayer(mode)
    player.testVoice()
    expect(speak).toHaveBeenCalledOnce()
    expect(mode).toHaveBeenLastCalledWith('starting',expect.any(String))
    const utterance=speak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utterance.text).toContain('语音提示已开启')
    utterance.onstart?.({} as SpeechSynthesisEvent)
    expect(mode).toHaveBeenLastCalledWith('speech',expect.any(String))
    player.dispose()
  })
  it('reports not-allowed rather than claiming that queued speech was heard',()=>{
    const {speak}=mockSpeech(),mode=vi.fn(),player=new LocalCuePlayer(mode)
    player.play('tracked')
    speak.mock.calls[0][0].onerror({error:'not-allowed'})
    expect(mode).toHaveBeenLastCalledWith('unsupported',expect.stringContaining('浏览器阻止了语音'))
    player.dispose()
  })
  it('surfaces a silent start timeout and never falls back after intentional mute',()=>{
    vi.useFakeTimers()
    const {speak,cancel}=mockSpeech(),mode=vi.fn(),player=new LocalCuePlayer(mode)
    player.play('tracked');vi.advanceTimersByTime(2500)
    expect(mode).toHaveBeenLastCalledWith('unsupported',expect.stringContaining('未能启动'))
    player.play('lost')
    const old=speak.mock.calls[1][0]
    player.silence();mode.mockClear()
    old.onerror({error:'canceled'});vi.advanceTimersByTime(5000)
    expect(mode).not.toHaveBeenCalled();expect(cancel).toHaveBeenCalled()
    player.dispose()
  })
  it('handles a late voiceschanged list without auto-playing or requesting any device',()=>{
    const {engine,getVoices,speak}=mockSpeech(),mode=vi.fn()
    getVoices.mockReturnValue([])
    const player=new LocalCuePlayer(mode)
    getVoices.mockReturnValue([{lang:'zh-CN',localService:true} as SpeechSynthesisVoice])
    engine.dispatchEvent(new Event('voiceschanged'))
    expect(mode).toHaveBeenLastCalledWith('ready',expect.stringContaining('已加载'))
    expect(speak).not.toHaveBeenCalled()
    player.testVoice();expect(speak).toHaveBeenCalledOnce()
    player.dispose();mode.mockClear()
    engine.dispatchEvent(new Event('voiceschanged'));expect(mode).not.toHaveBeenCalled()
  })
  it('does not delay confirmed countdown / start or repeat them per frame',()=>{
    const {player,announcer}=setup()
    announcer.update('tracked');vi.advanceTimersByTime(1200)
    for(let i=0;i<30;i++)announcer.update('countdown')
    expect(player.play).toHaveBeenLastCalledWith('countdown')
    announcer.update('started')
    for(let i=0;i<30;i++)announcer.update('started')
    expect(player.play).toHaveBeenLastCalledWith('started')
    expect(player.play).toHaveBeenCalledTimes(3)
    announcer.update('won');expect(player.play).toHaveBeenLastCalledWith('won')
    announcer.dispose()
  })
  it('cancels a queued phase / tracking cue on reset and allows the next explicit round',()=>{
    const {player,announcer}=setup()
    announcer.update('countdown');announcer.update('lost');announcer.update(null)
    vi.advanceTimersByTime(5000)
    expect(player.play).toHaveBeenCalledTimes(1)
    announcer.update('tracked');vi.advanceTimersByTime(1200)
    expect(player.play).toHaveBeenLastCalledWith('tracked')
    announcer.update('countdown');expect(player.play).toHaveBeenCalledTimes(3)
    announcer.dispose()
  })
})
