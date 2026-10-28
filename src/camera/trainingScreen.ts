export function containFrame(areaWidth: number, areaHeight: number, ratio: number) {
  if (areaWidth <= 0 || areaHeight <= 0 || !Number.isFinite(ratio) || ratio <= 0) return { width: 0, height: 0 }
  const width = Math.min(areaWidth, areaHeight * ratio)
  return { width, height: width / ratio }
}

// Isolate only the rest of the page. Do not move/remount the video or its worker session.
export function isolateTrainingScreen(element: HTMLElement) {
  const changed: { element: HTMLElement; inert: boolean }[] = []
  let current: HTMLElement = element
  while (current.parentElement) {
    for (const sibling of current.parentElement.children) {
      if (sibling !== current && sibling instanceof HTMLElement) {
        changed.push({ element: sibling, inert: sibling.inert })
        sibling.inert = true
      }
    }
    current = current.parentElement
    if (current === document.body) break
  }
  const oldOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  return () => {
    for (const item of changed) item.element.inert = item.inert
    document.body.style.overflow = oldOverflow
  }
}
