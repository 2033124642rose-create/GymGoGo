import { describe, expect, it } from 'vitest'
import { PartySession, validateNames } from '../src/party/PartySession'
import { makeSequence, poseFrame } from './squat-fixtures'

function setup(names=['冒险者A','冒险者B']) {
  const game=new PartySession(names), sequence=makeSequence()
  const feed=(angle:number,drop:number,duration:number)=>sequence.hold(angle,drop,duration).map(frame=>game.frame(frame))
  const start=()=>{game.prepare(sequence.time);feed(175,0,5500);expect(game.snapshot().phase).toBe('active')}
  const rep=()=>{feed(175,0,500);feed(130,.08,500);feed(175,0,700)}
  return {game,sequence,feed,start,rep}
}

describe('local first-level party rules (synthetic data, no human accuracy claim)',()=>{
  it('validates 2–6 players, Unicode nickname bounds, and uses ids even for repeated names',()=>{
    expect(validateNames(['A'])).toBeTruthy();expect(validateNames(Array(7).fill('A'))).toBeTruthy()
    expect(validateNames(['  ','B'])).toBeTruthy();expect(validateNames(['a'.repeat(13),'B'])).toBeTruthy()
    const g=new PartySession([' 同名 ','同名']);expect(g.snapshot().players.map(p=>p.name)).toEqual(['同名','同名'])
    expect(new Set(g.snapshot().players.map(p=>p.id)).size).toBe(2)
    expect(()=>new PartySession(['A'])).toThrow()
  })
  it.each([2,6])('derives %i-player HP and never starts without prepare',n=>{
    const {game,feed}=setup(Array.from({length:n},(_,i)=>`P${i}`))
    feed(175,0,6000);feed(130,.08,600);feed(175,0,700)
    expect(game.snapshot()).toMatchObject({phase:'ready',total:0,hp:n*20,maxHp:n*20})
  })
  it('uses the accepted counter: shallow down/up counts once, standing and held bottom do not repeat',()=>{
    const s=setup();s.start();s.feed(175,0,2000);expect(s.game.snapshot().total).toBe(0)
    s.feed(130,.08,700);s.feed(130,.08,2000);expect(s.game.snapshot().total).toBe(0)
    s.feed(175,0,700);expect(s.game.snapshot()).toMatchObject({total:1,hp:30,phase:'active'})
    s.feed(175,0,3000);expect(s.game.snapshot().total).toBe(1)
  })
  it('ends a completed player once, requires explicit next + prepare, and never requeues completed players',()=>{
    const s=setup();s.start();s.rep();s.rep()
    expect(s.game.snapshot()).toMatchObject({phase:'turnComplete',total:2,queue:['player-2']})
    s.rep();expect(s.game.snapshot().total).toBe(2)
    s.game.next(s.sequence.time);expect(s.game.snapshot().currentId).toBe('player-2')
    s.rep();expect(s.game.snapshot().total).toBe(2)
    s.start();s.rep();s.rep();expect(s.game.snapshot()).toMatchObject({phase:'levelWon',hp:0,total:4,queue:[]})
    s.game.next(s.sequence.time);s.game.skip(s.sequence.time);s.rep()
    expect(s.game.snapshot()).toMatchObject({phase:'levelWon',total:4})
  })
  it('keeps partial counts on skip and resumes only the remaining target at the tail',()=>{
    const s=setup();s.start();s.rep();s.game.skip(s.sequence.time)
    expect(s.game.snapshot()).toMatchObject({phase:'ready',currentId:'player-2',hp:30,queue:['player-2','player-1']})
    s.start();s.rep();s.rep();s.game.next(s.sequence.time)
    expect(s.game.snapshot().currentId).toBe('player-1');s.start();s.rep()
    expect(s.game.snapshot()).toMatchObject({phase:'levelWon',total:4,hp:0})
    expect(s.game.snapshot().players.map(p=>p.count)).toEqual([2,2])
  })
  it('blocks after every unfinished player skips and does not loop or damage; offers explicit resume/pause/exit',()=>{
    const s=setup();s.game.skip(0);s.game.skip(0)
    expect(s.game.snapshot()).toMatchObject({phase:'blocked',total:0,hp:40})
    const before=s.game.snapshot();for(let i=0;i<50;i++)s.game.skip(0)
    expect(s.game.snapshot()).toEqual(before)
    s.game.pause(0);expect(s.game.snapshot().phase).toBe('paused')
    s.game.resume(0);expect(s.game.snapshot().phase).toBe('ready')
    s.game.skip(0);expect(s.game.snapshot().phase).toBe('ready')
    s.game.skip(0);expect(s.game.snapshot().phase).toBe('blocked')
    s.game.exit(0);s.feed(175,0,6000);expect(s.game.snapshot()).toMatchObject({phase:'exited',total:0,hp:40})
  })
  it('only unfinished players participate in all-skipped detection',()=>{
    const s=setup();s.start();s.rep();s.rep();s.game.next(s.sequence.time)
    s.game.skip(s.sequence.time);expect(s.game.snapshot()).toMatchObject({phase:'blocked',queue:['player-2'],hp:20})
    s.game.resume(s.sequence.time);s.start();s.rep();s.rep();expect(s.game.snapshot().phase).toBe('levelWon')
  })
  it('pause preserves contributions, ignores exercise, and requires a fresh baseline + countdown on resume',()=>{
    const s=setup();s.start();s.rep();s.feed(130,.08,500);s.game.pause(s.sequence.time)
    s.feed(175,0,1000);s.rep();expect(s.game.snapshot()).toMatchObject({phase:'paused',total:1,hp:30})
    s.game.resume(s.sequence.time);s.feed(175,0,6000);expect(s.game.snapshot()).toMatchObject({phase:'ready',total:1})
    s.start();s.feed(175,0,800);expect(s.game.snapshot().total).toBe(1)
    s.rep();expect(s.game.snapshot()).toMatchObject({phase:'turnComplete',total:2})
  })
  it('never counts one player’s half action for the next player',()=>{
    const s=setup();s.start();s.feed(130,.08,700);s.game.skip(s.sequence.time)
    s.feed(175,0,800);s.start();s.feed(175,0,1500)
    expect(s.game.snapshot().players.map(p=>p.count)).toEqual([0,0])
    s.rep();expect(s.game.snapshot().players.map(p=>p.count)).toEqual([0,1])
  })
  it('rejects stale/duplicate rep tokens, sequence gaps and frames from before the current prepare',()=>{
    const s=setup();s.start();const token=s.game.snapshot().attempt
    expect(s.game.acceptRep(token,1)).toBe(true)
    expect(s.game.acceptRep(token,1)).toBe(false);expect(s.game.acceptRep(token,3)).toBe(false)
    s.game.skip(s.sequence.time);s.start()
    expect(s.game.acceptRep(token,2)).toBe(false)
    const before=s.game.snapshot();s.game.frame(poseFrame(1,130,130,.1));expect(s.game.snapshot()).toEqual(before)
  })
  it('lost body cancels countdown and camera interruption discards half actions but keeps reps',()=>{
    const s=setup();s.game.prepare(0);s.feed(175,0,2400);expect(s.game.snapshot().digit).toBeGreaterThan(0)
    s.game.frame(null);expect(s.game.snapshot()).toMatchObject({phase:'preparing',digit:0,total:0})
    s.feed(175,0,5500);expect(s.game.snapshot().phase).toBe('active')
    s.rep();s.feed(130,.08,600);s.game.frame(null);s.feed(175,0,1500)
    expect(s.game.snapshot().total).toBe(1)
    s.rep();expect(s.game.snapshot().total).toBe(2)
  })
  it('pause/cancel during preparation never activates counting; background interrupts readiness',()=>{
    const s=setup();s.game.prepare(0);s.feed(175,0,2400);s.game.check(s.sequence.time,true)
    expect(s.game.snapshot().digit).toBe(0)
    s.game.cancel(s.sequence.time);s.feed(175,0,6000);expect(s.game.snapshot().phase).toBe('ready')
    s.game.prepare(s.sequence.time);s.feed(175,0,2400);s.game.pause(s.sequence.time)
    s.feed(175,0,7000);expect(s.game.snapshot()).toMatchObject({phase:'paused',total:0})
  })
  it('six players finish once each with consistent totals and no extra damage',()=>{
    const s=setup(['P1','P2','P3','P4','P5','P6'])
    for(let i=0;i<6;i++){if(i)s.game.next(s.sequence.time);s.start();s.rep();s.rep()}
    expect(s.game.snapshot()).toMatchObject({phase:'levelWon',total:12,hp:0,maxHp:120})
    expect(s.game.snapshot().players.every(p=>p.count===2)).toBe(true)
  })
})
