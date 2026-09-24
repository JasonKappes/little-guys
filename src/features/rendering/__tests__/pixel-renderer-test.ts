import { quantizePixelArtPixels } from '@/features/rendering/pixelRenderer'
import { pixelPaletteOf, shadeLayers } from '@/features/rendering/paintPlan'

describe('pixel art renderer', () => {
  it('removes antialiased transparency and mixed edge colors', () => {
    const pixels = new Uint8ClampedArray([91, 127, 229, 90, 88, 122, 221, 220, 24, 25, 31, 255])

    quantizePixelArtPixels(pixels, ['#5b7fe5', '#111316'])

    expect([...pixels]).toEqual([0, 0, 0, 0, 91, 127, 229, 255, 17, 19, 22, 255])
  })

  it('uses a deterministic hard threshold for boundary pixels', () => {
    const pixels = new Uint8ClampedArray([91, 127, 229, 127, 91, 127, 229, 128])

    quantizePixelArtPixels(pixels, ['#5b7fe5', '#111316'])

    expect([...pixels]).toEqual([0, 0, 0, 0, 91, 127, 229, 255])
  })

  it('keeps accent colors and shaded tones in the pixel palette', () => {
    const colors = { body: '#5b7fe5', eyes: '#111316', accent: '#f5a623', accent2: '#fff1d6' }
    const ops = [{ path: 'M0 0Z', fill: '#f5a623', opacity: 1, clip: false, evenOdd: false }]
    const shades = shadeLayers({ amount: 60, size: 12, angle: 135, highlight: 0, color: '#1d1b3f' })
    const palette = pixelPaletteOf(colors, ops, shades)

    expect(palette).toContain('#f5a623')
    expect(palette.length).toBeGreaterThan(3)

    const pixels = new Uint8ClampedArray([240, 160, 40, 255])
    quantizePixelArtPixels(pixels, palette)
    expect([...pixels]).toEqual([245, 166, 35, 255])
  })
})
