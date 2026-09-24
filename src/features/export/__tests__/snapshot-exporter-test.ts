import { poseFromExpression, renderAvatar } from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import { createRenderedScene, paintRenderedOffset } from '@/features/rendering/renderedScene'
import {
  serializeAvatarSnapshot,
  serializePixelSnapshot,
  snapshotFileName,
} from '@/features/export/snapshotExporter'
import { surfacePresets } from '@/features/avatar/surfaces'
import { createMarking } from '@/features/avatar/markings'

describe('avatar snapshot export', () => {
  const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1)
  const scene = createRenderedScene(geometry)
  const colors = { body: '#5b7fe5', eyes: '#111316' }

  it('exports the currently rendered scene as a transparent SVG', () => {
    paintRenderedOffset(scene, { x: 3, y: -2 })
    const svg = serializeAvatarSnapshot('Strobi', scene, colors, {
      background: 'transparent',
      colorFrom: '#ffffff',
      colorTo: '#000000',
      size: 1024,
    })

    expect(svg).toContain('width="1024" height="1024"')
    expect(svg).toContain('transform="translate(3 -2)"')
    expect(svg).toContain(`d="${geometry.headPath}" fill="#5b7fe5"`)
    expect(svg).toContain('fill="#111316"')
    expect(svg).not.toContain('<rect')
  })

  it('embeds a radial background without external dependencies', () => {
    const svg = serializeAvatarSnapshot('Strobi', scene, colors, {
      background: 'radial',
      colorFrom: '#ffffff',
      colorTo: '#8899aa',
      size: 512,
    })

    expect(svg).toContain('<radialGradient id="snapshot-radial"')
    expect(svg).toContain('fill="url(#snapshot-radial)"')
    expect(snapshotFileName('Étoile du soir')).toBe('etoile-du-soir-snapshot.svg')
    expect(snapshotFileName('Étoile du soir', 'png')).toBe('etoile-du-soir-snapshot.png')
  })

  it('embeds outline, soft shade and glow finishes in the SVG snapshot', () => {
    const outline = serializeAvatarSnapshot(
      'Strobi',
      scene,
      colors,
      { background: 'transparent', colorFrom: '#ffffff', colorTo: '#000000', size: 512 },
      { type: 'outline', width: 10 }
    )
    const shade = serializeAvatarSnapshot(
      'Strobi',
      scene,
      colors,
      { background: 'transparent', colorFrom: '#ffffff', colorTo: '#000000', size: 512 },
      { type: 'softShade', strength: 70 }
    )
    const glow = serializeAvatarSnapshot(
      'Strobi',
      scene,
      colors,
      { background: 'transparent', colorFrom: '#ffffff', colorTo: '#000000', size: 512 },
      { type: 'glow', size: 12 }
    )

    expect(outline).toContain('stroke-width="10"')
    expect(outline).toContain('paint-order:stroke fill')
    expect(shade).toContain('<radialGradient id="snapshot-shade"')
    expect(shade).toContain('fill="url(#snapshot-shade)"')
    expect(glow).toContain('<filter id="snapshot-glow"')
    expect(glow).toContain('stdDeviation="12"')

    const ink = serializeAvatarSnapshot(
      'Strobi',
      scene,
      colors,
      { background: 'transparent', colorFrom: '#ffffff', colorTo: '#000000', size: 512 },
      { type: 'borderlands', width: 14, wobble: 8, color: '#22180c' }
    )
    expect(ink).toContain('stroke="#22180c"')
    expect(ink).toContain('stroke-width="14"')
    expect(ink).toContain('paint-order:stroke fill')
    expect(ink).toContain('<filter id="snapshot-ink"')
    expect(ink).toContain('feDisplacementMap')
    expect(ink).toContain('stroke-dasharray="16 22 9 18 13 26"')
    expect(ink).toContain('<mask id="snapshot-ink-rim"')
    expect(ink).toContain('feMorphology operator="erode"')
    expect(ink).toContain('mask="url(#snapshot-ink-rim)"')
  })

  it('embeds part colors, markings and cartoon shading in the SVG snapshot', () => {
    const painted = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      markings: [createMarking('belly', [])],
    })
    const paintedScene = createRenderedScene(painted)
    const svg = serializeAvatarSnapshot(
      'Strobi',
      paintedScene,
      colors,
      { background: 'transparent', colorFrom: '#ffffff', colorTo: '#000000', size: 512 },
      { type: 'vector' },
      {
        palette: { accent: '#f5a623', accent2: '#fff1d6' },
        shading: { amount: 50, size: 12, angle: 135, highlight: 40, color: '#1d1b3f' },
      }
    )

    expect(svg).toContain('fill="#fff1d6"')
    expect(svg).toContain('clip-path="url(#snapshot-head-clip)" fill-rule="evenodd"')
    expect(svg).toContain('<mask id="snapshot-shadow"')
    expect(svg).toContain('<mask id="snapshot-highlight"')
    expect(svg).toContain('mask="url(#snapshot-shadow)"')
  })

  it('embeds a pixel snapshot as a self-contained raster SVG', () => {
    const svg = serializePixelSnapshot('Pixel & Co', 'data:image/png;base64,AAAA', 256)

    expect(svg).toContain('viewBox="0 0 256 256"')
    expect(svg).toContain('image-rendering="pixelated"')
    expect(svg).toContain('data:image/png;base64,AAAA')
    expect(svg).toContain('aria-label="Pixel &amp; Co"')
  })
})
