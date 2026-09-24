import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef } from 'react'

import type { AvatarRenderStyle } from '@/features/avatar/avatars'
import {
  buildPaintPlan,
  paintColorsOf,
  shadeLayers,
  type PaintLook,
  type ScenePaint,
} from '@/features/rendering/paintPlan'
import { syncSvgPaintOps } from '@/features/rendering/svgPaintDom'
import {
  glowTint,
  inkFilterParams,
  inkFilterSeed,
  inkInnerDash,
  inkRimRadius,
  livePaintFill,
  livePaintStroke,
  resolveVectorMaterial,
  shadeColors,
} from '@/features/rendering/vectorMaterials'

type PathValue = string | MotionValue<string>
type OpacityValue = number | MotionValue<number>
type OffsetValue = number | MotionValue<number>
type ColorValue = string | MotionValue<string>
type PaintValue = ScenePaint | MotionValue<ScenePaint>

const isMotionPaint = (value: PaintValue): value is MotionValue<ScenePaint> =>
  typeof (value as MotionValue<ScenePaint>).get === 'function'

export function AvatarPaintOverlay({
  id,
  clipId,
  paint,
  look,
  style,
  bodyColor,
  eyeColor,
}: {
  id: string
  clipId: string
  paint: PaintValue
  look: PaintLook
  style: AvatarRenderStyle
  bodyColor: ColorValue
  eyeColor: ColorValue
}) {
  const groupRef = useRef<SVGGElement>(null)
  const body = useResolvedColor(bodyColor)
  const eyes = useResolvedColor(eyeColor)

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    const sync = () => {
      const scenePaint = isMotionPaint(paint) ? paint.get() : paint
      const ops =
        style.type === 'pixel'
          ? []
          : buildPaintPlan(
              scenePaint,
              paintColorsOf({ body: body.get(), eyes: eyes.get() }, look.palette),
              livePaintFill(style.type, body.get(), `${id}-shade`)
            )
      syncSvgPaintOps(group, ops, `url(#${clipId})`)
    }
    const unsubscribers = [body.on('change', sync), eyes.on('change', sync)]
    if (isMotionPaint(paint)) unsubscribers.push(paint.on('change', sync))
    sync()
    return () => unsubscribers.forEach(unsubscribe => unsubscribe())
  }, [body, clipId, eyes, id, look, paint, style])

  return <g ref={groupRef} className="avatar-paint" pointerEvents="none" />
}

export function AvatarShadeLayers({
  id,
  silhouette,
  look,
  style,
}: {
  id: string
  silhouette: PathValue
  look: PaintLook
  style: AvatarRenderStyle
}) {
  if (style.type === 'pixel') return null
  return (
    <>
      {shadeLayers(look.shading).map(layer => {
        const maskId = `${id}-${layer.kind}`
        return (
          <g className={`avatar-${layer.kind}`} key={layer.kind} pointerEvents="none">
            <mask id={maskId} maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800">
              <motion.path d={silhouette} fill="#fff" />
              <motion.path
                d={silhouette}
                fill="#000"
                transform={`translate(${layer.dx.toFixed(2)} ${layer.dy.toFixed(2)})`}
              />
            </mask>
            <motion.path
              d={silhouette}
              fill={layer.fill}
              opacity={layer.opacity}
              mask={`url(#${maskId})`}
            />
          </g>
        )
      })}
    </>
  )
}

function useResolvedColor(color: ColorValue) {
  const local = useMotionValue(typeof color === 'string' ? color : color.get())
  if (typeof color === 'string') {
    if (local.get() !== color) local.set(color)
    return local
  }
  return color
}

function ShadeStops({ bodyColor, strength }: { bodyColor: ColorValue; strength: number }) {
  const color = useResolvedColor(bodyColor)
  const highlight = useTransform(color, value => shadeColors(value, strength).highlight)
  const mid = useTransform(color, value => shadeColors(value, strength).mid)
  const shadow = useTransform(color, value => shadeColors(value, strength).shadow)
  return (
    <>
      <motion.stop offset="0" style={{ stopColor: highlight }} />
      <motion.stop offset="0.48" style={{ stopColor: mid }} />
      <motion.stop offset="1" style={{ stopColor: shadow }} />
    </>
  )
}

export function AvatarStyleDefs({
  id,
  style,
  bodyColor,
}: {
  id: string
  style: AvatarRenderStyle
  bodyColor: ColorValue
}) {
  if (style.type === 'softShade') {
    return (
      <radialGradient id={`${id}-shade`} cx="36%" cy="30%" r="72%">
        <ShadeStops bodyColor={bodyColor} strength={style.strength} />
      </radialGradient>
    )
  }
  if (style.type === 'glow') {
    return (
      <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation={style.size} />
      </filter>
    )
  }
  if (style.type === 'borderlands') {
    const { scale, frequency } = inkFilterParams(style.wobble)
    return (
      <>
        <filter
          id={`${id}-ink`}
          x="-45%"
          y="-45%"
          width="190%"
          height="190%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency={frequency}
            numOctaves={2}
            seed={inkFilterSeed(id)}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id={`${id}-ink-erode`}>
          <feMorphology operator="erode" radius={inkRimRadius(style.width)} />
        </filter>
      </>
    )
  }
  return null
}

