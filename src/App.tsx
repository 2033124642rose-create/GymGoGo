import { ProductHero, ProductGuide } from './product/ProductIntro'
import { Monster, ForestBackdrop } from './game/ForestScene'
import PartyGame from './party/PartyGame'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import CameraCamp from './camera/CameraCamp'
import type { BattleRecognition } from './camera/CameraCamp'
import type { PoseFrame } from './camera/pose'
import { SquatCounter } from './squat/SquatCounter'
import type { SquatResult } from './squat/SquatCounter'
import { BattleAudio } from './game/BattleAudio'
import { ReadyGate } from './game/ReadyGate'
import ReadyDebug from './game/ReadyDebug'
import SquatDebug from './squat/SquatDebug'
import BattleResult from './settlement/BattleResult'
import type { BattleSummary } from './settlement/review'
import { ArrowRight, Check, ChevronRight, CircleHelp, Clock3, Flag, Heart, Leaf, LockKeyhole, Play, RotateCcw, ShieldCheck, Swords, Trophy, X, Zap } from 'lucide-react'

const TARGET = 10

export default function App() {
  const [partyMode, setPartyMode] = useState(false)
  const [mode, setMode] = useState<'real' | 'demo'>('real')
  const [result,setResult]=useState<BattleSummary|null>(null)
  const [squat, setSquat] = useState<SquatResult>(()=>new SquatCounter().getState())
  const counter = useRef(new SquatCounter(TARGET))
  const readyGate = useRef(new ReadyGate())
  const [ready, setReady] = useState({phase:'idle',digit:0,stableMs:0,reason:'尚未准备',framingIssue:false,guidance:''})
  const syncReady = useCallback(()=>{
    const {phase,digit,stableMs,reason,framingIssue,guidance}=readyGate.current.snapshot()
    const displayedMs=Math.floor(stableMs/100)*100
    setReady(previous=>previous.phase===phase && previous.digit===digit && previous.stableMs===displayedMs && previous.reason===reason && previous.framingIssue===framingIssue && previous.guidance===guidance ? previous : {phase,digit,stableMs:displayedMs,reason,framingIssue,guidance})
  },[])
  const session = useRef({ id:0, active:false, mode:'real' as 'real'|'demo', count:0, startedAt:0 })
  const battleAudio = useRef<BattleAudio | null>(null)
  const [effectsEnabled, setEffectsEnabled] = useState(true)
  const effectsEnabledRef = useRef(true)
  const [audioReady, setAudioReady] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'active' | 'won'>('idle')
  const [count, setCount] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [hit, setHit] = useState(false)
  const [help, setHelp] = useState(false)
  const [battleImmersive, setBattleImmersive] = useState(false)
  const [recognition, setRecognition] = useState<BattleRecognition>({ title: '摄像头已关闭', hint: '点击开启后在浏览器本地识别。', kind: 'idle' })
  const battleRoot = useRef<HTMLDivElement>(null)
  const battleActionButton = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTime = useRef(0)
  const actionButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const helpButton = useRef<HTMLButtonElement>(null)
  const hp = Math.max(0, 100 - count * 10)
  const formattedTime = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

  useEffect(()=>{const audio=new BattleAudio();battleAudio.current=audio;return()=>{session.current.active=false;session.current.id++;audio.dispose();battleAudio.current=null}},[])
  const commitAttack = useCallback((source: 'real'|'demo', repNumber?: number) => {
    const round=session.current
    if(!round.active || round.mode!==source || round.count>=TARGET) return
    if(source==='real' && repNumber!==round.count+1) return
    const next=++round.count
    setCount(next);setHit(true)
    if(timer.current)clearTimeout(timer.current)
    timer.current=setTimeout(()=>setHit(false),450)
    if(effectsEnabledRef.current && battleAudio.current) setAudioReady(battleAudio.current.strike())
    if(next===TARGET){
      round.active=false
      readyGate.current.stop('ended');syncReady()
      const duration=Math.max(0,Math.floor((Date.now()-startTime.current)/1000))
      setSeconds(duration);setPhase('won')
      setResult({roundId:crypto.randomUUID(),count:next,seconds:duration,mode:source,defeated:true})
      if(effectsEnabledRef.current)battleAudio.current?.victory()
    }
  },[syncReady])
  const handlePoseFrame = useCallback((frame: PoseFrame | null) => {
    const round=session.current
    if(round.mode==='real' && (readyGate.current.phase==='waiting'||readyGate.current.phase==='countdown')) {
      if(document.hidden || (frame && performance.now()-frame.timestamp>700)) {readyGate.current.interrupt(document.hidden?'页面处于后台，重新等待就位':'识别帧延迟超过 700ms');syncReady();return}
      if(frame && frame.timestamp<round.startedAt)return
      const previousDigit=readyGate.current.digit
      const result=readyGate.current.update(frame)
      syncReady()
      if(readyGate.current.digit && previousDigit!==readyGate.current.digit && effectsEnabledRef.current)battleAudio.current?.countdown()
      if(result.start && frame){
        counter.current.reset()
        // Start regardless of posture. Adopt a usable standing baseline when available;
        // otherwise the normal counter prompts for standing before the first real rep.
        counter.current.acceptReadyBaseline(frame)
        setSquat(counter.current.getState())
        round.active=true;round.startedAt=frame.timestamp
        startTime.current=Date.now();setPhase('active')
        if(effectsEnabledRef.current)battleAudio.current?.countdown()
      }
      return
    }
    if(!round.active || round.mode!=='real')return
    if(frame && frame.timestamp<round.startedAt)return
    const result=frame ? counter.current.update(frame) : counter.current.interrupt()
    setSquat(previous=>previous.phase===result.phase && previous.count===result.count && previous.message===result.message && !result.rep ? previous : result)
    if(result.rep)commitAttack('real',result.count)
  },[commitAttack,syncReady])

  useEffect(()=>{
    const check=()=>{
      if(document.hidden)readyGate.current.interrupt('页面处于后台，重新等待就位')
      else readyGate.current.stale(performance.now())
      syncReady()
    }
    const interval=setInterval(check,200)
    document.addEventListener('visibilitychange',check)
    return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',check)}
  },[syncReady])

  useEffect(() => {
    if (phase !== 'active') return
    const interval = setInterval(() => setSeconds(Math.floor((Date.now() - startTime.current) / 1000)), 250)
    return () => clearInterval(interval)
  }, [phase])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (!help) return
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setHelp(false); helpButton.current?.focus() }
      if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [help])

  function start() {
    if(readyGate.current.phase==='waiting'||readyGate.current.phase==='countdown')return
    const id=session.current.id+1
    setResult(null)
    session.current={id,active:mode==='demo',mode,count:0,startedAt:performance.now()}
    if(mode==='real')readyGate.current.prepare()
    else readyGate.current.stop()
    syncReady()
    counter.current.reset();setSquat(counter.current.getState())
    battleAudio.current?.silence()
    if(effectsEnabledRef.current)void battleAudio.current?.unlock().then(ready=>{if(session.current.id===id && effectsEnabledRef.current)setAudioReady(ready)})
    setCount(0); setSeconds(0); setHit(false)
    startTime.current = Date.now()
    setPhase(mode==='real'?'idle':'active')
    requestAnimationFrame(() => (battleImmersive ? battleActionButton : actionButton).current?.focus())
  }
  function reset(nextMode = mode) {
    setResult(null)
    readyGate.current.stop();syncReady()
    session.current={id:session.current.id+1,active:false,mode:nextMode,count:0,startedAt:performance.now()}
    counter.current.reset();setSquat(counter.current.getState());battleAudio.current?.silence()
    setPhase('idle');setCount(0);setSeconds(0);setHit(false)
    if(timer.current)clearTimeout(timer.current)
  }
  function attack() {
    commitAttack('demo')
  }
  function changeMode(next: 'real'|'demo') {if(next!==mode){reset(next);setMode(next)}}
  const squatTitle = squat.phase==='calibrating' ? (squat.message.includes('暂停') || squat.message.includes('不连续') ? '计数暂停' : '请先站直') :
    {standing:squat.message.includes('成功')?'成功！+1':'准备下蹲',bottom:'检测到下蹲，请起立',complete:'挑战通关'}[squat.phase]
  const preparing=mode==='real' && (ready.phase==='waiting'||ready.phase==='countdown')
  const readyMessage=ready.phase==='countdown'?`保持入镜，倒计时结束后开始深蹲。${ready.reason.startsWith('短暂')?'识别波动，倒计时暂停。':''}`:
    ready.framingIssue?`${ready.reason}。${ready.guidance}`:`识别确认 ${(ready.stableMs/1000).toFixed(1)} / 2.0 秒 · ${ready.reason}`
  const visibleStatus = preparing ? {title:ready.phase==='countdown'?`即将开战 · ${ready.digit}`:ready.framingIssue?'请调整取景':'等待就位',hint:readyMessage,kind:'partial'} : mode==='real' && phase==='active' ? {title:squatTitle,hint:squat.message,kind:squat.phase==='calibrating'?'partial':'tracked'} : recognition
  const roundMessage = mode==='real' ? preparing ? readyMessage : phase==='idle' ? '点击准备挑战后再走远就位，无需在电脑前全身入镜。' : phase==='won' ? '真实深蹲挑战完成！本局已停止计数。' : squat.message :
    phase==='idle'?'演示模式 · 点击开始，无需摄像头权限':phase==='active'?`演示中 · 已模拟 ${count} 次，点击按钮触发攻击`:'通关啦！这里的数据来自按钮模拟，并非真实训练。'
  function modeControls() {
    return <div className="round-options"><div className="round-mode" role="group" aria-label="挑战模式">
      <button aria-pressed={mode==='real'} onClick={()=>changeMode('real')}>真实深蹲</button>
      <button aria-pressed={mode==='demo'} onClick={()=>changeMode('demo')}>按钮演示</button>
    </div><div className="battle-audio-options"><button aria-pressed={effectsEnabled} onClick={()=>{
      const enabled=!effectsEnabled;effectsEnabledRef.current=enabled;setEffectsEnabled(enabled)
      if(!enabled)battleAudio.current?.silence()
      else void battleAudio.current?.unlock().then(ready=>{if(effectsEnabledRef.current)setAudioReady(ready)})
    }}>战斗音效：{effectsEnabled?'开':'关'}</button><button onClick={()=>{
      effectsEnabledRef.current=true;setEffectsEnabled(true)
      const id=session.current.id
      void battleAudio.current?.unlock().then(ready=>{if(id===session.current.id && effectsEnabledRef.current){setAudioReady(ready);if(ready)battleAudio.current?.strike()}})
    }}>试听攻击音</button></div></div>
  }
  function roundAction(ref: RefObject<HTMLButtonElement | null>) {
    if(preparing)return <button className="primary-button" onClick={()=>reset()}><X size={18}/>取消准备</button>
    if(phase==='active' && mode==='real')return <div className="real-counting-indicator"><span/>真实动作计数中</div>
    return phase==='active' ? <button ref={ref} className="primary-button" onClick={attack}><Zap size={19} fill="currentColor"/>模拟完成一次深蹲<ArrowRight size={19}/></button> :
      <button className="primary-button" onClick={start}>{phase==='won'?<RotateCcw size={18}/>:<Play size={18} fill="currentColor"/>}{phase==='won'?(mode==='real'?'再来一局':'再挑战一次'):(mode==='real'?'准备挑战':'开始挑战')}<ArrowRight size={19}/></button>
  }

  if (partyMode) return <PartyGame onExit={() => setPartyMode(false)}/>

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#main" aria-label="GymGoGo 首页"><span className="brand-mark"><Zap fill="currentColor" size={25}/></span><span>Gym<span className="brand-go">GoGo</span><small>AI 体感派对游戏</small></span></a>
      <div className="header-center"><span className="green-dot"/> 朋友到齐，冒险开始。</div>
      <button className="help-button" onClick={() => { reset(); setPartyMode(true) }}>创建本地派对</button>
      <button ref={helpButton} className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17}/> 玩法说明</button>
    </header>

    <main id="main">
      <ProductHero onStart={() => { reset(); setPartyMode(true) }}/>
      <div className="solo-heading"><span>一个人，也能出发</span><h2>单人体感挑战</h2><p>先和森林团子过过招：10 次深蹲完成单人挑战。想玩三关合作与知识问答？点击「立即开始」创建派对。</p></div>

      <div ref={battleRoot} className={`game-layout ${battleImmersive ? 'is-battle-immersive' : ''}`}
        role={battleImmersive ? 'dialog' : undefined} aria-modal={battleImmersive ? true : undefined}
        aria-label={battleImmersive ? '沉浸式游戏战斗模式' : undefined}>
        {import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug')==='1' && mode==='real' && <ReadyDebug gate={readyGate.current} gameState={`${ready.phase} / ${phase} / 深蹲 ${squat.phase}`} recognized={recognition.kind==='tracked'}/>}
        {import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug')==='1' && mode==='real' && phase!=='idle' && <SquatDebug counter={counter.current}/>}
        <section className={`arena ${hit ? 'arena-hit' : ''}`} aria-label="深蹲挑战游戏区域">
          <div className="arena-top"><span className="level-badge"><Flag size={14}/> LEVEL 01</span><span className="world-name"><Leaf size={14}/> 萌芽森林 <ChevronRight size={13}/> 初次相遇</span><span className="demo-badge">{mode==='real'?'体感挑战':'按钮体验'}</span></div>
          <div className="arena-title"><h2>深蹲挑战</h2><p>第一站 · 唤醒森林里的贪睡团子</p></div>
          <div className="monster-health"><div><span><span className="monster-dot"/> 贪睡团子 <small>森林守门员</small></span><strong>{hp}<span> / 100 HP</span></strong></div><div className="health-track" role="progressbar" aria-label="怪兽生命值" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hp}><div style={{width: `${hp}%`}}/></div></div>
          <div className="scene">
            {preparing && <div className="ready-overlay" role="status" aria-live="polite"><strong>{ready.phase==='countdown'?ready.digit:ready.framingIssue?'请调整取景':'等待就位'}</strong><span>{ready.phase==='countdown'?'保持入镜 · 准备出发':ready.framingIssue?'肩膀与双脚都要入镜 · 调整角度或后退':'主要关节入镜，识别约 2 秒'}</span></div>}
            <ForestBackdrop/>
            <div className="forest-motes" aria-hidden="true">{Array.from({ length: 3 }, (_, i) => <span key={i} style={{ left: `${20 + i * 30}%`, animationDelay: `${i * 1.7}s` }}/>)}</div>
            <div className="monster-speech">{phase === 'won' ? '好吧，今天你赢啦！' : count >= 7 ? '等一下，我的绷带不够啦！' : count >= 4 ? '哎哟，真的醒了…' : count > 0 ? '嘿！有点实力嘛…' : '再睡五分钟… z Z'}</div>
            <Monster hit={hit} defeated={phase === 'won'} damageCount={count}/>
            {count > 0 && <div key={`combo-${count}`} className="combo-badge"><Zap size={16} fill="currentColor"/><strong>{count} HIT</strong><span>{phase === 'won' ? '完美收官！' : count >= 7 ? '胜利就在眼前！' : count >= 4 ? '冒险家，势不可挡！' : '漂亮的一击！'}</span></div>}
            {hit && <div key={count} className="damage">−10 <Zap size={22} fill="currentColor"/></div>}
            {hit && <div key={`burst-${count}`} className="hit-burst" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i}/>)}</div>}
            {phase === 'won' && <div className="victory"><Trophy size={20}/><strong>挑战通关！</strong><span>{mode==='real'?'真实深蹲':'按钮演示'} · {count} 次 · {formattedTime}</span></div>}
            {phase === 'won' && <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${4 + i * 5.3}%`, animationDelay: `${i % 5 * .12}s`, backgroundColor: ['#c2d99e', '#d8e6aa', '#a5ef3f'][i % 3] }}/>)}</div>}
          </div>
          <div className="arena-bottom"><span><Swords size={16}/>{mode==='real'?'一次有效深蹲':'模拟一次深蹲'}<ArrowRight size={13}/>一次攻击</span><span>{mode==='real'?'明显下蹲 → 起立，轻松出招':'按钮演示 · 真实姿态不触发攻击'}</span></div>
        </section>

        <aside className="training-panel" aria-label="训练控制区域">
          <div className="panel-title"><span><Leaf size={19}/> 冒险者营地</span><span className="local-tag">画面留在本地</span></div>
          <CameraCamp challengeCue={mode==='real' ? ready.phase==='countdown' ? 'countdown' : phase==='active' ? 'started' : phase==='won' ? 'won' : undefined : undefined} screenRoot={battleRoot} onImmersiveChange={setBattleImmersive} onRecognitionChange={setRecognition} onPoseFrame={handlePoseFrame} countingMode={mode==='real'}/>
          <div className="camp-simulation" hidden={battleImmersive}>
          {modeControls()}
          <div className="simulation-heading"><strong>{mode==='real'?'真实深蹲挑战':'按钮模拟挑战'}</strong><small>切换模式会清空本局</small></div>
          <div className="stats"><div><span><Swords size={14}/>{mode==='real'?'有效次数':'模拟次数'}</span><strong>{count}<small> / {TARGET} 次</small></strong></div><div><span><Clock3 size={14}/>{mode==='real'?'本局用时':'模拟用时'}</span><strong>{formattedTime}</strong></div></div>
          <div className="target-row"><span><Flag size={15}/> 本关目标</span><strong>完成 {TARGET} 次深蹲</strong></div>
          <div className="progress-dots" aria-label={`完成 ${count} 次，共 ${TARGET} 次`}>{Array.from({length: TARGET}, (_, i) => <span key={i} className={i < count ? 'done' : ''}>{i < count ? <Check size={12}/> : ''}</span>)}</div>
          {roundAction(actionButton)}
          <div className="status-message" role="status" aria-live="polite">{roundMessage}</div>
          {phase === 'active' && <button className="reset-button" onClick={()=>reset()}><RotateCcw size={12}/>{mode==='real'?'重置本局':'重置演示'}</button>}
          {effectsEnabled && !audioReady && phase==='active' && <p className="audio-recovery">没有声音？点击“试听攻击音”启用；计数不受影响。</p>}
          <div className="privacy-note"><ShieldCheck size={16}/><p>你的动作，留在你的设备。<span>只在点击开启后采集；不上传、不录制视频。</span></p><LockKeyhole size={13}/></div>
          </div>
        </aside>
        {battleImmersive && <div className="battle-footer">
          <div className="battle-counter" aria-label={mode==='real'?'真实深蹲计数':'模拟深蹲计数'}><span>{mode==='real'?'真实动作次数 · 游戏模式':'模拟深蹲次数 · 按钮演示'}</span><strong aria-live="polite"><b key={`${mode}-${count}`} className={count>0?'count-punch':''}>{count}</b><em> / {TARGET}</em></strong><small><Clock3 size={13}/>本局用时 {formattedTime}</small></div>
          <div className={`battle-recognition battle-recognition-${visibleStatus.kind}`} role="status" aria-live="polite"><strong>{visibleStatus.kind === 'tracked' ? <Check size={28}/> : <span className="battle-status-dot"/>}{visibleStatus.title}</strong><p>{visibleStatus.hint}</p></div>
          <div className="battle-game-controls">{modeControls()}<span>{roundMessage}</span>
            {roundAction(battleActionButton)}
            {phase === 'active' && <button className="reset-button" onClick={()=>reset()}><RotateCcw size={12}/>{mode==='real'?'重置本局':'重置演示'}</button>}
          </div>
        </div>}
        {result&&<BattleResult key={result.roundId} result={result} onReplay={start} immersive={battleImmersive}/>}
      </div>

      <ProductGuide/>
    </main>
    <footer><span>GymGoGo <span className="footer-dot">·</span> 让运动多一点好玩。</span><span>MADE FOR YOUR NEXT LITTLE WIN <Heart size={12}/></span></footer>

    {help && <div className="modal-overlay" onClick={() => { setHelp(false); helpButton.current?.focus() }}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e=>e.stopPropagation()}><button ref={closeButton} className="close-button" aria-label="关闭玩法说明" onClick={() => { setHelp(false); helpButton.current?.focus() }}><X size={21}/></button><span className="modal-icon"><Swords size={27}/></span><div className="eyebrow">YOUR FIRST ADVENTURE</div><h2 id="help-title">先来一场小小的冒险</h2><p>和朋友玩：创建 2–6 人派对，输入昵称并选择帽子。三关每人分别完成 2、3、4 次深蹲；启用 AI 后还需每人每关答对一道题。一个人玩：下方单人挑战目标为 10 次，也提供明确标注的按钮演示。</p><ol><li>点击「开启摄像头」并亲自授权，全身入镜后可查看关键点。随时点击关闭即可停止采集。</li><li>真实模式点击「准备挑战」后再走远就位。主要关节入镜并连续识别约 2 秒，保持姿态等待 3 秒倒计时结束，再完成深蹲。倒计时离开画面会重新等待；随时可取消准备。</li><li>按钮演示中点击「模拟完成一次深蹲」触发攻击，真实动作不会增加模拟次数。两种模式均完成 10 次后通关。</li></ol><div className="modal-note"><ShieldCheck size={18}/> 原始视频仅本地处理，不录制、不上传；不做精准姿势诊断。AI 答题只发送题目与文字答案等必要信息，服务可用性以派对页提示为准。</div></section></div>}
  </div>
}
