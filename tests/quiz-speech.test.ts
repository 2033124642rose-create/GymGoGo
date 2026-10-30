import {afterEach,describe,expect,it,vi} from 'vitest'
import {QuizSpeech} from '../src/party/QuizSpeech'
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
function voice(){
  const spoken:SpeechSynthesisUtterance[]=[]
  vi.stubGlobal('SpeechSynthesisUtterance',class {constructor(public text:string){}})
  vi.stubGlobal('speechSynthesis',{getVoices:()=>[{localService:true,lang:'zh-CN'}],speak:vi.fn(u=>spoken.push(u)),cancel:vi.fn()})
  return spoken
}
describe('local quiz speech bounded completion',()=>{
 it('uses selected role parameters and pauses between monster segments without changing the text',async()=>{
  vi.useFakeTimers();const spoken=voice(),speech=new QuizSpeech()
  const line='哎呀，这次我认输！',p=speech.play(line,true,vi.fn(),{role:'monster',rate:.94,pitch:.88})
  expect(spoken[0].rate).toBe(.94);expect(spoken[0].pitch).toBe(.88)
  spoken[0].onend?.({} as SpeechSynthesisEvent);await vi.advanceTimersByTimeAsync(150)
  expect(spoken.map(u=>u.text).join('')).toBe(line)
  spoken[1].onend?.({} as SpeechSynthesisEvent);await vi.advanceTimersByTimeAsync(1);expect(await p).toBe(true)
 })
 it('prefers an imported local recording and falls back to speech if its codec/playback fails',async()=>{
  const spoken=voice(),speech=new QuizSpeech();const audio={play:vi.fn().mockRejectedValue(Error('codec')),pause:vi.fn(),onended:null,onerror:null}
  vi.stubGlobal('Audio',class{constructor(){return audio}})
  const p=speech.play('Bingo！',true,vi.fn(),{role:'success',audioSrc:'blob:local-recording'})
  await Promise.resolve();await Promise.resolve();expect(audio.play).toHaveBeenCalledTimes(1);expect(spoken[0].text).toBe('Bingo！')
  speech.cancel();expect(await p).toBe(false)
 })
 it('speaks Bingo once, resolves only on completion and ignores duplicate end events',async()=>{
  const spoken=voice(),speech=new QuizSpeech();let count=0
  const promise=speech.play('Bingo！',true,vi.fn()).then(v=>{if(v)count++})
  expect(spoken.map(s=>s.text)).toEqual(['Bingo！']);expect(count).toBe(0)
  const end=spoken[0].onend!;end.call(spoken[0],{} as SpeechSynthesisEvent);end.call(spoken[0],{} as SpeechSynthesisEvent);await promise;expect(count).toBe(1)
 })
 it('uses exactly the supplied monster reaction without another service',async()=>{
  const spoken=voice(),speech=new QuizSpeech(),text='哼，这次轮到我守住城堡！'
  const p=speech.play(text,true,vi.fn());expect(spoken[0].text).toBe(text);speech.cancel();expect(await p).toBe(false)
 })
 it('handles unavailable, muted, blocked and silent browsers without hanging',async()=>{
  vi.useFakeTimers();const spoken=voice(),speech=new QuizSpeech(),notice=vi.fn()
  let p=speech.play('Bingo！',false,notice);await vi.advanceTimersByTimeAsync(701);expect(await p).toBe(true);expect(spoken).toHaveLength(0)
  p=speech.play('Bingo！',true,notice);spoken[0].onerror?.({} as SpeechSynthesisErrorEvent);await vi.advanceTimersByTimeAsync(701);expect(await p).toBe(true)
  p=speech.play('Bingo！',true,notice);await vi.advanceTimersByTimeAsync(3300);expect(await p).toBe(true)
  expect(notice).toHaveBeenCalled();speech.cancel()
 })
 it('cancels previous queued speech and a late callback cannot complete the old result',async()=>{
  const spoken=voice(),speech=new QuizSpeech();const old=speech.play('Bingo！',true,vi.fn()),late=spoken[0].onend!
  const current=speech.play('新回合',true,vi.fn());late.call(spoken[0],{} as SpeechSynthesisEvent);expect(await old).toBe(false)
  speech.cancel();expect(await current).toBe(false)
 })
})
