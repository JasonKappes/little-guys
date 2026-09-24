import type { AvatarGeometry, PartPaintLayer } from '../avatar/geometry'
import {
  defaultAvatarShading,
  mixPaintHex,
  resolvePaintRef,
  type AvatarPalette,
  type AvatarShading,
  type PaintColors,
  type PaintRef,
} from '../avatar/paint'

export type ScenePaint = Pick<
  AvatarGeometry,
  'headPath' | 'backLayers' | 'frontLayers' | 'markingLayers' | 'painted'
>

export type PaintOp = {
  path: string
  fill: string
  opacity: number
  clip: boolean
  evenOdd: boolean
}

export type ShadeLayer = {
  kind: 'shadow' | 'highlight'
  fill: string
  opacity: number
  dx: number
  dy: number
}

export type PaintLook = { palette: AvatarPalette; shading: AvatarShading }

export const emptyScenePaint: ScenePaint = {
  headPath: '',
  backLayers: [],
  frontLayers: [],
  markingLayers: [],
  painted: false,
}

export const scenePaintOf = (geometry: AvatarGeometry): ScenePaint => ({
  headPath: geometry.headPath,
  backLayers: geometry.backLayers,
  frontLayers: geometry.frontLayers,
  markingLayers: geometry.markingLayers,
  painted: geometry.painted,
})

export const paintColorsOf = (
  colors: { body: string; eyes: string },
  palette: AvatarPalette
): PaintColors => ({
  body: colors.body,
  eyes: colors.eyes,
  accent: palette.accent,
  accent2: palette.accent2,
})

export const buildPaintPlan = (
  paint: ScenePaint,
  colors: PaintColors,
  bodyFill = colors.body
): PaintOp[] => {
  if (!paint.painted) return []
  const fillFor = (ref: PaintRef) => (ref === 'body' ? bodyFill : resolvePaintRef(ref, colors))
  const op = (path: string, fill: string, extra: Partial<PaintOp> = {}): PaintOp => ({
    path,
    fill,
    opacity: 1,
    clip: false,
    evenOdd: false,
    ...extra,
  })
  const layerOps = (layer: PartPaintLayer) =>
    layer.path
      ? [
          op(layer.path, fillFor(layer.paint)),
          ...layer.bands.filter(band => band.path).map(band => op(band.path, fillFor(band.paint))),
        ]
      : []
  return [
    ...paint.backLayers.flatMap(layerOps),
    op(paint.headPath, bodyFill),
    ...paint.markingLayers.map(layer =>
      op(layer.path, fillFor(layer.paint), {
        opacity: layer.opacity,
        clip: true,
        evenOdd: layer.evenOdd,
      })
    ),
    ...paint.frontLayers.flatMap(layerOps),
  ]
}

export const shadeLayers = (shading: AvatarShading = defaultAvatarShading): ShadeLayer[] => {
  const angle = (shading.angle * Math.PI) / 180
  const lightX = Math.cos(angle)
  const lightY = -Math.sin(angle)
  const layers: ShadeLayer[] = []
  if (shading.amount > 0) {
    layers.push({
      kind: 'shadow',
      fill: shading.color,
      opacity: (shading.amount / 100) * 0.62,
      dx: lightX * shading.size,
      dy: lightY * shading.size,
    })
  }
  if (shading.highlight > 0) {
    layers.push({
      kind: 'highlight',
      fill: '#ffffff',
      opacity: (shading.highlight / 100) * 0.55,
      dx: -lightX * shading.size * 0.45,
      dy: -lightY * shading.size * 0.45,
    })
  }
  return layers
}

export const pixelPaletteOf = (
  colors: PaintColors,
  ops: PaintOp[],
  shades: ShadeLayer[]
): string[] => {
  const base = new Set<string>([colors.body, colors.eyes])
  ops.forEach(item => {
    if (/^#[0-9a-f]{6}$/i.test(item.fill)) {
      base.add(item.opacity >= 1 ? item.fill : mixPaintHex(colors.body, item.fill, item.opacity))
    }
  })
  const result = new Set(base)
  shades.forEach(shade => {
    base.forEach(color => result.add(mixPaintHex(color, shade.fill, shade.opacity)))
  })
  return [...result].map(color => color.toLowerCase())
}
