import { parseAvatarBody, type BodyNode } from '@/features/avatar/body'
import {
  createBodyLimb,
  insertLimbHandleOnLongestSpan,
  moveLimbHandle,
  removeLimbHandle,
} from '@/features/avatar/limbs'
import {
  isHitMouth,
  lerpMouthPose,
  mouthFromVisemeId,
  mouthPoseFromShape,
  talkingMouthShape,
  visemeAtTime,
} from '@/features/avatar/mouth'
import {
  poseFromExpression,
  projectWorldPoint,
  renderAvatar,
  renderBodyNodeEditor,
  rotateBodyNodeAroundLocalAxis,
  translateBodyNodeInCameraPlane,
  translateBodyNodeAlongLocalAxis,
  translatePointInCameraPlane,
} from '@/features/avatar/geometry'
import { createMarking, parseMarkings } from '@/features/avatar/markings'
import { defaultExpression } from '@/features/avatar/presets'
import { surfacePresets } from '@/features/avatar/surfaces'

const node: BodyNode = {
  id: 'shape-test',
  name: 'Forme test',
  surface: surfacePresets.cube,
  position: [0, 0, -20],
  rotation: [0, 0, 0],
}

describe('body node editor geometry', () => {
  it('keeps all translation axes manipulable when one points at the camera', () => {
    const editor = renderBodyNodeEditor(poseFromExpression(defaultExpression), node)

    expect(
      Math.hypot(editor.axes.z[0] - editor.center[0], editor.axes.z[1] - editor.center[1])
    ).toBeGreaterThanOrEqual(12)
    expect(Object.values(editor.axes).flat().every(Number.isFinite)).toBe(true)
  })

  it('projects complete local rotation rings around the selected node', () => {
    const editor = renderBodyNodeEditor(poseFromExpression(defaultExpression), {
      ...node,
      rotation: [20, -15, 35],
    })

    expect(editor.rings.x).toHaveLength(65)
    expect(editor.rings.y).toHaveLength(65)
    expect(editor.rings.z).toHaveLength(65)
    expect(editor.rings.z[0]).not.toEqual(editor.rings.z[16])
  })

  it('moves along the rotated local axis', () => {
    const translated = translateBodyNodeAlongLocalAxis({ ...node, rotation: [0, 0, 90] }, 'x', 20)

    expect(translated.position[0]).toBeCloseTo(0)
    expect(translated.position[1]).toBeCloseTo(20)
    expect(translated.position[2]).toBeCloseTo(-20)
  })

  it('moves freely in the camera plane regardless of head rotation', () => {
    const pose = poseFromExpression({ ...defaultExpression, headX: 24, headY: -31, headZ: 18 })
    const before = renderBodyNodeEditor(pose, node).center
    const translated = translateBodyNodeInCameraPlane(node, pose, 18, -9)
    const after = renderBodyNodeEditor(pose, translated).center

    expect(after[0] - before[0]).toBeCloseTo(18)
    expect(after[1] - before[1]).toBeCloseTo(-9)
    expect(translated.position[2]).not.toBe(node.position[2])
  })

  it('composes a local rotation instead of incrementing a raw Euler field', () => {
    const rotated = rotateBodyNodeAroundLocalAxis({ ...node, rotation: [25, 30, -20] }, 'x', 15)

    expect(rotated.rotation.every(Number.isFinite)).toBe(true)
    expect(rotated.rotation).not.toEqual([40, 30, -20])
  })

  it('keeps equivalent Euler values near their current free rotation', () => {
    const rotated = rotateBodyNodeAroundLocalAxis({ ...node, rotation: [0, 0, 350] }, 'x', 1)

    expect(rotated.rotation[2]).toBeGreaterThan(300)
  })

  it('keeps a spherical silhouette path stable across head rotations', () => {
    const neutralPath = renderAvatar(
      poseFromExpression(defaultExpression),
      surfacePresets.sphere,
      1,
      { includeWire: false }
    ).headPath
    const rotatedPath = renderAvatar(
      poseFromExpression({ ...defaultExpression, headX: 17, headY: 34, headZ: -21 }),
      surfacePresets.sphere,
      1,
      { includeWire: false }
    ).headPath

    expect(rotatedPath).toBe(neutralPath)
  })

  it('keeps the mouth hidden until a talking shape is requested', () => {
    const silent = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      includeWire: false,
    })
    const talking = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      includeWire: false,
      mouth: 'wide',
    })

    const pathY = (value: string) =>
      [...value.matchAll(/(?:M|L)(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map(match => Number(match[2]))
    const eyeY =
      pathY(talking.leftPath).reduce((total, value) => total + value, 0) /
      pathY(talking.leftPath).length
    const mouthY =
      pathY(talking.mouthPath).reduce((total, value) => total + value, 0) /
      pathY(talking.mouthPath).length

    expect(silent.mouthPath).toBe('')
    expect(silent.mouthVisible).toBe(false)
    expect(talking.mouthPath.startsWith('M')).toBe(true)
    expect(talking.mouthVisible).toBe(true)
    expect(mouthY).toBeGreaterThan(eyeY + 20)
    expect(mouthFromVisemeId(0)).toBe('closed')
    expect(mouthFromVisemeId(21)).toBe('pressed')
    expect(isHitMouth('pressed')).toBe(true)
    expect(isHitMouth('wide')).toBe(false)
    expect(
      lerpMouthPose(mouthPoseFromShape('closed'), mouthPoseFromShape('wide'), 0.5).height
    ).toBeGreaterThan(mouthPoseFromShape('closed').height)
    expect(
      talkingMouthShape(
        [
          { t: 0, id: 1 },
          { t: 0.2, id: 21 },
        ],
        0.17,
        0
      ).shape
    ).toBe('pressed')
    expect(
      visemeAtTime(
        [
          { t: 0, id: 1 },
          { t: 0.2, id: 21 },
        ],
        0.19
      )?.id
    ).toBe(1)
    expect(
      visemeAtTime(
        [
          { t: 0, id: 1 },
          { t: 0.2, id: 21 },
        ],
        0.2
      )?.id
    ).toBe(21)
  })
})

