import { defaultExpression } from '@/features/avatar/presets'
import { createInitialSequences } from '@/features/animation/sequences'
import {
  applyAvatarEyeDefaults,
  cloneAvatarBehavior,
  createAvatar,
  defaultAvatarEyes,
  parseAvatarEyeDefaults,
  parseAvatarLibrary,
  parseAvatarRenderStyle,
  resolveAvatarBehavior,
} from '@/features/avatar/avatars'
import { defaultAvatarShading, hexToHsl, hslToHex, suggestPalette } from '@/features/avatar/paint'
import { initialExpressions } from '@/features/avatar/presets'

describe('avatar eye defaults', () => {
  it('keeps the historical rendering when using default values', () => {
    expect(applyAvatarEyeDefaults(defaultExpression, defaultAvatarEyes)).toEqual(defaultExpression)
  })

  it('composes avatar defaults as variations around the neutral expression', () => {
    const expression = { ...defaultExpression, widthLeft: 28, positionYLeft: 5 }
    const eyes = { ...defaultAvatarEyes, widthLeft: 30, positionYLeft: -12 }

    const result = applyAvatarEyeDefaults(expression, eyes)

    expect(result.widthLeft).toBe(38)
    expect(result.positionYLeft).toBe(0)
    expect(expression.widthLeft).toBe(28)
  })

  it('sanitizes partial persisted values', () => {
    const result = parseAvatarEyeDefaults({ widthLeft: 42, heightRight: Number.NaN })

    expect(result.widthLeft).toBe(42)
    expect(result.heightRight).toBe(defaultAvatarEyes.heightRight)
    expect(result.spacing).toBe(defaultAvatarEyes.spacing)
  })
})

describe('avatar render style', () => {
  it('keeps vector rendering as the compatible default', () => {
    expect(parseAvatarRenderStyle(undefined)).toEqual({ type: 'vector' })
  })

  it('sanitizes pixel settings', () => {
    expect(
      parseAvatarRenderStyle({
        type: 'pixel',
        resolution: 500,
      })
    ).toEqual({
      type: 'pixel',
      resolution: 192,
    })
    expect(parseAvatarRenderStyle({ type: 'pixel', resolution: 1 })).toEqual({
      type: 'pixel',
      resolution: 8,
    })
  })

  it('sanitizes outline, soft shade and glow settings', () => {
    expect(parseAvatarRenderStyle({ type: 'outline', width: 80 })).toEqual({
      type: 'outline',
      width: 18,
    })
    expect(parseAvatarRenderStyle({ type: 'softShade', strength: 4 })).toEqual({
      type: 'softShade',
      strength: 15,
    })
    expect(parseAvatarRenderStyle({ type: 'glow', size: 3 })).toEqual({
      type: 'glow',
      size: 4,
    })
    expect(
      parseAvatarRenderStyle({ type: 'borderlands', width: 80, wobble: 0, color: 'red' })
    ).toEqual({
      type: 'borderlands',
      width: 22,
      wobble: 1,
      color: '#1a140c',
    })
  })
})

describe('avatar palette and shading', () => {
  const fallback = { activeAvatarId: 'fallback', avatars: [createAvatar('Fallback')] }
  const base = { expressions: initialExpressions, sequences: createInitialSequences() }

  it('derives accents for older avatars and sanitizes shading', () => {
    const library = parseAvatarLibrary(
      {
        activeAvatarId: 'a',
        avatars: [
          {
            id: 'a',
            name: 'Ember',
            colors: { body: '#e8743b', eyes: '#111316' },
            shading: { amount: 400, angle: 'left', color: 'blue' },
          },
        ],
      },
      fallback,
      base
    )
    const [avatar] = library.avatars

    expect(avatar.palette.accent).toMatch(/^#[0-9a-f]{6}$/)
    expect(avatar.palette.accent).not.toBe(avatar.colors.body)
    expect(avatar.shading).toEqual({ ...defaultAvatarShading, amount: 100 })
    expect(avatar.markings).toEqual([])
  })

  it('suggests harmonies that move the accent hue away from the body', () => {
    const [bodyHue] = hexToHsl('#5b7fe5')
    const [accentHue] = hexToHsl(suggestPalette('#5b7fe5', 'complementary').accent)
    const distance = Math.abs(((accentHue - bodyHue + 540) % 360) - 180)

    expect(distance).toBeGreaterThan(172)
    expect(hslToHex(...hexToHsl('#5b7fe5'))).toBe('#5b7fe5')
    expect(suggestPalette('#5b7fe5', 'ember').accent).not.toBe(
      suggestPalette('#5b7fe5', 'pastel').accent
    )
  })
})

describe('avatar behavior library', () => {
  const base = {
    expressions: initialExpressions,
    sequences: createInitialSequences(),
  }

  it('inherits the base library until the avatar owns a customization', () => {
    const avatar = createAvatar('Strobi')

    expect(resolveAvatarBehavior(avatar, base)).toBe(base)
  })

  it('clones expressions, animations and nested steps as one independent library', () => {
    const behavior = cloneAvatarBehavior(base)

    expect(behavior).not.toBe(base)
    expect(behavior.expressions).not.toBe(base.expressions)
    expect(behavior.sequences).not.toBe(base.sequences)
    expect(behavior.sequences[0].steps).not.toBe(base.sequences[0].steps)
    expect(behavior.sequences[0].blink).not.toBe(base.sequences[0].blink)
  })
})
