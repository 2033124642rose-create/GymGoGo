import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, CircleCheck, Expand, Leaf, LoaderCircle, LogOut, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react'
import { CameraController } from './CameraController'
import type { CameraState } from './CameraController'
import { EMPTY_GROUPS } from './pose'
import type { PoseFrame } from './pose'
import { containFrame, isolateTrainingScreen } from './trainingScreen'
import { LocalCuePlayer, StableStatusAnnouncer } from './trainingFeedback'
import type { SoundMode, ChallengeCue } from './trainingFeedback'
import type { RefObject } from 'react'

export interface BattleRecognition { title: string; hint: string; kind: string }
interface CameraCampProps {
  screenRoot?: RefObject<HTMLElement | null>
  onImmersiveChange?: (value: boolean) => void
  onRecognitionChange?: (value: BattleRecognition) => void
  onPoseFrame?: (value: PoseFrame | null) => void
  challengeCue?: ChallengeCue
  countingMode?: boolean
}

const TRACKING_TEXT = {
  waiting: ['等待用户入镜', '向后站一点，让肩膀、髋部、膝盖和脚踝都进入画面。'],
  tracked: ['识别成功', '肩、髋、膝、踝已进入画面。骨骼跟随动作，不进行深蹲计数。'],
  partial: ['人体超出画面或关节点不清晰', '请让全身入镜，改善光线并减少遮挡；当前不判定动作。'],
  lost: ['人体超出画面', '暂未检测到人体，请回到镜头前；遮挡或光线不足也可能导致丢失。'],
} as const
const GROUP_NAMES = { shoulders: '肩膀', hips: '髋部', knees: '膝盖', ankles: '脚踝' } as const

