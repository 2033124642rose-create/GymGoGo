import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CameraCamp from '../src/camera/CameraCamp'
import { containFrame } from '../src/camera/trainingScreen'

let fullscreen: Element | null = null
const originalRequest = Object.getOwnPropertyDescriptor(Element.prototype, 'requestFullscreen')
const originalExit = Object.getOwnPropertyDescriptor(document, 'exitFullscreen')
const originalFullscreen = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
beforeEach(() => {
  fullscreen = null
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn() } as unknown as CanvasRenderingContext2D)
  Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: vi.fn().mockRejectedValue(new Error('blocked')) })
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: vi.fn(async () => { fullscreen = null; fireEvent(document, new Event('fullscreenchange')) }) })
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  vi.stubGlobal('OffscreenCanvas', class {})
  vi.stubGlobal('createImageBitmap', vi.fn())
  vi.stubGlobal('Worker', class { postMessage() {} terminate() {} })
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  for (const [object, name, descriptor] of [[Element.prototype, 'requestFullscreen', originalRequest], [document, 'exitFullscreen', originalExit], [document, 'fullscreenElement', originalFullscreen]] as const) {
    if (descriptor) Object.defineProperty(object, name, descriptor)
    else Reflect.deleteProperty(object, name)
  }
})

describe('uncropped frame sizing', () => {
  it.each([4/3, 16/9, 9/16, 1])('fits a %s-ratio camera entirely within the available rectangle', ratio => {
    const fit = containFrame(1200, 600, ratio)
    expect(fit.width).toBeLessThanOrEqual(1200)
    expect(fit.height).toBeLessThanOrEqual(600)
    expect(fit.width / fit.height).toBeCloseTo(ratio)
  })
  it('handles an unmeasured area and invalid ratio', () => {
    expect(containFrame(0, 600, 4/3)).toEqual({ width: 0, height: 0 })
    expect(containFrame(600, 400, NaN)).toEqual({ width: 0, height: 0 })
  })
})

describe('immersive mode retains the original camera session', () => {
  it('falls back on full-screen rejection without requesting camera permission; Escape restores page and focus', async () => {
    const getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    render(createElement('div', null, createElement('button', null, '其他页面内容'), createElement(CameraCamp)))
    const video = screen.getByLabelText('本地摄像头实时画面')
    const canvas = screen.getByLabelText('人体骨骼关键点叠加层')
    const enter = screen.getByRole('button', { name: '战斗大屏' })
    fireEvent.click(enter)
    expect(Element.prototype.requestFullscreen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '系统全屏' }))
    await screen.findByText(/浏览器未允许系统全屏/)
    expect(screen.getByRole('dialog', { name: '沉浸式游戏战斗模式' })).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
    expect(screen.getByText('其他页面内容').inert).toBe(true)
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(screen.getByLabelText('本地摄像头实时画面')).toBe(video)
    expect(screen.getByLabelText('人体骨骼关键点叠加层')).toBe(canvas)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(screen.getByText('其他页面内容').inert).not.toBe(true)
    expect(document.activeElement).toBe(enter)
  })
  it('supports viewport mode even without the Fullscreen API', () => {
    Reflect.deleteProperty(Element.prototype, 'requestFullscreen')
    render(createElement(CameraCamp))
    fireEvent.click(screen.getByRole('button', { name: '战斗大屏' }))
    fireEvent.click(screen.getByRole('button', { name: '系统全屏' }))
    expect(screen.getByText(/浏览器不支持系统全屏/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '退出大屏' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('leaves native fullscreen when the browser exits it', async () => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: vi.fn(function(this: HTMLElement) {
      fullscreen = this; fireEvent(document, new Event('fullscreenchange')); return Promise.resolve()
    }) })
    render(createElement(CameraCamp))
    fireEvent.click(screen.getByRole('button', { name: '战斗大屏' }))
    fireEvent.click(screen.getByRole('button', { name: '系统全屏' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    act(() => { fullscreen = null; fireEvent(document, new Event('fullscreenchange')) })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('does not stop or re-request an active camera when entering and leaving the screen', async () => {
    const track = Object.assign(new EventTarget(), { stop: vi.fn() })
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] })
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    render(createElement(CameraCamp))
    fireEvent.click(screen.getByRole('button', { name: '开启摄像头' }))
    await screen.findByText('正在加载姿态模型')
    fireEvent.click(screen.getByRole('button', { name: '战斗大屏' }))
    fireEvent.click(screen.getByRole('button', { name: '退出大屏' }))
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(track.stop).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消并关闭摄像头' }))
    expect(track.stop).toHaveBeenCalledOnce()
  })
  it('offers an accessible mute toggle and traps focus inside the screen', () => {
    render(createElement(CameraCamp))
    fireEvent.click(screen.getByRole('button', { name: '战斗大屏' }))
    const mute = screen.getByRole('button', { name: '声音提示：开' })
    fireEvent.click(mute)
    expect(screen.getByRole('button', { name: '声音提示：关' }).getAttribute('aria-pressed')).toBe('false')
    const test = screen.getByRole('button', { name: '试听提示' })
    test.focus(); fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '系统全屏' }))
    fireEvent.click(screen.getByRole('button', { name: '退出大屏' }))
  })
  it('does not reopen immersive mode when a pending fullscreen grant arrives after exit', async () => {
    let grant!: () => void
    let requested!: Element
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: vi.fn(function(this: Element) {
      requested = this
      return new Promise<void>(resolve => { grant = resolve })
    }) })
    render(createElement(CameraCamp))
    fireEvent.click(screen.getByRole('button', { name: '战斗大屏' }))
    fireEvent.click(screen.getByRole('button', { name: '系统全屏' }))
    fireEvent.click(screen.getByRole('button', { name: '退出大屏' }))
    await act(async () => { fullscreen = requested; fireEvent(document, new Event('fullscreenchange')); grant() })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.exitFullscreen).toHaveBeenCalledOnce()
  })
})
