import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { makeSequence } from './squat-fixtures'
import { headFrame } from './hat-fixtures'
import { HeadTracker } from '../src/ar/headTracking'
import type { HatId } from '../src/ar/hats'

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
function setupParty(names=['测试甲','测试乙'], hats?:HatId[]) {
  render(createElement(App))
  fireEvent.click(screen.getByRole('button',{name:'创建本地派对'}))
  fireEvent.change(screen.getByLabelText('玩家人数'),{target:{value:String(names.length)}})
  names.forEach((name,i)=>fireEvent.change(screen.getByLabelText(`玩家 ${i+1} 昵称`),{target:{value:name}}))
  hats?.forEach((hat,i)=>fireEvent.change(screen.getByLabelText(`玩家 ${i+1} 帽子`),{target:{value:hat}}))
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
    expect(screen.getByLabelText('派对 AR 帽子叠加层').getAttribute('data-hat')).toBe('pirate')
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
  it('wins the first level once and unlocks the guarded second-level entry without AI',async()=>{
    setupParty();const s=await camera();s.start();s.rep();s.rep()
    fireEvent.click(screen.getByRole('button',{name:'下一位玩家'}));s.start();s.rep();s.rep()
    expect(hp()).toBe('0');expect(screen.getByText('第一关合作完成')).toBeTruthy()
    expect(screen.getByRole('button',{name:'下一关 · 幽灵秘境'})).toBeTruthy()
    expect(screen.queryByRole('button',{name:/生成.*战报/})).toBeNull()
    s.rep();expect(hp()).toBe('0');expect(fetch).not.toHaveBeenCalled()
  })
  it('retains camera and party progress through immersive entry/exit, with voice test available',async()=>{
    setupParty();const s=await camera();s.start();s.rep()
    const video=screen.getByLabelText('本地摄像头实时画面')
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'战斗大屏'}))})
    expect(screen.getByRole('dialog',{name:'沉浸式游戏战斗模式'})).toBeTruthy()
    expect(screen.getByRole('button',{name:'语音试听'})).toBeTruthy()
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


