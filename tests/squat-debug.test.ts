import { createElement } from 'react'
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react'
import { afterEach,expect,it,vi } from 'vitest'
import SquatDebug from '../src/squat/SquatDebug'
import { SquatCounter } from '../src/squat/SquatCounter'
import { makeSequence } from './squat-fixtures'
afterEach(()=>{cleanup();vi.useRealTimers()})
it('shows motion diagnostics, can freeze them, and retains completed motion events',()=>{
  vi.useFakeTimers();const counter=new SquatCounter(),sequence=makeSequence()
  sequence.hold(158,0,1000).forEach(f=>counter.update(f))
  sequence.hold(145,.04,600).forEach(f=>counter.update(f))
  sequence.hold(158,0,700).forEach(f=>counter.update(f))
  render(createElement(SquatDebug,{counter}))
  fireEvent.click(screen.getByRole('button',{name:'动作调试'}))
  expect(screen.getByLabelText('正式动作调试面板').textContent).toContain('成功！+1')
  fireEvent.click(screen.getByRole('button',{name:'冻结动作数据'}));counter.interrupt()
  act(()=>vi.advanceTimersByTime(400))
  expect(screen.getByLabelText('正式动作调试面板').textContent).not.toContain('计数暂停')
  fireEvent.click(screen.getByRole('button',{name:'恢复动作数据'}))
  expect(screen.getByLabelText('正式动作调试面板').textContent).toContain('计数暂停')
})
