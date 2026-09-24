export type OutlineRenderStyle = {
  type: 'outline'
  width: number
}

export type SoftShadeRenderStyle = {
  type: 'softShade'
  strength: number
}

export type GlowRenderStyle = {
  type: 'glow'
  size: number
}

export type BorderlandsRenderStyle = {
  type: 'borderlands'
  width: number
  wobble: number
  color: string
}

export type VectorFinishStyle =
  | { type: 'vector' }
  | OutlineRenderStyle
  | SoftShadeRenderStyle
  | GlowRenderStyle
  | BorderlandsRenderStyle

export const defaultOutlineRenderStyle: OutlineRenderStyle = {
  type: 'outline',
  width: 8,
}

export const defaultSoftShadeRenderStyle: SoftShadeRenderStyle = {
  type: 'softShade',
  strength: 55,
}

export const defaultGlowRenderStyle: GlowRenderStyle = {
  type: 'glow',
  size: 10,
}

export const defaultBorderlandsRenderStyle: BorderlandsRenderStyle = {
  type: 'borderlands',
  width: 12,
  wobble: 6,
  color: '#1a140c',
}

export const outlineWidthRange = { min: 2, max: 18 } as const
export const softShadeStrengthRange = { min: 15, max: 100 } as const
export const glowSizeRange = { min: 4, max: 22 } as const
export const borderlandsWidthRange = { min: 4, max: 22 } as const
export const borderlandsWobbleRange = { min: 1, max: 14 } as const
const hexColor = /^#[0-9a-f]{6}$/i

export const parseInkColor = (value: unknown, fallback = defaultBorderlandsRenderStyle.color) =>
  typeof value === 'string' && hexColor.test(value) ? value.toLowerCase() : fallback

export const inkInnerDash = '16 22 9 18 13 26'

export const inkFilterParams = (wobble: number) => ({
  scale: 2 + wobble * 0.85,
  frequency: Math.max(0.018, 0.056 - wobble * 0.002),
})

export const inkRimRadius = (width: number) => Math.max(1.5, width * 0.45)

export const inkFilterSeed = (id: string) =>
  Array.from(id).reduce((total, char) => total + char.charCodeAt(0), 0) % 17 + 2

const hexChannels = (color: string): readonly [number, number, number] => [
  Number.parseInt(color.slice(1, 3), 16),
  Number.parseInt(color.slice(3, 5), 16),
  Number.parseInt(color.slice(5, 7), 16),
]

export const mixHex = (from: string, to: string, amount: number) => {
  const progress = Math.min(1, Math.max(0, amount))
  const left = hexChannels(from)
  const right = hexChannels(to)
  return `#${left
    .map((channel, index) =>
      Math.round(channel + (right[index] - channel) * progress)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

export const hexLuminance = (color: string) => {
  const [red, green, blue] = hexChannels(color)
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
}

export const outlineStrokeColor = (bodyColor: string) =>
  hexLuminance(bodyColor) < 0.28 ? mixHex(bodyColor, '#f4f7fb', 0.42) : mixHex(bodyColor, '#0b0d10', 0.64)

export const glowTint = (bodyColor: string) => mixHex(bodyColor, '#ffffff', 0.38)

export const shadeColors = (bodyColor: string, strength: number) => {
  const amount = Math.min(1, Math.max(0, strength / 100))
  return {
    highlight: mixHex(bodyColor, '#ffffff', 0.16 + amount * 0.42),
    mid: bodyColor,
    shadow: mixHex(bodyColor, '#0b1020', 0.2 + amount * 0.4),
  }
}

export type VectorMaterial = {
  type: VectorFinishStyle['type']
  bodyFill: string
  useShade: boolean
  highlightColor: string
  midColor: string
  shadowColor: string
  outlineColor: string
  outlineWidth: number
  eyeOutlineWidth: number
  glowColor: string
  glowSize: number
  showGlow: boolean
  showOutline: boolean
  showBorderlands: boolean
  wobble: number
}

export const resolveVectorMaterial = (
  style: {
    type?: string
    width?: number
    strength?: number
    size?: number
    wobble?: number
    color?: string
  } | null | undefined,
  bodyColor: string
): VectorMaterial => {
  const type = style?.type
  const shade = shadeColors(
    bodyColor,
    typeof style?.strength === 'number' ? style.strength : defaultSoftShadeRenderStyle.strength
  )
  const outlineWidth =
    typeof style?.width === 'number'
      ? style.width
      : type === 'borderlands'
        ? defaultBorderlandsRenderStyle.width
        : defaultOutlineRenderStyle.width
  const glowSize = typeof style?.size === 'number' ? style.size : defaultGlowRenderStyle.size
  const wobble =
    typeof style?.wobble === 'number' ? style.wobble : defaultBorderlandsRenderStyle.wobble
  const inkColor = parseInkColor(style?.color)
  return {
    type:
      type === 'outline' || type === 'softShade' || type === 'glow' || type === 'borderlands'
        ? type
        : 'vector',
    bodyFill: type === 'softShade' ? shade.mid : bodyColor,
    useShade: type === 'softShade',
    highlightColor: shade.highlight,
    midColor: shade.mid,
    shadowColor: shade.shadow,
    outlineColor: type === 'borderlands' ? inkColor : outlineStrokeColor(bodyColor),
    outlineWidth,
    eyeOutlineWidth: outlineWidth * (type === 'borderlands' ? 0.42 : 0.45),
    glowColor: glowTint(bodyColor),
    glowSize,
    showGlow: type === 'glow',
    showOutline: type === 'outline' || type === 'borderlands',
    showBorderlands: type === 'borderlands',
    wobble,
  }
}

export const borderlandsFilterMarkup = (idPrefix: string, wobble: number, seed = 4) => {
  const { scale, frequency } = inkFilterParams(wobble)
  return `<filter id="${idPrefix}-ink" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${frequency.toFixed(3)}" numOctaves="2" seed="${seed}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${scale.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/></filter>`
}

export const vectorStyleDefsMarkup = (idPrefix: string, material: VectorMaterial) => {
  const parts: string[] = []
  if (material.useShade) {
    parts.push(
      `<radialGradient id="${idPrefix}-shade" cx="36%" cy="30%" r="72%"><stop offset="0" stop-color="${material.highlightColor}"/><stop offset="0.48" stop-color="${material.midColor}"/><stop offset="1" stop-color="${material.shadowColor}"/></radialGradient>`
    )
  }
  if (material.showGlow) {
    parts.push(
      `<filter id="${idPrefix}-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="${material.glowSize}"/></filter>`
    )
  }
  if (material.showBorderlands) {
    parts.push(borderlandsFilterMarkup(idPrefix, material.wobble))
    parts.push(
      `<filter id="${idPrefix}-ink-erode"><feMorphology operator="erode" radius="${inkRimRadius(material.outlineWidth).toFixed(2)}"/></filter>`
    )
  }
  return parts.join('')
}

export const bodyFillForMaterial = (material: VectorMaterial, shadeId: string) =>
  material.useShade ? `url(#${shadeId})` : material.bodyFill

export const livePaintFill = (
  styleType: string | undefined,
  bodyColor: string,
  shadeId: string
) => {
  if (styleType === 'pixel') return 'transparent'
  if (styleType === 'softShade') return `url(#${shadeId})`
  return bodyColor
}

export const livePaintStroke = (
  styleType: string | undefined,
  bodyColor: string,
  inkColor?: string
) => {
  if (styleType === 'borderlands') return parseInkColor(inkColor)
  if (styleType === 'outline') return outlineStrokeColor(bodyColor)
  return 'none'
}
