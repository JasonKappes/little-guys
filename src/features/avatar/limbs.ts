import type { BodyVector } from './body'
import { parseOptionalPaintRef, parsePaintRef, type PaintRef } from './paint'

export const bodyLimbKinds = ['tail', 'ear', 'horn', 'belly'] as const
export type BodyLimbKind = (typeof bodyLimbKinds)[number]

export const bodyLimbPresetIds = [
  'tail-short-curl',
  'tail-long-thin',
  'tail-thick-stub',
  'ear',
  'horn',
  'belly',
] as const
export type BodyLimbPresetId = (typeof bodyLimbPresetIds)[number]

export type BodyLimbHandle = {
  id: string
  point: BodyVector
  radius: number
}

export type LimbPaint = {
  base: PaintRef
  tip: PaintRef | null
  tipLength: number
  rings: PaintRef | null
  ringCount: number
}

export type BodyLimb = {
  id: string
  name: string
  kind: BodyLimbKind
  handles: BodyLimbHandle[]
  paint?: LimbPaint
}

export const defaultLimbPaint: LimbPaint = {
  base: 'body',
  tip: null,
  tipLength: 0.3,
  rings: null,
  ringCount: 3,
}
export const limbTipLengthRange = { min: 5, max: 90 } as const
export const limbRingCountRange = { min: 1, max: 6 } as const

export const limbPaintOf = (limb: BodyLimb): LimbPaint => limb.paint ?? defaultLimbPaint

export const parseLimbPaint = (value: unknown): LimbPaint | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<LimbPaint>
  const tipLength =
    typeof candidate.tipLength === 'number' && Number.isFinite(candidate.tipLength)
      ? Math.min(0.9, Math.max(0.05, candidate.tipLength))
      : defaultLimbPaint.tipLength
  const ringCount =
    typeof candidate.ringCount === 'number' && Number.isFinite(candidate.ringCount)
      ? Math.round(
          Math.min(limbRingCountRange.max, Math.max(limbRingCountRange.min, candidate.ringCount))
        )
      : defaultLimbPaint.ringCount
  return {
    base: parsePaintRef(candidate.base),
    tip: parseOptionalPaintRef(candidate.tip),
    tipLength,
    rings: parseOptionalPaintRef(candidate.rings),
    ringCount,
  }
}

export type LimbSpineSample = {
  point: BodyVector
  radius: number
  t: number
}

export const MAX_BODY_LIMBS = 8
export const MAX_LIMB_HANDLES = 12
export const limbRadiusRange = { min: 4, max: 80 } as const

export const bodyLimbLabels: Record<BodyLimbPresetId, string> = {
  'tail-short-curl': 'Queue courte',
  'tail-long-thin': 'Queue longue',
  'tail-thick-stub': 'Queue épaisse',
  ear: 'Oreille',
  horn: 'Corne',
  belly: 'Ventre',
}

