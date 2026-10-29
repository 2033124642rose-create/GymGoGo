import { HATS, HAT_IDS, defaultHat } from '../ar/hats'
import type { HatId } from '../ar/hats'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Flag, Leaf, Pause, Play, ShieldCheck, SkipForward, Trophy, Users, Volume2, X } from 'lucide-react'
import CameraCamp from '../camera/CameraCamp'
import type { BattleRecognition } from '../camera/CameraCamp'
import type { PoseFrame } from '../camera/pose'
import { BattleAudio } from '../game/BattleAudio'
import PartyMonster, { PartyBackdrop } from './PartyMonster'
import PartyFinal from './PartyFinal'
import { formatDuration } from '../settlement/review'
import { PARTY_LEVELS } from './levels'
import { PartySession, validateNames } from './PartySession'
import type { PartySnapshot } from './PartySession'
import './party.css'

export default function PartyGame({ onExit }: { onExit: () => void }) {
  const [size, setSize] = useState(2)
  const [names, setNames] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [hats, setHats] = useState<HatId[]>(() => Array.from({length:6},(_,index) => defaultHat(index)))
  const session = useRef<PartySession | null>(null)
  const [view, setView] = useState<PartySnapshot | null>(null)
  const [immersive, setImmersive] = useState(false)
  const screenRoot = useRef<HTMLDivElement>(null)
  const [recognition, setRecognition] = useState<BattleRecognition>({title:'摄像头已关闭',hint:'请主动开启摄像头。',kind:'idle'})
  const audio = useRef<BattleAudio | null>(null)
  const sound = useRef(true)
  const mounted = useRef(false)
  const [effects, setEffects] = useState(true)
  const [audioReady, setAudioReady] = useState(false)
  const [hit, setHit] = useState(false)
  const hitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startAt = useRef(0)
  const [seconds, setSeconds] = useState(0)
  const [confirmExit, setConfirmExit] = useState(false)
  const [showFinal,setShowFinal] = useState(false)
  const closeFinal=useCallback(()=>setShowFinal(false),[])
  const cancelExitButton = useRef<HTMLButtonElement>(null)
  const sync = useCallback(() => {
    const next = session.current?.snapshot()
    if (next) setView(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
  }, [])
  useEffect(() => {
    mounted.current = true
    const player = new BattleAudio(); audio.current = player
    return () => { mounted.current = false; player.dispose(); audio.current = null; clearTimeout(hitTimer.current) }
  }, [])
  useEffect(() => {
    const check = () => {
      session.current?.check(performance.now(), document.hidden); sync()
      const phase = session.current?.snapshot().phase
      if (phase && phase !== 'won' && phase !== 'exited') setSeconds(Math.floor((Date.now() - startAt.current) / 1000))
    }
    const timer = setInterval(check, 200)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [sync])
  useEffect(() => {
    if (!confirmExit) return
    cancelExitButton.current?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setConfirmExit(false) }
      if (event.key === 'Tab') {
        event.preventDefault()
        const buttons = screenRoot.current?.querySelectorAll<HTMLButtonElement>('.party-exit-dialog button')
        if (buttons?.length) (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus()
      }
    }
    window.addEventListener('keydown', keys, true)
    return () => window.removeEventListener('keydown', keys, true)
  }, [confirmExit])
  function mutate(action: (game: PartySession) => void) {
    if (!session.current) return
    action(session.current); audio.current?.silence(); setHit(false); clearTimeout(hitTimer.current); sync()
  }
  const onFrame = useCallback((frame: PoseFrame | null) => {
    if (!session.current) return
    if (document.hidden || (frame && performance.now() - frame.timestamp > 700)) {
      session.current.check(performance.now(), true); sync(); return
    }
    const effect = session.current.frame(frame)
    if (effect.countdown && sound.current) audio.current?.countdown()
    if (effect.attack) {
      setHit(true); clearTimeout(hitTimer.current); hitTimer.current = setTimeout(() => setHit(false), 450)
      if (sound.current) setAudioReady(audio.current?.strike() ?? false)
    }
    if (effect.levelWon && sound.current) audio.current?.victory()
    if (effect.won) {
      setShowFinal(true)
      setSeconds(Math.floor((Date.now() - startAt.current) / 1000))
    }
    sync()
  }, [sync])
  function prepare() {
    mutate(game => game.prepare(performance.now()))
    if (sound.current) void audio.current?.unlock().then(ready => { if (mounted.current && sound.current) setAudioReady(ready) })
  }
  function createParty(event: React.FormEvent) {
    event.preventDefault()
    const selected = names.slice(0, size)
    const issue = validateNames(selected)
    if (issue) { setError(issue); return }
    session.current = new PartySession(selected,hats.slice(0,size)); startAt.current = Date.now(); setSeconds(0); setError(''); sync()
  }
  function exitLevel() {
    // Pause before confirmation so moving to the keyboard cannot score a rep behind the dialog.
    mutate(game => game.pause(performance.now())); setConfirmExit(true)
  }
  function effectsControls() {
    return <div className="party-sound"><button aria-pressed={effects} onClick={() => {
      sound.current = !effects; setEffects(!effects)
      if (!sound.current) audio.current?.silence()
      else void audio.current?.unlock().then(ready => { if (mounted.current && sound.current) setAudioReady(ready) })
    }}><Volume2 size={15}/>战斗音效：{effects ? '开' : '关'}</button><button onClick={() => {
      sound.current = true; setEffects(true)
      void audio.current?.unlock().then(ready => {
        if (mounted.current && sound.current) { setAudioReady(ready); if (ready) audio.current?.strike() }
      })
    }}>试听攻击音</button></div>
  }
  function controls() {
    if (!view) return null
    const now = () => performance.now()
    if (view.phase === 'levelWon') return <div className="party-result"><Trophy/><strong>{view.levelIndex===0?'第一关':'第二关'}合作完成</strong><span>{view.level.reward} · 本关团队 {view.total} 次</span><p>下一关已解锁。可以先休息，不会自动开始。</p><button className="primary-button" onClick={()=>mutate(game=>game.nextLevel(now()))}>下一关 · {PARTY_LEVELS[view.levelIndex+1].name}</button><button onClick={()=>mutate(game=>game.pause(now()))}>休息</button><button onClick={exitLevel}>退出本关</button></div>
    if (view.phase === 'won') return <div className="party-result"><Trophy/><strong>三关合作完成</strong><span>全队累计 {view.teamTotal} 次 · {view.rewards.length} 枚徽章</span><button onClick={()=>setShowFinal(true)}>查看全队贡献</button><button onClick={onExit}>返回单人模式</button></div>
    if (view.phase === 'exited') return <div className="party-result"><strong>{view.completedLevels?'派对已结束 · 未完成三关':'本关已退出 · 未通关'}</strong><span>累计实际完成 {view.teamTotal} 次，{view.rewards.length?`已获 ${view.rewards.length} 枚徽章，保留奖励`:'未获得通关奖励'}。</span><button onClick={onExit}>返回单人模式</button></div>
    return <div className="party-actions">
      {view.phase === 'ready' && <button className="primary-button" onClick={prepare}><Play size={17}/>准备挑战</button>}
      {view.phase === 'preparing' && <button onClick={() => mutate(game => game.cancel(now()))}>取消准备</button>}
      {view.phase === 'active' && <strong className="party-active">真实动作计数中 · 下蹲后起立</strong>}
      {view.phase === 'turnComplete' && <button className="primary-button" onClick={() => mutate(game => game.next(now()))}>下一位玩家</button>}
      {(view.phase === 'paused' || view.phase === 'blocked') && <button className="primary-button" onClick={() => mutate(game => game.resume(now()))}>继续挑战</button>}
      {['ready','preparing','active','blocked','turnComplete'].includes(view.phase) && <button onClick={() => mutate(game => game.pause(now()))}><Pause size={15}/>休息</button>}
      {['ready','preparing','active'].includes(view.phase) && <button onClick={() => mutate(game => game.skip(now()))}><SkipForward size={15}/>跳过本回合</button>}
      <button onClick={exitLevel}><X size={15}/>退出本关</button>
      <p>{view.phase === 'blocked' ? '本轮所有未完成玩家都已跳过。请继续、休息或退出；不会自动轮转。' : view.phase === 'paused' ? '休息不计数，所有进度保留。继续后需重新准备。' : '跳过保留次数并排到队尾；只让当前玩家一人入镜。'}</p>
    </div>
  }
  if (!view) return <div className="app-shell party-shell"><header className="topbar"><strong className="party-wordmark"><Users/>GymGoGo · 本地派对</strong><button className="help-button" onClick={onExit}><ArrowLeft size={16}/>返回单人模式</button></header>
    <main className="party-setup"><span className="eyebrow">一台电脑 · 一个摄像头 · 轮流合作</span><h1>召集你的森林小队</h1><p>三关每人依次完成 2、3、4 次下蹲与起立，一起击败史莱姆、幽灵与巨龙。随时可以休息。</p>
      <form onSubmit={createParty}><label className="party-size">玩家人数<select aria-label="玩家人数" value={size} onChange={event => setSize(Number(event.target.value))}>{[2,3,4,5,6].map(n => <option key={n} value={n}>{n} 位玩家</option>)}</select></label>
        <div className="party-names">{names.slice(0,size).map((name,index) => <div key={index} className="party-player-setup"><label>玩家 {index+1}<input aria-label={`玩家 ${index+1} 昵称`} value={name} placeholder={`输入昵称（1–12字符）`} onChange={event => setNames(previous => previous.map((value,i) => i === index ? event.target.value : value))}/></label><label className="party-hat-choice">派对帽子<select aria-label={`玩家 ${index+1} 帽子`} value={hats[index]} onChange={event => setHats(previous => previous.map((value,i) => i===index ? event.target.value as HatId : value))}>{HAT_IDS.map(id => <option key={id} value={id}>{HATS[id].name}</option>)}</select></label><img className="party-hat-preview" src={HATS[hats[index]].src} alt={`玩家 ${index+1} 的${HATS[hats[index]].name}预览`}/></div>)}</div>
        {error && <p role="alert">{error}</p>}<button className="primary-button" type="submit"><Leaf size={18}/>创建派对 · 进入第一关</button>
      </form><p className="party-scope"><ShieldCheck size={16}/>昵称和进度只存本次页面，刷新会清空；视频不上传、不录制。三关合作已本地实现，待真人验收；团队 AI 战报尚未开发。</p>
    </main></div>

  const level=view.level
  const levelCleared=view.phase==='levelWon'||view.phase==='won'||view.completedLevels>view.levelIndex
  const current = view.players.find(player => player.id === view.currentId)!
  const currentIndex = view.players.findIndex(player => player.id === current.id) + 1
  const title = view.phase === 'paused' ? '休息中' : view.phase === 'blocked' ? '本关已暂停' : view.phase === 'turnComplete' ? '回合完成' : view.phase === 'levelWon' ? '本关通关！' : view.phase === 'won' ? '三关全通！' : view.phase === 'exited' ? '本关已退出' : view.phase === 'preparing' ? view.digit ? `准备开始 · ${view.digit}` : '等待当前玩家入镜' : view.phase === 'active' ? view.message : '等待准备'
  const cue = view.phase === 'preparing' && view.digit > 0 ? 'countdown' : view.phase === 'active' ? 'started' : (view.phase === 'levelWon'||view.phase === 'won') ? 'won' : undefined
  return <div className="app-shell party-shell"><header className="topbar"><strong className="party-wordmark"><Users/>GymGoGo · 本地派对</strong><span>三关本地测试 · 待真人验收 · AR 帽子保留</span><button className="help-button" onClick={() => { if (view.phase === 'won' || view.phase === 'exited') onExit(); else exitLevel() }}>返回单人模式</button></header>
    <main><div className="page-heading"><div><div className="eyebrow">LOCAL PARTY · 轮流出招，一起闯关</div><h1>森林小队，集结！</h1><p>不比速度，只为一起完成这场冒险。</p></div></div>
    <div ref={screenRoot} className={`game-layout party-battle party-theme-${level.theme} ${immersive ? 'is-battle-immersive' : ''}`} role={immersive ? 'dialog' : undefined} aria-modal={immersive || undefined} aria-label={immersive ? '沉浸式游戏战斗模式' : undefined}>
      <section className={`arena ${hit ? 'arena-hit' : ''}`} aria-label="派对怪兽战斗区"><div className="arena-top"><span className="level-badge"><Flag size={14}/>LEVEL 0{view.levelIndex+1}</span><span className="world-name">{level.name}</span><span className="demo-badge">LOCAL · {view.players.length}人</span></div>
        <div className="party-level-path" aria-label="关卡解锁进度">{PARTY_LEVELS.map((entry,i)=><span key={entry.id} aria-current={i===view.levelIndex?'step':undefined} className={i<view.completedLevels?'cleared':i===view.levelIndex?'current':'locked'}>{i<view.completedLevels?'✓ ':i>view.levelIndex?'🔒 ':''}{entry.name}</span>)}</div>
        <div className="arena-title"><h2>{level.name}</h2><p>每人 {level.target} 次，轮流出招 · 只有真实有效动作才扣血</p></div>
        <div className="monster-health"><div><span>{level.monster}</span><strong>{view.hp}<span> / {view.maxHp} HP</span></strong></div><div className="health-track" role="progressbar" aria-label="派对怪兽生命值" aria-valuemin={0} aria-valuemax={view.maxHp} aria-valuenow={view.hp}><div style={{width:`${view.hp/view.maxHp*100}%`}}/></div></div>
        <div className="scene"><PartyBackdrop theme={level.theme}/><div className="monster-speech">{levelCleared ? '好吧，这次是你们一起赢啦！' : view.total ? '你们这支小队，有点默契！' : level.visual==='ghost'?'迷雾里，谁在叫我？':level.visual==='dragon'?'我的城堡，欢迎勇敢的小队！':'森林小队？让我再睡五分钟…'}</div><PartyMonster level={level} hit={hit} defeated={levelCleared} count={view.total} total={view.players.length*level.target}/>
          {view.phase === 'preparing' && <div className="ready-overlay" role="status"><strong>{view.digit || '等待就位'}</strong><span>当前玩家全身入镜 · 准备期间不计数</span></div>}
          {hit && <div key={view.total} className="damage">−{level.damage}</div>}
          {hit && <div key={`burst-${view.total}`} className="hit-burst" aria-hidden="true">{Array.from({length:6},(_,i)=><span key={i}/>)}</div>}
          {levelCleared && <div className="victory"><Trophy/><strong>{level.name}通关！</strong><span>{level.reward}</span></div>}
          {levelCleared && <div className="confetti" aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{left:`${4+i*5.3}%`,animationDelay:`${i%5*.12}s`,backgroundColor:['#bce58a','#dfcfef','#f5dda3'][i%3]}}/>)}</div>}
        </div><div className="arena-bottom"><span>团队有效动作：{view.total} / {view.players.length*level.target}</span><span>休息与跳过不会扣血</span></div>
      </section>
      <aside className="training-panel"><div className="panel-title"><span><Users size={18}/>小队观测营地</span><span className="local-tag">仅当前玩家入镜</span></div>
        {view.phase !== 'exited' && <CameraCamp hat={{id:current.hat,playerId:current.id}} screenRoot={screenRoot} onImmersiveChange={setImmersive} onRecognitionChange={setRecognition} onPoseFrame={onFrame} challengeCue={cue} countingMode/>}
        {!immersive && <><div className="party-current" role="status"><span>当前玩家 · #{currentIndex}</span><strong>{current.name}</strong><b>{current.count} / {level.target}</b><p>{title}</p></div>{controls()}{effectsControls()}{effects && !audioReady && view.phase==='active' && <p className="audio-recovery">没有攻击音？点击试听攻击音；计数不受影响。</p>}</>}
      </aside>
      {immersive && <div className="battle-footer party-footer"><div className="battle-counter"><span>当前玩家 · #{currentIndex} {current.name}</span><strong aria-live="polite"><b key={current.count}>{current.count}</b><em> / {level.target}</em></strong><small>第 {view.levelIndex+1} / 3 关 · 本关 {view.total} 次 · 累计 {view.teamTotal} 次 · 经过时间 {formatDuration(seconds)}（含休息）</small></div><div className="battle-recognition" role="status"><strong>{title}</strong><p>{recognition.title} · {view.message}</p></div><div className="battle-game-controls">{controls()}{effectsControls()}</div></div>}
      {confirmExit && <div className="modal-overlay"><section className="help-modal party-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="party-exit-title"><h2 id="party-exit-title">退出本关？</h2><p>游戏已暂停。退出将结束整场派对，保留已获徽章与实际贡献，不算三关通关。</p><button ref={cancelExitButton} onClick={() => setConfirmExit(false)}>留在休息区</button><button onClick={() => { if (document.fullscreenElement === screenRoot.current) void document.exitFullscreen?.().catch(() => {}); setImmersive(false); mutate(game => game.exit(performance.now())); setConfirmExit(false) }}>确认退出本关</button></section></div>}
      {showFinal && view.phase==='won' && <PartyFinal result={view} seconds={seconds} onClose={closeFinal} onExit={onExit}/>}
    </div>
    <section className="party-roster" aria-label="小队贡献"><h2>每一次出招，都是小队的力量</h2><p>已获 {view.rewards.length} / 3 枚徽章 · 团队累计 {view.teamTotal} 次 · 整场经过时间 {formatDuration(seconds)}（含轮换和休息）。昵称、进度仅保留在本页面，刷新会清空。</p><div>{view.players.map((player,index) => <article key={player.id} className={view.currentId===player.id?'is-current':''}><span>玩家 #{index+1}</span><h3>{player.name}</h3><span className="party-roster-hat"><img src={HATS[player.hat].src} alt=""/>{HATS[player.hat].name}</span><strong>{player.count} / {level.target} 次</strong><p>三关记录：{player.counts.join(' / ')} · 累计 {player.totalCount} 次</p><p>团队累计贡献：{view.teamTotal ? (player.totalCount/view.teamTotal*100).toFixed(1) : '0.0'}%{player.count===level.target?' · 本关已完成':view.queue.includes(player.id)?' · 待完成':''}</p></article>)}</div><small>贡献按已完成次数计算，百分比四舍五入。不代表动作标准或健康收益。本地三关合作版 · 团队 AI 战报尚未开发。</small></section>
    </main></div>
}
