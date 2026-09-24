export const mouthShapes = [
  'closed',
  'pressed',
  'teeth',
  'slight',
  'smile',
  'wide',
  'open',
  'round',
] as const

export type MouthShape = (typeof mouthShapes)[number]

export type MouthPose = {
  width: number
  height: number
  smile: number
}

export type SpeechViseme = {
  t: number
  id: number
}

export const MOUTH_LOOKAHEAD_S = 0.04
export const MOUTH_BLEND_S = 0.055
export const MOUTH_PRESSED_HOLD_S = 0.045
export const MOUTH_CLOSE_HIDE_MS = 70

export const mouthPoses: Record<MouthShape, MouthPose> = {
  closed: { width: 22, height: 3, smile: 0 },
  pressed: { width: 18, height: 4.6, smile: 0 },
  teeth: { width: 30, height: 3.6, smile: 0 },
  slight: { width: 20, height: 7.5, smile: 0.18 },
  smile: { width: 30, height: 7.2, smile: 1 },
  wide: { width: 32, height: 17, smile: 0.12 },
  open: { width: 24, height: 15, smile: 0 },
  round: { width: 14, height: 14, smile: 0 },
}

export const mouthSizes: Record<MouthShape, { width: number; height: number }> = {
  closed: mouthPoses.closed,
  pressed: mouthPoses.pressed,
  teeth: mouthPoses.teeth,
  slight: mouthPoses.slight,
  smile: mouthPoses.smile,
  wide: mouthPoses.wide,
  open: mouthPoses.open,
  round: mouthPoses.round,
}

const azureVisemeMouth: MouthShape[] = [
  'closed',
  'wide',
  'wide',
  'open',
  'smile',
  'open',
  'smile',
  'round',
  'round',
  'wide',
  'round',
  'wide',
  'slight',
  'slight',
  'slight',
  'slight',
  'slight',
  'teeth',
  'teeth',
  'slight',
  'slight',
  'pressed',
]

export const mouthFromVisemeId = (id: number): MouthShape =>
  azureVisemeMouth[Math.min(Math.max(Math.round(id), 0), 21)] ?? 'closed'

export const mouthPoseFromShape = (shape: MouthShape): MouthPose => ({ ...mouthPoses[shape] })

export const isHitMouth = (shape: MouthShape) => shape === 'pressed' || shape === 'teeth'

export const lerpMouthPose = (from: MouthPose, to: MouthPose, amount: number): MouthPose => {
  const progress = Math.min(1, Math.max(0, amount))
  return {
    width: from.width + (to.width - from.width) * progress,
    height: from.height + (to.height - from.height) * progress,
    smile: from.smile + (to.smile - from.smile) * progress,
  }
}

export const blendMouthAmount = (deltaSeconds: number) =>
  1 - Math.exp(-Math.max(0, deltaSeconds) / MOUTH_BLEND_S)

export const visemeAtTime = (visemes: readonly SpeechViseme[], time: number) => {
  let current = visemes[0]
  for (const viseme of visemes) {
    if (viseme.t > time) break
    current = viseme
  }
  return current
}

export const talkingMouthShape = (
  visemes: readonly SpeechViseme[],
  time: number,
  pressedUntil: number
) => {
  const viseme = visemeAtTime(visemes, time + MOUTH_LOOKAHEAD_S)
  let shape = mouthFromVisemeId(viseme?.id ?? 0)
  let nextPressedUntil = pressedUntil
  if (shape === 'pressed') nextPressedUntil = Math.max(pressedUntil, time + MOUTH_PRESSED_HOLD_S)
  if (time < nextPressedUntil) shape = 'pressed'
  return { shape, pressedUntil: nextPressedUntil }
}

const MOUTH_OUTLINE_SAMPLES = 24

export const mouthOutline = (pose: MouthPose): (readonly [number, number])[] => {
  const halfWidth = Math.max(pose.width, 2) / 2
  const halfHeight = Math.max(pose.height, 1.4) / 2
  return Array.from({ length: MOUTH_OUTLINE_SAMPLES }, (_, index) => {
    const angle = (index / MOUTH_OUTLINE_SAMPLES) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * halfWidth
    const lift = pose.smile * (x / halfWidth) ** 2 * halfHeight * 0.95
    const y = Math.sin(angle) * halfHeight - lift
    return [x, y] as const
  })
}

export const isMouthPose = (value: MouthShape | MouthPose | null | undefined): value is MouthPose =>
  typeof value === 'object' && value !== null && 'width' in value
