import {useCallback,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {PartySession} from '../src/party/PartySession'
import PartyMonster,{PartyBackdrop} from '../src/party/PartyMonster'
import PartyFinal from '../src/party/PartyFinal'
import {makeSequence} from './squat-fixtures'
import '../src/style.css'
import '../src/playful.css'
import '../src/camera/camera.css'
import '../src/battle.css'
import '../src/party/party.css'

function Preview(){
  const game=useRef(new PartySession(['合成示例A','合成示例B']))
  const sequence=useRef(makeSequence())
  const [view,setView]=useState(()=>game.current.snapshot()),[final,setFinal]=useState(false)
  const close=useCallback(()=>setFinal(false),[])
  const feed=(angle:number,drop:number,ms:number)=>sequence.current.hold(angle,drop,ms).forEach(frame=>game.current.frame(frame))
  function complete(){
    let safety=0
    while(['ready','turnComplete'].includes(game.current.snapshot().phase)){
      if(++safety>6)break
      if(game.current.snapshot().phase==='turnComplete')game.current.next(sequence.current.time)
      const state=game.current.snapshot(),player=state.players.find(p=>p.id===state.currentId)!
      game.current.prepare(sequence.current.time);feed(175,0,5500)
      for(let i=player.count;i<state.level.target;i++){feed(175,0,500);feed(130,.08,500);feed(175,0,700)}
    }
    setView(game.current.snapshot());if(game.current.snapshot().phase==='won')setFinal(true)
  }
  const cleared=view.completedLevels>view.levelIndex
  return <div className="app-shell"><style>{`.campaign-preview-tools{position:fixed;z-index:1200;top:14px;left:24px;right:24px;display:flex;align-items:center;justify-content:space-between;gap:15px;color:#eaf2c7;font-size:14px}.campaign-preview-tools button{padding:9px 14px;background:#456039;color:#e8f3c3;border:1px solid #b6d88c;border-radius:11px;margin-left:8px}.campaign-preview-panel{display:flex!important;align-items:center;justify-content:center;flex-direction:column;text-align:center;background:repeating-linear-gradient(45deg,#213b2a,#213b2a 30px,#284430 30px,#284430 60px)!important}.campaign-preview-panel strong{font-size:32px;color:#e1edc2;margin:15px}.campaign-preview-panel p{font-size:15px;color:#bdcda9;line-height:1.8;max-width:330px}`}</style>
    <div className="campaign-preview-tools"><span>合成三关预览 · 未开摄像头 · 非真人数据</span><div><select aria-label="合成玩家人数" defaultValue="2" onChange={event=>{game.current=new PartySession(Array.from({length:Number(event.target.value)},(_,i)=>`合成示例${i+1}`));sequence.current=makeSequence();setFinal(false);setView(game.current.snapshot())}}><option value="2">2人</option><option value="6">6人</option></select>{view.phase==='ready'&&<button onClick={complete}>执行本关合成动作</button>}{view.phase==='levelWon'&&<button onClick={()=>{game.current.nextLevel(sequence.current.time);setView(game.current.snapshot())}}>进入下一关</button>}{view.phase==='won'&&<button onClick={()=>setFinal(true)}>查看合成结算</button>}</div></div>
    <div className={`game-layout is-battle-immersive party-theme-${view.level.theme}`}>
      <section className="arena"><div className="arena-top"><span className="level-badge">LEVEL 0{view.levelIndex+1}</span><span className="world-name">{view.level.name}</span></div><div className="arena-title"><h2>{view.level.name}</h2><p>每人 {view.level.target} 次 · {view.players.length}人合成序列</p></div><div className="monster-health"><div><span>{view.level.monster}</span><strong>{view.hp} / {view.maxHp} HP</strong></div><div className="health-track"><div style={{width:`${view.hp/view.maxHp*100}%`}}/></div></div><div className="scene"><PartyBackdrop theme={view.level.theme}/><PartyMonster level={view.level} hit={false} defeated={cleared} count={view.total} total={view.players.length*view.level.target}/>{cleared&&<div className="victory"><strong>{view.level.name}通关</strong><span>{view.level.reward}</span></div>}</div><div className="arena-bottom">本关有效计数 {view.total} / {view.players.length*view.level.target}</div></section>
      <aside className="training-panel campaign-preview-panel"><strong>未使用摄像头</strong><p>这里只使用合成姿态序列驱动真实PartySession，展示同一怪物与结算组件。</p><p>不代表真人计数、AR或远距离听感验收。</p></aside>
      <div className="battle-footer"><div className="battle-counter"><span>本关合成有效次数</span><strong><b>{view.total}</b><em> / {view.players.length*view.level.target}</em></strong></div><div className="battle-recognition"><strong>{cleared?'本关通关':'等待合成动作'}</strong><p>{view.level.name}</p></div><div className="party-result"><span>累计 {view.teamTotal} 次</span><span>{view.rewards.join(' · ')||'尚未获得徽章'}</span></div></div>
      {final&&<PartyFinal result={view} seconds={0} onClose={close} onExit={()=>{setFinal(false)}}/>}
    </div></div>
}
const previewRoot=import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if(import.meta.hot)import.meta.hot.data.root=previewRoot
previewRoot.render(<Preview/>)
