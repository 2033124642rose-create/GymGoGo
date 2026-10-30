import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CameraController, cameraError } from '../src/camera/CameraController'
import type { CameraEnvironment, PoseWorker } from '../src/camera/CameraController'

function setup(getMedia?: CameraEnvironment['getMedia']) {
  const video = document.createElement('video')
  const canvas = document.createElement('canvas')
  Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 480 }, readyState: { value: 4 } })
  const track = Object.assign(new EventTarget(), { stop: vi.fn() })
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  const worker: PoseWorker = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() }
  const bitmap = { width: 640, height: 480, close: vi.fn() } as unknown as ImageBitmap
  const env: CameraEnvironment = {
    getMedia: getMedia ?? vi.fn().mockResolvedValue(stream), createWorker: vi.fn(() => worker),
    getFrame: vi.fn().mockResolvedValue(bitmap), schedule: vi.fn(() => 1), cancel: vi.fn(), now: () => 1000,
  }
  const onState = vi.fn()
  const onPose=vi.fn()
  const controller = new CameraController(video, canvas, onState, env,onPose)
  const reply = (data: unknown) => worker.onmessage?.({ data } as MessageEvent)
  return { controller, env, video, canvas, track, stream, worker, bitmap, reply,onPose }
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
})
afterEach(() => vi.useRealTimers())

describe('camera session ownership and privacy cleanup', () => {
  it('does not request permission on construction', () => {
    const { controller, env } = setup()
    expect(env.getMedia).not.toHaveBeenCalled()
    expect(controller.state.phase).toBe('idle')
  })
  it('starts on demand, ignores repeated starts and stops all owned resources', async () => {
    const { controller, env, worker, track, video } = setup()
    await controller.start()
    await controller.start()
    expect(env.getMedia).toHaveBeenCalledTimes(1)
    expect(controller.state.phase).toBe('loading')
    controller.stop()
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(video.srcObject).toBeNull()
    expect(controller.state.phase).toBe('idle')
  })
  it('stops a stream granted AFTER the user has cancelled permission', async () => {
    let grant!: (stream: MediaStream) => void
    const setupResult = setup(() => new Promise(resolve => { grant = resolve }))
    const pending = setupResult.controller.start()
    setupResult.controller.stop()
    grant(setupResult.stream)
    await pending
    expect(setupResult.track.stop).toHaveBeenCalledTimes(1)
    expect(setupResult.env.createWorker).not.toHaveBeenCalled()
    expect(setupResult.video.srcObject).toBeNull()
  })
  it.each(['NotAllowedError', 'NotFoundError', 'NotReadableError'])('recovers from %s without starting a model', async name => {
    const error = new DOMException('test', name)
    const { controller, env } = setup(vi.fn().mockRejectedValue(error))
    await controller.start()
    expect(controller.state.phase).toBe('error')
    expect(controller.state.message).toBe(cameraError(error))
    expect(env.createWorker).not.toHaveBeenCalled()
  })
  it('stops camera if model initialization fails', async () => {
    const { controller, reply, track, worker } = setup()
    await controller.start()
    reply({ type: 'error', code: 'model' })
    expect(controller.state.message).toContain('模型加载失败')
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('ignores stale worker replies after the user closes the camera', async () => {
    const { controller, worker } = setup()
    await controller.start()
    const oldReply = worker.onmessage!
    controller.stop()
    oldReply({ data: { type: 'ready' } } as MessageEvent)
    expect(controller.state.phase).toBe('idle')
  })
  it('stops capture after an inference error instead of leaving the webcam live', async () => {
    const { controller, reply, track } = setup()
    await controller.start()
    reply({ type: 'ready' })
    reply({ type: 'error', code: 'inference' })
    expect(controller.state.message).toContain('识别发生错误')
    expect(track.stop).toHaveBeenCalledOnce()
  })
  it('stops camera when the initialization watchdog expires', async () => {
    vi.useFakeTimers()
    const { controller, track } = setup()
    await controller.start()
    vi.advanceTimersByTime(45_000)
    expect(controller.state.message).toContain('加载超时')
    expect(track.stop).toHaveBeenCalledTimes(1)
  })
  it('handles device disconnection as an error and releases the worker', async () => {
    const { controller, reply, track, worker } = setup()
    await controller.start()
    reply({ type: 'ready', backend: 'GPU' })
    track.dispatchEvent(new Event('ended'))
    expect(controller.state.phase).toBe('error')
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('closes an image bitmap that finishes capturing after shutdown', async () => {
    const { controller, env, reply, bitmap } = setup()
    let finish!: (frame: ImageBitmap) => void
    vi.mocked(env.getFrame).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await controller.start()
    reply({ type: 'ready' })
    const tick = vi.mocked(env.schedule).mock.calls[0][0]
    tick(1000)
    tick(1001)
    expect(env.getFrame).toHaveBeenCalledTimes(1) // single-frame backpressure
    controller.stop()
    finish(bitmap)
    await Promise.resolve()
    expect(bitmap.close).toHaveBeenCalledTimes(1)
  })
  it('debounces full-body and lost-body statuses and clears stale joints', async () => {
    const { controller, reply } = setup()
    await controller.start()
    reply({ type: 'ready' })
    const full = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }))
    for (let i = 0; i < 3; i++) reply({ type: 'result', landmarks: full })
    expect(controller.state.tracking).toBe('tracked')
    reply({ type: 'result', landmarks: [] })
    expect(controller.state.tracking).toBe('tracked')
    for (let i = 0; i < 2; i++) reply({ type: 'result', landmarks: [] })
    expect(controller.state.tracking).toBe('lost')
    expect(Object.values(controller.state.groups).every(value => !value)).toBe(true)
    controller.stop()
  })
})


describe('inference standby without reacquiring camera',()=>{
 it('stops captures, drops late replies and resumes the same worker/stream',async()=>{
  const s=setup();await s.controller.start();s.reply({type:'ready'});
  s.controller.setInferencePaused(true);s.onPose.mockClear();
  const callback=vi.mocked(s.env.schedule).mock.calls.at(-1)![0];callback(1000);
  s.reply({type:'result',timestamp:900,landmarks:[]});
  expect(s.env.getFrame).not.toHaveBeenCalled();expect(s.onPose).not.toHaveBeenCalled();
  expect(s.track.stop).not.toHaveBeenCalled();expect(s.worker.terminate).not.toHaveBeenCalled();
  s.controller.setInferencePaused(false);s.onPose.mockClear();
  s.reply({type:'result',timestamp:900,landmarks:[]});expect(s.onPose).not.toHaveBeenCalled();
  vi.mocked(s.env.schedule).mock.calls.at(-1)![0](1000);await Promise.resolve();
  expect(s.env.getFrame).toHaveBeenCalledTimes(1);expect(s.env.getMedia).toHaveBeenCalledTimes(1);
  s.controller.stop();
 });
 it('discards a bitmap captured before standby even if it resolves after resume',async()=>{
  const s=setup();let finish!:(v:ImageBitmap)=>void;vi.mocked(s.env.getFrame).mockImplementation(()=>new Promise(r=>{finish=r}));
  await s.controller.start();s.reply({type:'ready'});vi.mocked(s.env.schedule).mock.calls.at(-1)![0](1000);
  s.controller.setInferencePaused(true);s.controller.setInferencePaused(false);finish(s.bitmap);await Promise.resolve();
  expect(s.bitmap.close).toHaveBeenCalled();expect(vi.mocked(s.worker.postMessage).mock.calls.some(c=>(c[0] as {type:string}).type==='frame')).toBe(false);s.controller.stop();
 });
});
