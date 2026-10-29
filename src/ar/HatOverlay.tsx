import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { PoseFrame } from '../camera/pose'
import { HATS } from './hats'
import type { HatId } from './hats'
import { HeadTracker } from './headTracking'
import './hats.css'

export interface HatOverlayHandle { update(frame: PoseFrame | null, width: number, height: number): void }
const HatOverlay = forwardRef<HatOverlayHandle, {hat: HatId; playerId: string}>(function HatOverlay({hat,playerId},ref) {
  const svg = useRef<SVGSVGElement>(null)
  const group = useRef<SVGGElement>(null)
  const tracker = useRef(new HeadTracker())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const assetFailed = useRef(false)
  const modeRef = useRef('waiting')
  const [mode,setMode] = useState('waiting')
  const report = useCallback((value: string) => { if (modeRef.current !== value) { modeRef.current=value; setMode(value) } },[])
  const hide = useCallback(() => {
    clearTimeout(timer.current); tracker.current.reset()
    if (group.current) group.current.style.display='none'
    report(assetFailed.current ? 'error' : 'waiting')
  },[report])
  useLayoutEffect(() => { assetFailed.current=false; hide(); return () => clearTimeout(timer.current) },[hat,playerId,hide])
  useImperativeHandle(ref,() => ({update(frame,width,height) {
    const pose = tracker.current.update(frame,width,height)
    clearTimeout(timer.current)
    if (!pose || assetFailed.current) { hide(); return }
    if (svg.current) svg.current.setAttribute('viewBox',`0 0 ${width} ${height}`)
    if (group.current) {
      group.current.setAttribute('transform',`translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${pose.angle.toFixed(2)}) scale(${(pose.width/200).toFixed(4)})`)
      group.current.style.display=''
    }
    report('tracking')
    // A stalled worker must not leave a floating hat behind for its full inference timeout.
    timer.current=setTimeout(hide,500)
  }}),[hide,report])
  return <>
    <svg ref={svg} className="camp-hat-overlay" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid meet" aria-label="派对 AR 帽子叠加层" data-player={playerId} data-hat={hat}>
      <g ref={group} style={{display:'none'}}><image href={HATS[hat].src} x="-100" y="-145" width="200" height="160" onError={() => { assetFailed.current=true; hide() }}/></g>
    </svg>
    <span className="camp-hat-status" role="status">{HATS[hat].name} · {mode==='tracking' ? '头部跟随中' : mode==='error' ? '帽子素材加载失败，请刷新重试' : '等待清晰头部'}</span>
  </>
})
export default HatOverlay
