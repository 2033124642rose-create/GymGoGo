import { useEffect, useRef, useState } from 'react'
import CameraCamp from './camera/CameraCamp'
import type { BattleRecognition } from './camera/CameraCamp'
import { ArrowRight, Camera, Check, ChevronRight, CircleHelp, Clock3, Flag, Heart, Leaf, LockKeyhole, Play, RotateCcw, ShieldCheck, Sparkles, Swords, Trophy, X, Zap } from 'lucide-react'

const TARGET = 10

// Every hit adds a persistent cartoon mark; resetting the count clears them all.
const WOUND_MARKS = [
  { x: 132, y: 231, rotation: -22, kind: 'scratch' },
  { x: 294, y: 232, rotation: 24, kind: 'bandage' },
  { x: 181, y: 116, rotation: -15, kind: 'scratch' },
  { x: 245, y: 272, rotation: -20, kind: 'bruise' },
  { x: 116, y: 275, rotation: 25, kind: 'bandage' },
  { x: 286, y: 119, rotation: 18, kind: 'scratch' },
  { x: 185, y: 286, rotation: 20, kind: 'bandage' },
  { x: 318, y: 260, rotation: -25, kind: 'bruise' },
  { x: 217, y: 147, rotation: 12, kind: 'bandage' },
  { x: 262, y: 306, rotation: -10, kind: 'scratch' },
] as const

