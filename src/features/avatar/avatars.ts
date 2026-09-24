import { parseAvatarBody, type AvatarBody } from './body'
import { parseMarkings, type Marking } from './markings'
import {
  defaultAvatarShading,
  derivePalette,
  parseAvatarPalette,
  parseAvatarShading,
  type AvatarPalette,
  type AvatarShading,
} from './paint'
import { defaultExpression, initialExpressions } from './presets'
import { surfacePresets } from './surfaces'
import type { Expression } from './geometry'
import { isBodyMotion, isEyeMotion } from './ambientMotion'
import {
  normalizeSequencesForExpressions,
  parseSequences,
  type AvatarSequence,
} from '../animation/sequences'
import {
  borderlandsWidthRange,
  borderlandsWobbleRange,
  defaultBorderlandsRenderStyle,
  defaultGlowRenderStyle,
  defaultOutlineRenderStyle,
  defaultSoftShadeRenderStyle,
  glowSizeRange,
  outlineWidthRange,
  parseInkColor,
  softShadeStrengthRange,
  type BorderlandsRenderStyle,
  type GlowRenderStyle,
  type OutlineRenderStyle,
  type SoftShadeRenderStyle,
} from '../rendering/vectorMaterials'

export type AvatarBehaviorLibrary = {
  expressions: Expression[]
  sequences: AvatarSequence[]
}

export type StudioAvatar = {
  id: string
  name: string
  body: AvatarBody
  colors: AvatarColors
  eyes: AvatarEyeDefaults
  renderStyle: AvatarRenderStyle
  palette: AvatarPalette
  shading: AvatarShading
  markings: Marking[]
  behavior?: AvatarBehaviorLibrary
}

export type AvatarLook = Pick<StudioAvatar, 'palette' | 'shading' | 'markings'>

export const avatarLook = (avatar: StudioAvatar): AvatarLook => ({
  palette: avatar.palette,
  shading: avatar.shading,
  markings: avatar.markings,
})

export type AvatarColors = { body: string; eyes: string }
export type PixelRenderStyle = {
  type: 'pixel'
  resolution: number
}
export type AvatarRenderStyle =
  | { type: 'vector' }
  | PixelRenderStyle
  | OutlineRenderStyle
  | SoftShadeRenderStyle
  | GlowRenderStyle
  | BorderlandsRenderStyle
export type AvatarRenderStyleType = AvatarRenderStyle['type']
export type AvatarEyeDefaults = Pick<
  Expression,
  | 'widthLeft'
  | 'widthRight'
  | 'heightLeft'
  | 'heightRight'
  | 'spacing'
  | 'positionXLeft'
  | 'positionXRight'
  | 'positionYLeft'
  | 'positionYRight'
  | 'leftAngle'
  | 'rightAngle'
>
export const defaultAvatarColors: AvatarColors = { body: '#5b7fe5', eyes: '#111316' }
export const defaultAvatarRenderStyle: AvatarRenderStyle = { type: 'vector' }
export const defaultPixelRenderStyle: PixelRenderStyle = {
  type: 'pixel',
  resolution: 64,
}
export {
  defaultBorderlandsRenderStyle,
  defaultGlowRenderStyle,
  defaultOutlineRenderStyle,
  defaultSoftShadeRenderStyle,
}
export const defaultAvatarEyes: AvatarEyeDefaults = {
  widthLeft: defaultExpression.widthLeft,
  widthRight: defaultExpression.widthRight,
  heightLeft: defaultExpression.heightLeft,
  heightRight: defaultExpression.heightRight,
  spacing: defaultExpression.spacing,
  positionXLeft: defaultExpression.positionXLeft,
  positionXRight: defaultExpression.positionXRight,
  positionYLeft: defaultExpression.positionYLeft,
  positionYRight: defaultExpression.positionYRight,
  leftAngle: defaultExpression.leftAngle,
  rightAngle: defaultExpression.rightAngle,
}
const hexColor = /^#[0-9a-f]{6}$/i
const parseColors = (value: unknown): AvatarColors => {
  const candidate = value as Partial<AvatarColors> | null
  return {
    body:
      typeof candidate?.body === 'string' && hexColor.test(candidate.body)
        ? candidate.body
        : defaultAvatarColors.body,
    eyes:
      typeof candidate?.eyes === 'string' && hexColor.test(candidate.eyes)
        ? candidate.eyes
        : defaultAvatarColors.eyes,
  }
}

const finiteBounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback

export const createAvatarRenderStyle = (type: AvatarRenderStyleType): AvatarRenderStyle => {
  if (type === 'pixel') return { ...defaultPixelRenderStyle }
  if (type === 'outline') return { ...defaultOutlineRenderStyle }
  if (type === 'softShade') return { ...defaultSoftShadeRenderStyle }
  if (type === 'glow') return { ...defaultGlowRenderStyle }
  if (type === 'borderlands') return { ...defaultBorderlandsRenderStyle }
  return { ...defaultAvatarRenderStyle }
}