export default function CameraCamp({ screenRoot, onImmersiveChange, onRecognitionChange, onPoseFrame, challengeCue, countingMode = false }: CameraCampProps = {}) {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const enterButton = useRef<HTMLButtonElement>(null)
  const exitButton = useRef<HTMLButtonElement>(null)
  const immersiveRef = useRef(false)
  const ownsFullscreen = useRef(false)
  const fullscreenRequest = useRef(0)
  const player = useRef<LocalCuePlayer | null>(null)
  const announcer = useRef<StableStatusAnnouncer | null>(null)
  const [immersive, setImmersive] = useState(false)
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [screenNotice, setScreenNotice] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const soundEnabledRef = useRef(true)
  const [soundMode, setSoundMode] = useState<SoundMode>('ready')
  const [soundDetail, setSoundDetail] = useState('')
  const [area, setArea] = useState({ width: 0, height: 0 })
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const controller = useRef<CameraController | null>(null)
  const [ratio, setRatio] = useState(4 / 3)
  const [state, setState] = useState<CameraState>({ phase: 'idle', tracking: 'waiting', groups: { ...EMPTY_GROUPS }, message: '' })
  const screenElement = () => screenRoot?.current ?? root.current
  const setScreen = (value: boolean) => { setImmersive(value); onImmersiveChange?.(value) }
  useEffect(() => {
    let alive = true
    const cues = new LocalCuePlayer((mode, detail = '') => { if (alive) { setSoundMode(mode); setSoundDetail(detail) } })
    const announcements = new StableStatusAnnouncer(cues)
    player.current = cues
    announcer.current = announcements
    return () => { alive = false; announcements.dispose(); player.current = null; announcer.current = null }
  }, [])

  function exitScreen() {
    fullscreenRequest.current++
    immersiveRef.current = false
    setScreen(false)
    setNativeFullscreen(false)
    if (document.fullscreenElement === screenElement()) void document.exitFullscreen?.().catch(() => {})
  }

  function enterScreen() {
    fullscreenRequest.current++
    immersiveRef.current = true
    setScreen(true)
    setScreenNotice('页面战斗大屏 · Esc 或退出按钮可返回')
    if (soundEnabled) void player.current?.unlock()
  }

  function requestNativeFullscreen() {
    const request = ++fullscreenRequest.current
    // Optional enhancement, invoked synchronously by its own explicit button.
    try {
      const element = screenElement()
      if (element?.requestFullscreen) {
        void element.requestFullscreen().catch(() => {
          if (request === fullscreenRequest.current && immersiveRef.current) setScreenNotice('浏览器未允许系统全屏，已使用页面大屏；可正常训练。')
        })
      } else setScreenNotice('浏览器不支持系统全屏，已使用页面大屏；可正常训练。')
    } catch { setScreenNotice('系统全屏不可用，已使用页面大屏；可正常训练。') }
  }

  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === screenElement()) {
        if (!immersiveRef.current) { void document.exitFullscreen?.().catch(() => {}); return }
        ownsFullscreen.current = true
        setNativeFullscreen(true)
        setScreenNotice('浏览器全屏 · Esc 或退出按钮可返回')
      } else if (ownsFullscreen.current) {
        ownsFullscreen.current = false
        setNativeFullscreen(false)
        immersiveRef.current = false
        setScreen(false)
      }
    }
    document.addEventListener('fullscreenchange', changed)
    return () => { document.removeEventListener('fullscreenchange', changed); fullscreenRequest.current++; immersiveRef.current = false }
  }, [])

  useEffect(() => {
    if (!immersive) return
    const restore = isolateTrainingScreen(screenElement()!)
    exitButton.current?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); exitScreen() }
      if (event.key === 'Tab') {
        const buttons = Array.from(screenElement()!.querySelectorAll<HTMLButtonElement>('button:not([disabled]):not([hidden])'))
          .filter(button => !button.closest('[hidden]'))
        const first = buttons[0], last = buttons.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', keys)
    return () => { restore(); window.removeEventListener('keydown', keys); enterButton.current?.focus() }
  }, [immersive])

  useEffect(() => {
    if (!immersive || !stage.current) return
    const measure = () => {
      const rect = stage.current!.getBoundingClientRect()
      setArea({ width: rect.width, height: rect.height })
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(stage.current)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [immersive, ratio])

  useEffect(() => {
    announcer.current?.update(soundEnabled && state.phase === 'running' ?
      (challengeCue && (state.tracking === 'tracked' || challengeCue === 'countdown' || challengeCue === 'won') ? challengeCue : state.tracking) : null)
  }, [soundEnabled, state.phase, state.tracking, challengeCue])
  useEffect(() => {
    const session = new CameraController(video.current!, canvas.current!, next => {
      setState(next)
      if (next.phase === 'idle' || next.phase === 'error') setRatio(4 / 3)
    }, undefined, frame => onPoseFrame?.(frame))
    controller.current = session
    const leave = () => session.stop()
    window.addEventListener('pagehide', leave)
    return () => { window.removeEventListener('pagehide', leave); session.stop(false); controller.current = null }
  }, [])
  const busy = state.phase === 'requesting' || state.phase === 'loading'
  const live = state.phase === 'loading' || state.phase === 'running'
  const active = busy || state.phase === 'running'
  const [title, originalHint] = state.phase === 'running' ? TRACKING_TEXT[state.tracking] :
    state.phase === 'requesting' ? ['等待摄像头授权', state.message] :
    state.phase === 'loading' ? ['正在加载姿态模型', state.message] :
    state.phase === 'error' ? ['观测暂时中断', state.message] : ['摄像头已关闭', '点击开启后再请求权限，原始画面只在你的浏览器中处理。']
  const hint = countingMode && state.phase === 'running' && state.tracking === 'tracked' ? '主要关节已入镜；准备挑战后，明显下蹲再起立即可攻击。' : originalHint
  const largeTitle = state.phase === 'running' ? {
    waiting: '等待全身入镜', tracked: '识别成功', partial: '请让全身入镜', lost: '未检测到人体',
  }[state.tracking] : title
  useEffect(() => {
    onRecognitionChange?.({ title: state.tracking === 'partial' && state.phase === 'running' ? '请调整站位' : largeTitle,
      hint, kind: state.phase === 'error' ? 'error' : state.phase === 'running' ? state.tracking : 'idle' })
  }, [state.phase, state.tracking, largeTitle, hint, onRecognitionChange])
  const fit = containFrame(area.width, area.height, ratio)
  const soundHint = !soundEnabled ? '语音提示已关闭。' : soundDetail || (
    soundMode === 'blocked' ? '声音被阻止，请点击「测试语音」启用。' :
    soundMode === 'unsupported' ? '本地语音不可用，请查看屏幕状态。' :
    soundMode === 'starting' ? '正在等待中文语音启动…' :
    soundMode === 'speech' ? '中文语音播放正常，仅在有效状态变化时提醒。' :
    soundMode === 'tone' ? '当前使用提示音备用，请点击「测试语音」重试中文语音。' :
    '点击「测试语音」确认声音，再走远训练；无需开启麦克风。')

  return <section ref={root} className={`camera-camp ${immersive ? 'is-immersive' : ''}`} role={immersive && !screenRoot ? 'dialog' : undefined}
    aria-modal={immersive && !screenRoot ? true : undefined} aria-label={immersive && !screenRoot ? '沉浸式游戏战斗模式' : '真实摄像头与姿态识别'}>
    <div className="camp-section-heading"><span>{immersive ? <Leaf size={23}/> : <Camera size={14}/>} {immersive ? <span><span className="training-wordmark">GymGoGo · </span>战斗大屏</span> : '营地观测区'}</span>
      <div className="camp-screen-actions"><span className="real-label">{countingMode ? '实时识别 · 游戏动作计数' : '真实识别 · 不计数'}</span>
        <button ref={enterButton} hidden={immersive} className="training-screen-button" onClick={enterScreen}><Expand size={16}/>战斗大屏</button>
        {immersive && !nativeFullscreen && <button className="training-native-button" onClick={requestNativeFullscreen}><Expand size={17}/>系统全屏</button>}
        {immersive && <button ref={exitButton} className="training-exit-button" onClick={exitScreen}><LogOut size={18}/>退出大屏</button>}
      </div>
    </div>
    <div ref={stage} className="camp-main-stage">
    <div className={`camp-camera-view ${live ? 'is-live' : ''}`} style={{ aspectRatio: ratio,
      ...(immersive && fit.width > 0 ? { width: fit.width, height: fit.height } : {}) }}>
      <video ref={video} muted playsInline className="camp-video" aria-label="本地摄像头实时画面"
        onLoadedMetadata={() => { if (video.current?.videoHeight) setRatio(video.current.videoWidth / video.current.videoHeight) }}
        onResize={() => { if (video.current?.videoHeight) setRatio(video.current.videoWidth / video.current.videoHeight) }}/>
      <canvas ref={canvas} className="camp-skeleton" aria-label="人体骨骼关键点叠加层"/>
      <span className={`camp-video-label ${live ? 'live' : ''}`}><i/>{live ? '本地画面 · 镜像显示' : '观测未开启'}</span>
      {!live && <div className="camp-camera-empty"><span className="camp-camera-emblem"><Camera size={30}/></span><strong>营地观测区</strong><span>整装待发，让身体成为冒险的主角。</span><small>画面不上传 · 不录制 · 不保存</small></div>}
      {state.phase === 'loading' && <div className="camp-loading"><LoaderCircle size={17}/> 正在准备骨骼识别…</div>}
    </div>
    </div>
    <div className={`camp-tracking camp-tracking-${state.phase === 'error' ? 'error' : state.phase === 'running' ? state.tracking : 'idle'}`} role={state.phase === 'error' ? 'alert' : 'status'} aria-live="polite">
      <strong>{immersive && state.phase === 'running' && state.tracking === 'tracked' ? <CircleCheck className="tracking-success-icon"/> : <i/>}{immersive ? largeTitle : title}</strong><p>{hint}</p>
    </div>
    <div className="camp-session-tools">
    {state.phase === 'running' && <div className="joint-status" aria-label="主要关节可见性">
      {Object.entries(GROUP_NAMES).map(([key, name]) => <span key={key} className={state.groups[key as keyof typeof GROUP_NAMES] ? 'visible' : ''}><i/>{name}{state.groups[key as keyof typeof GROUP_NAMES] ? '可见' : '待入镜'}</span>)}
    </div>}
    <div className="camera-controls">
      {!active ? <button className="camera-toggle" onClick={() => { if (soundEnabledRef.current) void player.current?.unlock(); void controller.current?.start() }}><Camera size={17}/>{state.phase === 'error' ? '重试开启摄像头' : '开启摄像头'}</button> :
        <button className="camera-stop" onClick={() => controller.current?.stop()}>{busy ? <X size={17}/> : <CameraOff size={17}/>} {busy ? '取消并关闭摄像头' : '关闭摄像头'}</button>}
      <>
        <button className="training-sound-button" aria-pressed={soundEnabled} onClick={() => {
          const enabled = !soundEnabled; soundEnabledRef.current = enabled; setSoundEnabled(enabled)
          if (enabled) void player.current?.unlock()
          else announcer.current?.update(null)
        }}>{soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}语音提示：{soundEnabled ? '开' : '关'}</button>
        <button className="training-sound-test" onClick={() => {
          soundEnabledRef.current = true; setSoundEnabled(true)
          player.current?.testVoice()
        }}>测试语音</button>
      </>
    </div>
    <p className="camera-scope"><ShieldCheck size={13}/>{countingMode ? '真实挑战中明显下蹲并起立即可攻击，不评价姿势是否标准。视频仅本地处理。' : '按钮演示模式：真实姿态不会增加模拟次数。'}</p>
    <p className="training-voice-status" role="status" aria-live="polite">{soundHint}</p>
    {immersive && <div className="training-screen-notes"><span>{screenNotice} · 退出大屏不关闭摄像头；语音开关独立于战斗音效。</span></div>}
    </div>
  </section>
}
