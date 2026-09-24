import type { AvatarColors, AvatarRenderStyle } from '../avatar/avatars'
import type { RenderedScene } from '../rendering/renderedScene'
import {
  bodyFillForMaterial,
  inkInnerDash,
  resolveVectorMaterial,
  vectorStyleDefsMarkup,
} from '../rendering/vectorMaterials'
import { buildPaintPlan, paintColorsOf, shadeLayers, type PaintLook } from '../rendering/paintPlan'

export type SnapshotBackground = 'transparent' | 'solid' | 'linear' | 'radial'

export type SnapshotOptions = {
  background: SnapshotBackground
  colorFrom: string
  colorTo: string
  size: number
}

const escapeXml = (value: string) =>
  value.replace(/[&<>"]/g, character => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
    }
    return entities[character]
  })

const path = (value: string, fill: string, opacity = 1, extras = '') =>
  value ? `<path d="${escapeXml(value)}" fill="${fill}" opacity="${opacity}"${extras}/>` : ''

const outlineExtras = (color: string, width: number) =>
  ` stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" style="paint-order:stroke fill"`

const inkStroke = (value: string, color: string, width: number, opacity = 1, dash = '') =>
  value
    ? `<path d="${escapeXml(value)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''} opacity="${opacity}"/>`
    : ''

const backgroundMarkup = (options: SnapshotOptions) => {
  if (options.background === 'transparent') return ''
  const fill =
    options.background === 'solid'
      ? options.colorFrom
      : options.background === 'linear'
        ? 'url(#snapshot-linear)'
        : 'url(#snapshot-radial)'
  return `<rect x="-150" y="-150" width="300" height="300" fill="${fill}"/>`
}

const gradientMarkup = (options: SnapshotOptions) => {
  if (options.background === 'linear') {
    return `<linearGradient id="snapshot-linear" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${options.colorFrom}"/><stop offset="1" stop-color="${options.colorTo}"/></linearGradient>`
  }
  if (options.background === 'radial') {
    return `<radialGradient id="snapshot-radial" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${options.colorFrom}"/><stop offset="1" stop-color="${options.colorTo}"/></radialGradient>`
  }
  return ''
}

export const serializeAvatarSnapshot = (
  name: string,
  scene: RenderedScene,
  colors: AvatarColors,
  options: SnapshotOptions,
  renderStyle: AvatarRenderStyle = { type: 'vector' },
  look?: PaintLook
) => {
  const headPath = scene.headPath.get()
  const bodyFillPath = scene.bodyFillPath.get() || headPath
  const offsetX = scene.offsetX.get()
  const offsetY = scene.offsetY.get()
  const material = resolveVectorMaterial(renderStyle, colors.body)
  const shadeId = 'snapshot-shade'
  const bodyFill = bodyFillForMaterial(material, shadeId)
  const bodyExtras = material.showOutline
    ? outlineExtras(material.outlineColor, material.outlineWidth)
    : ''
  const eyeExtras = material.showOutline
    ? outlineExtras(material.outlineColor, material.eyeOutlineWidth)
    : ''
  const glow = material.showGlow
    ? `<g filter="url(#snapshot-glow)">${path(bodyFillPath, material.glowColor)}</g>`
    : ''
  const leftEyePath = scene.leftPath.get()
  const rightEyePath = scene.rightPath.get()
  const leftEyeOpacity = scene.leftOpacity.get()
  const rightEyeOpacity = scene.rightOpacity.get()
  const ink = material.showBorderlands
    ? `<g mask="url(#snapshot-ink-rim)">${inkStroke(bodyFillPath, material.outlineColor, material.outlineWidth * 0.28, 1, inkInnerDash)}</g>`
    : ''
  const inkRimMask = material.showBorderlands
    ? `<mask id="snapshot-ink-rim" maskUnits="userSpaceOnUse" x="-200" y="-200" width="400" height="400"><path d="${escapeXml(bodyFillPath)}" fill="#fff"/><g filter="url(#snapshot-ink-erode)"><path d="${escapeXml(bodyFillPath)}" fill="#000"/></g></mask>`
    : ''
  const paintOps = look
    ? buildPaintPlan(scene.paint.get(), paintColorsOf(colors, look.palette), bodyFill)
    : []
  const paintLayer = paintOps
    .map(item =>
      path(
        item.path,
        item.fill,
        item.opacity,
        `${item.clip ? ' clip-path="url(#snapshot-head-clip)"' : ''}${item.evenOdd ? ' fill-rule="evenodd"' : ''}`
      )
    )
    .join('')
  const shades = look ? shadeLayers(look.shading) : []
  const shadeMasks = shades
    .map(
      shade =>
        `<mask id="snapshot-${shade.kind}" maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800"><path d="${escapeXml(bodyFillPath)}" fill="#fff"/><path d="${escapeXml(bodyFillPath)}" fill="#000" transform="translate(${shade.dx.toFixed(2)} ${shade.dy.toFixed(2)})"/></mask>`
    )
    .join('')
  const shadeLayer = shades
    .map(shade =>
      path(bodyFillPath, shade.fill, shade.opacity, ` mask="url(#snapshot-${shade.kind})"`)
    )
    .join('')
  const body = [
    glow,
    path(bodyFillPath, bodyFill, 1, bodyExtras),
    paintLayer,
    shadeLayer,
    `<g clip-path="url(#snapshot-head-clip)">${path(leftEyePath, colors.eyes, leftEyeOpacity, eyeExtras)}${path(rightEyePath, colors.eyes, rightEyeOpacity, eyeExtras)}</g>`,
    ink,
  ].join('')
  const inkFilter = material.showBorderlands ? ' filter="url(#snapshot-ink)"' : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -150 300 300" width="${options.size}" height="${options.size}" role="img" aria-label="${escapeXml(name)}" overflow="visible">
  <defs>${gradientMarkup(options)}${vectorStyleDefsMarkup('snapshot', material)}${inkRimMask}${shadeMasks}<clipPath id="snapshot-head-clip"><path d="${escapeXml(headPath)}"/></clipPath></defs>
  ${backgroundMarkup(options)}
  <g transform="translate(${offsetX} ${offsetY})"${inkFilter}>${body}</g>
</svg>`
}

export const serializePixelSnapshot = (name: string, imageDataUrl: string, size: number) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(name)}">
  <image href="${escapeXml(imageDataUrl)}" width="${size}" height="${size}" image-rendering="pixelated"/>
</svg>`

export const snapshotFileName = (name: string, extension: 'svg' | 'png' = 'svg') => {
  const slug =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'avatar'
  return `${slug}-snapshot.${extension}`
}
