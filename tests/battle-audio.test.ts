import { afterEach, describe, expect, it, vi } from 'vitest'
import { BattleAudio } from '../src/game/BattleAudio'

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
describe('basic battle audio degrades without blocking the game',()=>{
  it('is safe when the browser has no audio context',async()=>{
    vi.stubGlobal('AudioContext',undefined)
    const audio=new BattleAudio()
    expect(await audio.unlock()).toBe(false);expect(audio.strike()).toBe(false)
    expect(()=>audio.victory()).not.toThrow();audio.dispose()
  })
  it('uses short local notes for an attack and three delayed notes for victory',async()=>{
    const start=vi.fn(),stop=vi.fn(),close=vi.fn().mockResolvedValue(undefined),ramp=vi.fn()
    vi.stubGlobal('AudioContext',class {
      state='running';currentTime=0;destination={};close=close
      createOscillator(){return{type:'sine',frequency:{setValueAtTime:vi.fn(),exponentialRampToValueAtTime:ramp},connect:vi.fn(),disconnect:vi.fn(),start,stop,onended:null}}
      createGain(){return{gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}}
    })
    const audio=new BattleAudio();expect(await audio.unlock()).toBe(true)
    expect(audio.strike()).toBe(true);expect(ramp).toHaveBeenCalledWith(70,.12)
    audio.victory();expect(start).toHaveBeenCalledTimes(4)
    audio.dispose();expect(close).toHaveBeenCalledOnce()
  })
  it('bounds a suspended resume request instead of hanging',async()=>{
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext',class{state='suspended';resume=()=>new Promise<void>(()=>{});close=vi.fn().mockResolvedValue(undefined)})
    const audio=new BattleAudio(),pending=audio.unlock()
    await vi.advanceTimersByTimeAsync(1500)
    expect(await pending).toBe(false);audio.dispose()
  })
})
