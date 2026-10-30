import { createElement } from 'react'
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import App from '../src/App'
import { createQuizService } from '../server/quiz.mjs'
import { QUIZ_SAVE_KEY } from '../src/party/quizClient'
import { makeSequence } from './squat-fixtures'

class FakeWorker {
  static instances:FakeWorker[]=[]
  onmessage:((e:MessageEvent)=>void)|null=null
  postMessage=vi.fn();terminate=vi.fn()
  constructor(){FakeWorker.instances.push(this)}
  reply(data:unknown){this.onmessage?.({data} as MessageEvent)}
}
let media:ReturnType<typeof vi.fn>,provider:ReturnType<typeof vi.fn>,frontend:ReturnType<typeof vi.fn>
let service:ReturnType<typeof createQuizService>,verdict='correct',questions=0
let filename=''
beforeEach(()=>{
  sessionStorage.clear();FakeWorker.instances=[];verdict='correct';questions=0
  const track=Object.assign(new EventTarget(),{stop:vi.fn()})
  media=vi.fn().mockResolvedValue({getTracks:()=>[track],getVideoTracks:()=>[track]})
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:media}})
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true})
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({clearRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),arc:vi.fn(),fill:vi.fn()} as unknown as CanvasRenderingContext2D)
  vi.spyOn(performance,'now').mockReturnValue(0)
  vi.stubGlobal('Worker',FakeWorker);vi.stubGlobal('OffscreenCanvas',class{});vi.stubGlobal('createImageBitmap',vi.fn())
  provider=vi.fn(async(_url,req)=>{
    const messages=JSON.parse(req.body).messages,question=messages[0].content.includes('出题员')
    const value=question?{question:`集成测试合成题目${++questions}`,referenceAnswer:'隐藏参考不可出现在页面',keyPoints:['合成核心'],explanation:'隐藏出题解释',topic:'warmup',difficulty:JSON.parse(messages[1].content).difficulty,answerability:'clear'}:
      {verdict,basis:verdict==='correct'?'matches_core':verdict==='incorrect'?'contradicts_core':'insufficient',explanation:'合成判定理由',monsterReaction:'合成怪兽认输反馈'}
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}))
  })
  filename=path.resolve('.npm-cache/quiz-ui-tests',randomUUID(),'state.json')
  service=createQuizService({filename,fetchImpl:provider,now:()=>Date.parse('2026-10-29T00:00Z')+provider.mock.calls.length*61000,
    env:{GYMGO_QUIZ_ENABLED:'true',DASHSCOPE_API_KEY:'fixture-not-a-real-key',QUIZ_APPROVED_CALLS:'100',QUIZ_BUDGET_CNY:'1',QUIZ_INPUT_CNY_PER_MILLION:'.1',QUIZ_OUTPUT_CNY_PER_MILLION:'.2',QUIZ_PRICE_CHECKED_ON:'2026-10-29'}})
  frontend=vi.fn(async(url,req)=>{
    const route=String(url).split('/').at(-1),input=req?.body?JSON.parse(req.body):{},token=req?.headers?.['X-Party-Token']
    const value=route==='status'?service.capability():route==='party'?service.createParty(input.players):
      route==='question'||route==='judge'?await service.evaluate(input,token):service.sessionAction(route,input.partyId,token,input)
    return new Response(JSON.stringify(value),{status:value.error?409:200})
  });vi.stubGlobal('fetch',frontend)
})
afterEach(()=>{cleanup();service.close();sessionStorage.clear();vi.unstubAllGlobals()})
async function setup(){
  render(createElement(App));fireEvent.click(screen.getByRole('button',{name:'创建本地派对'}))
  fireEvent.change(screen.getByLabelText('玩家 1 昵称'),{target:{value:'合成甲'}});fireEvent.change(screen.getByLabelText('玩家 2 昵称'),{target:{value:'合成乙'}})
  fireEvent.click(screen.getByLabelText('开启 AI 知识挑战（本地）'))
  await waitFor(()=>expect(screen.getByRole('button',{name:'创建派对 · 进入第一关'}).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'创建派对 · 进入第一关'}));await screen.findByRole('button',{name:'准备挑战'})
}
async function camera(){
  // Flush mocked permission/video promises inside React act before checking worker creation.
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'开启摄像头'}))});await waitFor(()=>expect(FakeWorker.instances).toHaveLength(1),{timeout:3000})
  const worker=FakeWorker.instances[0];act(()=>worker.reply({type:'ready'}));const seq=makeSequence()
  const feed=(angle:number,drop:number,ms:number)=>act(()=>seq.hold(angle,drop,ms).forEach(f=>worker.reply({type:'result',...f})))
  return {start:()=>{fireEvent.click(screen.getByRole('button',{name:'准备挑战'}));feed(175,0,5500)},rep:()=>{feed(175,0,500);feed(130,.08,500);feed(175,0,700)}}
}
async function answer(){
  const input=await screen.findByLabelText('你的简短答案')
  fireEvent.change(input,{target:{value:'这是合成短答案'}})
  fireEvent.click(screen.getByRole('button',{name:/^(提交答案|再次判题)$/}))
}
const hp=()=>screen.getByRole('progressbar',{name:'派对怪兽生命值'}).getAttribute('aria-valuenow')

