import { applyAvatarEyeDefaults, defaultAvatarEyes } from '@/features/avatar/avatars'
import { resolveCanvasPreviewExpression } from '@/features/rendering/canvasPreview'
import { defaultExpression } from '@/features/avatar/presets'
import { nextStageZoom, STAGE_ZOOM_MAX, STAGE_ZOOM_MIN } from '@/features/rendering/stageZoom'
import { livePaintFill, livePaintStroke } from '@/features/rendering/vectorMaterials'

describe('canvas preview expression', () => {
  it('keeps customized neutral eyes applied while rotating the body preview', () => {
    const eyes = {
      ...defaultAvatarEyes,
      widthLeft: 37,
      positionYLeft: -18,
      leftAngle: 21,
      rightAngle: -21,
    }
    const draggedExpression = { ...defaultExpression, headX: 24, headY: 31 }

    expect(resolveCanvasPreviewExpression(draggedExpression, eyes, true, 'head')).toEqual(
      applyAvatarEyeDefaults(draggedExpression, eyes)
    )
  })

  it('does not compose neutral eyes twice outside body editing', () => {
    const eyes = { ...defaultAvatarEyes, widthLeft: 37 }

    expect(resolveCanvasPreviewExpression(defaultExpression, eyes, false, 'head')).toBe(
      defaultExpression
    )
  })

  it('does not compose customized eyes twice while editing an eye handle', () => {
    const eyes = { ...defaultAvatarEyes, widthLeft: 37 }
    const customizedExpression = applyAvatarEyeDefaults(defaultExpression, eyes)

    expect(resolveCanvasPreviewExpression(customizedExpression, eyes, true, 'eyes')).toBe(
      customizedExpression
    )
  })
})

describe('stage zoom', () => {
  it('shrinks the character when scrolling down and grows it when scrolling up', () => {
    expect(nextStageZoom(1, 120)).toBeLessThan(1)
    expect(nextStageZoom(1, -120)).toBeGreaterThan(1)
  })

  it('keeps zoom inside a wide but finite range', () => {
    expect(nextStageZoom(0.04, 8000)).toBe(STAGE_ZOOM_MIN)
    expect(nextStageZoom(18, -8000)).toBe(STAGE_ZOOM_MAX)
  })
})

describe('live render paint', () => {
  it('restores a solid body fill after leaving pixel rendering', () => {
    expect(livePaintFill('pixel', '#5b7fe5', 'avatar-stage-shade')).toBe('transparent')
    expect(livePaintFill('vector', '#5b7fe5', 'avatar-stage-shade')).toBe('#5b7fe5')
    expect(livePaintFill('outline', '#5b7fe5', 'avatar-stage-shade')).toBe('#5b7fe5')
    expect(livePaintFill('glow', '#5b7fe5', 'avatar-stage-shade')).toBe('#5b7fe5')
  })

  it('uses a shade gradient only while soft shade is active', () => {
    expect(livePaintFill('softShade', '#5b7fe5', 'avatar-stage-shade')).toBe(
      'url(#avatar-stage-shade)'
    )
    expect(livePaintStroke('outline', '#5b7fe5')).not.toBe('none')
    expect(livePaintStroke('vector', '#5b7fe5')).toBe('none')
    expect(livePaintStroke('borderlands', '#5b7fe5', '#22180c')).toBe('#22180c')
    expect(livePaintFill('borderlands', '#5b7fe5', 'avatar-stage-shade')).toBe('#5b7fe5')
  })
})