describe('body limbs', () => {
  it('parses extra parts and ignores a body with no limbs', () => {
    expect(
      parseAvatarBody({ primary: surfacePresets.sphere, nodes: [] }, surfacePresets.sphere).limbs
    ).toEqual([])
    const limb = createBodyLimb('tail-short-curl', [])
    expect(
      parseAvatarBody(
        { primary: surfacePresets.sphere, nodes: [], limbs: [limb, { id: 'bad' }] },
        surfacePresets.sphere
      ).limbs
    ).toEqual([limb])
  })

  it('draws a curling tail as overlapping circles planted on the body', () => {
    const limb = createBodyLimb('tail-short-curl', [])
    const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      includeWire: false,
      limbs: [limb],
    })
    const path = [...geometry.backPaths, ...geometry.frontPaths].find(Boolean)

    expect(path).toBeTruthy()
    expect(path!.startsWith('M')).toBe(true)
    expect(path!.includes('C')).toBe(false)
    expect((path!.match(/Z/g) ?? []).length).toBeGreaterThan(8)
    expect(geometry.bodyFillPath.includes(path!)).toBe(true)
    expect(geometry.backNodeIds).toContain(limb.id)
    const turned = renderAvatar(
      poseFromExpression({ ...defaultExpression, headY: 180 }),
      surfacePresets.sphere,
      1,
      { includeWire: false, limbs: [limb] }
    )
    expect(turned.frontNodeIds).toContain(limb.id)
    const numbers = [...path!.matchAll(/-?\d+\.?\d*/g)].map(match => Number(match[0]))
    expect(numbers.every(value => Math.abs(value) < 320)).toBe(true)
  })

  it('adds a handle on the longest span and keeps at least two handles', () => {
    const limb = createBodyLimb('tail-thick-stub', [])
    const next = insertLimbHandleOnLongestSpan(limb)

    expect(next.handles.length).toBe(limb.handles.length + 1)
    expect(removeLimbHandle(next, next.handles[1].id).handles.length).toBe(limb.handles.length)
    expect(removeLimbHandle(limb, limb.handles[1].id).handles.length).toBe(2)
  })

  it('moves a handle in the camera plane', () => {
    const limb = createBodyLimb('belly', [])
    const pose = poseFromExpression(defaultExpression)
    const handle = limb.handles[1]
    const before = projectWorldPoint(pose, handle.point)
    const moved = moveLimbHandle(
      limb,
      handle.id,
      translatePointInCameraPlane(handle.point, pose, 16, -8)
    )
    const after = projectWorldPoint(pose, moved.handles[1].point)

    expect(after[0] - before[0]).toBeCloseTo(16, 0)
    expect(after[1] - before[1]).toBeCloseTo(-8, 0)
  })
})

