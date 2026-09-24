export const paintRoles = ['body', 'accent', 'accent2', 'eyes'] as const
export type PaintRole = (typeof paintRoles)[number]
export type PaintRef = PaintRole | `#${string}`

export type AvatarPalette = { accent: string; accent2: string }
export type PaintColors = { body: string; eyes: string; accent: string; accent2: string }

export type AvatarShading = {
  amount: number
  size: number
  angle: number
  highlight: number
  color: string
}

export const shadingAmountRange = { min: 0, max: 100 } as const
export const shadingSizeRange = { min: 2, max: 48 } as const
export const shadingAngleRange = { min: -180, max: 180 } as const
export const shadingHighlightRange = { min: 0, max: 100 } as const

export const defaultAvatarShading: AvatarShading = {
  amount: 0,
  size: 16,
  angle: 135,
  highlight: 0,
  color: '#1d1b3f',
}

export const paintRoleLabels: Record<PaintRole, string> = {
  body: 'Corps',
  accent: 'Accent',
  accent2: 'Accent 2',
  eyes: 'Yeux',
}

const hexColor = /^#[0-9a-f]{6}$/i
export const isHexColor = (value: unknown): value is `#${string}` =>
  typeof value === 'string' && hexColor.test(value)

export const isPaintRole = (value: unknown): value is PaintRole =>
  typeof value === 'string' && (paintRoles as readonly string[]).includes(value)

export const parsePaintRef = (value: unknown, fallback: PaintRef = 'body'): PaintRef => {
  if (isPaintRole(value)) return value
  if (isHexColor(value)) return value.toLowerCase() as PaintRef
  return fallback
}

export const parseOptionalPaintRef = (value: unknown): PaintRef | null =>
  isPaintRole(value) || isHexColor(value) ? parsePaintRef(value) : null

export const resolvePaintRef = (ref: PaintRef, colors: PaintColors) =>
  isPaintRole(ref) ? colors[ref] : ref

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const finiteBounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback

export const hexToHsl = (color: string): readonly [number, number, number] => {
  const red = Number.parseInt(color.slice(1, 3), 16) / 255
  const green = Number.parseInt(color.slice(3, 5), 16) / 255
  const blue = Number.parseInt(color.slice(5, 7), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  if (max === min) return [0, 0, lightness]
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue =
    max === red
      ? (green - blue) / delta + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4
  return [hue * 60, saturation, lightness]
}

export const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const h = (((hue % 360) + 360) % 360) / 360
  const s = clamp01(saturation)
  const l = clamp01(lightness)
  const channel = (offset: number) => {
    const k = (offset + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

export const mixPaintHex = (from: string, to: string, amount: number) => {
  const progress = clamp01(amount)
  const channels = [1, 3, 5].map(offset => {
    const start = Number.parseInt(from.slice(offset, offset + 2), 16)
    const end = Number.parseInt(to.slice(offset, offset + 2), 16)
    return Math.round(start + (end - start) * progress)
      .toString(16)
      .padStart(2, '0')
  })
  return `#${channels.join('')}`
}

export const paletteHarmonies = [
  'complementary',
  'analogous',
  'triadic',
  'split',
  'tonal',
  'pastel',
  'ember',
] as const
export type PaletteHarmony = (typeof paletteHarmonies)[number]

export const paletteHarmonyLabels: Record<PaletteHarmony, string> = {
  complementary: 'Complémentaire',
  analogous: 'Analogue',
  triadic: 'Triadique',
  split: 'Complémentaire divisée',
  tonal: 'Ton sur ton',
  pastel: 'Pastel',
  ember: 'Braise',
}

export const suggestPalette = (body: string, harmony: PaletteHarmony): AvatarPalette => {
  const [hue, saturation, lightness] = hexToHsl(body)
  const vivid = Math.min(0.9, Math.max(0.55, saturation))
  if (harmony === 'analogous') {
    return {
      accent: hslToHex(hue + 32, vivid, Math.min(0.66, Math.max(0.45, lightness))),
      accent2: hslToHex(hue - 28, vivid * 0.7, 0.82),
    }
  }
  if (harmony === 'triadic') {
    return {
      accent: hslToHex(hue + 120, vivid, 0.56),
      accent2: hslToHex(hue + 240, vivid * 0.8, 0.72),
    }
  }
  if (harmony === 'split') {
    return {
      accent: hslToHex(hue + 150, vivid, 0.56),
      accent2: hslToHex(hue + 210, vivid * 0.75, 0.78),
    }
  }
  if (harmony === 'tonal') {
    return {
      accent: hslToHex(hue, Math.min(1, saturation * 1.1), Math.max(0.18, lightness - 0.24)),
      accent2: hslToHex(hue, saturation * 0.55, Math.min(0.93, lightness + 0.3)),
    }
  }
  if (harmony === 'pastel') {
    return {
      accent: hslToHex(hue + 180, 0.62, 0.8),
      accent2: hslToHex(hue + 40, 0.5, 0.9),
    }
  }
  if (harmony === 'ember') {
    return {
      accent: hslToHex(22, 0.95, 0.56),
      accent2: hslToHex(48, 0.96, 0.62),
    }
  }
  return {
    accent: hslToHex(hue + 180, vivid, 0.58),
    accent2: hslToHex(hue + 20, saturation * 0.4, 0.9),
  }
}

export const derivePalette = (body: string) => suggestPalette(body, 'complementary')

export const parseAvatarPalette = (value: unknown, body: string): AvatarPalette => {
  const candidate = value as Partial<AvatarPalette> | null
  const fallback = derivePalette(body)
  return {
    accent: isHexColor(candidate?.accent) ? candidate.accent.toLowerCase() : fallback.accent,
    accent2: isHexColor(candidate?.accent2) ? candidate.accent2.toLowerCase() : fallback.accent2,
  }
}

export const parseAvatarShading = (value: unknown): AvatarShading => {
  const candidate = value as Partial<AvatarShading> | null
  return {
    amount: finiteBounded(
      candidate?.amount,
      defaultAvatarShading.amount,
      shadingAmountRange.min,
      shadingAmountRange.max
    ),
    size: finiteBounded(
      candidate?.size,
      defaultAvatarShading.size,
      shadingSizeRange.min,
      shadingSizeRange.max
    ),
    angle: finiteBounded(
      candidate?.angle,
      defaultAvatarShading.angle,
      shadingAngleRange.min,
      shadingAngleRange.max
    ),
    highlight: finiteBounded(
      candidate?.highlight,
      defaultAvatarShading.highlight,
      shadingHighlightRange.min,
      shadingHighlightRange.max
    ),
    color: isHexColor(candidate?.color)
      ? candidate.color.toLowerCase()
      : defaultAvatarShading.color,
  }
}

const hashSeed = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export const seededRandom = hashSeed

export const randomPalette = (seed: number) => {
  const random = hashSeed(seed)
  const body = hslToHex(random() * 360, 0.45 + random() * 0.4, 0.5 + random() * 0.22)
  const harmony = paletteHarmonies[Math.floor(random() * paletteHarmonies.length)]
  return { body, harmony, palette: suggestPalette(body, harmony) }
}
