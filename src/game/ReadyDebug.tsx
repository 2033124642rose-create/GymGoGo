import { useEffect, useRef, useState } from 'react'
import type { ReadyGate } from './ReadyGate'

// Temporary developer tool. No frame storage, logging, upload or game-state mutation.
export default function ReadyDebug({gate,gameState,recognized}: {gate:ReadyGate;gameState:string;recognized:boolean}) {
  const [open,setOpen]=useState(false)
  const current=useRef({gameState,recognized})
  current.current={gameState,recognized}
  const read=()=>({...gate.snapshot(),...current.current})
  const [data,setData]=useState(read)
  const [frozen,setFrozen]=useState(false)
  const [capture,setCapture]=useState('')
  const [report,setReport]=useState<string[]>([])
  const diagnosis=useRef<{start:number;end:number;best:ReturnType<typeof read>|null;reasons:Map<string,number>;samples:number}|null>(null)
  useEffect(()=>{
    if(!open)return
    const tick=()=>{
      const sample={...gate.snapshot(),...current.current}
      if(!frozen)setData(sample)
      const run=diagnosis.current
      if(!run)return
      const now=Date.now()
      if(now<run.start){setCapture(`请走远就位 · ${Math.ceil((run.start-now)/1000)} 秒后开始记录`);return}
      if(now<run.end){
        setCapture(`正在记录，请保持站位 · 剩余 ${Math.ceil((run.end-now)/1000)} 秒`)
        if(sample.phase==='waiting'||sample.phase==='countdown'){
          run.samples++
          if(!run.best||sample.stableMs>run.best.stableMs)run.best=sample
          if(!sample.standing)run.reasons.set(sample.reason,(run.reasons.get(sample.reason)??0)+1)
        }
        return
      }
      diagnosis.current=null
      setData(run.best??sample);setFrozen(true)
      setCapture('诊断已结束并冻结；现在可以走近查看')
      setReport(run.samples ? run.reasons.size ? [...run.reasons.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([reason,count])=>`${reason}：${count} / ${run.samples} 个面板样本`) : ['此时段未记录到不合格的准备样本'] : ['未采到等待 / 倒计时数据，请先点击准备挑战再诊断'])
    }
    tick()
    const timer=setInterval(tick,200)
    return()=>clearInterval(timer)
  },[open,gate,frozen])
  const angle=(value:number|null)=>value===null?'当前无有效数据':`${value.toFixed(1)}°`
  const phaseName={idle:'未准备',waiting:'等待就位',countdown:'倒计时',active:'正式挑战',ended:'本局结束'}[data.phase]
  return <div className="ready-debug">
    <button aria-expanded={open} aria-controls="ready-debug-panel" onClick={()=>{
      if(open && diagnosis.current){diagnosis.current=null;setCapture('已取消远距离诊断')}
      setOpen(!open)
    }}>{open?'收起就位调试':'就位调试'}</button>
    {open && <section id="ready-debug-panel" aria-label="就位调试面板">
      <strong>临时开发调试 · {frozen?'已冻结的准备快照':'实时准备数据'}</strong>
      <div className="diagnosis-actions">
        <button onClick={()=>{diagnosis.current=null;setCapture('');setFrozen(!frozen)}}>{frozen?'恢复实时':'冻结当前数据'}</button>
        <button onClick={()=>{
          const now=Date.now();diagnosis.current={start:now+5000,end:now+15000,best:null,reasons:new Map(),samples:0}
          setFrozen(false);setReport([]);setCapture('请走远就位 · 5 秒后开始记录')
        }}>远距离诊断（自动冻结）</button>
      </div>
      <p>{capture||'先准备挑战，再点远距离诊断：留 5 秒走远，记录 10 秒后自动冻结。只记录数字和原因，不拍摄或保存视频。'}</p>
      {report.length>0 && <div aria-label="远距离诊断结果"><strong>诊断时段主要阻塞原因</strong>{report.map(line=><p key={line}>{line}</p>)}<p>下方为此时段稳定累计最高的快照；采样次数不是准确率或识别帧数。</p></div>}
      <dl>
        <div><dt>当前游戏状态</dt><dd>{phaseName} · {data.gameState}</dd></div>
        <div><dt>人体识别成功</dt><dd>{data.recognized?'是（不等于就位成功）':'否'}</dd></div>
        <div><dt>符合开局条件</dt><dd>{data.standing?'是':'否 / 尚未确认'}（只检查入镜识别）</dd></div>
        <div><dt>当前判断原因</dt><dd>{data.reason}</dd></div>
        <div><dt>现在该怎么做</dt><dd>{data.guidance}</dd></div>
        <div><dt>连续识别累计</dt><dd>{(data.stableMs/1000).toFixed(1)} / 2.0 秒</dd></div>
        <div><dt>左右膝角（原始）</dt><dd>{data.jointsValid?`${angle(data.left)} / ${angle(data.right)}`:'关节点不可靠，不作为站立依据'}</dd></div>
        <div><dt>膝角 / 位移限制</dt><dd>开局不检查；膝角仅供诊断参考</dd></div>
        <div><dt>最低可信度</dt><dd>{data.weakJoint} {data.confidence.toFixed(2)}，需 ≥0.50（与摄像头识别一致）</dd></div>
        <div><dt>重置次数</dt><dd>{data.resets}</dd></div>
        <div><dt>最近重置原因</dt><dd>{data.lastReset}</dd></div>
      </dl>
      <details><summary>最近失败记录（最多 12 条，新一轮准备清空）</summary>
        {data.failures.length===0?<p>暂无失败记录</p>:data.failures.map((failure,i)=><p key={i}>{i+1}. {failure.reason}；累计 {(failure.stableMs/1000).toFixed(1)}秒；{failure.weakJoint}可信度 {failure.confidence.toFixed(2)}；膝角 {angle(failure.filteredLeft)} / {angle(failure.filteredRight)}</p>)}
      </details>
      <p>主要关节连续识别 2 秒即可倒计时，不检查膝角或移步。离开画面仍会取消；正式计数按完整深蹲判断。</p>
    </section>}
  </div>
}
