import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  reply(data: unknown) { this.onmessage?.({ data } as MessageEvent) }
}
let getUserMedia: ReturnType<typeof vi.fn>
let stop: ReturnType<typeof vi.fn>
const originalFullscreen = Object.getOwnPropertyDescriptor(Element.prototype, 'requestFullscreen')
beforeEach(() => {
  FakeWorker.instances = []
  stop = vi.fn()
  const track = Object.assign(new EventTarget(), { stop })
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('OffscreenCanvas', class {})
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 640, height: 360, close: vi.fn() }))
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  if (originalFullscreen) Object.defineProperty(Element.prototype, 'requestFullscreen', originalFullscreen)
  else Reflect.deleteProperty(Element.prototype, 'requestFullscreen')
})

describe('shared immersive battle board', () => {
  it('keeps the original monster, arena, video and canvas mounted with existing game progress', async () => {
    render(createElement(App))
    fireEvent.click(screen.getByRole('button', { name: '按钮演示' }))
    const arena = screen.getByRole('region', { name: '深蹲挑战游戏区域' })
    const video = screen.getByLabelText('本地摄像头实时画面')
    const canvas = screen.getByLabelText('人体骨骼关键点叠加层')
    fireEvent.click(screen.getByRole('button', { name: '开始挑战' }))
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: '模拟完成一次深蹲' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '战斗大屏' })) })
    const battle = screen.getByRole('dialog', { name: '沉浸式游戏战斗模式' })
    expect(within(battle).getByRole('region', { name: '深蹲挑战游戏区域' })).toBe(arena)
    expect(within(battle).getByLabelText('本地摄像头实时画面')).toBe(video)
    expect(within(battle).getByLabelText('人体骨骼关键点叠加层')).toBe(canvas)
    expect(within(battle).getByLabelText('模拟深蹲计数').textContent).toContain('3 / 10')
    expect(within(battle).getByRole('progressbar', { name: '怪兽生命值' }).getAttribute('aria-valuenow')).toBe('70')
    expect(getUserMedia).not.toHaveBeenCalled()
    fireEvent.click(within(battle).getByRole('button', { name: '退出大屏' }))
    expect(screen.getByRole('region', { name: '深蹲挑战游戏区域' })).toBe(arena)
    expect(screen.getByLabelText('本地摄像头实时画面')).toBe(video)
    expect(screen.getByRole('progressbar', { name: '怪兽生命值' }).getAttribute('aria-valuenow')).toBe('70')
  })
  it('updates the giant simulated counter, wounds and HP from the same manual attack', async () => {
    render(createElement(App))
    fireEvent.click(screen.getByRole('button', { name: '按钮演示' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '战斗大屏' })) })
    fireEvent.click(screen.getByRole('button', { name: '开始挑战' }))
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: '模拟完成一次深蹲' }))
    expect(screen.getByLabelText('模拟深蹲计数').textContent).toContain('10 / 10')
    expect(document.querySelectorAll('[data-wound]').length).toBe(10)
    expect(screen.getByRole('progressbar', { name: '怪兽生命值' }).getAttribute('aria-valuenow')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: '再挑战一次' }))
    expect(screen.getByLabelText('模拟深蹲计数').textContent).toContain('0 / 10')
  })
  it('does not turn genuine pose success into fake squat counts or attacks, and keeps the stream on exit', async () => {
    render(createElement(App))
    fireEvent.click(screen.getByRole('button', { name: '按钮演示' }))
    fireEvent.click(screen.getByRole('button', { name: '开启摄像头' }))
    await waitFor(() => expect(FakeWorker.instances.length).toBe(1))
    const worker = FakeWorker.instances[0]
    act(() => worker.reply({ type: 'ready', backend: 'GPU' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '战斗大屏' })) })
    const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }))
    act(() => { for (let i = 0; i < 3; i++) worker.reply({ type: 'result', landmarks: points }) })
    expect(document.querySelector('.battle-recognition strong')?.textContent).toBe('识别成功')
    expect(screen.getByLabelText('模拟深蹲计数').textContent).toContain('0 / 10')
    expect(screen.getByRole('progressbar', { name: '怪兽生命值' }).getAttribute('aria-valuenow')).toBe('100')
    fireEvent.click(screen.getByRole('button', { name: '退出大屏' }))
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(stop).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '关闭摄像头' }))
    expect(stop).toHaveBeenCalledOnce()
  })
  it('requests native fullscreen for the whole battle board, including both zones', async () => {
    let requested: Element | undefined
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: vi.fn(function(this: Element) { requested = this; return Promise.resolve() }) })
    render(createElement(App))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '战斗大屏' })) })
    fireEvent.click(screen.getByRole('button', { name: '系统全屏' }))
    expect(requested).toBe(screen.getByRole('dialog', { name: '沉浸式游戏战斗模式' }))
    expect(requested?.querySelector('.arena')).toBeTruthy()
    expect(requested?.querySelector('video')).toBeTruthy()
  })
  it('uses intrinsic source dimensions, not preview layout, for actual inference capture', async () => {
    let tick: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { tick = callback; return 1 }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    render(createElement(App))
    const video = screen.getByLabelText('本地摄像头实时画面') as HTMLVideoElement
    Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 720 }, readyState: { value: 4 }, clientWidth: { value: 180 } })
    fireEvent.click(screen.getByRole('button', { name: '开启摄像头' }))
    await waitFor(() => expect(FakeWorker.instances.length).toBe(1))
    act(() => FakeWorker.instances[0].reply({ type: 'ready' }))
    await act(async () => { tick?.(1000) })
    expect(createImageBitmap).toHaveBeenLastCalledWith(video, { resizeWidth: 640, resizeHeight: 360 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '战斗大屏' })) })
    video.style.width = '900px'
    video.currentTime = 1
    vi.mocked(performance.now).mockReturnValue(1200)
    act(() => FakeWorker.instances[0].reply({ type: 'result', landmarks: [] }))
    await act(async () => { tick?.(1200) })
    expect(createImageBitmap).toHaveBeenCalledTimes(2)
    expect(createImageBitmap).toHaveBeenLastCalledWith(video, { resizeWidth: 640, resizeHeight: 360 })
  })
})
