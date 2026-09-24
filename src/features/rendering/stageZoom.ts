export const STAGE_ZOOM_MIN = 0.03
export const STAGE_ZOOM_MAX = 20
export const STAGE_ZOOM_DEFAULT = 1

const zoomSensitivity = 0.0018

export const nextStageZoom = (current: number, deltaY: number, deltaMode = 0) => {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY
  const next = current * Math.exp(-pixels * zoomSensitivity)
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, next))
}