describe('actual UI + local service + original pose counter; model is a fixture',()=>{
  it('plays all three AI levels through actual UI, preserving camera, difficulty and final totals',async()=>{
    await setup();const c=await camera()
    for(let level=0;level<3;level++){
      expect(hp()).toBe(String((level+2)*20))
      for(let player=0;player<2;player++){
        await screen.findByRole('button',{name:'准备挑战'},{timeout:3000});c.start()
        for(let count=0;count<level+2;count++)c.rep()
        await screen.findByLabelText('你的简短答案');expect(document.querySelector('.camp-standby')).toBeTruthy()
        if(player===1){expect(hp()).toBe('0');expect(screen.queryByText('三关全通！小队凯旋')).toBeNull()}
        await answer()
        await screen.findByText('Bingo！')
        await waitFor(()=>expect(document.querySelector('.quiz-bingo')).toBeNull(),{timeout:3000})
      }
      if(level<2){fireEvent.click(await screen.findByRole('button',{name:'下一关 · '+['幽灵秘境','巨龙城堡'][level]}));await waitFor(()=>expect(hp()).toBe(String((level+3)*20)))}
    }
    await screen.findByRole('heading',{name:'三关全通！小队凯旋'})
    expect(provider).toHaveBeenCalledTimes(12);expect(media).toHaveBeenCalledTimes(1)
    const difficulties=provider.mock.calls.map(c=>JSON.parse(c[1].body).messages).filter(m=>m[0].content.includes('出题员')).map(m=>JSON.parse(m[1].content).difficulty)
    expect(difficulties).toEqual([1,1,2,2,3,3])
    expect(screen.getByRole('table',{name:'最终全队贡献'}).textContent).toContain('9')
  },15000)
  it('speaks Bingo once then automatically hands over, with inference standby during the question',async()=>{
    const spoken:SpeechSynthesisUtterance[]=[]
    vi.stubGlobal('SpeechSynthesisUtterance',class{constructor(public text:string){}})
    vi.stubGlobal('speechSynthesis',{getVoices:()=>[{localService:true,lang:'zh-CN'}],speak:vi.fn(u=>spoken.push(u)),cancel:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()})
    await setup();const c=await camera();c.start();c.rep();c.rep();await screen.findByLabelText('你的简短答案')
    expect(document.querySelector('.camp-standby')).toBeTruthy()
    const before=spoken.length;c.rep();expect(spoken).toHaveLength(before)
    await answer();await screen.findByText('Bingo！')
    const bingo=spoken.filter(u=>u.text==='Bingo！');expect(bingo).toHaveLength(1)
    await act(async()=>{bingo[0].onend?.({} as SpeechSynthesisEvent)})
    await screen.findByRole('button',{name:'准备挑战'});expect(document.querySelector('.party-current')?.textContent).toContain('合成乙')
    expect(document.querySelector('.camp-standby')).toBeNull();expect(media).toHaveBeenCalledTimes(1)
  })
  it('speaks exactly the incorrect monster text once and keeps the failure screen',async()=>{
    const spoken:SpeechSynthesisUtterance[]=[]
    vi.stubGlobal('SpeechSynthesisUtterance',class{constructor(public text:string){}})
    vi.stubGlobal('speechSynthesis',{getVoices:()=>[{localService:true,lang:'zh-CN'}],speak:vi.fn(u=>spoken.push(u)),cancel:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()})
    await setup();const c=await camera();c.start();c.rep();c.rep();verdict='incorrect';await answer()
    await screen.findByRole('heading',{name:'挑战失败'});const lines=spoken.filter(u=>u.text==='合成怪兽认输反馈')
    expect(lines).toHaveLength(1);expect(document.querySelector('.quiz-invasion')).toBeTruthy()
    await act(async()=>{lines[0].onend?.({} as SpeechSynthesisEvent)})
    expect(screen.getByRole('heading',{name:'挑战失败'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'重新挑战本关'}));await screen.findByRole('button',{name:'准备挑战'})
    expect(document.querySelector('.camp-standby')).toBeNull();expect(media).toHaveBeenCalledTimes(1)
  })
  it('waits at zero HP for the last answer and advances only after both actual judgments',async()=>{
    await setup();const c=await camera();c.start();c.rep();c.rep()
    await screen.findByLabelText('你的简短答案');expect(hp()).toBe('20')
    expect(screen.queryByText('隐藏参考不可出现在页面')).toBeNull();c.rep();expect(hp()).toBe('20')
    await answer();await screen.findByText('合成怪兽认输反馈')
    expect(screen.getByText('合成怪兽认输反馈')).toBeTruthy()
    await screen.findByRole('button',{name:'准备挑战'},{timeout:3000});c.start();c.rep();c.rep()
    await screen.findByLabelText('你的简短答案');expect(hp()).toBe('0');expect(screen.queryByRole('button',{name:'下一关 · 幽灵秘境'})).toBeNull()
    await answer();fireEvent.click(await screen.findByRole('button',{name:'下一关 · 幽灵秘境'}))
    await waitFor(()=>expect(hp()).toBe('60'));expect(media).toHaveBeenCalledTimes(1);expect(provider).toHaveBeenCalledTimes(4)
    expect(JSON.stringify(frontend.mock.calls)).not.toContain('隐藏参考')
  })
  it('shows full-screen failure only for incorrect and resets this level through the server guard',async()=>{
    await setup();const c=await camera();c.start();c.rep();c.rep();verdict='incorrect';await answer()
    await screen.findByRole('heading',{name:'挑战失败'});expect(document.querySelector('.quiz-invasion')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'重新挑战本关'}));await screen.findByRole('button',{name:'准备挑战'})
    expect(hp()).toBe('40');expect(provider).toHaveBeenCalledTimes(2)
    c.start();c.rep();c.rep();await screen.findByLabelText('你的简短答案')
    expect(provider).toHaveBeenCalledTimes(3)
  })
  it('keeps uncertain on the same question; rest/resume does not count or regenerate',async()=>{
    await setup();const c=await camera();c.start();c.rep();c.rep();verdict='uncertain';await answer()
    await screen.findByRole('heading',{name:'暂时无法确定'});const original=screen.getByText('集成测试合成题目1').textContent
    fireEvent.click(screen.getByRole('button',{name:'休息'}));c.rep();expect(hp()).toBe('20')
    fireEvent.click(screen.getByRole('button',{name:'继续挑战'}));expect(screen.getByText(original!)).toBeTruthy()
    expect(provider).toHaveBeenCalledTimes(2);verdict='correct';await answer();await screen.findByRole('button',{name:'准备挑战'},{timeout:3000})
    expect(provider).toHaveBeenCalledTimes(3)
  })
  it('restores the same question after remount without requesting a camera or new model question',async()=>{
    await setup();const c=await camera();c.start();c.rep();c.rep();await screen.findByLabelText('你的简短答案')
    const original=screen.getByText('集成测试合成题目1').textContent;expect(sessionStorage.getItem(QUIZ_SAVE_KEY)).toBeTruthy()
    cleanup();render(createElement(App));fireEvent.click(screen.getByRole('button',{name:'创建本地派对'}))
    fireEvent.click(screen.getByRole('button',{name:'恢复上次 AI 派对'}));await screen.findByRole('button',{name:'继续挑战'})
    expect(media).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button',{name:'继续挑战'}));await screen.findByLabelText('你的简短答案')
    expect(screen.getByText(original!)).toBeTruthy();expect(provider).toHaveBeenCalledTimes(1)
    await answer();await screen.findByRole('button',{name:'准备挑战'},{timeout:3000});expect(provider).toHaveBeenCalledTimes(2)
  })
  it('never turns provider failure into defeat or a local preset question; exit is available',async()=>{
    await setup();provider.mockRejectedValue(Error('simulated offline'))
    const c=await camera();c.start();c.rep();c.rep()
    await screen.findByRole('button',{name:'重试出题（可能消耗额度）'})
    expect(screen.queryByRole('heading',{name:'挑战失败'})).toBeNull();expect(screen.queryByLabelText('你的简短答案')).toBeNull()
    expect(provider).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button',{name:'安全退出问答'}));await screen.findByRole('button',{name:'创建派对 · 进入第一关'})
    expect(sessionStorage.getItem(QUIZ_SAVE_KEY)).toBeNull()
  })
  it('handles disabled capability without a provider request',async()=>{
    frontend.mockResolvedValueOnce(new Response(JSON.stringify({enabled:false,notice:'未批准测试额度'})))
    render(createElement(App));fireEvent.click(screen.getByRole('button',{name:'创建本地派对'}));fireEvent.click(screen.getByLabelText('开启 AI 知识挑战（本地）'))
    await screen.findByText('未批准测试额度');expect(screen.getByRole('button',{name:'创建派对 · 进入第一关'}).hasAttribute('disabled')).toBe(true)
    cleanup();await setup()
    expect(provider).not.toHaveBeenCalled()
    expect(fs.existsSync(filename)).toBe(true)
  })
  it('blocks model requests when the browser cannot save the operation before sending it',async()=>{
    await setup();const c=await camera()
    const save=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('simulated quota error')})
    try{
      c.start();c.rep();c.rep();await screen.findByRole('button',{name:'重试出题（可能消耗额度）'})
      expect(provider).not.toHaveBeenCalled();expect(screen.getByText(/浏览器进度保存失败/)).toBeTruthy()
    }finally{save.mockRestore()}
  })
})