export function AvatarGlowUnderlay({
  id,
  style,
  bodyColor,
  headPath,
  bodyFillPath,
  backPaths,
  frontPaths,
}: {
  id: string
  style: AvatarRenderStyle
  bodyColor: ColorValue
  headPath: PathValue
  bodyFillPath?: PathValue
  backPaths: PathValue[]
  frontPaths: PathValue[]
}) {
  const color = useResolvedColor(bodyColor)
  const fill = useTransform(color, glowTint)
  if (style.type !== 'glow') return null
  if (bodyFillPath) {
    return (
      <g className="avatar-glow" filter={`url(#${id}-glow)`} pointerEvents="none">
        <motion.path d={bodyFillPath} fill={fill} />
      </g>
    )
  }
  return (
    <g className="avatar-glow" filter={`url(#${id}-glow)`} pointerEvents="none">
      {backPaths.map((pathValue, index) => (
        <motion.path d={pathValue} fill={fill} key={`glow-back-${index}`} />
      ))}
      <motion.path d={headPath} fill={fill} />
      {frontPaths.map((pathValue, index) => (
        <motion.path d={pathValue} fill={fill} key={`glow-front-${index}`} />
      ))}
    </g>
  )
}

export function AvatarInkMarks({
  id,
  style,
  bodyFillPath,
  headPath,
  backPaths,
  frontPaths,
}: {
  id: string
  style: AvatarRenderStyle
  bodyFillPath?: PathValue
  headPath: PathValue
  backPaths: PathValue[]
  frontPaths: PathValue[]
}) {
  if (style.type !== 'borderlands') return null
  const bodyPaths = bodyFillPath ? [bodyFillPath] : [...backPaths, headPath, ...frontPaths]
  const maskId = `${id}-ink-rim`
  return (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="-200" y="-200" width="400" height="400">
        {bodyPaths.map((pathValue, index) => (
          <motion.path d={pathValue} fill="#fff" key={`rim-full-${index}`} />
        ))}
        <g filter={`url(#${id}-ink-erode)`}>
          {bodyPaths.map((pathValue, index) => (
            <motion.path d={pathValue} fill="#000" key={`rim-core-${index}`} />
          ))}
        </g>
      </mask>
      <g className="avatar-ink" mask={`url(#${maskId})`} pointerEvents="none">
        {bodyPaths.map((pathValue, index) => (
          <motion.path
            d={pathValue}
            fill="none"
            stroke={style.color}
            strokeWidth={style.width * 0.28}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={inkInnerDash}
            key={`ink-inner-${index}`}
          />
        ))}
      </g>
    </>
  )
}

