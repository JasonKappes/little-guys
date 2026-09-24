import type { Marking, MarkingShape } from './markings'
import { seededRandom, type PaintRef } from './paint'
import { surfacePointAt, surfaceSampleAt, type SurfaceConfig } from './surfaces'

type Vector = readonly [number, number, number]
export type DecalSample = { point: Vector; normal: Vector }
export type DecalProjector = (sample: DecalSample) => DecalSample

export type MarkingLayer = {
  id: string
  path: string
  paint: PaintRef
  opacity: number
  evenOdd: boolean
}

type Decal = {
  yaw: number
  pitch: number
  width: number
  height: number
  rotation: number
  shape: MarkingShape
}

const DECAL_SAMPLES = 96
const FAR = 900
const COVER_PATH = 'M-900 -900H900V900H-900Z'
const degrees = (value: number) => (value * Math.PI) / 180

const normalize = ([x, y, z]: Vector): Vector => {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

const direction = (yaw: number, pitch: number): Vector => {
  const y = degrees(yaw)
  const p = degrees(pitch)
  return [Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)]
}

const ELEVATION_SAMPLES = 96
const elevationTables = new Map<string, { latitude: number; elevation: number }[]>()

const elevationTable = (surface: SurfaceConfig) => {
  const key = [
    surface.type,
    surface.width,
    surface.height,
    surface.depth,
    surface.roundness,
    surface.morphRoundness,
    surface.tipRoundness,
    surface.baseRoundness,
  ].join(':')
  const cached = elevationTables.get(key)
  if (cached) return cached
  const table = Array.from({ length: ELEVATION_SAMPLES + 1 }, (_, index) => {
    const latitude = -Math.PI / 2 + (index / ELEVATION_SAMPLES) * Math.PI
    const [, y, z] = surfacePointAt(surface, 0, latitude)
    return { latitude, elevation: Math.atan2(y, Math.max(1e-6, z)) }
  }).sort((left, right) => left.elevation - right.elevation)
  if (elevationTables.size >= 24) elevationTables.delete(elevationTables.keys().next().value!)
  elevationTables.set(key, table)
  return table
}

const latitudeForElevation = (surface: SurfaceConfig, elevation: number) => {
  const table = elevationTable(surface)
  if (elevation <= table[0].elevation) return table[0].latitude
  const last = table[table.length - 1]
  if (elevation >= last.elevation) return last.latitude
  let low = 0
  let high = table.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (table[middle].elevation <= elevation) low = middle
    else high = middle
  }
  const span = table[high].elevation - table[low].elevation || 1
  const progress = (elevation - table[low].elevation) / span
  return table[low].latitude + (table[high].latitude - table[low].latitude) * progress
}

const sampleDirection = (surface: SurfaceConfig, [x, y, z]: Vector) =>
  surfaceSampleAt(
    surface,
    Math.atan2(x, z),
    latitudeForElevation(surface, Math.asin(Math.max(-1, Math.min(1, y))))
  )

const starRadius = (angle: number) => {
  const points = 5
  const step = Math.PI / points
  const offset = angle + Math.PI / 2
  const wrapped = ((offset % (step * 2)) + step * 2) % (step * 2)
  const progress = wrapped <= step ? wrapped / step : 2 - wrapped / step
  return 1 - progress * 0.56
}

const shapePoint = (shape: MarkingShape, angle: number): readonly [number, number] => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  if (shape === 'diamond') {
    const scale = 1 / (Math.abs(cos) + Math.abs(sin))
    return [cos * scale, sin * scale]
  }
  if (shape === 'square') {
    return [Math.sign(cos) * Math.abs(cos) ** 0.35, Math.sign(sin) * Math.abs(sin) ** 0.35]
  }
  if (shape === 'star') {
    const radius = starRadius(angle)
    return [cos * radius, sin * radius]
  }
  if (shape === 'heart') {
    const x = 16 * Math.sin(angle) ** 3
    const y = -(
      13 * Math.cos(angle) -
      5 * Math.cos(2 * angle) -
      2 * Math.cos(3 * angle) -
      Math.cos(4 * angle)
    )
    return [x / 17, (y - 2.5) / 15]
  }
  return [cos, sin]
}

