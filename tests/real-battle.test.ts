import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { makeSequence } from './squat-fixtures'
import type { PoseFrame } from '../src/camera/pose'

const audio = vi.hoisted(()=>({ unlock:vi.fn().mockResolvedValue(true),strike:vi.fn().mockReturnValue(true),countdown:vi.fn(),victory:vi.fn(),silence:vi.fn(),dispose:vi.fn() }))
vi.mock('../src/game/BattleAudio',()=>({BattleAudio:class {unlock=audio.unlock;strike=audio.strike;countdown=audio.countdown;victory=audio.victory;silence=audio.silence;dispose=audio.dispose}}))
class FakeWorker {
  static instances:FakeWorker[]=[]
  onmessage:((event:MessageEvent)=>void)|null=null
  onerror=null
  postMessage=vi.fn();terminate=vi.fn()
  constructor(){FakeWorker.instances.push(this)}
  reply(data:unknown){this.onmessage?.({data} as MessageEvent)}
}
beforeEach(()=>{
  FakeWorker.instances=[]
  Object.values(audio).forEach(fn=>fn.mockClear())
  audio.unlock.mockResolvedValue(true);audio.strike.mockReturnValue(true)
  const track=Object.assign(new EventTarget(),{stop:vi.fn()})
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[track],getVideoTracks:()=>[track]})}})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true})
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({clearRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),arc:vi.fn(),fill:vi.fn()} as unknown as CanvasRenderingContext2D)
  vi.spyOn(performance,'now').mockReturnValue(0)
  vi.stubGlobal('Worker',FakeWorker);vi.stubGlobal('OffscreenCanvas',class{});vi.stubGlobal('createImageBitmap',vi.fn())
})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})

async function setup() {
  render(createElement(App))
  expect((screen.getByRole('button',{name:'准备挑战'}) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button',{name:'开启摄像头'}))
  await waitFor(()=>expect(FakeWorker.instances.length).toBe(1))
  let worker=FakeWorker.instances[0]
  act(()=>worker.reply({type:'ready'}))
  const sequence=makeSequence()
  const feed=(frames:PoseFrame[])=>act(()=>frames.forEach(frame=>worker.reply({type:'result',...frame})))
  feed(sequence.hold(175,0,400))
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'战斗大屏'}))})
  const prepare=async()=>act(async()=>{fireEvent.click(screen.getByRole('button',{name:'准备挑战'}))})
  const start=async()=>{await prepare();feed(sequence.hold(175,0,5200))}
  const stand=()=>feed(sequence.hold(175,0,900))
  const rep=()=>{feed(sequence.hold(140,.04,400));feed(sequence.hold(95,.14,600));feed(sequence.hold(135,.06,400));feed(sequence.hold(175,0,600))}
  return {sequence,feed,start,prepare,stand,rep,useWorker:(value:FakeWorker)=>{worker=value}}
}
const countText=()=>screen.getByLabelText('真实深蹲计数').textContent
const hp=()=>screen.getByRole('progressbar',{name:'怪兽生命值'}).getAttribute('aria-valuenow')

