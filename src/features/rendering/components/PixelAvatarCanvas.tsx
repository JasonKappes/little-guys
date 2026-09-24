import { useEffect, useRef } from 'react'

import type { PixelRenderStyle } from '@/features/avatar/avatars'
import type { PaintLook } from '@/features/rendering/paintPlan'
import {
  paintPixelAvatar,
  readPixelFrame,
  type PixelAvatarFrame,
} from '@/features/rendering/pixelRenderer'
import type { RenderedColors, RenderedScene } from '@/features/rendering/renderedScene'

export function StaticPixelAvatarCanvas({
  frame,
  style,
  className,
}: {
  frame: PixelAvatarFrame
  style: PixelRenderStyle
  className: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return
    canvas.width = style.resolution
    canvas.height = style.resolution
    paintPixelAvatar(context, frame, style)
  }, [frame, style])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

export function LivePixelAvatarCanvas({
  scene,
  colors,
  style,
  look,
  className,
}: {
  scene: RenderedScene
  colors: RenderedColors
  style: PixelRenderStyle
  look?: PaintLook
  className: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return
    canvas.width = style.resolution
    canvas.height = style.resolution
    let frameRequest: number | null = null
    const paint = () => {
      frameRequest = null
      paintPixelAvatar(context, readPixelFrame(scene, colors, look), style)
    }
    const schedulePaint = () => {
      if (frameRequest === null) frameRequest = requestAnimationFrame(paint)
    }
    const values = [
      scene.headPath,
      scene.bodyFillPath,
      ...scene.backPaths,
      ...scene.frontPaths,
      scene.leftPath,
      scene.rightPath,
      scene.leftOpacity,
      scene.rightOpacity,
      scene.offsetX,
      scene.offsetY,
      scene.paint,
      colors.body,
      colors.eyes,
    ]
    const unsubscribers = values.map(value => value.on('change', schedulePaint))
    paint()
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
      if (frameRequest !== null) cancelAnimationFrame(frameRequest)
    }
  }, [colors, look, scene, style])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
