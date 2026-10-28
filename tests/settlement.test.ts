import { createElement } from 'react'
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import BattleResult from '../src/settlement/BattleResult'
const result={roundId:'unit-round-123456',count:10,seconds:75,mode:'real' as const,defeated:true}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
describe('battle settlement is immutable and AI is explicitly requested once',()=>{
  it('shows actual stats and local entertainment without auto-spending API calls',()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
    const replay=vi.fn();render(createElement(BattleResult,{result,onReplay:replay}))
    const panel=screen.getByRole('region',{name:'战斗结算'})
    expect(panel.textContent).toContain('10 次');expect(panel.textContent).toContain('01:15');expect(panel.textContent).toContain('已击败')
    expect(panel.textContent).toContain('本局 AI 战报尚未生成');expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'再次挑战'}));expect(replay).toHaveBeenCalledOnce()
  })
  it('requests on click only and protects rapid repeated clicks',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({title:'萌芽破关者',review:'团子举起白旗，把萌芽森林的通行证交到了你的手上。今天这段冒险，值得写进森林日记。',monsterLine:'我的午睡计划又泡汤啦！',source:'ai',receipt:{id:'unit-request-123',source:'ai',model:'qwen-flash',generatedAt:'2026-10-28T12:00:00.000Z'}})})
    vi.stubGlobal('fetch',fetch);render(createElement(BattleResult,{result,onReplay:vi.fn()}))
    const button=screen.getByRole('button',{name:'召唤 AI 战报 · 每局一次'})
    fireEvent.click(button);fireEvent.click(button)
    await waitFor(()=>expect(screen.getByText('百炼 AI 已生成')).toBeTruthy())
    expect(screen.getByText(/我的午睡计划又泡汤啦/)).toBeTruthy()
    expect(screen.getByText(/服务端请求编号/).textContent).toContain('unit-request-123')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({roundId:result.roundId,count:10,seconds:75,mode:'real'})
    fireEvent.click(screen.getByRole('button',{name:'收起战报，回看战场'}));fireEvent.click(screen.getByRole('button',{name:'查看本局战报'}))
    expect((screen.getByRole('button',{name:'AI 战报已生成 · 本局不再重复调用'}) as HTMLButtonElement).disabled).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('keeps local results after network or schema failure',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('offline')))
    render(createElement(BattleResult,{result,onReplay:vi.fn()}))
    fireEvent.click(screen.getByRole('button',{name:'召唤 AI 战报 · 每局一次'}))
    await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('本地战报'))
    expect(screen.getByText('本地备用战报 · 非 AI 生成')).toBeTruthy();expect(screen.getByText('01:15')).toBeTruthy()
  })
  it('rejects an unsafe AI payload and preserves verified game stats',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({source:'ai',title:'燃脂大师',review:'这段内容编造了热量消耗，不应该出现在游戏中。'})}))
    render(createElement(BattleResult,{result,onReplay:vi.fn()}))
    fireEvent.click(screen.getByRole('button',{name:'召唤 AI 战报 · 每局一次'}))
    await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('本地战报'))
    expect(screen.queryByText('燃脂大师')).toBeNull();expect(screen.getByText('01:15')).toBeTruthy()
  })
  it('does not label a source-only payload without a generation receipt as verified AI',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({source:'ai',title:'空口战报',review:'虽然这个对象自称来自模型，却没有对应的服务端生成凭证。'})}))
    render(createElement(BattleResult,{result,onReplay:vi.fn()}))
    fireEvent.click(screen.getByRole('button',{name:'召唤 AI 战报 · 每局一次'}))
    await waitFor(()=>expect(screen.getByText('本地备用战报 · 非 AI 生成')).toBeTruthy())
    expect(screen.queryByText('百炼 AI 已生成')).toBeNull()
  })
  it('labels demo results and never exposes an AI spending action in demo mode',()=>{
    vi.stubGlobal('fetch',vi.fn());render(createElement(BattleResult,{result:{...result,mode:'demo'},onReplay:vi.fn()}))
    expect(screen.getByText(/按钮演示结果/)).toBeTruthy()
    expect(screen.queryByRole('button',{name:'召唤 AI 战报 · 每局一次'})).toBeNull()
  })
  it('aborts an old round request when starting a new round',async()=>{
    let signal:AbortSignal|undefined
    vi.stubGlobal('fetch',vi.fn((_url,options)=>{signal=options.signal;return new Promise(()=>{})}))
    const view=render(createElement(BattleResult,{result,onReplay:vi.fn()}))
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'召唤 AI 战报 · 每局一次'})))
    view.unmount();expect(signal?.aborted).toBe(true)
  })
})
