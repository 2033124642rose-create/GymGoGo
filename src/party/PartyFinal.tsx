import { useEffect,useRef } from 'react'
import { Trophy } from 'lucide-react'
import { PARTY_LEVELS } from './levels'
import type { PartySnapshot } from './PartySession'
import { HATS } from '../ar/hats'
import { formatDuration } from '../settlement/review'

export default function PartyFinal({result,seconds,onClose,onExit}:{result:PartySnapshot;seconds:number;onClose:()=>void;onExit:()=>void}){
  const panel=useRef<HTMLElement>(null)
  const close=useRef<HTMLButtonElement>(null)
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    panel.current?.focus({preventScroll:true})
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();onClose()}
      if(event.key==='Tab'){
        const buttons=panel.current?.querySelectorAll<HTMLButtonElement>('button')
        if(!buttons?.length)return
        const first=buttons[0],last=buttons[buttons.length-1]
        if(document.activeElement===panel.current){event.preventDefault();(event.shiftKey?last:first).focus();return}
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    }
    window.addEventListener('keydown',keys,true)
    return()=>{window.removeEventListener('keydown',keys,true);previous?.focus()}
  },[onClose])
  return <div className="party-final-overlay"><section ref={panel} className="party-final-panel" role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="party-final-title">
    <span className="party-final-emblem"><Trophy size={36}/></span><p className="eyebrow">TOGETHER WE DID IT</p><h2 id="party-final-title">三关全通！小队凯旋</h2><p>每个人的每一次出招，都在这场冒险里。</p>
    <div className="party-final-totals"><span>团队有效次数<strong>{result.teamTotal} 次</strong></span><span>通关关卡<strong>{result.completedLevels} / {PARTY_LEVELS.length}</strong></span><span>整场经过时间<strong>{formatDuration(seconds)}</strong><small>含轮换与休息</small></span></div>
    <div className="party-rewards" aria-label="已获得奖励">{result.rewards.map(reward=><span key={reward}><Trophy size={17}/>{reward}</span>)}</div>
    <div className="party-contribution-table"><table aria-label="最终全队贡献"><thead><tr><th>冒险者</th>{PARTY_LEVELS.map(level=><th key={level.id}>{level.name}</th>)}<th>合计</th><th>团队贡献</th></tr></thead><tbody>{result.players.map((player,index)=><tr key={player.id}><th><img src={HATS[player.hat].src} alt=""/>#{index+1} {player.name}</th>{player.counts.map((count,i)=><td key={i}>{count}</td>)}<td>{player.totalCount}</td><td>{result.teamTotal?(player.totalCount/result.teamTotal*100).toFixed(1):'0.0'}%</td></tr>)}</tbody></table></div>
    <p className="party-final-note">贡献来自实际有效计数，百分比有四舍五入误差，不做速度排名。本页记录本场实际动作与获得的徽章。</p>
    {result.failedAttempts.length>0&&<p className="party-final-note">上表统计成功闯关路线。失败尝试另外实际完成 {result.failedAttempts.reduce((sum,a)=>sum+a.counts.reduce((n,c)=>n+c,0),0)} 次，不重复用于当前Boss扣血。</p>}
    <div className="party-final-actions"><button ref={close} onClick={onClose}>回看战场</button><button className="primary-button" onClick={onExit}>返回单人模式</button></div>
  </section></div>
}
