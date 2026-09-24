import type { PixelRenderStyle } from '../avatar/avatars'
import { defaultAvatarShading, derivePalette } from '../avatar/paint'
import {
  buildPaintPlan,
  emptyScenePaint,
  paintColorsOf,
  pixelPaletteOf,
  shadeLayers,
  type PaintLook,
  type ScenePaint,
} from './paintPlan'
import type { RenderedColors, RenderedScene } from './renderedScene'

export type PixelAvatarFrame = {
  headPath: string
  backPaths: string[]
  frontPaths: string[]
  leftPath: string
  rightPath: string
  leftOpacity: number
  rightOpacity: number
  offsetX: number
  offsetY: number
  bodyColor: string
  eyeColor: string
  paint?: ScenePaint
  look?: PaintLook
}

export const readPixelFrame = (
  scene: RenderedScene,
  colors: RenderedColors,
  look?: PaintLook
): PixelAvatarFrame => {
  const readPaths = (paths: RenderedScene['backPaths']) => {
    const values: string[] = []
    paths.forEach(path => {
      const value = path.get()
      if (value) values.push(value)
    })
    return values
  }
  return {
    headPath: scene.headPath.get(),
    backPaths: readPaths(scene.backPaths),
    frontPaths: readPaths(scene.frontPaths),
    leftPath: scene.leftPath.get(),
    rightPath: scene.rightPath.get(),
    leftOpacity: scene.leftOpacity.get(),
    rightOpacity: scene.rightOpacity.get(),
    offsetX: scene.offsetX.get(),
    offsetY: scene.offsetY.get(),
    bodyColor: colors.body.get(),
    eyeColor: colors.eyes.get(),
    paint: scene.paint.get(),
    look,
  }
}

const fillPath = (
  context: CanvasRenderingContext2D,
  path: string,
  color: string,
  opacity = 1,
  evenOdd = false
) => {
  if (!path || opacity <= 0) return
  context.globalAlpha = opacity
  context.fillStyle = color
  context.fill(new Path2D(path), evenOdd ? 'evenodd' : 'nonzero')
}

const colorChannels = (color: string): readonly [number, number, number] => [
  Number.parseInt(color.slice(1, 3), 16),
  Number.parseInt(color.slice(3, 5), 16),
  Number.parseInt(color.slice(5, 7), 16),
]

const colorDistance = (
  red: number,
  green: number,
  blue: number,
  target: readonly [number, number, number]
) => (red - target[0]) ** 2 + (green - target[1]) ** 2 + (blue - target[2]) ** 2

export const quantizePixelArtPixels = (
  pixels: Uint8ClampedArray,
  palette: readonly string[],
  alphaThreshold = 128
) => {
  const targets = palette.map(colorChannels)
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < alphaThreshold) {
      pixels[index] = 0
      pixels[index + 1] = 0
      pixels[index + 2] = 0
      pixels[index + 3] = 0
      continue
    }
    let best = targets[0]
    let bestDistance = Infinity
    for (const target of targets) {
      const distance = colorDistance(pixels[index], pixels[index + 1], pixels[index + 2], target)
      if (distance < bestDistance) {
        bestDistance = distance
        best = target
      }
    }
    pixels[index] = best[0]
    pixels[index + 1] = best[1]
    pixels[index + 2] = best[2]
    pixels[index + 3] = 255
  }
}

const paintShade = (
  context: CanvasRenderingContext2D,
  silhouette: string,
  resolution: number,
  shade: ReturnType<typeof shadeLayers>[number],
  transform: DOMMatrix
) => {
  if (typeof document === 'undefined') return
  const layer = document.createElement('canvas')
  layer.width = resolution
  layer.height = resolution
  const layerContext = layer.getContext('2d')
  if (!layerContext) return
  layerContext.setTransform(transform)
  layerContext.fillStyle = shade.fill
  layerContext.fill(new Path2D(silhouette))
  layerContext.globalCompositeOperation = 'destination-out'
  layerContext.translate(shade.dx, shade.dy)
  layerContext.fill(new Path2D(silhouette))
  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.globalAlpha = shade.opacity
  context.drawImage(layer, 0, 0)
  context.restore()
}

export const paintPixelAvatar = (
  context: CanvasRenderingContext2D,
  frame: PixelAvatarFrame,
  style: PixelRenderStyle
) => {
  const resolution = style.resolution
  const scale = resolution / 300
  const look = frame.look ?? {
    palette: derivePalette(frame.bodyColor),
    shading: defaultAvatarShading,
  }
  const colors = paintColorsOf({ body: frame.bodyColor, eyes: frame.eyeColor }, look.palette)
  const ops = buildPaintPlan(frame.paint ?? emptyScenePaint, colors)
  const shades = shadeLayers(look.shading)
  const silhouette = [frame.headPath, ...frame.backPaths, ...frame.frontPaths]
    .filter(Boolean)
    .join('')
  context.clearRect(0, 0, resolution, resolution)
  context.imageSmoothingEnabled = false
  context.save()
  context.setTransform(scale, 0, 0, scale, resolution / 2, resolution / 2)
  context.translate(frame.offsetX, frame.offsetY)
  const transform = context.getTransform()

  fillPath(context, silhouette, frame.bodyColor)
  ops.forEach(item => {
    if (item.clip) {
      context.save()
      context.clip(new Path2D(frame.headPath))
      fillPath(context, item.path, item.fill, item.opacity, item.evenOdd)
      context.restore()
    } else {
      fillPath(context, item.path, item.fill, item.opacity, item.evenOdd)
    }
  })
  shades.forEach(shade => paintShade(context, silhouette, resolution, shade, transform))

  context.save()
  context.clip(new Path2D(frame.headPath))
  fillPath(context, frame.leftPath, frame.eyeColor, frame.leftOpacity)
  fillPath(context, frame.rightPath, frame.eyeColor, frame.rightOpacity)
  context.restore()

  context.restore()

  const image = context.getImageData(0, 0, resolution, resolution)
  quantizePixelArtPixels(image.data, pixelPaletteOf(colors, ops, shades))
  context.putImageData(image, 0, 0)
}