export const bodyLimbKindLabels: Record<BodyLimbKind, string> = {
  tail: 'Queue',
  ear: 'Oreille',
  horn: 'Corne',
  belly: 'Ventre',
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const vector = (value: unknown): value is BodyVector =>
  Array.isArray(value) && value.length === 3 && value.every(finite)

const clampRadius = (value: number) =>
  Math.min(limbRadiusRange.max, Math.max(limbRadiusRange.min, value))

const handleId = () => `limb-handle-${crypto.randomUUID()}`
const limbId = () => `limb-${crypto.randomUUID()}`

const handle = (point: BodyVector, radius: number): BodyLimbHandle => ({
  id: handleId(),
  point,
  radius: clampRadius(radius),
})

const parseHandle = (value: unknown): BodyLimbHandle | null => {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<BodyLimbHandle>
  if (typeof candidate.id !== 'string' || !candidate.id) return null
  if (!vector(candidate.point) || !finite(candidate.radius)) return null
  return {
    id: candidate.id,
    point: candidate.point,
    radius: clampRadius(candidate.radius),
  }
}

export const parseBodyLimbs = (value: unknown): BodyLimb[] => {
  if (!Array.isArray(value)) return []
  const seenIds = new Set<string>()
  return value
    .flatMap((item): BodyLimb[] => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Partial<BodyLimb>
      if (typeof candidate.id !== 'string' || !candidate.id || seenIds.has(candidate.id)) return []
      if (typeof candidate.name !== 'string' || !candidate.name) return []
      if (!candidate.kind || !bodyLimbKinds.includes(candidate.kind)) return []
      const handles = Array.isArray(candidate.handles)
        ? candidate.handles.flatMap(handleValue => {
            const parsed = parseHandle(handleValue)
            return parsed ? [parsed] : []
          })
        : []
      if (handles.length < 2) return []
      seenIds.add(candidate.id)
      const paint = parseLimbPaint(candidate.paint)
      return [
        {
          id: candidate.id,
          name: candidate.name,
          kind: candidate.kind,
          handles: handles.slice(0, MAX_LIMB_HANDLES),
          ...(paint ? { paint } : {}),
        },
      ]
    })
    .slice(0, MAX_BODY_LIMBS)
}

const presetHandles = (preset: BodyLimbPresetId, mirror: boolean): BodyLimbHandle[] => {
  const flip = mirror ? -1 : 1
  if (preset === 'tail-short-curl') {
    return [
      handle([0, 64, -14], 46),
      handle([flip * 22, 128, -38], 26),
      handle([flip * 58, 152, -22], 14),
      handle([flip * 78, 138, 8], 8),
    ]
  }
  if (preset === 'tail-long-thin') {
    return [
      handle([0, 66, -12], 38),
      handle([flip * 12, 138, -42], 22),
      handle([flip * 28, 198, -54], 13),
      handle([flip * 58, 238, -28], 8),
      handle([flip * 86, 248, 6], 5),
    ]
  }
  if (preset === 'tail-thick-stub') {
    return [
      handle([0, 68, -10], 52),
      handle([flip * 10, 132, -22], 36),
      handle([flip * 22, 158, -8], 22),
    ]
  }
  if (preset === 'ear') {
    return [
      handle([flip * -42, -72, 10], 26),
      handle([flip * -68, -128, 4], 16),
      handle([flip * -74, -152, -2], 9),
    ]
  }
  if (preset === 'horn') {
    return [
      handle([flip * 28, -64, 16], 20),
      handle([flip * 38, -128, 28], 10),
      handle([flip * 36, -168, 22], 5),
    ]
  }
  return [handle([0, 58, 22], 48), handle([0, 112, 46], 32), handle([0, 138, 38], 18)]
}

const kindForPreset = (preset: BodyLimbPresetId): BodyLimbKind => {
  if (preset === 'ear') return 'ear'
  if (preset === 'horn') return 'horn'
  if (preset === 'belly') return 'belly'
  return 'tail'
}

export const createBodyLimb = (preset: BodyLimbPresetId, existing: BodyLimb[]): BodyLimb => {
  const kind = kindForPreset(preset)
  const sameKind = existing.filter(limb => limb.kind === kind).length
  const mirror = (kind === 'ear' || kind === 'horn' || kind === 'tail') && sameKind % 2 === 1
  const label = bodyLimbLabels[preset]
  return {
    id: limbId(),
    name: sameKind === 0 ? label : `${label} ${sameKind + 1}`,
    kind,
    handles: presetHandles(preset, mirror),
  }
}

export const duplicateBodyLimb = (source: BodyLimb): BodyLimb => ({
  ...source,
  id: limbId(),
  name: `${source.name} copie`,
  handles: source.handles.map(item => ({
    ...item,
    id: handleId(),
    point: [item.point[0] + 12, item.point[1] + 10, item.point[2]] as BodyVector,
  })),
})