export function useVectorPathPaint(
  style: AvatarRenderStyle,
  bodyColor: ColorValue,
  eyeColor: ColorValue,
  id: string
) {
  const color = useResolvedColor(bodyColor)
  const eyes = useResolvedColor(eyeColor)
  const shadeId = `${id}-shade`
  const fill = useMotionValue(livePaintFill(style.type, color.get(), shadeId))
  const eyeFill = useMotionValue(style.type === 'pixel' ? 'transparent' : eyes.get())
  const inkColor = style.type === 'borderlands' ? style.color : undefined
  const stroke = useMotionValue(livePaintStroke(style.type, color.get(), inkColor))
  const material = resolveVectorMaterial(style, color.get())

  useEffect(() => {
    const sync = () => {
      fill.set(livePaintFill(style.type, color.get(), shadeId))
      eyeFill.set(style.type === 'pixel' ? 'transparent' : eyes.get())
      stroke.set(livePaintStroke(style.type, color.get(), inkColor))
    }
    const unsubscribers = [color.on('change', sync), eyes.on('change', sync)]
    sync()
    return () => unsubscribers.forEach(unsubscribe => unsubscribe())
  }, [color, eyes, fill, eyeFill, stroke, style, shadeId, inkColor])

  return {
    fill,
    eyeFill,
    stroke,
    strokeWidth: material.showOutline ? material.outlineWidth : 0,
    eyeStrokeWidth: material.showOutline ? material.eyeOutlineWidth : 0,
    paintOrder: 'stroke fill',
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
}

export function VectorAvatarGraphic({
  id,
  renderStyle,
  bodyColor,
  eyeColor,
  headPath,
  bodyFillPath,
  backPaths,
  frontPaths,
  leftPath,
  rightPath,
  leftOpacity,
  rightOpacity,
  offsetX = 0,
  offsetY = 0,
  className,
  extraDefs,
  children,
  paint,
  look,
}: {
  id: string
  renderStyle: AvatarRenderStyle
  bodyColor: ColorValue
  eyeColor: ColorValue
  headPath: PathValue
  bodyFillPath?: PathValue
  backPaths: PathValue[]
  frontPaths: PathValue[]
  leftPath: PathValue
  rightPath: PathValue
  leftOpacity: OpacityValue
  rightOpacity: OpacityValue
  offsetX?: OffsetValue
  offsetY?: OffsetValue
  className?: string
  extraDefs?: React.ReactNode
  children?: React.ReactNode
  paint?: PaintValue
  look?: PaintLook
}) {
  const pathPaint = useVectorPathPaint(renderStyle, bodyColor, eyeColor, id)
  const fillPath = bodyFillPath ?? headPath
  const bodyStyle = {
    fill: pathPaint.fill,
    stroke: pathPaint.stroke,
    paintOrder: pathPaint.paintOrder,
  }
  const eyeStyle = {
    fill: pathPaint.eyeFill,
    stroke: pathPaint.stroke,
    paintOrder: pathPaint.paintOrder,
  }
  return (
    <svg className={className} viewBox="-150 -150 300 300" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}>
          <motion.path d={headPath} />
        </clipPath>
        <AvatarStyleDefs id={id} style={renderStyle} bodyColor={bodyColor} />
        {extraDefs}
      </defs>
      {children}
      <motion.g
        style={{ x: offsetX, y: offsetY }}
        filter={renderStyle.type === 'borderlands' ? `url(#${id}-ink)` : undefined}
      >
        <AvatarGlowUnderlay
          id={id}
          style={renderStyle}
          bodyColor={bodyColor}
          headPath={headPath}
          bodyFillPath={bodyFillPath}
          backPaths={backPaths}
          frontPaths={frontPaths}
        />
        {bodyFillPath ? (
          <motion.path
            className="preview-head"
            d={fillPath}
            strokeWidth={pathPaint.strokeWidth}
            strokeLinejoin={pathPaint.strokeLinejoin}
            strokeLinecap={pathPaint.strokeLinecap}
            fillRule="nonzero"
            style={bodyStyle}
          />
        ) : (
          <>
            {backPaths.map((pathValue, index) => (
              <motion.path
                className="preview-head"
                d={pathValue}
                strokeWidth={pathPaint.strokeWidth}
                strokeLinejoin={pathPaint.strokeLinejoin}
                strokeLinecap={pathPaint.strokeLinecap}
                fillRule="nonzero"
                style={bodyStyle}
                key={`back-${index}`}
              />
            ))}
            <motion.path
              className="preview-head"
              d={headPath}
              strokeWidth={pathPaint.strokeWidth}
              strokeLinejoin={pathPaint.strokeLinejoin}
              strokeLinecap={pathPaint.strokeLinecap}
              style={bodyStyle}
            />
          </>
        )}
        {paint && look && (
          <AvatarPaintOverlay
            id={id}
            clipId={`${id}-clip`}
            paint={paint}
            look={look}
            style={renderStyle}
            bodyColor={bodyColor}
            eyeColor={eyeColor}
          />
        )}
        {look && (
          <AvatarShadeLayers id={id} silhouette={fillPath} look={look} style={renderStyle} />
        )}
        <g clipPath={`url(#${id}-clip)`}>
          <motion.path
            className="preview-eye"
            d={leftPath}
            opacity={leftOpacity}
            strokeWidth={pathPaint.eyeStrokeWidth}
            strokeLinejoin={pathPaint.strokeLinejoin}
            strokeLinecap={pathPaint.strokeLinecap}
            style={eyeStyle}
          />
          <motion.path
            className="preview-eye"
            d={rightPath}
            opacity={rightOpacity}
            strokeWidth={pathPaint.eyeStrokeWidth}
            strokeLinejoin={pathPaint.strokeLinejoin}
            strokeLinecap={pathPaint.strokeLinecap}
            style={eyeStyle}
          />
        </g>
        {!bodyFillPath &&
          frontPaths.map((pathValue, index) => (
            <motion.path
              className="preview-head"
              d={pathValue}
              strokeWidth={pathPaint.strokeWidth}
              strokeLinejoin={pathPaint.strokeLinejoin}
              strokeLinecap={pathPaint.strokeLinecap}
              fillRule="nonzero"
              style={bodyStyle}
              key={`front-${index}`}
            />
          ))}
        <AvatarInkMarks
          id={id}
          style={renderStyle}
          bodyFillPath={bodyFillPath}
          headPath={headPath}
          backPaths={backPaths}
          frontPaths={frontPaths}
        />
      </motion.g>
    </svg>
  )
}
