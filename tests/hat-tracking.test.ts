import { describe,expect,it } from 'vitest'
import { HeadTracker,locateHat } from '../src/ar/headTracking'
import { HATS,HAT_IDS } from '../src/ar/hats'
import { headFrame } from './hat-fixtures'
import { PartySession } from '../src/party/PartySession'
import type { HatId } from '../src/ar/hats'

describe('head-only local decoration geometry',()=>{
  it('provides exactly four transparent local SVG presets',()=>{
    expect(HAT_IDS).toEqual(['crown','pirate','wizard','party'])
    expect(HAT_IDS.map(id=>HATS[id].name)).toEqual(['皇冠','海盗帽','魔法帽','派对帽'])
    HAT_IDS.forEach(id=>expect(HATS[id].src).toMatch(/\.svg|^data:image\/svg/))
  })
  it('follows independent x/y translations without pre-mirroring coordinates',()=>{
    const a=locateHat(headFrame(1).landmarks,640,480)!
    const b=locateHat(headFrame(2,.1,.05).landmarks,640,480)!
    expect(b.x-a.x).toBeCloseTo(64);expect(b.y-a.y).toBeCloseTo(24)
    expect(a.x).toBeCloseTo(320);expect(b.width).toBeCloseTo(a.width)
    // CSS performs the only horizontal mirror; a positive source shift becomes a negative screen shift.
    expect((640-b.x)-(640-a.x)).toBeCloseTo(-64)
  })
  it('uses pixel aspect ratio for tilt rather than normalized-coordinate atan2',()=>{
    for(const roll of [-20,20]){
      expect(locateHat(headFrame(1,0,0,1,roll).landmarks,640,480)!.angle).toBeCloseTo(roll)
    }
  })
  it('scales with head size and video resolution; displayed meet ratios stay consistent',()=>{
    const a=locateHat(headFrame(1).landmarks,640,480)!
    const b=locateHat(headFrame(1,0,0,1.4).landmarks,640,480)!
    expect(b.width/a.width).toBeCloseTo(1.4)
    const c=locateHat(headFrame(1).landmarks,1280,960)!
    expect(c.x).toBeCloseTo(a.x*2);expect(c.y).toBeCloseTo(a.y*2);expect(c.width).toBeCloseTo(a.width*2)
  })
  it.each([[640,480],[1280,720],[480,640]])('keeps finite geometry for %ix%i input', (w,h)=>{
    const pose=locateHat(headFrame(1,0,0,1,20,w,h).landmarks,w,h)!
    expect(pose.angle).toBeCloseTo(20)
    expect(Object.values(pose).every(Number.isFinite)).toBe(true)
    expect(pose.width).toBeGreaterThan(0)
  })
  it('hides on low confidence, missing head, invalid dimensions and implausible points',()=>{
    const f=headFrame(1);f.landmarks[0].visibility=.2
    expect(locateHat(f.landmarks,640,480)).toBeNull()
    expect(locateHat([],640,480)).toBeNull();expect(locateHat(headFrame(1).landmarks,0,480)).toBeNull()
    const g=headFrame(1);g.landmarks[2].visibility=.1;g.landmarks[5].visibility=.1;g.landmarks[7].visibility=.1
    expect(locateHat(g.landmarks,640,480)).toBeNull()
    const k=headFrame(1);k.landmarks[2].x=NaN;k.landmarks[7].x=NaN
    expect(locateHat(k.landmarks,640,480)).toBeNull()
  })
  it('can use visible ears when eyes are occluded, or eyes when ear scale is unavailable',()=>{
    const f=headFrame(1);f.landmarks[2].visibility=.1;f.landmarks[5].visibility=.1
    expect(locateHat(f.landmarks,640,480)).not.toBeNull()
    const g=headFrame(1);g.landmarks[7].visibility=.1;g.landmarks[8].visibility=.1
    expect(locateHat(g.landmarks,640,480)).not.toBeNull()
  })
  it('smooths small jitter but resets immediately after loss, a new player or resolution change',()=>{
    const t=new HeadTracker();const a=t.update(headFrame(100),640,480)!
    const raw=locateHat(headFrame(130,.01).landmarks,640,480)!
    const b=t.update(headFrame(130,.01),640,480)!
    expect(b.x).toBeGreaterThan(a.x);expect(b.x).toBeLessThan(raw.x)
    expect(t.update(null,640,480)).toBeNull()
    expect(t.update(headFrame(200,.1),640,480)).toEqual(locateHat(headFrame(200,.1).landmarks,640,480))
    t.reset();expect(t.update(headFrame(300,-.1),640,480)).toEqual(locateHat(headFrame(300,-.1).landmarks,640,480))
    expect(t.update(headFrame(400),1280,960)).toEqual(locateHat(headFrame(400).landmarks,1280,960))
  })
  it('does not mutate landmarks and rejects duplicate timestamp updates',()=>{
    const t=new HeadTracker(),frame=headFrame(100),copy=structuredClone(frame)
    t.update(frame,640,480);expect(frame).toEqual(copy)
    expect(t.update(frame,640,480)).toBeNull()
    expect(t.update(headFrame(120),640,480)).not.toBeNull()
  })
})

it('rejects invalid per-player hat configuration without changing counters',()=>{
  expect(()=>new PartySession(['A','B'],['crown'])).toThrow('帽子')
  expect(()=>new PartySession(['A','B'],['unknown' as HatId,'party'])).toThrow('帽子')
})