export const moveLimbHandle = (limb: BodyLimb, handleId: string, point: BodyVector): BodyLimb => ({
  ...limb,
  handles: limb.handles.map(item =>
    item.id === handleId ? { ...item, point: [point[0], point[1], point[2]] as BodyVector } : item
  ),
})

export const setLimbHandleRadius = (
  limb: BodyLimb,
  handleId: string,
  radius: number
): BodyLimb => ({
  ...limb,
  handles: limb.handles.map(item =>
    item.id === handleId ? { ...item, radius: clampRadius(radius) } : item
  ),
})

export const insertLimbHandle = (
  limb: BodyLimb,
  point: BodyVector,
  radius: number,
  afterIndex: number
): BodyLimb => {
  if (limb.handles.length >= MAX_LIMB_HANDLES) return limb
  const index = Math.min(limb.handles.length - 1, Math.max(0, afterIndex) + 1)
  const next = limb.handles.slice()
  next.splice(index, 0, handle([point[0], point[1], point[2]], radius))
  return { ...limb, handles: next }
}

export const insertLimbHandleOnLongestSpan = (limb: BodyLimb): BodyLimb => {
  if (limb.handles.length >= MAX_LIMB_HANDLES) return limb
  let afterIndex = 0
  let longest = -1
  limb.handles.slice(0, -1).forEach((item, index) => {
    const next = limb.handles[index + 1]
    const distance = Math.hypot(
      next.point[0] - item.point[0],
      next.point[1] - item.point[1],
      next.point[2] - item.point[2]
    )
    if (distance > longest) {
      longest = distance
      afterIndex = index
    }
  })
  const start = limb.handles[afterIndex]
  const end = limb.handles[afterIndex + 1]
  return insertLimbHandle(
    limb,
    [
      (start.point[0] + end.point[0]) / 2,
      (start.point[1] + end.point[1]) / 2,
      (start.point[2] + end.point[2]) / 2,
    ],
    (start.radius + end.radius) / 2,
    afterIndex
  )
}

export const removeLimbHandle = (limb: BodyLimb, handleId: string): BodyLimb => {
  if (limb.handles.length <= 2) return limb
  const next = limb.handles.filter(item => item.id !== handleId)
  return next.length < 2 ? limb : { ...limb, handles: next }
}

const catmullRom = (
  p0: BodyVector,
  p1: BodyVector,
  p2: BodyVector,
  p3: BodyVector,
  t: number
): BodyVector => {
  const t2 = t * t
  const t3 = t2 * t
  return [0, 1, 2].map(axis => {
    const v0 = p0[axis]
    const v1 = p1[axis]
    const v2 = p2[axis]
    const v3 = p3[axis]
    return (
      0.5 *
      (2 * v1 +
        (-v0 + v2) * t +
        (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 +
        (-v0 + 3 * v1 - 3 * v2 + v3) * t3)
    )
  }) as unknown as BodyVector
}

export const sampleLimbSpine = (limb: BodyLimb, samplesPerSpan = 8): LimbSpineSample[] => {
  const { handles } = limb
  if (handles.length < 2) return []
  const samples: LimbSpineSample[] = []
  handles.slice(0, -1).forEach((item, index) => {
    const p0 = handles[Math.max(0, index - 1)].point
    const p1 = item.point
    const p2 = handles[index + 1].point
    const p3 = handles[Math.min(handles.length - 1, index + 2)].point
    for (let step = 0; step < samplesPerSpan; step += 1) {
      const t = step / samplesPerSpan
      samples.push({
        point: catmullRom(p0, p1, p2, p3, t),
        radius: item.radius * (1 - t) + handles[index + 1].radius * t,
        t: index + t,
      })
    }
  })
  const tip = handles[handles.length - 1]
  samples.push({ point: tip.point, radius: tip.radius, t: handles.length - 1 })
  return samples
}