describe('part colors and markings', () => {
  it('keeps plain avatars unpainted so the fused silhouette stays the only fill', () => {
    const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      includeWire: false,
      limbs: [createBodyLimb('horn', [])],
    })

    expect(geometry.painted).toBe(false)
    expect(geometry.markingLayers).toEqual([])
  })

  it('splits a tail into a colored tip band and ring bands along its spine', () => {
    const limb = {
      ...createBodyLimb('tail-long-thin', []),
      paint: { base: 'body', tip: 'accent', tipLength: 0.3, rings: 'accent2', ringCount: 2 },
    } as const
    const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      includeWire: false,
      limbs: [{ ...limb, paint: { ...limb.paint } }],
    })
    const layer = [...geometry.backLayers, ...geometry.frontLayers].find(
      item => item.id === limb.id
    )

    expect(geometry.painted).toBe(true)
    expect(layer?.bands.at(-1)?.paint).toBe('accent')
    expect(layer?.bands.filter(band => band.paint === 'accent2')).toHaveLength(2)
    expect(layer?.bands.every(band => layer.path.includes(band.path))).toBe(true)
  })

  it('keeps the part of a tail buried in the body behind the head at every angle', () => {
    const limb = {
      ...createBodyLimb('tail-short-curl', []),
      paint: { base: 'body', tip: null, tipLength: 0.3, rings: 'accent2', ringCount: 2 },
    } as const
    const angles = [
      { headX: 0, headY: 0 },
      { headX: -35, headY: 20 },
      { headX: 30, headY: -25 },
      { headX: -60, headY: 0 },
    ]
    angles.forEach(angle => {
      const geometry = renderAvatar(
        poseFromExpression({ ...defaultExpression, ...angle }),
        surfacePresets.sphere,
        1,
        { includeWire: false, limbs: [{ ...limb, paint: { ...limb.paint } }] }
      )
      const root = geometry.backLayers.find(layer => layer.id === limb.id)
      expect(root).toBeTruthy()
      const front = geometry.frontLayers.find(layer => layer.id === limb.id)
      expect(front?.path.includes(root!.path.slice(0, 40)) ?? false).toBe(false)
    })
  })

  it('wraps a belly patch onto the face and hides markings on the far side', () => {
    const belly = createMarking('belly', [])
    const front = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      includeWire: false,
      markings: [belly],
    })
    const behind = renderAvatar(
      poseFromExpression({ ...defaultExpression, headY: 180 }),
      surfacePresets.sphere,
      1,
      { includeWire: false, markings: [belly] }
    )

    expect(front.painted).toBe(true)
    expect(front.markingLayers).toHaveLength(1)
    expect(front.markingLayers[0].paint).toBe('accent2')
    const ys = [...front.markingLayers[0].path.matchAll(/(?:M|L)(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map(
      match => Number(match[2])
    )
    expect(Math.min(...ys)).toBeGreaterThan(0)
    expect(behind.markingLayers).toEqual([])
  })

  it('mirrors blush and builds nested stripe bands', () => {
    const blush = createMarking('blush', [])
    const stripes = createMarking('stripes', [])
    const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      includeWire: false,
      markings: [blush, stripes],
    })
    const stripeLayer = geometry.markingLayers.find(layer => layer.id === stripes.id)

    expect(geometry.markingLayers.filter(layer => layer.id.startsWith(blush.id))).toHaveLength(2)
    expect(stripeLayer?.evenOdd).toBe(true)
    expect((stripeLayer?.path.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(
      stripes.count * 2 - 1
    )
  })

  it('sanitizes persisted markings and part paint', () => {
    const [marking] = parseMarkings([
      { id: 'm', name: 'Taches', kind: 'spots', paint: 'nope', width: 999, count: 40 },
      { id: 'm', name: 'dup' },
    ])
    expect(marking.paint).toBe('accent')
    expect(marking.width).toBe(200)
    expect(marking.count).toBe(12)
    expect(marking.shape).toBe('ellipse')

    const limb = createBodyLimb('ear', [])
    const parsed = parseAvatarBody(
      {
        primary: surfacePresets.sphere,
        nodes: [{ ...node, paint: '#FF0000' }],
        limbs: [{ ...limb, paint: { base: 'accent', tip: 'bad', tipLength: 4 } }],
      },
      surfacePresets.sphere
    )
    expect(parsed.nodes[0].paint).toBe('#ff0000')
    expect(parsed.limbs[0].paint).toEqual({
      base: 'accent',
      tip: null,
      tipLength: 0.9,
      rings: null,
      ringCount: 3,
    })
  })
})