function Monster({ hit, defeated, damageCount }: { hit: boolean; defeated: boolean; damageCount: number }) {
  return <svg className={`monster ${hit ? 'monster-hit' : ''} ${defeated ? 'monster-defeated' : ''}`} viewBox="0 0 440 370" role="img" aria-label={`贪睡团子：已受到 ${damageCount} 次攻击，身上有 ${damageCount} 处卡通伤痕`}>
    <defs>
      <linearGradient id="body" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#dbffa6"/><stop offset=".55" stopColor="#a3de6c"/><stop offset="1" stopColor="#64aa57"/></linearGradient>
      <linearGradient id="horn" x2="0.4" y2="1"><stop stopColor="#fdf1bf"/><stop offset="1" stopColor="#d7bd7d"/></linearGradient>
      <radialGradient id="belly"><stop stopColor="#eff9bb"/><stop offset="1" stopColor="#cbe990"/></radialGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="13" stdDeviation="8" floodColor="#19232b" floodOpacity=".3"/></filter>
    </defs>
    <ellipse cx="220" cy="332" rx="115" ry="18" fill="#111321" opacity=".28"/>
    <g key={damageCount} className="monster-body" filter="url(#shadow)">
      <path d="M315 254q62 17 64-35 23 61-36 73" fill="#7dbb59" stroke="#51894b" strokeWidth="3"/>
      <path d="M130 120Q86 65 106 58q38 8 56 44M281 102q22-45 52-43 16 26-24 70" fill="url(#horn)" stroke="#a5ad68" strokeWidth="3"/>
      <ellipse cx="153" cy="310" rx="39" ry="23" fill="#7bb75a"/>
      <ellipse cx="284" cy="310" rx="39" ry="23" fill="#7bb75a"/>
      <path d="M108 172C100 97 151 79 217 84c66-9 122 29 116 97l13 75c8 50-36 65-123 64-92 2-140-18-128-66z" fill="url(#body)" stroke="#89bd64" strokeWidth="3"/>
      <path d="m196 87 16-24 15 23 16-17 10 20" fill="#b9eb86"/>
      <ellipse cx="221" cy="265" rx="67" ry="46" fill="url(#belly)" opacity=".85"/>
      <path d="M108 209q-47 4-44 43c3 15 20 8 32-8M331 205q48 1 48 38c-1 19-21 9-32-1" fill="url(#body)" stroke="#89bd64" strokeWidth="3"/>
      <ellipse cx="165" cy="179" rx="27" ry="33" fill="#f9fff0"/>
      <ellipse cx="275" cy="179" rx="27" ry="33" fill="#f9fff0"/>
      {defeated ? <g stroke="#33453e" strokeWidth="6" strokeLinecap="round"><path d="m154 179 18-12m-18 0 18 12m94 0 18-12m-18 0 18 12"/></g> : damageCount >= 7 ? <g fill="none" stroke="#33453e" strokeWidth="5" strokeLinecap="round"><path d="m157 177 20 8-20 7m121-15-20 8 20 7"/></g> : <g fill="#293b35"><ellipse cx="173" cy="184" rx="12" ry={damageCount >= 4 ? 12 : 18}/><ellipse cx="267" cy="184" rx="12" ry="18"/><g fill="white"><circle cx="177" cy="178" r="4"/><circle cx="271" cy="178" r="4"/></g></g>}
      <ellipse cx="139" cy="211" rx="19" ry="9" fill="#f5a4a2" opacity=".7"/><ellipse cx="302" cy="211" rx="19" ry="9" fill="#f5a4a2" opacity=".7"/>
      {damageCount < 4 ? <><path d="M197 214q24 27 48 0" fill="#425143" stroke="#3d5544" strokeWidth="4" strokeLinecap="round"/><path d="m202 220 7 12 7-8m15 0 7 8 5-12" fill="#fff9db"/></> : <path d={damageCount >= 7 ? 'm200 227 10-6 10 6 10-6 10 6' : 'M204 228q16-18 32 0'} fill="none" stroke="#425143" strokeWidth="4" strokeLinecap="round"/>}
      <g fill="#74b95a" opacity=".6"><circle cx="127" cy="151" r="6"/><circle cx="308" cy="143" r="5"/><circle cx="123" cy="273" r="6"/><circle cx="312" cy="279" r="8"/></g>
      <path d="m153 317 1 8m13-9 2 8m104-7-1 8m13-9 1 7" stroke="#d0e7a3" strokeWidth="5" strokeLinecap="round"/>
      {WOUND_MARKS.slice(0, damageCount).map((mark, index) => <g key={index} className="wound-mark" data-wound={index + 1} transform={`translate(${mark.x} ${mark.y}) rotate(${mark.rotation})`}>
        {mark.kind === 'scratch' ? <g fill="none" stroke="#966478" strokeWidth="3.5" strokeLinecap="round"><path d="m-10-6 5 12m3-14 5 12m3-14 5 12"/></g> : mark.kind === 'bandage' ? <g><rect x="-18" y="-8" width="36" height="16" rx="6" fill="#ffe0b5" stroke="#bc9a76" strokeWidth="1.5"/><rect x="-6" y="-7" width="12" height="14" rx="2" fill="#edbd95"/><g fill="#bf946e"><circle cx="-12" cy="-2" r="1"/><circle cx="-12" cy="3" r="1"/><circle cx="12" cy="-2" r="1"/><circle cx="12" cy="3" r="1"/></g></g> : <g><ellipse rx="15" ry="10" fill="#9b7bb0" opacity=".65"/><path d="m-7-3 4 6m3-7 4 6" stroke="#785d91" strokeWidth="2" strokeLinecap="round"/></g>}
      </g>)}
      {damageCount >= 4 && <path d="M322 158q-16 21 0 22 14-1 0-22" fill="#a4e5f5" stroke="#66b4c6" strokeWidth="1.5"/>}
    </g>
  </svg>
}