describe('real landmark → squat → one attack integration (synthetic data, not human validation)',()=>{
  it('requires explicit start; the real mode never exposes a manual fake-rep button',async()=>{
    const s=await setup();s.stand();s.rep()
    expect(countText()).toContain('0 / 10');expect(hp()).toBe('100')
    expect(screen.queryByRole('button',{name:'模拟完成一次深蹲'})).toBeNull()
    expect(audio.strike).not.toHaveBeenCalled()
  })
  it('adds one count, one wound, one damage and one short sound per valid cycle',async()=>{
    const s=await setup();await s.start();s.stand();s.rep();s.stand()
    expect(countText()).toContain('1 / 10');expect(hp()).toBe('90')
    expect(document.querySelectorAll('[data-wound]').length).toBe(1)
    expect(audio.strike).toHaveBeenCalledTimes(1);expect(audio.victory).not.toHaveBeenCalled()
    expect(audio.countdown).toHaveBeenCalledTimes(4)
  })
  it('wins exactly once on ten valid cycles and ignores further poses',async()=>{
    const s=await setup();await s.start();s.stand();for(let i=0;i<12;i++)s.rep()
    expect(countText()).toContain('10 / 10');expect(hp()).toBe('0')
    expect(audio.strike).toHaveBeenCalledTimes(10);expect(audio.victory).toHaveBeenCalledTimes(1)
    expect(screen.getByText('挑战通关！')).toBeTruthy()
    const settlement=screen.getByRole('dialog',{name:'战斗结算'})
    expect(settlement.textContent).toContain('实际完成10 次')
    expect(settlement.textContent).toContain('已击败')
    expect(screen.getByRole('button',{name:'召唤 AI 战报 · 每局一次'})).toBeTruthy()
  })
  it('freezes exact round duration at victory and clears settlement only on an explicit replay',async()=>{
    let now=100000;vi.spyOn(Date,'now').mockImplementation(()=>now)
    const s=await setup();await s.start();for(let i=0;i<9;i++)s.rep()
    now=175000;s.rep()
    expect(screen.getByRole('dialog',{name:'战斗结算'}).textContent).toContain('01:15')
    now=900000;s.stand()
    expect(screen.getByRole('dialog',{name:'战斗结算'}).textContent).toContain('01:15')
    fireEvent.click(screen.getByRole('button',{name:'再次挑战',exact:true}))
    expect(screen.queryByRole('dialog',{name:'战斗结算'})).toBeNull()
    expect(screen.getByRole('button',{name:'取消准备'})).toBeTruthy()
    expect(countText()).toContain('0 / 10')
  })
  it('counts shallow movements but aborts a completely occluded unfinished squat',async()=>{
    const s=await setup();await s.start();s.stand();s.feed(s.sequence.hold(135,.03,700));s.stand()
    s.feed(s.sequence.hold(95,.14,600))
    const lost=s.sequence.hold(95,.14,100)[0];lost.landmarks=[];s.feed([lost]);s.stand()
    expect(countText()).toContain('1 / 10');expect(audio.strike).toHaveBeenCalledTimes(1)
    s.rep();expect(countText()).toContain('2 / 10')
  })
  it('keeps completed counts, disarms a pending rep on camera close, and resumes after standing again',async()=>{
    const s=await setup();await s.start();s.stand();s.rep();s.feed(s.sequence.hold(95,.14,600))
    fireEvent.click(screen.getByRole('button',{name:'关闭摄像头'}))
    expect(countText()).toContain('1 / 10')
    expect(document.querySelector('.battle-recognition strong')?.textContent).toContain('计数暂停')
    fireEvent.click(screen.getByRole('button',{name:'开启摄像头'}));await waitFor(()=>expect(FakeWorker.instances.length).toBe(2))
    s.useWorker(FakeWorker.instances[1]);act(()=>FakeWorker.instances[1].reply({type:'ready'}));s.stand()
    expect(countText()).toContain('1 / 10');s.rep();expect(countText()).toContain('2 / 10')
  })
  it('isolates manual demo from real poses and resets the round when changing modes',async()=>{
    const s=await setup();await s.start();s.stand();s.rep()
    fireEvent.click(screen.getByRole('button',{name:'按钮演示'}))
    expect(screen.getByLabelText('模拟深蹲计数').textContent).toContain('0 / 10')
    fireEvent.click(screen.getByRole('button',{name:'开始挑战'}));fireEvent.click(screen.getByRole('button',{name:'模拟完成一次深蹲'}))
    s.rep();expect(screen.getByLabelText('模拟深蹲计数').textContent).toContain('1 / 10')
    fireEvent.click(screen.getByRole('button',{name:'真实深蹲'}));expect(countText()).toContain('0 / 10')
  })
  it('ignores frames captured before the current round started',async()=>{
    const s=await setup();vi.mocked(performance.now).mockReturnValue(10_000);await s.start();s.stand();s.rep()
    expect(countText()).toContain('0 / 10');expect(audio.strike).not.toHaveBeenCalled()
  })
  it('keeps counting when sound is blocked and does not count after resetting a real round',async()=>{
    audio.unlock.mockResolvedValue(false);audio.strike.mockReturnValue(false)
    const s=await setup();await s.start();s.stand();s.rep()
    expect(countText()).toContain('1 / 10');expect(hp()).toBe('90')
    fireEvent.click(screen.getByRole('button',{name:'重置本局'}));s.rep()
    expect(countText()).toContain('0 / 10');expect(hp()).toBe('100')
  })
  it('can prepare with no camera or full body and cancel without starting',()=>{
    render(createElement(App))
    fireEvent.click(screen.getByRole('button',{name:'准备挑战'}))
    expect(screen.getByText('等待就位')).toBeTruthy()
    expect(screen.getByRole('button',{name:'取消准备'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'取消准备'}))
    expect(screen.getByRole('button',{name:'准备挑战'})).toBeTruthy()
    expect(audio.strike).not.toHaveBeenCalled()
  })
  it('does not count preparation movements, cancels countdown on loss and starts once after re-entry',async()=>{
    const s=await setup();await s.prepare();s.rep()
    expect(countText()).toContain('0 / 10');expect(hp()).toBe('100')
    s.feed(s.sequence.hold(175,0,2200))
    // Preparation movements now qualify as presence, but never as game attacks.
    expect(document.querySelector('.ready-overlay strong')?.textContent).toBe('1')
    s.feed([{...s.sequence.hold(175,0,100)[0],landmarks:[]}])
    expect(document.querySelector('.ready-overlay strong')?.textContent).toBe('请调整取景')
    s.feed(s.sequence.hold(175,0,5200))
    expect(document.querySelector('.battle-game-controls .real-counting-indicator')?.textContent).toBe('真实动作计数中')
    expect(countText()).toContain('0 / 10')
    s.rep();expect(countText()).toContain('1 / 10')
    expect(audio.strike).toHaveBeenCalledTimes(1)
  })
  it('cancels on camera close, supports a fresh preparation, and never auto-restarts after victory',async()=>{
    const s=await setup();await s.prepare();s.feed(s.sequence.hold(175,0,2200))
    fireEvent.click(screen.getByRole('button',{name:'关闭摄像头'}))
    expect(document.querySelector('.ready-overlay strong')?.textContent).toBe('等待就位')
    fireEvent.click(screen.getByRole('button',{name:'取消准备'}))
    s.feed(s.sequence.hold(175,0,6000));expect(hp()).toBe('100')
    fireEvent.click(screen.getByRole('button',{name:'开启摄像头'}));await waitFor(()=>expect(FakeWorker.instances.length).toBe(2))
    s.useWorker(FakeWorker.instances[1]);act(()=>FakeWorker.instances[1].reply({type:'ready'}))
    await s.start();for(let i=0;i<10;i++)s.rep()
    s.feed(s.sequence.hold(175,0,10_000));s.rep()
    expect(countText()).toContain('10 / 10');expect(audio.victory).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button',{name:'再来一局'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'再来一局'}))
    expect(countText()).toContain('0 / 10');expect(screen.getByRole('button',{name:'取消准备'})).toBeTruthy()
  })
  it('cancels when the page is hidden and rejects delayed captured frames before resuming a full wait',async()=>{
    const s=await setup();await s.prepare();s.feed(s.sequence.hold(175,0,2200))
    Object.defineProperty(document,'hidden',{configurable:true,value:true})
    act(()=>document.dispatchEvent(new Event('visibilitychange')))
    expect(document.querySelector('.ready-overlay strong')?.textContent).toBe('等待就位')
    Object.defineProperty(document,'hidden',{configurable:true,value:false})
    vi.mocked(performance.now).mockReturnValue(20_000)
    s.feed(s.sequence.hold(175,0,6000))
    expect(document.querySelector('.ready-overlay strong')?.textContent).toBe('等待就位')
    vi.mocked(performance.now).mockReturnValue(0)
    s.feed(s.sequence.hold(175,0,5200))
    expect(document.querySelector('.ready-overlay')).toBeNull();expect(countText()).toContain('0 / 10')
  })
  it('shows the actual blocking joint and standing progress in the developer panel',async()=>{
    const s=await setup();await s.prepare()
    fireEvent.click(screen.getByRole('button',{name:'就位调试'}))
    const frame=s.sequence.hold(175,0,100)[0];frame.landmarks[27].visibility=.45;s.feed([frame])
    await waitFor(()=>expect(screen.getByLabelText('就位调试面板').textContent).toContain('左踝可信度不足'))
    expect(screen.getByLabelText('就位调试面板').textContent).toContain('是（不等于就位成功）')
    s.stand()
    await waitFor(()=>expect(screen.getByLabelText('就位调试面板').textContent).toContain('0.8 / 2.0 秒'))
    fireEvent.click(screen.getByRole('button',{name:'收起就位调试'}))
    expect(screen.queryByLabelText('就位调试面板')).toBeNull()
  })
  it('shows framing instructions instead of continuing to ask an out-of-frame user to wait',async()=>{
    const s=await setup();await s.prepare();s.stand()
    const frame=s.sequence.hold(175,0,100)[0];frame.landmarks[23].x=-.1;frame.landmarks[28].visibility=.02
    s.feed([frame])
    expect(document.querySelector('.ready-overlay strong')?.textContent).toBe('请调整取景')
    expect(document.querySelector('.battle-recognition')?.textContent).toContain('让肩膀和双脚同时完整入镜')
    expect(countText()).toContain('0 / 10');expect(hp()).toBe('100')
    s.feed(s.sequence.hold(175,0,5200));s.rep()
    expect(countText()).toContain('1 / 10')
  })
  it('starts with borderline standing knees and counts the first real squat without another 160 entry calibration',async()=>{
    const s=await setup();await s.prepare()
    s.feed(s.sequence.hold(165,0,400))
    s.feed(s.sequence.hold(162.8,0,5200,158.9))
    expect(document.querySelector('.real-counting-indicator')).toBeTruthy()
    expect(countText()).toContain('0 / 10')
    s.feed(s.sequence.hold(140,.04,400));s.feed(s.sequence.hold(95,.14,600));s.feed(s.sequence.hold(135,.06,400))
    s.feed(s.sequence.hold(157,0,800));expect(countText()).toContain('1 / 10')
    s.feed(s.sequence.hold(175,0,800));expect(countText()).toContain('1 / 10')
    expect(hp()).toBe('90');expect(audio.strike).toHaveBeenCalledTimes(1)
  })
  it('starts while knees are bent, keeps preparation at zero, and waits for normal counter calibration before attacking',async()=>{
    const s=await setup();await s.prepare()
    s.feed(s.sequence.hold(130,.1,5200))
    expect(document.querySelector('.real-counting-indicator')).toBeTruthy()
    expect(countText()).toContain('0 / 10');expect(hp()).toBe('100')
    expect(document.querySelector('.battle-recognition strong')?.textContent).toContain('准备下蹲')
    s.stand();s.rep();expect(countText()).toContain('1 / 10');expect(hp()).toBe('90')
  })
  it('passes moderate-confidence hip-only motion from the worker into a real attack',async()=>{
    const s=await setup();await s.start()
    const feedHip=(frames:PoseFrame[])=>s.feed(frames.map(frame=>{frame.worldLandmarks=[];frame.landmarks.forEach(p=>p.visibility=.55);return frame}))
    feedHip(s.sequence.hold(175,.04,700));feedHip(s.sequence.hold(175,0,800))
    expect(countText()).toContain('1 / 10');expect(hp()).toBe('90');expect(audio.strike).toHaveBeenCalledTimes(1)
  })
})
