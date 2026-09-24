export { expressionFields, poseFromExpression, renderAvatar } from '../avatar/geometry'
export {
  ambientBodyOffset,
  ambientEyeOffset,
  applyAmbientBodyMotion,
  applyAmbientMotion,
  hasAmbientMotion,
} from '../avatar/ambientMotion'
export { buildPaintPlan, paintColorsOf, shadeLayers } from '../rendering/paintPlan'
export { createSvgShadeNodes, syncSvgPaintOps, syncSvgShadeLayers } from '../rendering/svgPaintDom'
export { paintPixelAvatar } from '../rendering/pixelRenderer'
