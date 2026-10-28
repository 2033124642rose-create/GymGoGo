export interface Point { x: number; y: number; z?: number; visibility?: number }
export interface PoseFrame { landmarks: Point[]; worldLandmarks: Point[]; timestamp: number }
export type Tracking = 'waiting' | 'tracked' | 'partial' | 'lost'
export const JOINT_GROUPS = { shoulders: [11, 12], hips: [23, 24], knees: [25, 26], ankles: [27, 28] } as const
export type JointGroups = Record<keyof typeof JOINT_GROUPS, boolean>
export const EMPTY_GROUPS: JointGroups = { shoulders: false, hips: false, knees: false, ankles: false }

export function isVisible(point: Point | undefined) {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x > 0.02 && point.x < 0.98 && point.y > 0.02 && point.y < 0.98 && (point.visibility ?? 0) >= 0.5
}

export function assessPose(points: Point[], hasSeenPerson: boolean): { tracking: Tracking; groups: JointGroups } {
  const groups = Object.fromEntries(Object.entries(JOINT_GROUPS).map(([name, indices]) =>
    [name, indices.every(index => isVisible(points[index]))])) as JointGroups
  const tracking: Tracking = points.length === 0 ? (hasSeenPerson ? 'lost' : 'waiting') :
    Object.values(groups).every(Boolean) ? 'tracked' : 'partial'
  return { tracking, groups }
}

// MediaPipe Pose's body connections, excluding face detail to keep the view clear.
const CONNECTIONS = [[11,12],[11,13],[13,15],[15,17],[15,19],[17,19],[15,21],
  [12,14],[14,16],[16,18],[16,20],[18,20],[16,22],[11,23],[12,24],[23,24],
  [23,25],[25,27],[27,29],[29,31],[27,31],[24,26],[26,28],[28,30],[30,32],[28,32]]

export function drawPose(canvas: HTMLCanvasElement, points: Point[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#d8e6aa'
  ctx.lineWidth = Math.max(2, canvas.width / 240)
  ctx.lineCap = 'round'
  for (const [a, b] of CONNECTIONS) {
    if (!isVisible(points[a]) || !isVisible(points[b])) continue
    ctx.beginPath()
    ctx.moveTo(points[a].x * canvas.width, points[a].y * canvas.height)
    ctx.lineTo(points[b].x * canvas.width, points[b].y * canvas.height)
    ctx.stroke()
  }
  for (let i = 0; i < points.length; i++) {
    if ((i !== 0 && i < 11) || !isVisible(points[i])) continue
    const point = points[i]
    ctx.beginPath()
    ctx.arc(point.x * canvas.width, point.y * canvas.height, canvas.width / 130, 0, Math.PI * 2)
    ctx.fillStyle = '#a5ef3f'
    ctx.fill()
    ctx.strokeStyle = '#22312a'
    ctx.stroke()
    ctx.strokeStyle = '#d8e6aa'
  }
}
