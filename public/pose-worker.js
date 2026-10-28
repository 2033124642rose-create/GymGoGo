/* Classic worker: MediaPipe's IIFE/WASM loader uses importScripts. Never sends frames over the network. */
let landmarker
let detectorBackend = 'CPU'

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts('/mediapipe/vision_bundle.js')
      const fileset = await Vision.FilesetResolver.forVisionTasks('/mediapipe/wasm')
      const options = {
        baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'GPU' },
        canvas: new OffscreenCanvas(1, 1),
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5, outputSegmentationMasks: false,
      }
      try {
        landmarker = await Vision.PoseLandmarker.createFromOptions(fileset, options)
        detectorBackend = 'GPU'
      } catch {
        // A separate canvas avoids reusing a failed GPU context.
        landmarker = await Vision.PoseLandmarker.createFromOptions(fileset, {
          ...options, canvas: new OffscreenCanvas(1, 1),
          baseOptions: { ...options.baseOptions, delegate: 'CPU' },
        })
      }
      self.postMessage({ type: 'ready', backend: detectorBackend })
    } catch {
      landmarker?.close()
      self.postMessage({ type: 'error', code: 'model' })
    }
  } else if (data.type === 'frame') {
    const frame = data.frame
    try {
      if (!landmarker) throw new Error('Detector not initialized')
      const start = performance.now()
      const result = landmarker.detectForVideo(frame, data.timestamp)
      self.postMessage({
        type: 'result', landmarks: result.landmarks[0] ?? [], worldLandmarks: result.worldLandmarks[0] ?? [], timestamp: data.timestamp,
        inferenceMs: performance.now() - start,
      })
    } catch {
      self.postMessage({ type: 'error', code: 'inference' })
    } finally {
      frame.close()
    }
  }
}
