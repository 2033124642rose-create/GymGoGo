import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {PartySession} from '../src/party/PartySession'
import PartyQuiz from '../src/party/PartyQuiz'
import {makeSequence} from './squat-fixtures'
import '../src/style.css'
import '../src/party/party.css'

function Preview(){
  const build=(kind:string)=>{
    const game=new PartySession(['合成示例A','合成示例B'],undefined,{knowledgeChallenge:true}),seq=makeSequence()
    const feed=(a:number,d:number,ms:number)=>seq.hold(a,d,ms).forEach(f=>game.frame(f))
    game.prepare(0);feed(175,0,5500)
    for(let i=0;i<2;i++){feed(175,0,500);feed(130,.08,500);feed(175,0,700)}
    game.receiveQuiz(game.beginQuestion()!,{questionId:'synthetic-preview',question:'这是合成界面预览题目：请用自己的话输入一段简短回答。'})
    if(kind!=='answer')game.receiveQuiz(game.submitAnswer('合成答案')!,{verdict:kind==='failed'?'incorrect':'uncertain',explanation:'这是合成判定说明，不是真实AI判断。',monsterReaction:'怪兽的合成反馈：先让我把披风整理好！'})
    return game
  }
  const [game,setGame]=useState(()=>build('answer')),[answer,setAnswer]=useState('')
  const [version,setVersion]=useState(0)
  const sync=()=>setVersion(version+1)
  return <><header style={{position:'fixed',top:0,left:0,right:0,zIndex:200,padding:8,background:'#e2efad',color:'#203722',display:'flex',gap:14,alignItems:'center',fontSize:13}}><b>仅合成界面预览 · 非百炼生成 · 摄像头关闭</b>{['answer','uncertain','failed'].map((kind,i)=><button key={kind} onClick={()=>setGame(build(kind))}>{['答题预览','无法确定预览','失败预览'][i]}</button>)}</header><PartyQuiz view={game.snapshot()} notice={answer} busy={false} onAnswer={value=>setAnswer('仅预览，未提交模型：'+value)} onRetryQuestion={()=>{}} onPause={()=>setAnswer('预览：休息不会调用模型')} onSkip={()=>setAnswer('预览：延后保留原题')} onExit={()=>setGame(build('answer'))} onRetryLevel={()=>{game.retryLevel(0);setAnswer('预览：已重置本关');setGame(build('answer'));sync()}}/></>
}
const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!)
if(import.meta.hot)import.meta.hot.data.root=root
root.render(<Preview/>)
