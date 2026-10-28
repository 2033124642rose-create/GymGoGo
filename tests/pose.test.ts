import { describe, expect, it } from 'vitest'
import { assessPose, isVisible } from '../src/camera/pose'

const fullBody = () => Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .9 }))

describe('local pose visibility (not a squat algorithm)', () => {
  it('requires both shoulders, hips, knees and ankles to be visible', () => {
    expect(assessPose(fullBody(), false)).toEqual({ tracking: 'tracked', groups: { shoulders: true, hips: true, knees: true, ankles: true } })
  })
  it('marks a missing ankle as incomplete instead of a full body', () => {
    const points = fullBody()
    points[28].visibility = .1
    expect(assessPose(points, true)).toMatchObject({ tracking: 'partial', groups: { ankles: false, knees: true } })
  })
  it('does not trust predicted joints outside the image', () => {
    const points = fullBody()
    points[25].y = 1.1
    expect(assessPose(points, true).tracking).toBe('partial')
    expect(assessPose(points, true).groups.knees).toBe(false)
  })
  it('distinguishes first entry from losing a previously seen person', () => {
    expect(assessPose([], false).tracking).toBe('waiting')
    expect(assessPose([], true).tracking).toBe('lost')
  })
  it('rejects missing visibility, invalid numbers and edge points', () => {
    for (const point of [undefined, { x: NaN, y: .5, visibility: 1 }, { x: .5, y: .5 }, { x: .01, y: .5, visibility: 1 }]) {
      expect(isVisible(point)).toBe(false)
    }
  })
})