const unitOutline = (shape: MarkingShape): (readonly [number, number])[] => {
  if (shape === 'crescent') {
    const outer = Array.from({ length: DECAL_SAMPLES / 2 }, (_, index) => {
      const angle = Math.PI / 2 + (index / (DECAL_SAMPLES / 2 - 1)) * Math.PI
      return [Math.cos(angle), Math.sin(angle)] as const
    })
    const inner = Array.from({ length: DECAL_SAMPLES / 2 }, (_, index) => {
      const angle = Math.PI * 1.5 - (index / (DECAL_SAMPLES / 2 - 1)) * Math.PI
      return [0.38 + Math.cos(angle) * 0.72, Math.sin(angle) * 0.84] as const
    })
    return [...outer, ...inner]
  }
  return Array.from({ length: DECAL_SAMPLES }, (_, index) =>
    shapePoint(shape, (index / DECAL_SAMPLES) * Math.PI * 2)
  )
}

const decalDirections = (decal: Decal) => {
  const center = direction(decal.yaw, decal.pitch)
  const yaw = degrees(decal.yaw)
  const right = normalize([Math.cos(yaw), 0, -Math.sin(yaw)])
  const down = normalize(cross(center, right))
  const rotation = degrees(decal.rotation)
  const radiusX = degrees(decal.width) / 2
  const radiusY = degrees(decal.height) / 2
  const boundary = unitOutline(decal.shape).map(([u, w]) => {
    const localX = u * radiusX
    const localY = w * radiusY
    const radius = Math.hypot(localX, localY)
    const angle = Math.atan2(localY, localX) + rotation
    const tangentX = Math.cos(angle)
    const tangentY = Math.sin(angle)
    return normalize([
      center[0] * Math.cos(radius) + (right[0] * tangentX + down[0] * tangentY) * Math.sin(radius),
      center[1] * Math.cos(radius) + (right[1] * tangentX + down[1] * tangentY) * Math.sin(radius),
      center[2] * Math.cos(radius) + (right[2] * tangentX + down[2] * tangentY) * Math.sin(radius),
    ])
  })
  return { center, boundary }
}

const pointsPath = (points: (readonly [number, number])[]) =>
  points.length ? `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z` : ''

const radial = ([x, y]: Vector): readonly [number, number] => {
  const length = Math.hypot(x, y)
  return length > 0.001 ? [x / length, y / length] : [0, -1]
}

const decalRegion = (surface: SurfaceConfig, project: DecalProjector, decal: Decal): string[] => {
  const { center, boundary } = decalDirections(decal)
  const projectedCenter = project(sampleDirection(surface, center))
  const centerVisible = projectedCenter.normal[2] > 0
  const samples = boundary.map(item => project(sampleDirection(surface, item)))
  const visible = samples.map(sample => sample.normal[2] > 0.015)
  const visibleCount = visible.filter(Boolean).length
  if (visibleCount === samples.length) {
    const outline = pointsPath(samples.map(sample => [sample.point[0], sample.point[1]] as const))
    return centerVisible ? [outline] : [COVER_PATH, outline]
  }
  if (visibleCount === 0) return centerVisible ? [COVER_PATH] : []

  const centerDirection = Math.hypot(projectedCenter.normal[0], projectedCenter.normal[1])
  const start = visible.findIndex(
    (item, index) => item && !visible[(index - 1 + visible.length) % visible.length]
  )
  const points: (readonly [number, number])[] = []
  let index = 0
  while (index < samples.length) {
    const current = (start + index) % samples.length
    if (visible[current]) {
      points.push([samples[current].point[0], samples[current].point[1]])
      index += 1
      continue
    }
    const last = samples[(current - 1 + samples.length) % samples.length]
    let skip = index
    while (skip < samples.length && !visible[(start + skip) % samples.length]) skip += 1
    const next = samples[(start + skip) % samples.length]
    const lastRadial = radial(last.point)
    const nextRadial = radial(next.point)
    const push: readonly [number, number] =
      centerDirection > 0.2
        ? [projectedCenter.normal[0] / centerDirection, projectedCenter.normal[1] / centerDirection]
        : radial([lastRadial[0] + nextRadial[0], lastRadial[1] + nextRadial[1], 0] as Vector)
    points.push([last.point[0] + lastRadial[0] * FAR, last.point[1] + lastRadial[1] * FAR])
    points.push([push[0] * FAR, push[1] * FAR])
    points.push([next.point[0] + nextRadial[0] * FAR, next.point[1] + nextRadial[1] * FAR])
    index = skip
  }
  return [pointsPath(points)]
}

