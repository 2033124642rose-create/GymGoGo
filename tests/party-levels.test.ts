import {describe,expect,it} from 'vitest'
import {PARTY_LEVELS} from '../src/party/levels'
import {PartySession} from '../src/party/PartySession'
import {makeSequence,poseFrame} from './squat-fixtures'

function setup(n=2){
  const game=new PartySession(Array.from({length:n},(_,i)=>`合成玩家${i+1}`)),seq=makeSequence()
  const effects:{attack:boolean;levelWon:boolean;won:boolean}[]=[]
  const feed=(angle:number,drop:number,ms:number)=>seq.hold(angle,drop,ms).forEach(frame=>effects.push(game.frame(frame)))
  const start=()=>{game.prepare(seq.time);feed(175,0,5500);expect(game.snapshot().phase).toBe('active')}
  const rep=()=>{feed(175,0,500);feed(130,.08,500);feed(175,0,700)}
  const finish=()=>{
    let loops=0
    while(['ready','turnComplete'].includes(game.snapshot().phase)){
      if(++loops>n+1)throw Error('Unexpected queue loop')
      if(game.snapshot().phase==='turnComplete')game.next(seq.time)
      const state=game.snapshot(),player=state.players.find(p=>p.id===state.currentId)!
      start();for(let i=player.count;i<state.level.target;i++)rep()
    }
  }
  return{game,seq,effects,feed,start,rep,finish}
}