export const parseAvatarRenderStyle = (value: unknown): AvatarRenderStyle => {
  const candidate = value as Partial<AvatarRenderStyle> | null
  if (candidate?.type === 'pixel') {
    return {
      type: 'pixel',
      resolution: Math.round(
        finiteBounded(candidate.resolution, defaultPixelRenderStyle.resolution, 8, 192)
      ),
    }
  }
  if (candidate?.type === 'outline') {
    return {
      type: 'outline',
      width: finiteBounded(
        candidate.width,
        defaultOutlineRenderStyle.width,
        outlineWidthRange.min,
        outlineWidthRange.max
      ),
    }
  }
  if (candidate?.type === 'softShade') {
    return {
      type: 'softShade',
      strength: finiteBounded(
        candidate.strength,
        defaultSoftShadeRenderStyle.strength,
        softShadeStrengthRange.min,
        softShadeStrengthRange.max
      ),
    }
  }
  if (candidate?.type === 'glow') {
    return {
      type: 'glow',
      size: finiteBounded(
        candidate.size,
        defaultGlowRenderStyle.size,
        glowSizeRange.min,
        glowSizeRange.max
      ),
    }
  }
  if (candidate?.type === 'borderlands') {
    return {
      type: 'borderlands',
      width: finiteBounded(
        candidate.width,
        defaultBorderlandsRenderStyle.width,
        borderlandsWidthRange.min,
        borderlandsWidthRange.max
      ),
      wobble: finiteBounded(
        candidate.wobble,
        defaultBorderlandsRenderStyle.wobble,
        borderlandsWobbleRange.min,
        borderlandsWobbleRange.max
      ),
      color: parseInkColor(candidate.color),
    }
  }
  return { ...defaultAvatarRenderStyle }
}

const eyeDefaultFields = Object.keys(defaultAvatarEyes) as (keyof AvatarEyeDefaults)[]
export const parseAvatarEyeDefaults = (value: unknown): AvatarEyeDefaults => {
  const candidate = value as Partial<AvatarEyeDefaults> | null
  const parsed = { ...defaultAvatarEyes }
  eyeDefaultFields.forEach(field => {
    const stored = candidate?.[field]
    if (typeof stored === 'number' && Number.isFinite(stored)) parsed[field] = stored
  })
  return parsed
}

export const applyAvatarEyeDefaults = (
  expression: Expression,
  eyes: AvatarEyeDefaults = defaultAvatarEyes
): Expression => {
  const result = { ...expression }
  eyeDefaultFields.forEach(field => {
    result[field] = expression[field] + eyes[field] - defaultAvatarEyes[field]
  })
  result.widthLeft = Math.max(10, result.widthLeft)
  result.widthRight = Math.max(10, result.widthRight)
  result.heightLeft = Math.max(10, result.heightLeft)
  result.heightRight = Math.max(10, result.heightRight)
  return result
}

export type AvatarLibrary = {
  activeAvatarId: string
  avatars: StudioAvatar[]
}

const withBundledPartPaint = (local: AvatarBody, bundled: AvatarBody): AvatarBody => {
  const nodePaint = new Map(bundled.nodes.map(node => [node.id, node.paint]))
  const limbPaint = new Map(bundled.limbs.map(limb => [limb.id, limb.paint]))
  return {
    ...local,
    nodes: local.nodes.map(node => {
      const paint = nodePaint.get(node.id)
      return paint ? { ...node, paint } : node
    }),
    limbs: local.limbs.map(limb => {
      const paint = limbPaint.get(limb.id)
      return paint ? { ...limb, paint } : limb
    }),
  }
}

export const adoptBundledLook = (local: StudioAvatar, bundled: StudioAvatar): StudioAvatar => ({
  ...local,
  body: withBundledPartPaint(local.body, bundled.body),
  palette: bundled.palette,
  shading: bundled.shading,
  markings: bundled.markings,
})

export const mergeBundledAvatars = (
  local: StudioAvatar[],
  bundled: StudioAvatar[],
  lookUpgradeIds: ReadonlySet<string> = new Set()
): StudioAvatar[] => {
  const localById = new Map(local.map(avatar => [avatar.id, avatar]))
  const bundledIds = new Set(bundled.map(avatar => avatar.id))
  return [
    ...bundled.map(avatar => {
      const stored = localById.get(avatar.id)
      if (!stored) return avatar
      return lookUpgradeIds.has(avatar.id) ? adoptBundledLook(stored, avatar) : stored
    }),
    ...local.filter(avatar => !bundledIds.has(avatar.id)),
  ]
}

export const hasCustomLook = (avatar: StudioAvatar) =>
  avatar.markings.length > 0 ||
  avatar.body.nodes.some(node => node.paint) ||
  avatar.body.limbs.some(limb => limb.paint) ||
  avatar.shading.amount > 0 ||
  avatar.shading.highlight > 0

