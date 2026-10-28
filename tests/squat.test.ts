import { describe,expect,it } from 'vitest'
import { jointAngle,SquatCounter } from '../src/squat/SquatCounter'
import { makeSequence,poseFrame } from './squat-fixtures'
import type { PoseFrame } from '../src/camera/pose'
function setup(){
  const counter=new SquatCounter(),sequence=makeSequence(),events:number[]=[]
  const feed=(frames:PoseFrame[])=>frames.map(frame=>{const value=counter.update(frame);if(value.rep)events.push(value.count);return value})
  const stand=()=>feed(sequence.hold(158,0,1000))
  const rep=()=>{feed(sequence.hold(145,.04,600));return feed(sequence.hold(158,0,700))}
  return {counter,sequence,events,feed,stand,rep}
}
describe('game squat: clear down then up, not posture scoring',()=>{
  it('counts a shallow cycle once and stops at ten',()=>{
    const s=setup();s.stand();for(let i=0;i<12;i++)s.rep()
    expect(s.events).toEqual([1,2,3,4,5,6,7,8,9,10])
  })
  it('does not count standing still or small jitter',()=>{
    const s=setup();s.stand()
    s.feed(s.sequence.hold(158,0,5000).map((f,i)=>{for(const p of f.landmarks)p.y+=(i%2)*.003;return f}))
    s.feed(s.sequence.hold(151,.01,600));s.stand();expect(s.events).toEqual([])
  })
  it('uses a relative reference rather than requiring 160 degree initial knees',()=>{
    const s=setup();s.feed(s.sequence.hold(148,0,1000));expect(s.counter.getState().phase).toBe('standing')
    s.feed(s.sequence.hold(125,0,600));s.feed(s.sequence.hold(148,0,700));expect(s.events).toEqual([1])
  })
  it('counts on hip movement without world landmarks or strong knee-angle change',()=>{
    const s=setup(),feed=(frames:PoseFrame[])=>s.feed(frames.map(f=>({...f,worldLandmarks:[]})))
    feed(s.sequence.hold(158,0,1000));feed(s.sequence.hold(158,.04,600));feed(s.sequence.hold(158,0,700))
    expect(s.events).toEqual([1])
  })
  it('allows angle motion on one visible side without requiring both knees or hip descent',()=>{
    const s=setup();s.stand();s.feed(s.sequence.hold(125,0,600,158));s.stand();expect(s.events).toEqual([1])
  })
  it('counts with one occluded body side and moderate landmark confidence',()=>{
    const s=setup(),feed=(frames:PoseFrame[])=>s.feed(frames.map(f=>{for(const p of f.landmarks)p.visibility=.55;f.landmarks[28].visibility=.02;return f}))
    feed(s.sequence.hold(158,0,1000));feed(s.sequence.hold(145,.04,600));feed(s.sequence.hold(158,0,700))
    expect(s.events).toEqual([1])
  })
  it('holding or bouncing down does not count until returning near the reference',()=>{
    const s=setup();s.stand();s.feed(s.sequence.hold(125,.08,2500));s.feed(s.sequence.hold(140,.04,500));s.feed(s.sequence.hold(125,.08,500))
    expect(s.events).toEqual([]);s.stand();s.stand();expect(s.events).toEqual([1])
  })
  it('does not count an initial crouch followed only by rising',()=>{
    const s=setup();s.feed(s.sequence.hold(110,.12,1000));s.stand();expect(s.events).toEqual([]);s.rep();expect(s.events).toEqual([1])
  })
  it('rejects a single spike, duplicate and older timestamps',()=>{
    const s=setup();s.stand();const spike=poseFrame(s.sequence.time+100,80,80,.15)
    for(let i=0;i<10;i++)s.counter.update(spike)
    s.stand();expect(s.events).toEqual([])
  })
  it('aborts an unfinished action on complete body loss and keeps completed counts',()=>{
    const s=setup();s.stand();s.rep();s.feed(s.sequence.hold(125,.08,600))
    s.feed([{...poseFrame(s.sequence.time+50),landmarks:[]}]);s.stand()
    expect(s.events).toEqual([1]);s.rep();expect(s.events).toEqual([1,2])
  })
  it('cancels unfinished movement on camera closure or a long frame gap',()=>{
    const s=setup();s.stand();s.feed(s.sequence.hold(125,.08,600));s.counter.interrupt();s.stand();expect(s.events).toEqual([])
    s.feed(s.sequence.hold(125,.08,600));s.counter.update(poseFrame(s.sequence.time+2000));expect(s.counter.getState().phase).toBe('calibrating')
  })
  it('tolerates lateral translation and camera scale without counting translation as a squat',()=>{
    const s=setup();s.stand()
    s.feed(s.sequence.hold(158,0,1000).map(f=>{for(const p of f.landmarks){p.x=.5+(p.x-.5)*.9+.03;p.y=.5+(p.y-.5)*.9}return f}))
    expect(s.events).toEqual([])
    s.rep();expect(s.events).toEqual([1])
  })
  it('reset starts a new round and ignores unreasonably brief flickers',()=>{
    const s=setup();s.stand();s.rep();s.counter.reset();expect(s.counter.getState().count).toBe(0)
    s.stand();const time=s.sequence.time;s.feed([poseFrame(time+20,80,80,.1),poseFrame(time+40,80,80,.1),poseFrame(time+60,158)])
    expect(s.counter.getState().count).toBe(0)
  })
  it('keeps diagnostic frame counts, peak motion and transitions for later reading',()=>{
    const s=setup();s.stand();s.rep();const d=s.counter.diagnostics()
    expect(d.frames).toBeGreaterThan(0);expect(d.peakHip).toBeGreaterThan(.12);expect(d.events.some(x=>x.includes('成功'))).toBe(true)
  })
  it('retains 3D angle geometry validation',()=>{
    expect(jointAngle({x:0,y:0,z:0},{x:0,y:1,z:0},{x:0,y:2,z:0})).toBeCloseTo(180)
    expect(jointAngle({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:1,z:1})).toBeNull()
  })
})
