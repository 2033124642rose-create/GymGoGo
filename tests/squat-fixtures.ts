import type { PoseFrame, Point } from '../src/camera/pose'

// Synthetic landmark sequences; these are not recordings or measured human accuracy data.
export function poseFrame(timestamp: number, left = 175, right = left, drop = 0): PoseFrame {
  const landmarks: Point[] = Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.95}))
  const worldLandmarks: Point[] = Array.from({length:33},()=>({x:0,y:0,z:0,visibility:.95}))
  for (const [hip,knee,ankle,shoulder,x] of [[23,25,27,11,.42],[24,26,28,12,.58]]) {
    landmarks[shoulder] = {x,y:.2+drop,z:0,visibility:.95}
    landmarks[hip] = {x,y:.45+drop,z:0,visibility:.95}
    landmarks[knee] = {x,y:.68+drop*.25,z:0,visibility:.95}
    landmarks[ankle] = {x,y:.91,z:0,visibility:.95}
    const angle = (hip===23 ? left : right)*Math.PI/180
    worldLandmarks[hip] = {x,y:0,z:0}
    worldLandmarks[knee] = {x,y:.4,z:0}
    worldLandmarks[ankle] = {x,y:.4-Math.cos(angle)*.4,z:Math.sin(angle)*.4}
  }
  return {timestamp,landmarks,worldLandmarks}
}
export function makeSequence() {
  let time = 0
  return { hold(angle: number, drop: number, duration: number, right = angle) {
    const result: PoseFrame[] = []
    for(let i=0;i<duration;i+=100) { time+=100; result.push(poseFrame(time,angle,right,drop)) }
    return result
  }, get time() {return time} }
}
