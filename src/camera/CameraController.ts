import { assessPose, drawPose, EMPTY_GROUPS } from './pose'
import type { JointGroups, Point, Tracking } from './pose'

export type Phase = 'idle' | 'requesting' | 'loading' | 'running' | 'error'
export interface CameraState { phase: Phase; tracking: Tracking; groups: JointGroups; message: string; backend?: string }
interface WorkerReply { type: 'ready' | 'result' | 'error'; landmarks?: Point[]; inferenceMs?: number; backend?: string; code?: string }
export interface PoseWorker {
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
  terminate(): void
}
export interface CameraEnvironment {
  getMedia(): Promise<MediaStream>
  createWorker(): PoseWorker
  getFrame(video: HTMLVideoElement): Promise<ImageBitmap>
  schedule(callback: FrameRequestCallback): number
  cancel(id: number): void
  now(): number
}
const environment: CameraEnvironment = {
  getMedia: () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia ||
      typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      return Promise.reject(new Error('unsupported'))
    }
    return navigator.mediaDevices.getUserMedia({ audio: false, video: {
      facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 },
    } })
  },
  createWorker: () => new Worker('/pose-worker.js') as PoseWorker,
  getFrame: video => {
    const width = Math.min(640, video.videoWidth)
    return createImageBitmap(video, { resizeWidth: width, resizeHeight: Math.round(video.videoHeight * width / video.videoWidth) })
  },
  schedule: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id), now: () => performance.now(),
}

export function cameraError(error: unknown): string {
  // DOMException may come from a different realm and need not be instanceof Error.
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return '摄像头权限未获授权。请在浏览器地址栏允许摄像头后重试。'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '未找到摄像头，请连接设备后重试。'
  if (name === 'NotReadableError' || name === 'TrackStartError') return '摄像头无法读取，可能正被其他应用占用，请关闭占用应用后重试。'
  if (name === 'OverconstrainedError') return '摄像头不支持当前采集条件，请换用其他摄像头后重试。'
  if (error instanceof Error && error.message === 'unsupported') return '此环境不支持摄像头或后台识别。请使用新版 Chrome / Edge，通过 localhost 或 HTTPS 打开页面。'
  return '摄像头启动失败，请检查设备连接、系统权限后重试。'
}

const initialState = (): CameraState => ({ phase: 'idle', tracking: 'waiting', groups: { ...EMPTY_GROUPS }, message: '' })

// Session generations prevent late permission grants / image captures from reviving a stopped session.
export class CameraController {
  state = initialState()
  private generation = 0
  private stream: MediaStream | null = null
  private worker: PoseWorker | null = null
  private animation = 0
  private watchdog: ReturnType<typeof setTimeout> | undefined
  private inFlight = false
  private lastFrameTime = -1
  private lastCapture = -Infinity
  private interval = 1000 / 15
  private hasSeen = false
  private candidate: Tracking = 'waiting'
  private candidateCount = 0
  private ended = () => this.fail('摄像头连接已中断或系统权限已撤回。请检查设备后重新开启。')

  constructor(private video: HTMLVideoElement, private canvas: HTMLCanvasElement,
    private onState: (state: CameraState) => void, private env = environment) {}

  private update(patch: Partial<CameraState>) {
    this.state = { ...this.state, ...patch }
    this.onState(this.state)
  }

