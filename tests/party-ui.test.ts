import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { makeSequence } from './squat-fixtures'

class FakeWorker {
  static instances: FakeWorker[]=[]
  onmessage: ((event:MessageEvent)=>void)|null=null
  postMessage=vi.fn();terminate=vi.fn()
  constructor(){FakeWorker.instances.push(this)}
  reply(data:unknown){this.onmessage?.({data} as MessageEvent)}
}
let track: {stop:ReturnType<typeof vi.fn>}
let getMedia: ReturnType<typeof vi.fn>
beforeEach(()=>{
  FakeWorker.instances=[]
  track=Object.assign(new EventTarget(),{stop:vi.fn()})
  getMedia=vi.fn().mockResolvedValue({getTracks:()=>[track],getVideoTracks:()=>[track]})
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:getMedia}})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true})
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({clearRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),arc:vi.fn(),fill:vi.fn()} as unknown as CanvasRenderingContext2D)
  vi.spyOn(performance,'now').mockReturnValue(0)
  vi.stubGlobal('Worker',FakeWorker);vi.stubGlobal('OffscreenCanvas',class{});vi.stubGlobal('createImageBitmap',vi.fn())
  vi.stubGlobal('fetch',vi.fn())
})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function setupParty(names=['测试甲','测试乙']) {
  render(createElement(App))
  fireEvent.click(screen.getByRole('button',{name:'创建本地派对'}))
  fireEvent.change(screen.getByLabelText('玩家人数'),{target:{value:String(names.length)}})
  names.forEach((name,i)=>fireEvent.change(screen.getByLabelText(`玩家 ${i+1} 昵称`),{target:{value:name}}))
  fireEvent.click(screen.getByRole('button',{name:'创建派对 · 进入第一关'}))
}
async function camera() {
  fireEvent.click(screen.getByRole('button',{name:'开启摄像头'}))
  await waitFor(()=>expect(FakeWorker.instances.length).toBe(1))
  const worker=FakeWorker.instances[0];act(()=>worker.reply({type:'ready'}))
  const sequence=makeSequence()
  const feed=(angle:number,drop:number,ms:number)=>act(()=>sequence.hold(angle,drop,ms).forEach(frame=>worker.reply({type:'result',...frame})))
  const start=()=>{fireEvent.click(screen.getByRole('button',{name:'准备挑战'}));feed(175,0,5500)}
  const rep=()=>{feed(175,0,500);feed(130,.08,500);feed(175,0,700)}
  return {feed,start,rep,worker}
}
const hp=()=>screen.getByRole('progressbar',{name:'派对怪兽生命值'}).getAttribute('aria-valuenow')
const current=()=>document.querySelector('.party-current')!.textContent

