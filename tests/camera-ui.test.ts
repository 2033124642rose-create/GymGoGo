import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CameraCamp from '../src/camera/CameraCamp'

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn() } as unknown as CanvasRenderingContext2D)
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  vi.stubGlobal('OffscreenCanvas', class {})
  vi.stubGlobal('createImageBitmap', vi.fn())
  vi.stubGlobal('Worker', class { postMessage() {} terminate() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('camera UI boundary', () => {
  it('leaves media permission untouched on mount and reports permission denial only after a click', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
    render(createElement(CameraCamp))
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(screen.getByText('真实识别 · 不计数')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '开启摄像头' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('权限未获授权'))
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }))
    expect(screen.getByRole('button', { name: '重试开启摄像头' })).toBeTruthy()
  })
  it('allows cancellation while browser permission is pending and stops any late stream', async () => {
    let grant!: (stream: MediaStream) => void
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }], getVideoTracks: () => [] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => new Promise(resolve => { grant = resolve }) }, configurable: true })
    render(createElement(CameraCamp))
    fireEvent.click(screen.getByRole('button', { name: '开启摄像头' }))
    fireEvent.click(screen.getByRole('button', { name: '取消并关闭摄像头' }))
    await act(async () => { grant(stream) })
    expect(stop).toHaveBeenCalledOnce()
    expect(screen.getByText('摄像头已关闭')).toBeTruthy()
  })
  it('stops all camera tracks on pagehide', async () => {
    const track = Object.assign(new EventTarget(), { stop: vi.fn() })
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] }) }, configurable: true })
    render(createElement(CameraCamp))
    fireEvent.click(screen.getByRole('button', { name: '开启摄像头' }))
    await screen.findByText('正在加载姿态模型')
    fireEvent(window, new Event('pagehide'))
    expect(track.stop).toHaveBeenCalledOnce()
    expect(screen.getByText('摄像头已关闭')).toBeTruthy()
  })
})
