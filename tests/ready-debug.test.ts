import { createElement } from 'react'
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import ReadyDebug from '../src/game/ReadyDebug'
import { ReadyGate } from '../src/game/ReadyGate'
import { poseFrame } from './squat-fixtures'

afterEach(()=>{cleanup();vi.useRealTimers()})
describe('readable diagnostics after walking back to the computer',()=>{
  it('freezes numeric data and recognition state together, then can resume',()=>{
    vi.useFakeTimers()
    const gate=new ReadyGate();gate.prepare();const frame=poseFrame(100);frame.landmarks[27].visibility=.45;gate.update(frame)
    const view=render(createElement(ReadyDebug,{gate,gameState:'waiting',recognized:true}))
    fireEvent.click(screen.getByRole('button',{name:'就位调试'}))
    fireEvent.click(screen.getByRole('button',{name:'冻结当前数据'}))
    gate.update({...poseFrame(200),landmarks:[]})
    view.rerender(createElement(ReadyDebug,{gate,gameState:'waiting',recognized:false}))
    act(()=>vi.advanceTimersByTime(400))
    expect(screen.getByLabelText('就位调试面板').textContent).toContain('是（不等于就位成功）')
    expect(screen.getByLabelText('就位调试面板').textContent).toContain('左踝可信度不足')
    fireEvent.click(screen.getByRole('button',{name:'恢复实时'}))
    expect(screen.getByLabelText('就位调试面板').textContent).toContain('左肩关键点丢失')
  })
  it('allows 5 seconds to walk away, records 10 seconds, and keeps results when the person approaches',()=>{
    vi.useFakeTimers()
    const gate=new ReadyGate();gate.prepare()
    render(createElement(ReadyDebug,{gate,gameState:'waiting',recognized:true}))
    fireEvent.click(screen.getByRole('button',{name:'就位调试'}))
    fireEvent.click(screen.getByRole('button',{name:'远距离诊断（自动冻结）'}))
    const frame=poseFrame(100);frame.landmarks[27].visibility=.45;gate.update(frame)
    act(()=>vi.advanceTimersByTime(5000))
    expect(screen.getByText(/正在记录，请保持站位/)).toBeTruthy()
    act(()=>vi.advanceTimersByTime(10000))
    expect(screen.getByText('诊断已结束并冻结；现在可以走近查看')).toBeTruthy()
    expect(screen.getByLabelText('远距离诊断结果').textContent).toContain('左踝可信度不足')
    gate.update({...poseFrame(200),landmarks:[]})
    act(()=>vi.advanceTimersByTime(1000))
    expect(screen.getByLabelText('远距离诊断结果').textContent).not.toContain('左肩关键点丢失')
    expect(screen.getByRole('button',{name:'恢复实时'})).toBeTruthy()
  })
})