describe('party first level UI + real counter + existing camera integration (synthetic landmarks)',()=>{
  it('validates names and creates up to six local players without opening a camera',()=>{
    render(createElement(App));fireEvent.click(screen.getByRole('button',{name:'创建本地派对'}))
    fireEvent.click(screen.getByRole('button',{name:'创建派对 · 进入第一关'}))
    expect(screen.getByRole('alert').textContent).toContain('昵称')
    fireEvent.change(screen.getByLabelText('玩家人数'),{target:{value:'6'}})
    for(let i=0;i<6;i++)fireEvent.change(screen.getByLabelText(`玩家 ${i+1} 昵称`),{target:{value:i===0?'<script>':'队友'}})
    fireEvent.click(screen.getByRole('button',{name:'创建派对 · 进入第一关'}))
    expect(hp()).toBe('120');expect(getMedia).not.toHaveBeenCalled()
    expect(document.querySelectorAll('.party-roster article')).toHaveLength(6)
    expect(document.querySelector('.party-roster script')).toBeNull()
    expect(current()).toContain('<script>')
  })
  it('retains single-player 10-rep mode after visiting party setup',()=>{
    render(createElement(App));fireEvent.click(screen.getByRole('button',{name:'创建本地派对'}))
    fireEvent.click(screen.getByRole('button',{name:'返回单人模式'}))
    expect(screen.getByRole('progressbar',{name:'怪兽生命值'}).getAttribute('aria-valuemax')).toBe('100')
    expect(screen.getByText('完成 10 次深蹲')).toBeTruthy()
    expect(screen.getByRole('button',{name:'按钮演示'})).toBeTruthy()
  })
  it('hands off only after two genuine cycles and explicit next + new preparation',async()=>{
    setupParty();const s=await camera();s.feed(130,.08,1000);s.feed(175,0,1000);expect(hp()).toBe('40')
    s.start();s.rep();expect(hp()).toBe('30');expect(current()).toContain('1 / 2')
    s.rep();expect(hp()).toBe('20');expect(screen.getByRole('button',{name:'下一位玩家'})).toBeTruthy()
    s.rep();expect(hp()).toBe('20')
    fireEvent.click(screen.getByRole('button',{name:'下一位玩家'}));expect(current()).toContain('测试乙')
    s.rep();expect(hp()).toBe('20');s.start();s.rep();expect(hp()).toBe('10')
    expect(document.querySelectorAll('.party-roster article')[0].textContent).toContain('2 / 2')
  })
  it('retains a partial contribution across skip and blocks all-skipped with three escape options',async()=>{
    setupParty();const s=await camera();s.start();s.rep()
    fireEvent.click(screen.getByRole('button',{name:'跳过本回合'}));expect(current()).toContain('测试乙');expect(hp()).toBe('30')
    fireEvent.click(screen.getByRole('button',{name:'跳过本回合'}));expect(current()).toContain('本关已暂停')
    for(const name of ['继续挑战','休息','退出本关'])expect(screen.getByRole('button',{name})).toBeTruthy()
    s.rep();expect(hp()).toBe('30')
    fireEvent.click(screen.getByRole('button',{name:'继续挑战'}));expect(current()).toContain('测试甲')
    s.start();s.rep();expect(hp()).toBe('20');expect(current()).toContain('回合完成')
  })
  it('pauses and discards a half action; continued play needs preparation and a new cycle',async()=>{
    setupParty();const s=await camera();s.start();s.rep();s.feed(130,.08,700)
    fireEvent.click(screen.getByRole('button',{name:'休息'}));s.feed(175,0,2000);s.rep();expect(hp()).toBe('30')
    fireEvent.click(screen.getByRole('button',{name:'继续挑战'}));s.feed(175,0,6000);expect(hp()).toBe('30')
    s.start();s.feed(175,0,1000);expect(hp()).toBe('30');s.rep();expect(hp()).toBe('20')
  })
  it('wins only the first level and never calls AI or unlocks another playable level',async()=>{
    setupParty();const s=await camera();s.start();s.rep();s.rep()
    fireEvent.click(screen.getByRole('button',{name:'下一位玩家'}));s.start();s.rep();s.rep()
    expect(hp()).toBe('0');expect(screen.getByText('第一关合作完成')).toBeTruthy()
    expect(screen.getByText(/第二关及团队 AI 战报尚未开发/)).toBeTruthy()
    expect(screen.queryByRole('button',{name:/下一关|生成.*战报/})).toBeNull()
    s.rep();expect(hp()).toBe('0');expect(fetch).not.toHaveBeenCalled()
  })
  it('retains camera and party progress through immersive entry/exit, with voice test available',async()=>{
    setupParty();const s=await camera();s.start();s.rep()
    const video=screen.getByLabelText('本地摄像头实时画面')
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'战斗大屏'}))})
    expect(screen.getByRole('dialog',{name:'沉浸式游戏战斗模式'})).toBeTruthy()
    expect(screen.getByRole('button',{name:'测试语音'})).toBeTruthy()
    expect(screen.getByText('当前玩家 · #1 测试甲')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'退出大屏'}))
    expect(screen.getByLabelText('本地摄像头实时画面')).toBe(video)
    expect(hp()).toBe('30');expect(getMedia).toHaveBeenCalledTimes(1)
  })
  it('exit confirmation pauses first; confirmed exit stops camera, preserves actual incomplete summary',async()=>{
    setupParty();const s=await camera();s.start();s.rep()
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'战斗大屏'}))})
    fireEvent.click(screen.getByRole('button',{name:'退出本关'}));s.rep();expect(hp()).toBe('30')
    expect(screen.getByRole('dialog',{name:'退出本关？'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'确认退出本关'}))
    expect(screen.getByText('本关已退出 · 未通关')).toBeTruthy()
    expect(track.stop).toHaveBeenCalledOnce();expect(s.worker.terminate).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog',{name:'沉浸式游戏战斗模式'})).toBeNull()
    expect(screen.getByRole('region',{name:'小队贡献'}).textContent).toContain('1 / 2')
    expect(fetch).not.toHaveBeenCalled()
  })
})

it('switching from the old camera to party setup releases the original stream before a new request',async()=>{
  render(createElement(App));const old=await camera()
  fireEvent.click(screen.getByRole('button',{name:'创建本地派对'}))
  expect(track.stop).toHaveBeenCalledOnce();expect(old.worker.terminate).toHaveBeenCalledOnce()
  expect(getMedia).toHaveBeenCalledTimes(1)
  for(let i=0;i<2;i++)fireEvent.change(screen.getByLabelText(`玩家 ${i+1} 昵称`),{target:{value:`P${i+1}`}})
  fireEvent.click(screen.getByRole('button',{name:'创建派对 · 进入第一关'}))
  expect(getMedia).toHaveBeenCalledTimes(1)
})