describe('party hat wiring without changing accepted game rules',()=>{
  it('stores all four chosen hats, while original single mode never mounts an overlay',()=>{
    render(createElement(App));expect(screen.queryByLabelText('派对 AR 帽子叠加层')).toBeNull();cleanup()
    setupParty(['P1','P2','P3','P4'],['crown','pirate','wizard','party'])
    expect(Array.from(document.querySelectorAll('.party-roster-hat')).map(el=>el.textContent)).toEqual(['皇冠','海盗帽','魔法帽','派对帽'])
    expect(screen.getByLabelText('派对 AR 帽子叠加层').getAttribute('data-hat')).toBe('crown')
    expect(getMedia).not.toHaveBeenCalled()
  })
  it('updates the hat on skip without restarting video; lost head hides and return restores',async()=>{
    setupParty(['P1','P2'],['wizard','party']);const s=await camera()
    const video=screen.getByLabelText('本地摄像头实时画面')
    Object.defineProperty(video,'videoWidth',{configurable:true,value:640});Object.defineProperty(video,'videoHeight',{configurable:true,value:480})
    const reply=(frame:ReturnType<typeof headFrame>)=>act(()=>s.worker.reply({type:'result',...frame}))
    reply(headFrame(100));let svg=screen.getByLabelText('派对 AR 帽子叠加层')
    expect(svg.querySelector('g')!.style.display).toBe('')
    fireEvent.click(screen.getByRole('button',{name:'跳过本回合'}));svg=screen.getByLabelText('派对 AR 帽子叠加层')
    expect(svg.getAttribute('data-hat')).toBe('party');expect(svg.getAttribute('data-player')).toBe('player-2')
    expect(svg.querySelector('g')!.style.display).toBe('none')
    reply(headFrame(200,.1));expect(svg.querySelector('g')!.style.display).toBe('')
    const lost=headFrame(300);lost.landmarks=[];reply(lost)
    expect(svg.querySelector('g')!.style.display).toBe('none')
    reply(headFrame(400));expect(svg.querySelector('g')!.style.display).toBe('')
    expect(screen.getByLabelText('本地摄像头实时画面')).toBe(video);expect(getMedia).toHaveBeenCalledTimes(1)
    expect(hp()).toBe('40')
    fireEvent.click(screen.getByRole('button',{name:'关闭摄像头'}));expect(svg.querySelector('g')!.style.display).toBe('none')
  })
  it('decoration failures cannot block automatic start, valid reps or attacks',async()=>{
    setupParty();const s=await camera()
    vi.spyOn(HeadTracker.prototype,'update').mockImplementation(()=>{throw new Error('synthetic decoration failure')})
    s.start();s.rep();expect(hp()).toBe('30');s.rep();expect(hp()).toBe('20')
    expect(screen.getByRole('button',{name:'下一位玩家'})).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})


describe('three-level actual UI progression with synthetic pose frames',()=>{
  it('completes the campaign, retains camera/hats, and settles exact player/team contributions once',async()=>{
    let now=100000;vi.spyOn(Date,'now').mockImplementation(()=>now)
    setupParty();const s=await camera();const video=screen.getByLabelText('本地摄像头实时画面')
    expect(screen.queryByRole('button',{name:/下一关/})).toBeNull()
    for(let level=0;level<3;level++){
      if(level){fireEvent.click(screen.getByRole('button',{name:level===1?'下一关 · 幽灵秘境':'下一关 · 巨龙城堡'}))}
      expect(hp()).toBe(String((level+2)*20))
      expect(screen.getByLabelText('本地摄像头实时画面')).toBe(video)
      expect(screen.getByLabelText('派对 AR 帽子叠加层').getAttribute('data-hat')).toBe('crown')
      if(level===1){expect(screen.getByRole('img',{name:'迷雾幽灵，受到 0 次真实攻击'})).toBeTruthy();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'战斗大屏'}))})}
      if(level===2)expect(screen.getByRole('img',{name:'城堡巨龙，受到 0 次真实攻击'})).toBeTruthy()
      for(let player=0;player<2;player++){
        if(player)fireEvent.click(screen.getByRole('button',{name:'下一位玩家'}))
        s.start();for(let rep=0;rep<level+2;rep++){if(level===2&&player===1&&rep===3)now=275000;s.rep()}
      }
      expect(hp()).toBe('0')
      if(level<2)expect(screen.queryByRole('dialog',{name:'三关全通！小队凯旋'})).toBeNull()
    }
    const final=screen.getByRole('dialog',{name:'三关全通！小队凯旋'})
    expect(final.textContent).toContain('18 次');expect(final.textContent).toContain('02:55')
    for(const reward of ['萌芽伙伴徽章','驱雾小队徽章','屠龙同盟徽章'])expect(within(final).getByText(reward)).toBeTruthy()
    const rows=within(within(final).getByRole('table',{name:'最终全队贡献'})).getAllByRole('row').slice(1)
    for(const row of rows)expect(within(row).getAllByRole('cell').map(cell=>cell.textContent)).toEqual(['2','3','4','9','50.0%'])
    expect(getMedia).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(final)
    fireEvent.keyDown(window,{key:'Escape'})
    expect(screen.queryByRole('dialog',{name:'三关全通！小队凯旋'})).toBeNull()
    expect(screen.getByRole('dialog',{name:'沉浸式游戏战斗模式'})).toBeTruthy()
    now=999000;s.rep();fireEvent.click(screen.getByRole('button',{name:'查看全队贡献'}))
    expect(screen.getByRole('dialog',{name:'三关全通！小队凯旋'}).textContent).toContain('02:55')
  })
  it('can rest after a level reward and still needs explicit next-level entry and preparation',async()=>{
    setupParty();const s=await camera();s.start();s.rep();s.rep();fireEvent.click(screen.getByRole('button',{name:'下一位玩家'}));s.start();s.rep();s.rep()
    fireEvent.click(screen.getByRole('button',{name:'休息'}));s.rep();expect(hp()).toBe('0')
    fireEvent.click(screen.getByRole('button',{name:'继续挑战'}))
    expect(screen.getByRole('button',{name:'下一关 · 幽灵秘境'})).toBeTruthy()
    expect(screen.queryByRole('button',{name:'准备挑战'})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'下一关 · 幽灵秘境'}));s.rep()
    expect(hp()).toBe('60');expect(current()).toContain('0 / 3')
    s.start();s.rep();expect(hp()).toBe('50')
    expect(screen.getByRole('region',{name:'小队贡献'}).textContent).toContain('累计 3 次')
  })
  it('retains earned badges on early exit but never displays final campaign victory',async()=>{
    setupParty();const s=await camera();s.start();s.rep();s.rep();fireEvent.click(screen.getByRole('button',{name:'下一位玩家'}));s.start();s.rep();s.rep()
    fireEvent.click(screen.getByRole('button',{name:'退出本关'}));fireEvent.click(screen.getByRole('button',{name:'确认退出本关'}))
    expect(screen.getByText('派对已结束 · 未完成三关')).toBeTruthy()
    expect(screen.getByText(/已获 1 枚徽章，保留奖励/)).toBeTruthy()
    expect(screen.queryByRole('dialog',{name:'三关全通！小队凯旋'})).toBeNull()
    expect(track.stop).toHaveBeenCalledOnce()
  })
})
