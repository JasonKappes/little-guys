import type { PaintOp, ShadeLayer } from './paintPlan'

const SVG_NS = 'http://www.w3.org/2000/svg'

const resizeChildren = (group: Element, count: number, tag: string) => {
  while (group.children.length < count) {
    group.append(group.ownerDocument.createElementNS(SVG_NS, tag))
  }
  while (group.children.length > count) group.lastElementChild?.remove()
}

export const syncSvgPaintOps = (group: Element, ops: readonly PaintOp[], clipUrl: string) => {
  resizeChildren(group, ops.length, 'path')
  ops.forEach((item, index) => {
    const node = group.children[index]
    node.setAttribute('d', item.path)
    node.setAttribute('fill', item.fill)
    if (item.opacity < 1) node.setAttribute('opacity', String(item.opacity))
    else node.removeAttribute('opacity')
    if (item.clip) node.setAttribute('clip-path', clipUrl)
    else node.removeAttribute('clip-path')
    if (item.evenOdd) node.setAttribute('fill-rule', 'evenodd')
    else node.setAttribute('fill-rule', 'nonzero')
  })
}

export type SvgShadeNodes = { defs: Element; layer: Element; idPrefix: string }

export const createSvgShadeNodes = (
  document: Document,
  defs: Element,
  idPrefix: string
): SvgShadeNodes => {
  const layer = document.createElementNS(SVG_NS, 'g')
  layer.setAttribute('pointer-events', 'none')
  return { defs, layer, idPrefix }
}

export const syncSvgShadeLayers = (
  nodes: SvgShadeNodes,
  silhouette: string,
  shades: readonly ShadeLayer[]
) => {
  const document = nodes.layer.ownerDocument
  resizeChildren(nodes.layer, shades.length, 'path')
  shades.forEach((shade, index) => {
    const maskId = `${nodes.idPrefix}-${shade.kind}`
    let mask = nodes.defs.querySelector(`mask[id="${maskId}"]`)
    if (!mask) {
      mask = document.createElementNS(SVG_NS, 'mask')
      mask.id = maskId
      mask.setAttribute('maskUnits', 'userSpaceOnUse')
      mask.setAttribute('x', '-400')
      mask.setAttribute('y', '-400')
      mask.setAttribute('width', '800')
      mask.setAttribute('height', '800')
      mask.append(
        document.createElementNS(SVG_NS, 'path'),
        document.createElementNS(SVG_NS, 'path')
      )
      nodes.defs.append(mask)
    }
    const [inside, shifted] = [mask.children[0], mask.children[1]]
    inside.setAttribute('d', silhouette)
    inside.setAttribute('fill', '#fff')
    shifted.setAttribute('d', silhouette)
    shifted.setAttribute('fill', '#000')
    shifted.setAttribute('transform', `translate(${shade.dx.toFixed(2)} ${shade.dy.toFixed(2)})`)
    const node = nodes.layer.children[index]
    node.setAttribute('d', silhouette)
    node.setAttribute('fill', shade.fill)
    node.setAttribute('opacity', String(shade.opacity))
    node.setAttribute('mask', `url(#${maskId})`)
  })
}