function ForestBackdrop() {
  return <svg className="forest-backdrop" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="forest-ground" x2="0" y2="1"><stop stopColor="#49634d" stopOpacity=".25"/><stop offset="1" stopColor="#263f35"/></linearGradient>
      <radialGradient id="clearing-light"><stop stopColor="#adc789" stopOpacity=".18"/><stop offset="1" stopColor="#adc789" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="500" cy="330" rx="360" ry="165" fill="url(#clearing-light)"/>
    <g fill="#50634f" opacity=".16">
      <path d="M80 350Q102 225 94 15h23q-3 186 33 335zM177 335q30-181 11-335h18q-5 188 26 335zM790 340q22-171 9-330h21q-7 184 30 330zM883 350q20-180 2-350h27q-12 205 20 350z"/>
      <path d="M105 134Q57 97 20 118q20-62 94-35 42-55 102-31-38 45-111 82M807 136q-75-14-101-58 61-22 102 19 68-46 113-16-25 45-114 55"/>
    </g>
    <path d="M0 305Q153 267 320 319t349 2q190-63 331-21v100H0z" fill="url(#forest-ground)"/>
    <path d="M0 361q165-37 319-8 175 29 344 0t337 2v45H0z" fill="#253a31" opacity=".8"/>
    <ellipse cx="500" cy="358" rx="192" ry="20" fill="#729165" opacity=".09"/>
    <g fill="#324b3b">
      <path d="M0 385q38-139 13-292L0 70v315m5-181q40-42 79-45-18 41-76 59m7-81Q54 89 82 90q-9 37-67 61M0 159q-35-53-58-63 1 53 58 77"/>
      <path d="M1000 392q-31-178-6-302l6-21v323m-5-181q-49-43-88-38 17 34 86 53m0-79q-31-49-72-54 9 37 71 70"/>
    </g>
    <g stroke="#657b50" strokeWidth="2" fill="#4c6847" opacity=".75">
      <path d="M70 400q-8-42-40-65m34 45q-38 3-41-23 27-2 41 23m-10-17q9-26-10-36-7 17 10 36m13 26q23-28 5-43-13 18-5 43"/>
      <path d="M942 400q0-40 36-75m-27 48q36-1 40-23-25-3-40 23m15-24q-12-25 5-35 11 15-5 35m-18 38q-28-19-15-40 17 11 15 40"/>
    </g>
    <g fill="#aebc7d" opacity=".5"><ellipse cx="143" cy="367" rx="10" ry="3" transform="rotate(-24 143 367)"/><ellipse cx="841" cy="381" rx="9" ry="3" transform="rotate(20 841 381)"/></g>
  </svg>
}