  async start() {
    if (['requesting', 'loading', 'running'].includes(this.state.phase)) return
    this.stop(false)
    const generation = this.generation
    this.update({ ...initialState(), phase: 'requesting', message: '请在浏览器提示中允许摄像头。也可以随时取消。' })
    try {
      const stream = await this.env.getMedia()
      if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', this.ended))
      this.video.srcObject = stream
      this.watchdog = setTimeout(() => this.fail('视频启动超时，请检查摄像头后重试。'), 15_000)
      await this.video.play()
      if (generation !== this.generation) return
      clearTimeout(this.watchdog)
      this.update({ phase: 'loading', message: '画面已开启，正在加载本地姿态模型；首次可能需要数秒。' })
      const worker = this.env.createWorker()
      this.worker = worker
      this.watchdog = setTimeout(() => this.fail('姿态模型加载超时，摄像头已关闭。请刷新页面后重试。'), 45_000)
      worker.onerror = event => { event.preventDefault?.(); if (generation === this.generation) this.fail('姿态识别线程启动失败，摄像头已关闭。请使用新版 Chrome / Edge 后重试。') }
      worker.onmessage = ({ data }) => {
        if (generation !== this.generation) return
        clearTimeout(this.watchdog)
        if (data.type === 'ready') {
          this.update({ phase: 'running', tracking: 'waiting', message: '', backend: data.backend })
          this.animation = this.env.schedule(() => this.tick(generation))
        } else if (data.type === 'result') {
          this.inFlight = false
          this.interval = Math.max(1000 / 15, Math.min(250, (data.inferenceMs ?? 0) * 1.15))
          const points = data.landmarks ?? []
          drawPose(this.canvas, points)
          const assessment = assessPose(points, this.hasSeen)
          if (points.length > 0) this.hasSeen = true
          this.candidateCount = this.candidate === assessment.tracking ? this.candidateCount + 1 : 1
          this.candidate = assessment.tracking
          // Three consecutive observations reduce status flicker without retaining stale skeletons.
          if (this.candidateCount >= 3 && (this.state.tracking !== assessment.tracking ||
            JSON.stringify(this.state.groups) !== JSON.stringify(assessment.groups))) {
            this.update({ tracking: assessment.tracking, groups: assessment.groups })
          }
        } else {
          this.fail(data.code === 'model' ? '姿态模型加载失败，摄像头已关闭。请刷新页面后重试；仍失败可检查模型资源或更换浏览器。' :
            '姿态识别发生错误，摄像头已关闭。请重试或更换新版 Chrome / Edge。')
        }
      }
      worker.postMessage({ type: 'init' })
    } catch (error) {
      if (generation === this.generation) this.fail(cameraError(error))
    }
  }

  private tick(generation: number) {
    if (generation !== this.generation || this.state.phase !== 'running') return
    this.animation = this.env.schedule(() => this.tick(generation))
    const now = this.env.now()
    if (this.inFlight || this.video.readyState < 2 || this.video.videoWidth === 0 ||
      this.video.currentTime === this.lastFrameTime || now - this.lastCapture < this.interval) return
    this.inFlight = true
    this.lastFrameTime = this.video.currentTime
    this.lastCapture = now
    this.watchdog = setTimeout(() => this.fail('姿态识别响应超时，摄像头已关闭。请关闭其他高负载应用后重试。'), 10_000)
    void this.env.getFrame(this.video).then(frame => {
      if (generation !== this.generation || !this.worker) { frame.close(); return }
      // Assigning canvas dimensions clears it; do this only when the source resolution changes.
      if (this.canvas.width !== frame.width) this.canvas.width = frame.width
      if (this.canvas.height !== frame.height) this.canvas.height = frame.height
      try {
        this.worker.postMessage({ type: 'frame', frame, timestamp: now }, [frame])
      } catch (error) {
        frame.close()
        throw error
      }
    }).catch(() => {
      if (generation === this.generation) this.fail('无法读取摄像头画面，摄像头已关闭。请使用新版 Chrome / Edge 后重试。')
    })
  }

  private fail(message: string) {
    this.stop(false)
    this.update({ ...initialState(), phase: 'error', message })
  }

  stop(notify = true) {
    this.generation++
    this.env.cancel(this.animation)
    clearTimeout(this.watchdog)
    this.stream?.getVideoTracks().forEach(track => track.removeEventListener('ended', this.ended))
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    this.worker?.terminate()
    this.worker = null
    this.video.pause()
    this.video.srcObject = null
    this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.inFlight = false
    this.hasSeen = false
    this.candidate = 'waiting'
    this.candidateCount = 0
    this.lastFrameTime = -1
    this.lastCapture = -Infinity
    this.interval = 1000 / 15
    this.state = initialState()
    if (notify) this.onState(this.state)
  }
}