const mirrored = (decal: Decal): Decal => ({
  ...decal,
  yaw: -decal.yaw,
  rotation: -decal.rotation,
})

const spotDecals = (marking: Marking): Decal[] => {
  const random = seededRandom(marking.seed + 17)
  const base = Math.max(
    5,
    Math.min(marking.width, marking.height) / (1.4 * Math.sqrt(marking.count))
  )
  return Array.from({ length: marking.count }, () => {
    const size = base * (0.6 + random() * 0.8)
    return {
      yaw: marking.yaw + (random() * 2 - 1) * (marking.width / 2),
      pitch: Math.max(-88, Math.min(88, marking.pitch + (random() * 2 - 1) * (marking.height / 2))),
      width: size,
      height: size * (0.75 + random() * 0.3),
      rotation: random() * 180,
      shape: marking.shape,
    }
  })
}

const stripePolygons = (surface: SurfaceConfig, project: DecalProjector, marking: Marking) => {
  const thickness = Math.max(2, marking.height)
  return Array.from({ length: marking.count }, (_, index) => {
    const middle = (marking.width * (index + 0.5)) / marking.count
    const outer = Math.min(359, middle + thickness / 2)
    const inner = middle - thickness / 2
    const ring = (radius: number) =>
      decalRegion(surface, project, {
        yaw: marking.yaw,
        pitch: marking.pitch,
        width: radius * 2,
        height: radius * 2,
        rotation: marking.rotation,
        shape: 'ellipse',
      })
    return [...ring(outer), ...(inner > 0.5 ? ring(inner) : [])]
  }).flat()
}

export const renderMarkingLayers = (
  markings: readonly Marking[],
  surface: SurfaceConfig,
  project: DecalProjector
): MarkingLayer[] =>
  markings.flatMap(marking => {
    const layer = (id: string, paths: string[], evenOdd = true): MarkingLayer[] =>
      paths.length
        ? [{ id, path: paths.join(''), paint: marking.paint, opacity: marking.opacity, evenOdd }]
        : []
    if (marking.kind === 'stripes') {
      const stripes = layer(marking.id, stripePolygons(surface, project, marking))
      if (!marking.mirror) return stripes
      return [
        ...stripes,
        ...layer(
          `${marking.id}-mirror`,
          stripePolygons(surface, project, {
            ...marking,
            yaw: -marking.yaw,
            rotation: -marking.rotation,
          })
        ),
      ]
    }
    const decals =
      marking.kind === 'spots'
        ? spotDecals(marking)
        : [
            {
              yaw: marking.yaw,
              pitch: marking.pitch,
              width: marking.width,
              height: marking.height,
              rotation: marking.rotation,
              shape: marking.shape,
            },
          ]
    const all = marking.mirror ? [...decals, ...decals.map(mirrored)] : decals
    return all.flatMap((decal, index) =>
      layer(`${marking.id}-${index}`, decalRegion(surface, project, decal))
    )
  })