describe('three-level cooperative party, synthetic landmarks only',()=>{
  it('configures exactly 2/3/4 targets, 10 damage, distinct monsters and ordered rewards',()=>{
    expect(PARTY_LEVELS.map(l=>l.target)).toEqual([2,3,4])
    expect(PARTY_LEVELS.map(l=>l.damage)).toEqual([10,10,10])
    expect(PARTY_LEVELS.map(l=>l.reward)).toEqual(['萌芽伙伴徽章','驱雾小队徽章','屠龙同盟徽章'])
    expect(new Set(PARTY_LEVELS.map(l=>l.visual)).size).toBe(3)
    expect(PARTY_LEVELS.map(l=>l.name)).toEqual(['史莱姆森林','幽灵秘境','巨龙城堡'])
  })
  it.each([2,6])('preserves all history and totals across the %i-player full campaign',n=>{
    const s=setup(n)
    for(let level=0;level<3;level++){
      const before=s.game.snapshot();expect(before).toMatchObject({levelIndex:level,hp:n*(level+2)*10,total:0})
      s.finish();const done=s.game.snapshot()
      expect(done).toMatchObject({hp:0,total:n*(level+2),completedLevels:level+1,phase:level===2?'won':'levelWon'})
      expect(done.rewards).toEqual(PARTY_LEVELS.slice(0,level+1).map(l=>l.reward))
      if(level<2){s.game.nextLevel(s.seq.time);expect(s.game.snapshot().phase).toBe('ready')}
    }
    const final=s.game.snapshot();expect(final.teamTotal).toBe(n*9)
    expect(final.players.every(p=>p.totalCount===9&&p.counts.join(',')==='2,3,4')).toBe(true)
    expect(final.players.reduce((sum,p)=>sum+p.totalCount,0)).toBe(final.teamTotal)
    s.game.nextLevel(s.seq.time);s.game.resume(s.seq.time);s.rep()
    expect(s.game.snapshot()).toEqual(final)
  })
  it('rejects early advancement, partial team completion and repeated next-level clicks',()=>{
    const s=setup();s.game.nextLevel(0);expect(s.game.snapshot().levelIndex).toBe(0)
    s.start();s.rep();s.game.nextLevel(s.seq.time);expect(s.game.snapshot()).toMatchObject({levelIndex:0,hp:30})
    s.rep();s.game.nextLevel(s.seq.time);expect(s.game.snapshot()).toMatchObject({levelIndex:0,completedLevels:0})
    s.game.next(s.seq.time);s.finish();s.game.nextLevel(s.seq.time)
    s.game.nextLevel(s.seq.time);s.game.nextLevel(s.seq.time)
    expect(s.game.snapshot()).toMatchObject({levelIndex:1,phase:'ready',hp:60,total:0,teamTotal:4})
  })
  it('pause between levels resumes the reward screen rather than a zero-target counting round',()=>{
    const s=setup();s.finish();s.game.pause(s.seq.time);expect(s.game.snapshot().phase).toBe('paused')
    s.rep();s.game.prepare(s.seq.time);expect(s.game.snapshot().total).toBe(4)
    s.game.resume(s.seq.time);expect(s.game.snapshot().phase).toBe('levelWon')
    s.game.nextLevel(s.seq.time);s.finish();expect(s.game.snapshot()).toMatchObject({levelIndex:1,hp:0,teamTotal:10})
  })
  it('skips and pauses within level two retain history and count only the remaining personal quota',()=>{
    const s=setup();s.finish();s.game.nextLevel(s.seq.time);s.start();s.rep();s.game.skip(s.seq.time)
    s.game.skip(s.seq.time);expect(s.game.snapshot()).toMatchObject({phase:'blocked',total:1,teamTotal:5,hp:50})
    s.game.pause(s.seq.time);s.rep();s.game.resume(s.seq.time)
    expect(s.game.snapshot().players.map(p=>p.counts)).toEqual([[2,1,0],[2,0,0]])
    s.finish();expect(s.game.snapshot()).toMatchObject({phase:'levelWon',total:6,teamTotal:10,hp:0})
  })
  it('invalidates old attempts/frames across levels and never counts readiness or a previous half action',()=>{
    const s=setup();s.start();const old=s.game.snapshot().attempt;s.rep();s.rep();s.game.next(s.seq.time);s.finish()
    const cutoff=s.seq.time+10;s.game.nextLevel(cutoff)
    expect(s.game.acceptRep(old,1)).toBe(false);s.game.frame(poseFrame(1,130,130,.08))
    expect(s.game.snapshot()).toMatchObject({levelIndex:1,total:0,phase:'ready'})
    s.feed(130,.08,500);s.feed(175,0,1000);expect(s.game.snapshot().total).toBe(0)
    s.start();s.feed(175,0,1000);expect(s.game.snapshot().total).toBe(0)
    s.feed(130,.08,500);s.game.skip(s.seq.time);s.start();s.feed(175,0,1000)
    expect(s.game.snapshot().total).toBe(0);s.rep();expect(s.game.snapshot().players.map(p=>p.count)).toEqual([0,1])
  })
  it('awards each level once with exactly one attack per rep and one final victory event',()=>{
    const s=setup();for(let i=0;i<3;i++){if(i)s.game.nextLevel(s.seq.time);s.finish()}
    expect(s.effects.filter(e=>e.attack)).toHaveLength(18)
    expect(s.effects.filter(e=>e.levelWon)).toHaveLength(3)
    expect(s.effects.filter(e=>e.won)).toHaveLength(1)
    s.rep();expect(s.effects.filter(e=>e.attack)).toHaveLength(18)
  })
  it('an early exit after a completed level preserves earned rewards without fabricating full victory',()=>{
    const s=setup();s.finish();s.game.nextLevel(s.seq.time);s.start();s.rep();s.game.exit(s.seq.time)
    expect(s.game.snapshot()).toMatchObject({phase:'exited',levelIndex:1,teamTotal:5,completedLevels:1,rewards:['萌芽伙伴徽章']})
    s.game.nextLevel(s.seq.time);s.rep();expect(s.game.snapshot().teamTotal).toBe(5)
  })
  it('returned history is a copy and cannot be used to bypass the guarded unlock',()=>{
    const s=setup(),snapshot=s.game.snapshot();snapshot.players[0].counts[0]=99;snapshot.rewards.push('fake')
    s.game.nextLevel(0);expect(s.game.snapshot()).toMatchObject({levelIndex:0,teamTotal:0,rewards:[]})
  })
})