export default function App() {
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
    setCount(0); setSeconds(0); setHit(false)
    startTime.current = Date.now()
    setPhase('active')
    requestAnimationFrame(() => (battleImmersive ? battleActionButton : actionButton).current?.focus())
  }
  function reset() { setPhase('idle'); setCount(0); setSeconds(0); setHit(false) }
  function attack() {
    if (phase !== 'active') return
    const next = Math.min(TARGET, count + 1)
    setCount(next); setHit(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setHit(false), 450)
    if (next === TARGET) {
      setSeconds(Math.floor((Date.now() - startTime.current) / 1000))
      setPhase('won')
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#main" aria-label="GymGoGo 首页"><span className="brand-mark"><Zap fill="currentColor" size={25}/></span><span>Gym<span className="brand-go">GoGo</span><small>AI 健身冒险家</small></span></a>
      <div className="header-center"><span className="green-dot"/> 今天也要，为自己升级。</div>
      <button ref={helpButton} className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17}/> 玩法说明</button>
    </header>

    <main id="main">
      <div className="page-heading"><div><div className="eyebrow"><Leaf size={15}/> GYM GOGO · 森林冒险启程</div><h1>把每一次深蹲，<span>变成一次冒险。</span></h1><p>营地已经点亮，森林里的小团子还在打盹。<br className="hero-mobile-break"/>动一动，开启属于你的第一场冒险。</p></div><span className="prototype-tag"><span/> 第二阶段 · 姿态识别体验 · 动作计数待接入</span></div>

      <div ref={battleRoot} className={`game-layout ${battleImmersive ? 'is-battle-immersive' : ''}`}
        role={battleImmersive ? 'dialog' : undefined} aria-modal={battleImmersive ? true : undefined}
        aria-label={battleImmersive ? '沉浸式游戏战斗模式' : undefined}>
        <section className={`arena ${hit ? 'arena-hit' : ''}`} aria-label="深蹲挑战游戏区域">
          <div className="arena-top"><span className="level-badge"><Flag size={14}/> LEVEL 01</span><span className="world-name"><Leaf size={14}/> 萌芽森林 <ChevronRight size={13}/> 初次相遇</span><span className="demo-badge">DEMO</span></div>
          <div className="arena-title"><h2>深蹲挑战</h2><p>第一站 · 唤醒森林里的贪睡团子</p></div>
          <div className="monster-health"><div><span><span className="monster-dot"/> 贪睡团子 <small>森林守门员</small></span><strong>{hp}<span> / 100 HP</span></strong></div><div className="health-track" role="progressbar" aria-label="怪兽生命值" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hp}><div style={{width: `${hp}%`}}/></div></div>
          <div className="scene">
            <ForestBackdrop/>
            <div className="forest-motes" aria-hidden="true">{Array.from({ length: 3 }, (_, i) => <span key={i} style={{ left: `${20 + i * 30}%`, animationDelay: `${i * 1.7}s` }}/>)}</div>
            <div className="monster-speech">{phase === 'won' ? '好吧，今天你赢啦！' : count >= 7 ? '等一下，我的绷带不够啦！' : count >= 4 ? '哎哟，真的醒了…' : count > 0 ? '嘿！有点实力嘛…' : '再睡五分钟… z Z'}</div>
            <Monster hit={hit} defeated={phase === 'won'} damageCount={count}/>
            {count > 0 && <div key={`combo-${count}`} className="combo-badge"><Zap size={16} fill="currentColor"/><strong>{count} HIT</strong><span>{phase === 'won' ? '完美收官！' : count >= 7 ? '胜利就在眼前！' : count >= 4 ? '冒险家，势不可挡！' : '漂亮的一击！'}</span></div>}
            {hit && <div key={count} className="damage">−10 <Zap size={22} fill="currentColor"/></div>}
            {hit && <div key={`burst-${count}`} className="hit-burst" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i}/>)}</div>}
            {phase === 'won' && <div className="victory"><Trophy size={20}/><strong>挑战通关！</strong><span>演示完成 · {count} 次 · {formattedTime}</span></div>}
            {phase === 'won' && <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${4 + i * 5.3}%`, animationDelay: `${i % 5 * .12}s`, backgroundColor: ['#c2d99e', '#d8e6aa', '#a5ef3f'][i % 3] }}/>)}</div>}
          </div>
          <div className="arena-bottom"><span><Swords size={16}/> 模拟一次深蹲 <ArrowRight size={13}/> 一次攻击</span><span>仅按钮模拟 · 真实姿态不触发攻击</span></div>
        </section>

        <aside className="training-panel" aria-label="训练控制区域">
          <div className="panel-title"><span><Leaf size={19}/> 冒险者营地</span><span className="local-tag">画面留在本地</span></div>
          <CameraCamp screenRoot={battleRoot} onImmersiveChange={setBattleImmersive} onRecognitionChange={setRecognition}/>
          <div className="camp-simulation" hidden={battleImmersive}>
          <div className="simulation-heading"><strong>按钮模拟挑战</strong><small>与摄像头识别独立</small></div>
          <div className="stats"><div><span><Swords size={14}/> 模拟次数</span><strong>{count}<small> / {TARGET} 次</small></strong></div><div><span><Clock3 size={14}/> 模拟用时</span><strong>{formattedTime}</strong></div></div>
          <div className="target-row"><span><Flag size={15}/> 本关目标</span><strong>完成 {TARGET} 次深蹲</strong></div>
          <div className="progress-dots" aria-label={`完成 ${count} 次，共 ${TARGET} 次`}>{Array.from({length: TARGET}, (_, i) => <span key={i} className={i < count ? 'done' : ''}>{i < count ? <Check size={12}/> : ''}</span>)}</div>
          {phase === 'idle' ? <button className="primary-button" onClick={start}><Play size={18} fill="currentColor"/> 开始挑战 <ArrowRight size={19}/></button> : phase === 'active' ? <button ref={actionButton} className="primary-button" onClick={attack}><Zap size={19} fill="currentColor"/> 模拟完成一次深蹲 <ArrowRight size={19}/></button> : <button className="primary-button" onClick={start}><RotateCcw size={18}/> 再挑战一次 <ArrowRight size={19}/></button>}
          <div className="status-message" role="status" aria-live="polite">{phase === 'idle' ? '演示模式 · 点击开始，无需摄像头权限' : phase === 'active' ? `演示中 · 已模拟 ${count} 次，点击按钮触发攻击` : '通关啦！这里的数据来自按钮模拟，并非真实训练。'}</div>
          {phase === 'active' && <button className="reset-button" onClick={reset}><RotateCcw size={12}/> 重置演示</button>}
          <div className="privacy-note"><ShieldCheck size={16}/><p>你的动作，留在你的设备。<span>只在点击开启后采集；不上传、不录制视频。</span></p><LockKeyhole size={13}/></div>
          </div>
        </aside>
        {battleImmersive && <div className="battle-footer">
          <div className="battle-counter" aria-label="模拟深蹲计数"><span>模拟深蹲次数 · 非自动计数</span><strong aria-live="polite"><b>{count}</b><em> / {TARGET}</em></strong><small><Clock3 size={13}/> 本局模拟用时 {formattedTime}</small></div>
          <div className={`battle-recognition battle-recognition-${recognition.kind}`} role="status" aria-live="polite"><strong>{recognition.kind === 'tracked' ? <Check size={28}/> : <span className="battle-status-dot"/>}{recognition.title}</strong><p>{recognition.hint}</p></div>
          <div className="battle-game-controls"><span>{phase === 'won' ? '模拟通关！准备下一场冒险。' : '真实姿态不自动计数，攻击仍由按钮模拟。'}</span>
            {phase === 'idle' ? <button className="primary-button" onClick={start}><Play size={18} fill="currentColor"/>开始挑战<ArrowRight size={19}/></button> : phase === 'active' ? <button ref={battleActionButton} className="primary-button" onClick={attack}><Zap size={19} fill="currentColor"/>模拟完成一次深蹲<ArrowRight size={19}/></button> : <button className="primary-button" onClick={start}><RotateCcw size={18}/>再挑战一次<ArrowRight size={19}/></button>}
            {phase === 'active' && <button className="reset-button" onClick={reset}><RotateCcw size={12}/>重置演示</button>}
          </div>
        </div>}
      </div>

      <section className="how-it-works" aria-label="冒险指南">
        <div className="guide-title"><span className="guide-icon"><Sparkles size={25}/></span><div><span className="guide-kicker">冒险新手村 · 正式玩法预告</span><h2>小动作，大冒险</h2><p>三步出发，快乐升级。</p></div></div>
        {[
          { icon: Camera, title: '准备好你的空间', text: '腾出一小块冒险地，让全身进入镜头。', label: '准备出发' },
          { icon: Swords, title: '用动作发起攻击', text: '蹲一下，出招！让团子的血条一点点下降。', label: '释放能量' },
          { icon: Trophy, title: '收获你的通关时刻', text: '达成小目标，把今天的成就感收入囊中。', label: '快乐升级' },
        ].map((step, i) => <div className={`guide-step guide-step-${i + 1}`} key={step.title}><div className="step-top"><span className="step-icon"><step.icon size={23}/></span><span className="step-number">0{i + 1}</span></div><div><h3>{step.title}</h3><p>{step.text}</p></div><span className="step-label">{step.label}<ArrowRight size={14}/></span></div>)}
      </section>
      <div className="demo-notice"><Sparkles size={15}/><span>第二阶段说明：可手动开启摄像头查看真实骨骼关键点；动作计数和攻击仍由按钮模拟。未接入自动深蹲计数、真实攻击联动或 AI 评价。</span></div>
    </main>
    <footer><span>GymGoGo <span className="footer-dot">·</span> 让运动多一点好玩。</span><span>MADE FOR YOUR NEXT LITTLE WIN <Heart size={12}/></span></footer>

    {help && <div className="modal-overlay" onClick={() => { setHelp(false); helpButton.current?.focus() }}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e=>e.stopPropagation()}><button ref={closeButton} className="close-button" aria-label="关闭玩法说明" onClick={() => { setHelp(false); helpButton.current?.focus() }}><X size={21}/></button><span className="modal-icon"><Swords size={27}/></span><div className="eyebrow">YOUR FIRST ADVENTURE</div><h2 id="help-title">先来一场小小的冒险</h2><p>第二阶段有两个独立体验：摄像头查看真实骨骼，按钮模拟游戏。</p><ol><li>点击「开启摄像头」并亲自授权，全身入镜后可查看关键点。随时点击关闭即可停止采集。</li><li>点击「开始挑战」启动模拟计时，再点击「模拟完成一次深蹲」触发一次攻击。</li><li>完成 10 次按钮模拟后通关，可重新挑战；真实动作不会增加次数。</li></ol><div className="modal-note"><ShieldCheck size={18}/> 原始视频仅本地处理，不录制、不上传；自动计数与 AI 未接入。</div></section></div>}
  </div>
}
