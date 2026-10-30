import { useEffect,useRef,useState } from 'react'
import { ArrowRight,Leaf,Sparkles,Trophy,X } from 'lucide-react'
import { formatDuration,localReview,validReview } from './review'
import type { BattleSummary } from './review'

export default function BattleResult({result,onReplay,immersive=false}:{result:BattleSummary;onReplay:()=>void;immersive?:boolean}){
  const [review,setReview]=useState(()=>localReview(result))
  const [pending,setPending]=useState(false),[attempted,setAttempted]=useState(false),[collapsed,setCollapsed]=useState(false)
  const requested=useRef(false),controller=useRef<AbortController|null>(null)
  const aiReady=review.source==='ai'
  const card=useRef<HTMLElement>(null)
  useEffect(()=>{
    card.current?.scrollIntoView?.({block:'nearest',behavior:'auto'})
    if(immersive)card.current?.querySelector<HTMLButtonElement>('button')?.focus()
  },[immersive,collapsed])
  useEffect(()=>()=>controller.current?.abort(),[])
  async function requestReview(){
    if(requested.current||result.mode!=='real')return
    requested.current=true;setAttempted(true);setPending(true)
    const abort=new AbortController();controller.current=abort
    const timer=setTimeout(()=>abort.abort(),10000)
    try{
      const response=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,
        body:JSON.stringify({roundId:result.roundId,count:result.count,seconds:result.seconds,mode:result.mode})})
      if(!response.ok)throw Error('review unavailable')
      const data:unknown=await response.json()
      if(!validReview(data))throw Error('invalid review')
      if(!abort.signal.aborted)setReview(data)
    }catch{
      if(controller.current===abort)setReview({...localReview(result),notice:'AI 信使暂未抵达，已保留本地战报。'})
    }finally{clearTimeout(timer);if(controller.current===abort)setPending(false)}
  }
  if(collapsed)return <button className="result-reopen" onClick={()=>setCollapsed(false)}><Trophy size={17}/>查看本局战报</button>
  return <section ref={card} className="battle-result" aria-label="战斗结算" role={immersive?'dialog':'region'} aria-modal={immersive?true:undefined}
    onKeyDown={event=>{
      if(!immersive)return
      if(event.key==='Escape'){event.stopPropagation();setCollapsed(true)}
      if(event.key==='Tab'){
        const buttons=Array.from(card.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')??[])
        const first=buttons[0],last=buttons.at(-1)
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      }
    }}>
    <button className="result-close" aria-label="收起战报，回看战场" onClick={()=>setCollapsed(true)}><X size={20}/></button>
    <div className="result-seal"><Trophy size={36}/></div>
    <span className="result-kicker"><Leaf size={14}/> 萌芽森林 · 冒险存档</span>
    <h2>森林里，多了一段你的传说。</h2>
    <p className="result-intro">贪睡团子已被唤醒。这一局，漂亮收官！</p>
    <div className="result-stats">
      <div><span>{result.mode==='real'?'实际完成':'按钮模拟'}</span><strong>{result.count}<small> 次</small></strong></div>
      <div><span>本局用时</span><strong>{formatDuration(result.seconds)}</strong></div>
      <div><span>怪兽战果</span><strong>{result.defeated?'已击败':'未击败'}</strong></div>
    </div>
    {result.mode==='demo'&&<p className="result-demo">按钮演示结果 · 不代表真实训练，不调用 AI。</p>}
    <div className={`result-review ${aiReady?'is-ai-review':''}`} aria-live="polite" aria-busy={pending}>
      <span className="review-source"><Sparkles size={14}/>{pending?'百炼 AI 正在创作…':aiReady?'百炼 AI 已生成':attempted?'本地备用战报 · 非 AI 生成':result.mode==='demo'?'按钮演示 · 本地通关摘要':!import.meta.env.DEV?'本地通关摘要 · 非 AI 生成':'本局 AI 战报尚未生成'}</span>
      {result.mode==='real'&&import.meta.env.DEV&&<div className="ai-invitation">
        {!attempted&&<><h3>这一局，值得 AI 专门写一页。</h3><p>将本局 {result.count} 次动作、{formatDuration(result.seconds)} 的冒险，写成一段有团子回应的专属战报。</p></>}
        <button className="result-ai" disabled={attempted||pending} onClick={()=>void requestReview()}><Sparkles size={17}/>{pending?'正在根据本局数据生成…':aiReady?'AI 战报已生成 · 本局不再重复调用':attempted?'未生成 AI · 已使用本地备用':'召唤 AI 战报 · 每局一次'}</button>
      </div>}
      {pending?<p className="ai-writing">正在用本局 {result.count} 次 / {formatDuration(result.seconds)} 创作称号、故事与团子回应，稍等片刻。</p>:
        (attempted||result.mode==='demo'||!import.meta.env.DEV)&&<><h3>「{review.title}」</h3><p>{review.review}</p>
          {aiReady&&review.monsterLine&&<blockquote className="monster-reply"><span>贪睡团子小声嘀咕</span>“{review.monsterLine}”</blockquote>}
          <small>{aiReady?`根据本局 ${result.count} 次 / ${formatDuration(result.seconds)} 生成 · AI 趣味叙事，仅供娱乐。`:'这是本地备用内容，不是大模型生成。'}</small>
        </>}
      {aiReady&&review.receipt&&<details className="ai-receipt"><summary>查看本局生成凭证</summary><p>来源：百炼 · 模型：{review.receipt.model}<br/>服务端请求编号：{review.receipt.id}<br/>生成时间：{new Date(review.receipt.generatedAt).toLocaleTimeString('zh-CN')}</p><small>同一局重开战报会复用此结果；下一局才生成新的内容。</small></details>}
    </div>
    {review.notice&&<p className="result-notice" role="status">{review.notice}</p>}
    <div className="result-actions">
      <button className="primary-button" onClick={onReplay}>再次挑战<ArrowRight size={18}/></button>
    </div>
    <p className="result-privacy">AI 仅接收本局次数与用时，不发送视频或人体关键点。新一局需主动准备。</p>
  </section>
}
