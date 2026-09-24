import { parsePaintRef, type PaintRef } from './paint'

export const markingKinds = ['decal', 'spots', 'stripes'] as const
export type MarkingKind = (typeof markingKinds)[number]

export const markingShapes = ['ellipse', 'diamond', 'square', 'star', 'heart', 'crescent'] as const
export type MarkingShape = (typeof markingShapes)[number]

export type Marking = {
  id: string
  name: string
  kind: MarkingKind
  shape: MarkingShape
  paint: PaintRef
  opacity: number
  yaw: number
  pitch: number
  width: number
  height: number
  rotation: number
  mirror: boolean
  count: number
  seed: number
}

export const MAX_MARKINGS = 12

export const markingRanges = {
  yaw: { min: -180, max: 180 },
  pitch: { min: -90, max: 90 },
  width: { min: 4, max: 200 },
  height: { min: 2, max: 200 },
  rotation: { min: -180, max: 180 },
  opacity: { min: 0, max: 100 },
  count: { min: 1, max: 12 },
} as const

export const markingPresetIds = [
  'belly',
  'muzzle',
  'mask',
  'blush',
  'gem',
  'star',
  'heart',
  'moon',
  'spots',
  'stripes',
  'top-tone',
  'bottom-tone',
  'shine',
] as const
export type MarkingPresetId = (typeof markingPresetIds)[number]

export const markingPresetLabels: Record<MarkingPresetId, string> = {
  belly: 'Tache du ventre',
  muzzle: 'Museau',
  mask: 'Masque',
  blush: 'Joues',
  gem: 'Gemme',
  star: 'Étoile',
  heart: 'Cœur',
  moon: 'Lune',
  spots: 'Taches',
  stripes: 'Rayures',
  'top-tone': 'Dessus bicolore',
  'bottom-tone': 'Dessous bicolore',
  shine: 'Reflet',
}

export const markingShapeLabels: Record<MarkingShape, string> = {
  ellipse: 'Ovale',
  diamond: 'Losange',
  square: 'Carré doux',
  star: 'Étoile',
  heart: 'Cœur',
  crescent: 'Croissant',
}

export const markingKindLabels: Record<MarkingKind, string> = {
  decal: 'Motif',
  spots: 'Taches',
  stripes: 'Rayures',
}

type MarkingSettings = Omit<Marking, 'id' | 'name' | 'seed'>

const baseSettings: MarkingSettings = {
  kind: 'decal',
  shape: 'ellipse',
  paint: 'accent',
  opacity: 1,
  yaw: 0,
  pitch: 0,
  width: 40,
  height: 40,
  rotation: 0,
  mirror: false,
  count: 1,
}

export const markingPresetSettings: Record<MarkingPresetId, MarkingSettings> = {
  belly: { ...baseSettings, paint: 'accent2', pitch: 44, width: 78, height: 66 },
  muzzle: { ...baseSettings, paint: 'accent2', pitch: 20, width: 58, height: 36 },
  mask: { ...baseSettings, shape: 'square', paint: 'accent', pitch: -4, width: 104, height: 30 },
  blush: {
    ...baseSettings,
    paint: 'accent',
    opacity: 0.55,
    yaw: 34,
    pitch: 14,
    width: 20,
    height: 12,
    mirror: true,
  },
  gem: { ...baseSettings, shape: 'diamond', paint: 'accent', pitch: -40, width: 16, height: 24 },
  star: { ...baseSettings, shape: 'star', paint: 'accent', pitch: -38, width: 28, height: 28 },
  heart: { ...baseSettings, shape: 'heart', paint: 'accent', pitch: 36, width: 26, height: 24 },
  moon: {
    ...baseSettings,
    shape: 'crescent',
    paint: 'accent2',
    pitch: -40,
    width: 30,
    height: 30,
    rotation: -20,
  },
  spots: {
    ...baseSettings,
    kind: 'spots',
    paint: 'accent',
    yaw: 18,
    pitch: -12,
    width: 130,
    height: 90,
    count: 7,
  },
  stripes: {
    ...baseSettings,
    kind: 'stripes',
    paint: 'accent',
    pitch: -90,
    width: 150,
    height: 10,
    count: 4,
  },
  'top-tone': { ...baseSettings, paint: 'accent', pitch: -90, width: 130, height: 130 },
  'bottom-tone': { ...baseSettings, paint: 'accent2', pitch: 90, width: 120, height: 120 },
  shine: {
    ...baseSettings,
    paint: '#ffffff',
    opacity: 0.7,
    yaw: -30,
    pitch: -34,
    width: 16,
    height: 10,
    rotation: -32,
  },
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const bounded = (value: unknown, fallback: number, range: { min: number; max: number }) =>
  finite(value) ? Math.min(range.max, Math.max(range.min, value)) : fallback

const markingId = () => `marking-${crypto.randomUUID()}`
const randomSeed = () => Math.floor(Math.random() * 1_000_000)

export const createMarking = (preset: MarkingPresetId, existing: Marking[]): Marking => {
  const label = markingPresetLabels[preset]
  const sameName = existing.filter(marking => marking.name.startsWith(label)).length
  return {
    ...markingPresetSettings[preset],
    id: markingId(),
    name: sameName === 0 ? label : `${label} ${sameName + 1}`,
    seed: randomSeed(),
  }
}

export const duplicateMarking = (source: Marking): Marking => ({
  ...source,
  id: markingId(),
  name: `${source.name} copie`,
  yaw: Math.min(markingRanges.yaw.max, source.yaw + 12),
  seed: randomSeed(),
})

export const parseMarkings = (value: unknown): Marking[] => {
  if (!Array.isArray(value)) return []
  const seenIds = new Set<string>()
  return value
    .flatMap((item): Marking[] => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Partial<Marking>
      if (typeof candidate.id !== 'string' || !candidate.id || seenIds.has(candidate.id)) return []
      if (typeof candidate.name !== 'string' || !candidate.name) return []
      const kind = markingKinds.includes(candidate.kind as MarkingKind)
        ? (candidate.kind as MarkingKind)
        : 'decal'
      const shape = markingShapes.includes(candidate.shape as MarkingShape)
        ? (candidate.shape as MarkingShape)
        : 'ellipse'
      seenIds.add(candidate.id)
      return [
        {
          id: candidate.id,
          name: candidate.name,
          kind,
          shape,
          paint: parsePaintRef(candidate.paint, 'accent'),
          opacity: finite(candidate.opacity) ? Math.min(1, Math.max(0, candidate.opacity)) : 1,
          yaw: bounded(candidate.yaw, 0, markingRanges.yaw),
          pitch: bounded(candidate.pitch, 0, markingRanges.pitch),
          width: bounded(candidate.width, 40, markingRanges.width),
          height: bounded(candidate.height, 40, markingRanges.height),
          rotation: bounded(candidate.rotation, 0, markingRanges.rotation),
          mirror: candidate.mirror === true,
          count: Math.round(bounded(candidate.count, 1, markingRanges.count)),
          seed: finite(candidate.seed) ? Math.floor(Math.abs(candidate.seed)) : 1,
        },
      ]
    })
    .slice(0, MAX_MARKINGS)
}
