import type { Point, PoseFrame } from '../camera/pose'

export interface HatPose { x: number; y: number; width: number; angle: number }
const visible = (p: Point | undefined): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
  p.x > .01 && p.x < .99 && p.y > .01 && p.y < .99 && (p.visibility ?? 0) >= .5
const distance = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x-b.x,a.y-b.y)

// Coordinates remain in the UNMIRRORED video plane. CSS mirrors the whole overlay exactly once.
export function locateHat(points: Point[], width: number, height: number): HatPose | null {
  if (![width,height].every(value => Number.isFinite(value) && value > 0) || !visible(points[0])) return null
  const pixel = (p: Point) => ({ x: p.x*width, y: p.y*height })
  const pair = (a: number, b: number) => {
    if (!visible(points[a]) || !visible(points[b])) return null
    const ends = [pixel(points[a]),pixel(points[b])].sort((u,v) => u.x-v.x)
    return distance(ends[0],ends[1]) >= 3 ? ends : null
  }
  const eyes = pair(2,5), ears = pair(7,8), axis = eyes ?? ears
  if (!axis) return null
  const center = { x:(axis[0].x+axis[1].x)/2, y:(axis[0].y+axis[1].y)/2 }
  const faceWidth = ears ? distance(ears[0],ears[1]) : distance(axis[0],axis[1])*2.4
  if (faceWidth < 12 || faceWidth > width*.5 || distance(center,pixel(points[0])) > faceWidth*.85) return null
  const angle = Math.max(-Math.PI/3, Math.min(Math.PI/3, Math.atan2(axis[1].y-axis[0].y,axis[1].x-axis[0].x)))
  const rise = faceWidth*(eyes ? .45 : .65)
  return { x:center.x+Math.sin(angle)*rise, y:center.y-Math.cos(angle)*rise,
    width:Math.min(faceWidth*1.65,width*.9), angle:angle*180/Math.PI }
}

export class HeadTracker {
  private previous: HatPose | null = null
  private last = -Infinity
  private size = ''
  reset() { this.previous = null; this.last = -Infinity; this.size = '' }
  update(frame: PoseFrame | null, width: number, height: number): HatPose | null {
    if (!frame) { this.reset(); return null }
    if (!Number.isFinite(frame.timestamp) || frame.timestamp <= this.last) return null
    const raw = locateHat(frame.landmarks,width,height)
    if (!raw) { this.reset(); return null }
    const size = `${width}:${height}`, dt=frame.timestamp-this.last
    const prev = this.previous
    const alpha = 1-Math.exp(-dt/90)
    const snap = !prev || size!==this.size || dt>500 || distance(prev,raw)>raw.width*1.5
    const result = snap ? raw : {
      x:prev.x+(raw.x-prev.x)*alpha, y:prev.y+(raw.y-prev.y)*alpha,
      width:prev.width+(raw.width-prev.width)*alpha, angle:prev.angle+(raw.angle-prev.angle)*alpha,
    }
    this.previous=result; this.last=frame.timestamp; this.size=size
    return result
  }
}
