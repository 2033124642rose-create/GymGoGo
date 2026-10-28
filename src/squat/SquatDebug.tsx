import { useEffect,useState } from 'react'
import type { SquatCounter } from './SquatCounter'

export default function SquatDebug({counter}:{counter:SquatCounter}){
  const [open,setOpen]=useState(false),[frozen,setFrozen]=useState(false)
  const [data,setData]=useState(()=>counter.diagnostics())
  useEffect(()=>{
    if(!open||frozen)return
    setData(counter.diagnostics())
    const timer=setInterval(()=>setData(counter.diagnostics()),200)
    return()=>clearInterval(timer)
  },[open,frozen,counter])
  return <div className="ready-debug motion-debug">
    <button aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'收起动作调试':'动作调试'}</button>
    {open&&<section aria-label="正式动作调试面板"><strong>游戏动作诊断 · {frozen?'已冻结':'实时'}</strong>
      <div className="diagnosis-actions"><button onClick={()=>setFrozen(!frozen)}>{frozen?'恢复动作数据':'冻结动作数据'}</button></div>
      <dl>
        <div><dt>动作状态 / 次数</dt><dd>{data.phase} / {data.count}</dd></div>
        <div><dt>当前提示</dt><dd>{data.message}</dd></div>
        <div><dt>收到的新识别帧</dt><dd>{data.frames}</dd></div>
        <div><dt>髋部下降量</dt><dd>{data.hipDrop.toFixed(3)}（下蹲 ≥0.12；起立 ≤0.05）</dd></div>
        <div><dt>膝角相对变化</dt><dd>{data.angleDrop.toFixed(1)}°（下蹲 ≥18°；起立 ≤8°）</dd></div>
        <div><dt>本局最大幅度</dt><dd>髋 {data.peakHip.toFixed(3)} / 膝 {data.peakAngle.toFixed(1)}°</dd></div>
        <div><dt>当前使用信号</dt><dd>{data.signal==='hip'?'髋部':data.signal==='angle'?'膝角':'等待下蹲'}</dd></div>
        <div><dt>可用侧可信度</dt><dd>{data.confidence.toFixed(2)}</dd></div>
      </dl>
      <strong>最近动作记录（走近后仍可查看）</strong>
      {data.events.map((text,i)=><p key={i}>{text}</p>)}
      <p>髋部或膝角满足其一即可；髋部量以躯干长度归一化。只保留本局数字及状态，不录制视频。</p>
    </section>}
  </div>
}
