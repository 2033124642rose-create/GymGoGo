import { describe,expect,it } from 'vitest'
import { ReadyGate } from '../src/game/ReadyGate'
import { makeSequence,poseFrame } from './squat-fixtures'
import { assessPose } from '../src/camera/pose'

describe('simple presence-based preparation, independent of squat posture',()=>{
  function setup(){const gate=new ReadyGate(),sequence=makeSequence();gate.prepare();return {gate,sequence,hold:(duration:number)=>sequence.hold(175,0,duration).map(frame=>gate.update(frame))}}
  it('requires 2s of recognition then 3s countdown and starts only once',()=>{
    const s=setup();s.gate.update(null);s.hold(2000);expect(s.gate.phase).toBe('waiting')
    s.hold(100);expect(s.gate.digit).toBe(3);s.hold(1000);expect(s.gate.digit).toBe(2)
    s.hold(1000);expect(s.gate.digit).toBe(1);expect(s.hold(1000).filter(x=>x.start)).toHaveLength(1)
    expect(s.hold(6000).some(x=>x.start)).toBe(false)
  })
  it.each(['missing','low-confidence','outside','gap'] as const)('cancels countdown on %s and requires re-entry',reason=>{
    const s=setup();s.hold(2200);const frame=s.sequence.hold(175,0,100)[0]
    if(reason==='missing')frame.landmarks=[]
    if(reason==='low-confidence')frame.landmarks[27].visibility=.02
    if(reason==='outside')frame.landmarks[27].y=.99
    if(reason==='gap')s.gate.stale(frame.timestamp+701);else s.gate.update(frame)
    expect(s.gate.phase).toBe('waiting');expect(s.gate.digit).toBe(0);expect(s.gate.snapshot().stableMs).toBe(0)
    s.hold(1500);expect(s.gate.phase).toBe('waiting');s.hold(4000);expect(s.gate.phase).toBe('active')
  })
  it.each(['bent-knees','moving','missing-world','moderate-confidence','borderline-angle','near-edge'])('allows %s without posture gating',kind=>{
    const gate=new ReadyGate();gate.prepare();let starts=0
    for(let time=0;time<=5500;time+=100){
      const frame=poseFrame(time,kind==='bent-knees'?130:158)
      if(kind==='moving'){frame.landmarks[23].y+=time%400===0?.06:0;frame.landmarks[27].x+=time%400===0?.1:0}
      if(kind==='missing-world')frame.worldLandmarks=[]
      if(kind==='moderate-confidence')frame.landmarks[27].visibility=.6
      if(kind==='near-edge')frame.landmarks[27].y=.975
      expect(assessPose(frame.landmarks,true).tracking).toBe('tracked')
      if(gate.update(frame).start)starts++
    }
    expect(starts).toBe(1);expect(gate.snapshot().resets).toBe(0)
  })
  it('ignores stale frames and cannot restart after cancellation or victory',()=>{
    const s=setup();s.hold(2200);s.gate.update(poseFrame(100));expect(s.gate.digit).toBe(3)
    s.gate.stop();s.hold(6000);expect(s.gate.phase).toBe('idle')
    s.gate.stop('ended');s.hold(6000);expect(s.gate.phase).toBe('ended')
    s.gate.prepare();s.hold(5200);expect(s.gate.phase).toBe('active')
  })
  it('supports a slower 4fps stream',()=>{
    const gate=new ReadyGate();gate.prepare();let starts=0
    for(let time=0;time<=6000;time+=250)if(gate.update(poseFrame(time)).start)starts++
    expect(starts).toBe(1)
  })
  it('pauses short confidence dips without crediting bad time, but resets sustained loss',()=>{
    const s=setup();s.hold(1000);const before=s.gate.snapshot().stableMs
    const dip=s.sequence.hold(175,0,100)[0];dip.landmarks[27].visibility=.45;s.gate.update(dip)
    expect(s.gate.snapshot().stableMs).toBe(before);s.hold(100);expect(s.gate.snapshot().stableMs).toBe(before)
    s.sequence.hold(175,0,500).forEach(frame=>{frame.landmarks[27].visibility=.45;s.gate.update(frame)})
    expect(s.gate.snapshot().stableMs).toBe(0)
  })
  it('retains bounded failure history, does not store landmarks in it, and clears on new preparation',()=>{
    const s=setup();for(let i=0;i<20;i++)s.gate.interrupt(`reason ${i}`)
    const saved=s.gate.snapshot();expect(saved.failures).toHaveLength(12);expect(saved.failures[0]).not.toHaveProperty('landmarks')
    s.gate.interrupt('approaching');expect(saved.failures.at(-1)?.reason).toBe('reason 19')
    s.gate.prepare();expect(s.gate.snapshot().failures).toHaveLength(0)
  })
})
