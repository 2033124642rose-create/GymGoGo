import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CameraState } from '../src/camera/CameraController'
import CameraCamp from '../src/camera/CameraCamp'
import { LocalCuePlayer } from '../src/camera/trainingFeedback'

const testSession = vi.hoisted(() => ({ update: undefined as ((state: CameraState) => void) | undefined }))
vi.mock('../src/camera/CameraController', () => ({ CameraController: class {
  constructor(_video: unknown, _canvas: unknown, onState: (state: CameraState) => void) { testSession.update = onState }
  stop() {}
  start() {}
} }))
const running = (tracking: CameraState['tracking']): CameraState => ({ phase: 'running', tracking,
  groups: { shoulders: true, hips: true, knees: true, ankles: tracking === 'tracked' }, message: '' })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('large status text and feedback wiring (simulated pose states, no camera)', () => {
  it('shows success / incomplete / lost in large mode and does not repeat speech every pose update', async () => {
    vi.useFakeTimers()
    const play = vi.spyOn(LocalCuePlayer.prototype, 'play').mockImplementation(() => {})
    render(createElement(CameraCamp))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '战斗大屏' })) })
    act(() => testSession.update?.(running('tracked')))
    expect(screen.getByText('识别成功', { exact: true })).toBeTruthy()
    act(() => vi.advanceTimersByTime(1200))
    expect(play).toHaveBeenCalledExactlyOnceWith('tracked')
    for (let i = 0; i < 20; i++) act(() => testSession.update?.(running('tracked')))
    act(() => vi.advanceTimersByTime(10_000))
    expect(play).toHaveBeenCalledTimes(1)
    act(() => testSession.update?.(running('partial')))
    expect(screen.getByText('请让全身入镜', { exact: true })).toBeTruthy()
    act(() => testSession.update?.(running('lost')))
    expect(screen.getByText('未检测到人体', { exact: true })).toBeTruthy()
    act(() => vi.advanceTimersByTime(1200))
    expect(play).toHaveBeenLastCalledWith('lost')
  })
  it('cancels pending speech on mute, then remains available after leaving the screen', async () => {
    vi.useFakeTimers()
    const play = vi.spyOn(LocalCuePlayer.prototype, 'play').mockImplementation(() => {})
    render(createElement(CameraCamp))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '战斗大屏' })) })
    act(() => testSession.update?.(running('tracked')))
    fireEvent.click(screen.getByRole('button', { name: '语音提示：开' }))
    act(() => vi.advanceTimersByTime(10_000))
    expect(play).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '语音提示：关' })) })
    fireEvent.click(screen.getByRole('button', { name: '退出大屏' }))
    act(() => vi.advanceTimersByTime(10_000))
    expect(play).toHaveBeenCalledExactlyOnceWith('tracked')
  })
})

describe('voice entry and confirmed game cues',()=>{
  it('offers a voice test on the normal page without asking for a camera or microphone',()=>{
    const test=vi.spyOn(LocalCuePlayer.prototype,'testVoice').mockImplementation(()=>{})
    render(createElement(CameraCamp))
    fireEvent.click(screen.getByRole('button',{name:'测试语音'}))
    expect(test).toHaveBeenCalledOnce()
    expect(screen.getByRole('button',{name:'语音提示：开'})).toBeTruthy()
    expect(screen.getByText(/无需开启麦克风/)).toBeTruthy()
  })
  it('announces recognition on the normal page, then countdown and start once; camera close cancels pending feedback',()=>{
    vi.useFakeTimers()
    const play=vi.spyOn(LocalCuePlayer.prototype,'play').mockImplementation(()=>{})
    const {rerender}=render(createElement(CameraCamp))
    act(()=>testSession.update?.(running('tracked')))
    act(()=>vi.advanceTimersByTime(1200))
    expect(play).toHaveBeenCalledExactlyOnceWith('tracked')
    rerender(createElement(CameraCamp,{challengeCue:'countdown'}))
    expect(play).toHaveBeenLastCalledWith('countdown')
    rerender(createElement(CameraCamp,{challengeCue:'started'}))
    expect(play).toHaveBeenLastCalledWith('started')
    for(let i=0;i<20;i++)act(()=>testSession.update?.(running('tracked')))
    expect(play).toHaveBeenCalledTimes(3)
    act(()=>testSession.update?.(running('lost')))
    act(()=>testSession.update?.({...running('waiting'),phase:'idle'}))
    act(()=>vi.advanceTimersByTime(10000))
    expect(play).toHaveBeenCalledTimes(3)
  })
})
