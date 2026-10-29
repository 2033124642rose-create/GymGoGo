import { createElement,createRef } from 'react'
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import HatOverlay from '../src/ar/HatOverlay'
import type { HatOverlayHandle } from '../src/ar/HatOverlay'
import { HAT_IDS,HATS } from '../src/ar/hats'
import { headFrame } from './hat-fixtures'

afterEach(()=>{cleanup();vi.useRealTimers()})
describe('independent decorative SVG layer',()=>{
  it.each(HAT_IDS)('shows local %s asset only after a valid head frame',hat=>{
    const ref=createRef<HatOverlayHandle>();render(createElement(HatOverlay,{ref,hat,playerId:'p1'}))
    const svg=screen.getByLabelText('派对 AR 帽子叠加层'),group=svg.querySelector('g')!
    expect(group.style.display).toBe('none')
    expect(svg.querySelector('image')?.getAttribute('href')).toBe(HATS[hat].src)
    act(()=>ref.current!.update(headFrame(100),640,480))
    expect(group.style.display).toBe('');expect(group.getAttribute('transform')).toContain('translate(320.00')
    expect(screen.getByText(`${HATS[hat].name} · 头部跟随中`)).toBeTruthy()
    act(()=>ref.current!.update(null,640,480));expect(group.style.display).toBe('none')
    act(()=>ref.current!.update(headFrame(200),640,480));expect(group.style.display).toBe('')
  })
  it('hides stale overlays after 500ms and clears timers on unmount',()=>{
    vi.useFakeTimers();const ref=createRef<HatOverlayHandle>()
    const {unmount}=render(createElement(HatOverlay,{ref,hat:'crown',playerId:'p1'}))
    act(()=>ref.current!.update(headFrame(100),640,480));act(()=>vi.advanceTimersByTime(500))
    expect(screen.getByLabelText('派对 AR 帽子叠加层').querySelector('g')!.style.display).toBe('none')
    act(()=>ref.current!.update(headFrame(200),640,480));unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('clears smoothing/old position on player and hat change without needing a camera restart',()=>{
    const ref=createRef<HatOverlayHandle>();const {rerender}=render(createElement(HatOverlay,{ref,hat:'crown',playerId:'p1'}))
    act(()=>ref.current!.update(headFrame(100),640,480))
    rerender(createElement(HatOverlay,{ref,hat:'pirate',playerId:'p2'}))
    const svg=screen.getByLabelText('派对 AR 帽子叠加层')
    expect(svg.getAttribute('data-player')).toBe('p2');expect(svg.querySelector('g')!.style.display).toBe('none')
    act(()=>ref.current!.update(headFrame(200,.1),640,480))
    expect(svg.querySelector('g')!.getAttribute('transform')).toContain('translate(384.00')
    expect(svg.querySelector('image')!.getAttribute('href')).toBe(HATS.pirate.src)
  })
  it('uses centered meet viewBox so letterboxing/resize does not crop or stretch the pose plane',()=>{
    const ref=createRef<HatOverlayHandle>();render(createElement(HatOverlay,{ref,hat:'party',playerId:'p1'}))
    act(()=>ref.current!.update(headFrame(100),1280,720))
    const svg=screen.getByLabelText('派对 AR 帽子叠加层')
    expect(svg.getAttribute('viewBox')).toBe('0 0 1280 720');expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
  })
  it('surfaces broken local assets without changing video or invoking inference',()=>{
    const ref=createRef<HatOverlayHandle>();render(createElement(HatOverlay,{ref,hat:'wizard',playerId:'p1'}))
    act(()=>ref.current!.update(headFrame(100),640,480))
    fireEvent.error(screen.getByLabelText('派对 AR 帽子叠加层').querySelector('image')!)
    expect(screen.getByText(/帽子素材加载失败/)).toBeTruthy()
    act(()=>ref.current!.update(headFrame(200),640,480))
    expect(screen.getByLabelText('派对 AR 帽子叠加层').querySelector('g')!.style.display).toBe('none')
  })
})
