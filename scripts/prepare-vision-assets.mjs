import { mkdir, readdir, copyFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = path.join(root, 'node_modules/@mediapipe/tasks-vision')
const destination = path.join(root, 'public/mediapipe')
await mkdir(path.join(destination, 'wasm'), { recursive: true })
await copyFile(path.join(source, 'vision_bundle.js'), path.join(destination, 'vision_bundle.js'))
for (const name of await readdir(path.join(source, 'wasm'))) {
  if (/\.(js|wasm)$/.test(name)) {
    await copyFile(path.join(source, 'wasm', name), path.join(destination, 'wasm', name))
  }
}
const model = await stat(path.join(root, 'public/models/pose_landmarker_lite.task'))
if (model.size < 1_000_000) throw new Error('Pose model missing or incomplete; see docs/摄像头技术说明.md')
console.log('Local MediaPipe assets ready. No CDN requests needed at runtime.')