const cloneExpressions = (expressions: Expression[]) => expressions.map(item => ({ ...item }))
export const parseExpressions = (value: unknown): Expression[] => {
  if (!Array.isArray(value) || !value.length) return cloneExpressions(initialExpressions)
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return { ...defaultExpression, id: `expression-${String(index).padStart(2, '0')}` }
    }
    const candidate = item as Partial<Expression>
    const storedEyeMotion = (item as { eyeMotion?: unknown }).eyeMotion
    const storedBodyMotion = (item as { bodyMotion?: unknown }).bodyMotion
    const parsed = Object.fromEntries(
      Object.entries(defaultExpression).map(([field, fallback]) => {
        if (field === 'id') {
          return [
            field,
            typeof candidate.id === 'string' && candidate.id
              ? candidate.id
              : `expression-${String(index).padStart(2, '0')}`,
          ]
        }
        const stored = candidate[field as keyof Expression]
        return [field, typeof stored === 'number' && Number.isFinite(stored) ? stored : fallback]
      })
    ) as Expression
    if (typeof candidate.bodyColor === 'string' && hexColor.test(candidate.bodyColor))
      parsed.bodyColor = candidate.bodyColor
    if (typeof candidate.eyeColor === 'string' && hexColor.test(candidate.eyeColor))
      parsed.eyeColor = candidate.eyeColor
    parsed.eyeMotion = isEyeMotion(storedEyeMotion) ? storedEyeMotion : defaultExpression.eyeMotion
    parsed.bodyMotion = isBodyMotion(storedBodyMotion)
      ? storedBodyMotion
      : defaultExpression.bodyMotion
    return parsed
  })
}

const cloneSequences = (sequences: AvatarSequence[]) =>
  sequences.map(sequence => ({
    ...sequence,
    steps: sequence.steps.map(step => ({ ...step })),
    blink: { ...sequence.blink },
  }))

export const cloneAvatarBehavior = (behavior: AvatarBehaviorLibrary): AvatarBehaviorLibrary => ({
  expressions: cloneExpressions(behavior.expressions),
  sequences: cloneSequences(behavior.sequences),
})

export const resolveAvatarBehavior = (
  avatar: StudioAvatar,
  base: AvatarBehaviorLibrary
): AvatarBehaviorLibrary => avatar.behavior ?? base

const parseAvatarBehavior = (
  value: unknown,
  base: AvatarBehaviorLibrary
): AvatarBehaviorLibrary | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<AvatarBehaviorLibrary>
  if (!Array.isArray(candidate.expressions) || !candidate.expressions.length) return undefined
  const expressions = parseExpressions(candidate.expressions)
  const sequences = normalizeSequencesForExpressions(
    Array.isArray(candidate.sequences)
      ? parseSequences(candidate.sequences)
      : cloneSequences(base.sequences),
    expressions
  )
  return { expressions, sequences }
}

export const createAvatar = (name: string): StudioAvatar => ({
  id: `avatar-${crypto.randomUUID()}`,
  name: name.trim() || 'Nouvel avatar',
  body: { primary: { ...surfacePresets.sphere }, nodes: [], limbs: [] },
  colors: { ...defaultAvatarColors },
  eyes: { ...defaultAvatarEyes },
  renderStyle: { ...defaultAvatarRenderStyle },
  palette: derivePalette(defaultAvatarColors.body),
  shading: { ...defaultAvatarShading },
  markings: [],
})

export const parseAvatarLibrary = (
  value: unknown,
  fallback: AvatarLibrary,
  baseBehavior: AvatarBehaviorLibrary
): AvatarLibrary => {
  try {
    const parsed = value as Partial<AvatarLibrary> | null
    if (!parsed || !Array.isArray(parsed.avatars) || !parsed.avatars.length) return fallback
    const seenIds = new Set<string>()
    const avatars = parsed.avatars
      .filter(avatar => {
        if (!avatar || typeof avatar.id !== 'string' || typeof avatar.name !== 'string')
          return false
        if (seenIds.has(avatar.id)) return false
        seenIds.add(avatar.id)
        return true
      })
      .map(avatar => {
        const behavior = parseAvatarBehavior(avatar.behavior, baseBehavior)
        const colors = parseColors(avatar.colors)
        return {
          id: avatar.id,
          name: avatar.name,
          body: parseAvatarBody(avatar.body, surfacePresets.sphere),
          colors,
          eyes: parseAvatarEyeDefaults(avatar.eyes),
          renderStyle: parseAvatarRenderStyle(avatar.renderStyle),
          palette: parseAvatarPalette(avatar.palette, colors.body),
          shading: parseAvatarShading(avatar.shading),
          markings: parseMarkings(avatar.markings),
          ...(behavior ? { behavior } : {}),
        }
      })
    if (!avatars.length) return fallback
    const activeAvatarId = avatars.some(avatar => avatar.id === parsed.activeAvatarId)
      ? parsed.activeAvatarId!
      : avatars[0].id
    return { activeAvatarId, avatars }
  } catch {
    return fallback
  }
}
