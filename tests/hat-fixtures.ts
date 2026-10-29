import type { PoseFrame } from '../src/camera/pose'
import { poseFrame } from './squat-fixtures'
// Synthetic head points only, not a recording or human performance measurement.
export function headFrame(timestamp:number, dx=0, dy=0, scale=1, degrees=0, width=640, height=480): PoseFrame {
  const frame=poseFrame(timestamp)
  const angle=degrees*Math.PI/180
  for(const [id,x,y] of [[0,.5,.39],[2,.47,.35],[5,.53,.35],[7,.43,.37],[8,.57,.37]]){
    const px=(x-.5)*width*scale, py=(y-.35)*height*scale
    frame.landmarks[id]={x:.5+dx+(px*Math.cos(angle)-py*Math.sin(angle))/width,
      y:.35+dy+(px*Math.sin(angle)+py*Math.cos(angle))/height,z:0,visibility:.95}
  }
  return frame
}
