import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { useStudioLanguage } from '@/i18n'

import {
  AMBIENT_FRAME_MS,
  bounded,
  createExpressionId,
  downloadBlob,
  INSPECTOR_FRAME_MS,
  interpolateHexColor,
  poseWithAvatarEyes,
  resolveColors,
  RETARGET_BLEND_MS,
  type ExportFormat,
  type Highlight,
  type Mode,
  type PlaybackStatus,
  type Side,
  type SnapshotFormat,
} from '@/app/studio-utils'
import {
  advancePlaybackTimeline,
  beginPlayback,
  createPlaybackTimeline,
  pausePlaybackTimeline,
  schedulePlaybackBlink,
  schedulePlaybackStep,
  stopPlaybackTimeline,
} from '@/features/animation/playback'
import {
  createSequence,
  duplicateSequence,
  findExpressionIndex,
  getSequenceSpring,
  readSequenceClock,
  remapSequencesAfterExpressionDelete,
  type AvatarSequence,
  type SequenceStep,
} from '@/features/animation/sequences'
import {
  ambientBodyOffset,
  ambientEyeOffset,
  applyAmbientBodyMotion,
  hasAmbientMotion,
} from '@/features/avatar/ambientMotion'
import {
  cloneAvatarBehavior,
  createAvatar,
  defaultAvatarEyes,
  resolveAvatarBehavior,
  type AvatarBehaviorLibrary,
  type AvatarColors,
  type AvatarEyeDefaults,
  type AvatarRenderStyle,
  type StudioAvatar,
} from '@/features/avatar/avatars'
import {
  bodyPrimitiveTypes,
  createBodyNode,
  duplicateBodyNode,
  MAX_BODY_NODES,
  type BodyNode,
} from '@/features/avatar/body'
import {
  createBodyLimb,
  duplicateBodyLimb,
  MAX_BODY_LIMBS,
  type BodyLimb,
  type BodyLimbPresetId,
  type LimbPaint,
} from '@/features/avatar/limbs'
import {
  createMarking,
  duplicateMarking,
  MAX_MARKINGS,
  type Marking,
  type MarkingPresetId,
} from '@/features/avatar/markings'
import {
  randomPalette,
  suggestPalette,
  type AvatarPalette,
  type AvatarShading,
  type PaintRef,
  type PaletteHarmony,
} from '@/features/avatar/paint'
import {
  scaleEye,
  updateEyeDimension,
  updateEyePosition,
} from '@/features/avatar/expressionEditing'
import {
  expressionFields,
  poseFromExpression,
  renderAvatar,
  type AvatarPose,
  type Expression,
} from '@/features/avatar/geometry'
import {
  blendMouthAmount,
  isHitMouth,
  lerpMouthPose,
  mouthPoseFromShape,
  talkingMouthShape,
  type MouthPose,
  type MouthShape,
  MOUTH_CLOSE_HIDE_MS,
} from '@/features/avatar/mouth'
import { defaultExpression } from '@/features/avatar/presets'
import { type SurfaceConfig } from '@/features/avatar/surfaces'
import {
  avatarExportFileName,
  createAvatarExportPayload,
  generateJavaScriptAvatarPackage,
  generateReactAvatarPackage,
} from '@/features/export/exporter'
import {
  serializeAvatarSnapshot,
  serializePixelSnapshot,
  snapshotFileName,
  type SnapshotBackground,
} from '@/features/export/snapshotExporter'
import {
  resolveCanvasPreviewExpression,
  type CanvasPreviewTarget,
} from '@/features/rendering/canvasPreview'
import {
  createRenderedRotationGizmo,
  paintRenderedRotationGizmo,
} from '@/features/rendering/renderedRotationGizmo'
import {
  createRenderedColors,
  createRenderedScene,
  paintRenderedColors,
  paintRenderedOffset,
  paintRenderedScene,
} from '@/features/rendering/renderedScene'
import { paintPixelAvatar, readPixelFrame } from '@/features/rendering/pixelRenderer'
import {
  DEFAULT_SPEECH_REGION,
  DEFAULT_TALK_LANGUAGE,
  DEFAULT_TALK_SPEED,
  DEFAULT_TALK_STYLE,
  resolveTalkStyle,
  synthesizeTalkLine,
  talkLineMatches,
  type SpeechLine,
  type TalkLanguage,
  type TalkSpeed,
  type TalkStyle,
} from '@/features/studio/azureSpeech'
import {
  BUNDLED_LOOK_VERSION,
  createStudioDocumentStore,
  loadStudioDocument,
  parseImportedStudioDocument,
  persistStudioDocument,
  serializeStudioDocument,
  parseStageBackground,
  type StatePlaybackSelection,
  type StudioDocument,
} from '@/features/studio/studioDocument'

export function useStudioController() {
  const { language, setLanguage, t } = useStudioLanguage()
  const [mode, setMode] = useState<Mode>('avatars')
  const [initialDocument] = useState(() => {
    const loaded = loadStudioDocument()
    persistStudioDocument(loaded)
    return loaded
  })
  const [documentStore] = useState(() => createStudioDocumentStore(initialDocument))
  const initialLibrary = initialDocument.library
  const [avatars, setAvatars] = useState(initialLibrary.avatars)
  const [activeAvatarId, setActiveAvatarId] = useState(initialLibrary.activeAvatarId)
  const initialAvatar =
    initialLibrary.avatars.find(avatar => avatar.id === initialLibrary.activeAvatarId) ??
    initialLibrary.avatars[0]
  const [baseBehavior] = useState<AvatarBehaviorLibrary>(() => ({
    expressions: initialDocument.expressions,
    sequences: initialDocument.sequences,
  }))
  const initialBehavior = resolveAvatarBehavior(initialAvatar, baseBehavior)
  const [surface, setSurface] = useState(initialAvatar.body.primary)
  const [bodyNodes, setBodyNodes] = useState(initialAvatar.body.nodes)
  const [limbs, setLimbs] = useState(initialAvatar.body.limbs ?? [])
  const [selectedBodyNodeId, setSelectedBodyNodeId] = useState<'primary' | string | null>('primary')
  const [selectedLimbId, setSelectedLimbId] = useState<string | null>(null)
  const [selectedEyeSide, setSelectedEyeSide] = useState<-1 | 1 | null>(null)
  const [expressions, setExpressions] = useState(initialBehavior.expressions)
  const [sequences, setSequences] = useState(initialBehavior.sequences)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('react')
  const [exportAnimationIds, setExportAnimationIds] = useState(() =>
    initialBehavior.sequences.map(animation => animation.id)
  )
  const [snapshotBackground, setSnapshotBackground] = useState<SnapshotBackground>('transparent')
  const [snapshotColorFrom, setSnapshotColorFrom] = useState('#F5F7FC')
  const [snapshotColorTo, setSnapshotColorTo] = useState('#C9D5FF')
  const [snapshotSize, setSnapshotSize] = useState('1024')
  const [snapshotFormat, setSnapshotFormat] = useState<SnapshotFormat>('png')
  const [photoFlash, setPhotoFlash] = useState(0)
  const initialStatePlayback = initialDocument.playback
  const updateStudioLibrary = (library: typeof initialDocument.library) =>
    documentStore.update({ library })
  const persistStatePlayback = (playback: StatePlaybackSelection) =>
    documentStore.update({ playback })
  const [stageBackground, setStageBackground] = useState(initialDocument.stageBackground)
  const updateStageBackground = (value: string) => {
    const next = parseStageBackground(value)
    setStageBackground(next)
    documentStore.update({ stageBackground: next })
  }
  const [bodyEditing, setBodyEditing] = useState(false)
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  const avatarEditSnapshot = useRef<{
    avatars: StudioAvatar[]
    activeAvatarId: string
  } | null>(null)
  const workspaceBackButtonRef = useRef<HTMLButtonElement>(null)
  const [focusAvatarName, setFocusAvatarName] = useState(false)
  const initialExpression = expressions[0] ?? defaultExpression
  const [expression, setExpression] = useState<Expression>({ ...initialExpression })
  const initialDisplayColors = resolveColors(initialExpression, initialAvatar.colors)
  const [renderedColors] = useState(() => createRenderedColors(initialDisplayColors))
  const setDisplayColors = (next: AvatarColors) => {
    paintRenderedColors(renderedColors, next)
  }
  const [deleteAvatarOpen, setDeleteAvatarOpen] = useState(false)
  const [deleteExpressionOpen, setDeleteExpressionOpen] = useState(false)
  const [deleteSequenceOpen, setDeleteSequenceOpen] = useState(false)
  const [pendingProjectImport, setPendingProjectImport] = useState<{
    document: StudioDocument
    fileName: string
  } | null>(null)
  const [projectImportError, setProjectImportError] = useState<string | null>(null)
  const projectImportRef = useRef<HTMLInputElement>(null)
  const [statePlayerExpanded, setStatePlayerExpanded] = useState(false)
  const [activeExpression, setActiveExpression] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ index: number | null; draft: Expression } | null>(null)
  const [showWire, setShowWire] = useState(false)
  const [springSpeed, setSpringSpeed] = useState(7)
  const [linked, setLinked] = useState({
    width: true,
    height: true,
    size: true,
    position: true,
    rotation: true,
  })
  const [highlight, setHighlight] = useState<Highlight>(null)
  const [selectedState, setSelectedState] = useState(() =>
    sequences.some(sequence => sequence.id === initialStatePlayback.stateId)
      ? initialStatePlayback.stateId!
      : sequences.some(sequence => sequence.id === 'idle')
        ? 'idle'
        : (sequences[0]?.id ?? '')
  )
  const [activeState, setActiveState] = useState<string | null>(null)
  const [statePlaying, setStatePlaying] = useState(false)
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>(() =>
    initialStatePlayback.stateId === null ? 'stopped' : 'paused'
  )
  const [playbackVisual, setPlaybackVisual] = useState({
    position: null as number | null,
    run: 0,
    durationMs: 0,
  })
  const [sequenceEditing, setSequenceEditing] = useState<{
    sourceId: string | null
    draft: AvatarSequence
  } | null>(null)
  const [selectedSequenceStepId, setSelectedSequenceStepId] = useState<string | null>(null)
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeSequenceRef = useRef<AvatarSequence | null>(null)
  const editorStateSnapshot = useRef<{
    stateId: string
    playing: boolean
    expression: Expression
  } | null>(null)
  const initialStatePlaybackApplied = useRef(false)
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [initialPlaybackTimeline] = useState(createPlaybackTimeline)
  const playbackTimeline = useRef(initialPlaybackTimeline)
  const reduceMotion = useReducedMotion()

  const avatarsRef = useRef(avatars)
  const expressionsRef = useRef(expressions)
  const sequencesRef = useRef(sequences)
  const draggedAvatarId = useRef<string | null>(null)
  const avatarDragOrigin = useRef<StudioAvatar[] | null>(null)
  const avatarDragPreview = useRef(avatars)
  const [draggingAvatarId, setDraggingAvatarId] = useState<string | null>(null)
  const draggedExpressionId = useRef<string | null>(null)
  const expressionDragOrigin = useRef<Expression[] | null>(null)
  const expressionDragPreview = useRef(expressions)
  const [draggingExpressionId, setDraggingExpressionId] = useState<string | null>(null)
  const draggedStateId = useRef<string | null>(null)
  const stateDragOrigin = useRef<AvatarSequence[] | null>(null)
  const stateDragPreview = useRef(sequences)
  const [draggingStateId, setDraggingStateId] = useState<string | null>(null)
  const activeAvatarIdRef = useRef(activeAvatarId)
  const surfaceRef = useRef(surface)
  const bodyNodesRef = useRef(bodyNodes)
  const limbsRef = useRef(limbs)
  const showWireRef = useRef(showWire)
  const highlightRef = useRef(highlight)
  const persistActiveBehavior = (
    nextExpressions: Expression[],
    nextSequences: AvatarSequence[]
  ) => {
    const behavior = cloneAvatarBehavior({
      expressions: nextExpressions,
      sequences: nextSequences,
    })
    const nextAvatars = avatarsRef.current.map(avatar =>
      avatar.id === activeAvatarIdRef.current ? { ...avatar, behavior } : avatar
    )
    avatarsRef.current = nextAvatars
    setAvatars(nextAvatars)
    updateStudioLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: nextAvatars })
  }
  const updateStudioExpressions = (nextExpressions: Expression[]) => {
    expressionsRef.current = nextExpressions
    persistActiveBehavior(nextExpressions, sequencesRef.current)
  }
  const updateStudioSequences = (nextSequences: AvatarSequence[]) => {
    sequencesRef.current = nextSequences
    persistActiveBehavior(expressionsRef.current, nextSequences)
  }
  const [initialRender] = useState(() => {
    const pose = poseFromExpression(initialExpression)
    return {
      pose,
      geometry: renderAvatar(
        poseWithAvatarEyes(initialExpression, initialAvatar.eyes),
        surface,
        1,
        { bodyNodes, limbs, markings: initialAvatar.markings }
      ),
    }
  })
  const { pose: initialPose, geometry: initialGeometry } = initialRender
  const displayedPose = useRef<AvatarPose>(initialPose)
  const transitionFrame = useRef<number | null>(null)
  const ambientFrame = useRef<number | null>(null)
  const eyeAmbientStartedAt = useRef(-1)
  const bodyAmbientStartedAt = useRef(-1)
  const lastEyeAmbientElapsed = useRef(0)
  const lastBodyAmbientElapsed = useRef(0)
  const lastAmbientFrame = useRef(0)
  const eyeAmbientSignature = useRef('none')
  const bodyAmbientSignature = useRef('none')
  const lastAmbientStrength = useRef(1)
  const transitionTarget = useRef<Expression>({ ...initialExpression })
  const canonicalTarget = useRef<Expression>({ ...initialExpression })
  const retargetFrom = useRef<Expression | null>(null)
  const retargetTo = useRef<Expression | null>(null)
  const retargetStartedAt = useRef<number | null>(null)
  const [transitionVelocity] = useState(
    () =>
      Object.fromEntries(expressionFields.map(field => [field, 0])) as Record<
        (typeof expressionFields)[number],
        number
      >
  )
  const lastTransitionTime = useRef<number | null>(null)
  const lastInspectorFrame = useRef(0)
  const springSpeedRef = useRef(springSpeed)
  const sequenceTransitionRef = useRef<Pick<SequenceStep, 'transitionMs' | 'transition'>>({
    transitionMs: 500,
    transition: 'smooth',
  })
  const activeSequenceTransition = useRef<{
    target: Expression
    index: number | null
    settings: Pick<SequenceStep, 'transitionMs' | 'transition'>
    remainingMs: number
  } | null>(null)
  const pausedSequenceTransition = useRef<typeof activeSequenceTransition.current>(null)
  const blinkControls = useRef<ReturnType<typeof animate> | null>(null)
  const blinkAnimating = useRef(false)
  const blinkValue = useMotionValue(1)
  const mouthPoseRef = useRef<MouthPose | null>(null)
  const talkAudioRef = useRef<HTMLAudioElement | null>(null)
  const talkRafRef = useRef<number | null>(null)
  const talkHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const talkCacheRef = useRef<SpeechLine | null>(null)
  const talkObjectUrlRef = useRef<string | null>(null)
  const talkTokenRef = useRef(0)
  const talkPressedUntilRef = useRef(0)
  const talkMouthTimeRef = useRef<number | null>(null)
  const talkMouthShapeRef = useRef<MouthShape | null>(null)
  const [talkText, setTalkText] = useState('')
  const [talkKey, setTalkKey] = useState('')
  const [talkRegion, setTalkRegion] = useState(DEFAULT_SPEECH_REGION)
  const [talkLanguage, setTalkLanguage] = useState<TalkLanguage>(DEFAULT_TALK_LANGUAGE)
  const [talkSpeed, setTalkSpeed] = useState<TalkSpeed>(DEFAULT_TALK_SPEED)
  const [talkStyle, setTalkStyle] = useState<TalkStyle>(DEFAULT_TALK_STYLE)
  const [talkStatus, setTalkStatus] = useState<'idle' | 'generating' | 'ready' | 'talking'>('idle')
  const [talkError, setTalkError] = useState<string | null>(null)
  const [renderedScene] = useState(() => createRenderedScene(initialGeometry))
  const [renderedRotationGizmo] = useState(() => createRenderedRotationGizmo(initialExpression))
  const bodyColorAnimation = useRef<ReturnType<typeof animate> | null>(null)
  const eyeColorAnimation = useRef<ReturnType<typeof animate> | null>(null)

  const paintPose = (
    pose: AvatarPose,
    blink?: number,
    frameTimeMs?: number,
    ambientStrength?: number
  ) => {
    displayedPose.current = pose
    const resolvedAmbientStrength =
      ambientStrength ?? (transitionFrame.current === null ? 1 : lastAmbientStrength.current)
    lastAmbientStrength.current = resolvedAmbientStrength
    paintRenderedRotationGizmo(renderedRotationGizmo, pose.expression)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    const eyeAmbientEnabled = !reduceMotion && pose.expression.eyeMotion !== 'none'
    const bodyAmbientEnabled = !reduceMotion && pose.expression.bodyMotion !== 'none'
    const eyeSignature = eyeAmbientEnabled ? pose.expression.eyeMotion : 'none'
    const bodySignature = bodyAmbientEnabled ? pose.expression.bodyMotion : 'none'
    if (eyeSignature !== eyeAmbientSignature.current) {
      eyeAmbientSignature.current = eyeSignature
      eyeAmbientStartedAt.current = -1
      lastEyeAmbientElapsed.current = 0
    }
    if (bodySignature !== bodyAmbientSignature.current) {
      bodyAmbientSignature.current = bodySignature
      bodyAmbientStartedAt.current = -1
      lastBodyAmbientElapsed.current = 0
    }
    if (eyeAmbientEnabled && frameTimeMs !== undefined) {
      if (eyeAmbientStartedAt.current < 0) eyeAmbientStartedAt.current = frameTimeMs
      lastEyeAmbientElapsed.current = frameTimeMs - eyeAmbientStartedAt.current
    }
    if (bodyAmbientEnabled && frameTimeMs !== undefined) {
      if (bodyAmbientStartedAt.current < 0) bodyAmbientStartedAt.current = frameTimeMs
      lastBodyAmbientElapsed.current = frameTimeMs - bodyAmbientStartedAt.current
    }
    const renderedExpression = bodyAmbientEnabled
      ? applyAmbientBodyMotion(
          pose.expression,
          lastBodyAmbientElapsed.current,
          resolvedAmbientStrength
        )
      : pose.expression
    const eyeOffset = eyeAmbientEnabled
      ? ambientEyeOffset(pose.expression, lastEyeAmbientElapsed.current, resolvedAmbientStrength)
      : { x: 0, y: 0 }
    const renderPose = avatar
      ? poseWithAvatarEyes(renderedExpression, avatar.eyes ?? defaultAvatarEyes)
      : poseFromExpression(renderedExpression)
    const geometry = renderAvatar(renderPose, surfaceRef.current, blink ?? blinkValue.get(), {
      includeWire: showWireRef.current || highlightRef.current === 'head',
      bodyNodes: bodyNodesRef.current,
      limbs: limbsRef.current,
      markings: avatar?.markings,
      eyeOffset,
      mouth: mouthPoseRef.current,
    })
    paintRenderedScene(renderedScene, geometry)
    paintRenderedOffset(
      renderedScene,
      bodyAmbientEnabled
        ? ambientBodyOffset(
            pose.expression,
            lastBodyAmbientElapsed.current,
            resolvedAmbientStrength
          )
        : { x: 0, y: 0 }
    )
  }

  useMotionValueEvent(blinkValue, 'change', latest => paintPose(displayedPose.current, latest))

  const paintAmbientFrame = useEffectEvent((time: number) => {
    if (transitionFrame.current === null && time - lastAmbientFrame.current >= AMBIENT_FRAME_MS) {
      lastAmbientFrame.current = time
      paintPose(displayedPose.current, undefined, time)
    }
  })

  const ambientLoopActive = !reduceMotion && hasAmbientMotion(editing?.draft ?? expression)
  useEffect(() => {
    if (!ambientLoopActive) return
    const tick = (time: number) => {
      paintAmbientFrame(time)
      ambientFrame.current = requestAnimationFrame(tick)
    }
    ambientFrame.current = requestAnimationFrame(tick)
    return () => {
      if (ambientFrame.current !== null) cancelAnimationFrame(ambientFrame.current)
    }
  }, [ambientLoopActive])

  useEffect(
    () => () => {
      if (transitionFrame.current !== null) cancelAnimationFrame(transitionFrame.current)
      blinkControls.current?.stop()
      bodyColorAnimation.current?.stop()
      eyeColorAnimation.current?.stop()
      if (stateTimer.current) clearTimeout(stateTimer.current)
      if (blinkTimer.current) clearTimeout(blinkTimer.current)
      talkTokenRef.current += 1
      if (talkRafRef.current !== null) cancelAnimationFrame(talkRafRef.current)
      talkAudioRef.current?.pause()
      if (talkObjectUrlRef.current) URL.revokeObjectURL(talkObjectUrlRef.current)
    },
    []
  )

  const hideTalkMouth = () => {
    talkPressedUntilRef.current = 0
    talkMouthTimeRef.current = null
    talkMouthShapeRef.current = null
    if (mouthPoseRef.current === null) return
    mouthPoseRef.current = null
    paintPose(displayedPose.current)
  }

  const stopTalkPlayback = () => {
    if (talkRafRef.current !== null) cancelAnimationFrame(talkRafRef.current)
    talkRafRef.current = null
    if (talkHideTimerRef.current !== null) clearTimeout(talkHideTimerRef.current)
    talkHideTimerRef.current = null
    const audio = talkAudioRef.current
    if (audio) {
      audio.onended = null
      audio.pause()
      audio.removeAttribute('src')
    }
    talkAudioRef.current = null
    hideTalkMouth()
  }

  const stopTalk = () => {
    talkTokenRef.current += 1
    stopTalkPlayback()
    setTalkStatus(talkCacheRef.current ? 'ready' : 'idle')
  }

  const markTalkStaleIfNeeded = (
    text: string,
    speed: TalkSpeed,
    style: TalkStyle,
    language: TalkLanguage
  ) => {
    if (
      talkCacheRef.current &&
      !talkLineMatches(talkCacheRef.current, text, speed, style, language) &&
      talkStatus !== 'talking' &&
      talkStatus !== 'generating'
    ) {
      setTalkStatus('idle')
    }
  }

  const updateTalkText = (next: string) => {
    setTalkText(next)
    setTalkError(null)
    markTalkStaleIfNeeded(next.trim(), talkSpeed, talkStyle, talkLanguage)
  }

  const updateTalkLanguage = (next: TalkLanguage) => {
    const nextStyle = resolveTalkStyle(next, talkStyle)
    setTalkLanguage(next)
    setTalkStyle(nextStyle)
    setTalkError(null)
    markTalkStaleIfNeeded(talkText.trim(), talkSpeed, nextStyle, next)
  }

  const updateTalkSpeed = (next: TalkSpeed) => {
    setTalkSpeed(next)
    setTalkError(null)
    markTalkStaleIfNeeded(talkText.trim(), next, talkStyle, talkLanguage)
  }

  const updateTalkStyle = (next: TalkStyle) => {
    const resolved = resolveTalkStyle(talkLanguage, next)
    setTalkStyle(resolved)
    setTalkError(null)
    markTalkStaleIfNeeded(talkText.trim(), talkSpeed, resolved, talkLanguage)
  }

  const playTalk = async () => {
    const text = talkText.trim()
    if (!text) {
      setTalkError('missing-text')
      return
    }
    talkTokenRef.current += 1
    const token = talkTokenRef.current
    stopTalkPlayback()
    try {
      let line = talkCacheRef.current
      if (!line || !talkLineMatches(line, text, talkSpeed, talkStyle, talkLanguage)) {
        setTalkStatus('generating')
        setTalkError(null)
        line = await synthesizeTalkLine(
          talkKey,
          talkRegion,
          text,
          talkSpeed,
          talkStyle,
          talkLanguage
        )
        if (token !== talkTokenRef.current) return
        talkCacheRef.current = line
      }
      setTalkStatus('talking')
      setTalkError(null)
      if (talkObjectUrlRef.current) URL.revokeObjectURL(talkObjectUrlRef.current)
      const url = URL.createObjectURL(line.audio)
      talkObjectUrlRef.current = url
      const audio = new Audio(url)
      talkAudioRef.current = audio
      const visemes = line.visemes
      const applyMouth = (time: number) => {
        const resolved = talkingMouthShape(visemes, time, talkPressedUntilRef.current)
        talkPressedUntilRef.current = resolved.pressedUntil
        const target = mouthPoseFromShape(resolved.shape)
        const previousTime = talkMouthTimeRef.current
        const previousShape = talkMouthShapeRef.current
        talkMouthTimeRef.current = time
        talkMouthShapeRef.current = resolved.shape
        if (
          !mouthPoseRef.current ||
          previousShape === null ||
          isHitMouth(resolved.shape) ||
          isHitMouth(previousShape)
        ) {
          mouthPoseRef.current = target
        } else {
          const delta = previousTime === null ? 1 : Math.max(0, time - previousTime)
          mouthPoseRef.current = lerpMouthPose(
            mouthPoseRef.current,
            target,
            blendMouthAmount(delta)
          )
        }
        paintPose(displayedPose.current)
      }
      const tick = () => {
        if (token !== talkTokenRef.current) return
        applyMouth(audio.currentTime)
        talkRafRef.current = requestAnimationFrame(tick)
      }
      audio.onended = () => {
        if (token !== talkTokenRef.current) return
        if (talkRafRef.current !== null) cancelAnimationFrame(talkRafRef.current)
        talkRafRef.current = null
        talkAudioRef.current = null
        mouthPoseRef.current = mouthPoseFromShape('closed')
        talkMouthShapeRef.current = 'closed'
        paintPose(displayedPose.current)
        if (talkHideTimerRef.current !== null) clearTimeout(talkHideTimerRef.current)
        talkHideTimerRef.current = setTimeout(() => {
          if (token !== talkTokenRef.current) return
          hideTalkMouth()
          setTalkStatus('ready')
        }, MOUTH_CLOSE_HIDE_MS)
      }
      await audio.play()
      if (token !== talkTokenRef.current) return
      applyMouth(0)
      talkRafRef.current = requestAnimationFrame(tick)
    } catch (error) {
      if (token !== talkTokenRef.current) return
      stopTalkPlayback()
      setTalkStatus('idle')
      const message = error instanceof Error ? error.message : 'synthesis-failed'
      setTalkError(message)
    }
  }

  const stopTransition = (resetVelocity: boolean) => {
    if (transitionFrame.current !== null) cancelAnimationFrame(transitionFrame.current)
    transitionFrame.current = null
    lastTransitionTime.current = null
    retargetFrom.current = null
    retargetTo.current = null
    retargetStartedAt.current = null
    lastInspectorFrame.current = 0
    if (resetVelocity) {
      expressionFields.forEach(field => {
        transitionVelocity[field] = 0
      })
    }
  }

  const stopColorTransitions = () => {
    bodyColorAnimation.current?.stop()
    eyeColorAnimation.current?.stop()
    bodyColorAnimation.current = null
    eyeColorAnimation.current = null
  }

  const freezeLivePreviewForManipulation = () => {
    if (statePlaying) pauseState()
    const renderedExpression = { ...displayedPose.current.expression }
    stopTransition(true)
    stopColorTransitions()
    activeSequenceTransition.current = null
    pausedSequenceTransition.current = null
    transitionTarget.current = renderedExpression
    canonicalTarget.current = renderedExpression
    setExpression(renderedExpression)
    setActiveExpression(null)
    return renderedExpression
  }

  const updateImmediate = (next: Expression, preservePlayback = false) => {
    if (!preservePlayback && statePlaying) pauseState()
    stopTransition(true)
    stopColorTransitions()
    const pose = poseFromExpression(next)
    transitionTarget.current = next
    canonicalTarget.current = next
    setExpression(next)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(next, avatar.colors))
    setActiveExpression(null)
    paintPose(pose)
  }

  const transitionToExpression = (
    next: Expression,
    index: number | null = null,
    transitionSettings?: Pick<SequenceStep, 'transitionMs' | 'transition'>
  ) => {
    if (!transitionSettings && statePlaying) pauseState()
    sequenceTransitionRef.current = transitionSettings ?? {
      transitionMs: 500,
      transition: 'smooth',
    }
    setActiveExpression(index)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (reduceMotion || transitionSettings?.transitionMs === 0) {
      updateImmediate(next, Boolean(transitionSettings))
      setActiveExpression(index)
      return
    }
    const current = displayedPose.current.expression
    const nearestAngle = (target: number, from: number) => {
      let resolved = target
      while (resolved - from > 180) resolved -= 360
      while (resolved - from < -180) resolved += 360
      return resolved
    }
    canonicalTarget.current = next
    const resolvedTarget = {
      ...next,
      headX: nearestAngle(next.headX, current.headX),
      headY: nearestAngle(next.headY, current.headY),
      headZ: nearestAngle(next.headZ, current.headZ),
      leftAngle: nearestAngle(next.leftAngle, current.leftAngle),
      rightAngle: nearestAngle(next.rightAngle, current.rightAngle),
    }

    if (transitionSettings) {
      stopTransition(true)
      stopColorTransitions()
      const durationMs = transitionSettings.transitionMs
      lastAmbientStrength.current = 0
      const from = { ...current }
      const fromColors = {
        body: renderedColors.body.get(),
        eyes: renderedColors.eyes.get(),
      }
      const targetColors = avatar ? resolveColors(next, avatar.colors) : fromColors
      let startedAt: number | null = null
      activeSequenceTransition.current = {
        target: next,
        index,
        settings: transitionSettings,
        remainingMs: durationMs,
      }
      const tickSequenceTransition = (time: number) => {
        if (startedAt === null) startedAt = time
        const elapsed = time - startedAt
        const progress = Math.min(elapsed / durationMs, 1)
        const eased =
          transitionSettings.transition === 'smooth'
            ? progress * progress * (3 - 2 * progress)
            : transitionSettings.transition === 'snappy'
              ? 1 - (1 - progress) ** 3
              : 1 - Math.exp(-6 * progress) * Math.cos(8 * progress)
        const animated = { ...from, eyeMotion: next.eyeMotion, bodyMotion: next.bodyMotion }
        expressionFields.forEach(field => {
          animated[field] = from[field] + (resolvedTarget[field] - from[field]) * eased
        })
        activeSequenceTransition.current = {
          target: next,
          index,
          settings: transitionSettings,
          remainingMs: Math.max(durationMs - elapsed, 0),
        }
        setDisplayColors({
          body: interpolateHexColor(fromColors.body, targetColors.body, bounded(eased, 0, 1)),
          eyes: interpolateHexColor(fromColors.eyes, targetColors.eyes, bounded(eased, 0, 1)),
        })
        paintPose(poseFromExpression(animated), undefined, time, bounded(eased, 0, 1))
        if (
          modeRef.current === 'manual' &&
          time - lastInspectorFrame.current >= INSPECTOR_FRAME_MS
        ) {
          lastInspectorFrame.current = time
          setExpression(animated)
        }
        if (progress < 1) {
          transitionFrame.current = requestAnimationFrame(tickSequenceTransition)
          return
        }
        transitionFrame.current = null
        activeSequenceTransition.current = null
        canonicalTarget.current = next
        transitionTarget.current = next
        setExpression(next)
        setDisplayColors(targetColors)
        paintPose(poseFromExpression(next))
      }
      transitionFrame.current = requestAnimationFrame(tickSequenceTransition)
      return
    }

    if (avatar) {
      const targetColors = resolveColors(next, avatar.colors)
      bodyColorAnimation.current = animate(renderedColors.body, targetColors.body, {
        duration: 0.35,
        ease: 'easeInOut',
      })
      eyeColorAnimation.current = animate(renderedColors.eyes, targetColors.eyes, {
        duration: 0.35,
        ease: 'easeInOut',
      })
    }

    if (transitionFrame.current !== null) {
      retargetFrom.current = { ...transitionTarget.current }
      retargetTo.current = resolvedTarget
      retargetStartedAt.current = -1
      return
    }
    transitionTarget.current = resolvedTarget
    lastAmbientStrength.current = 0
    const initialTransitionDistance = expressionFields.reduce(
      (total, field) => total + Math.abs(resolvedTarget[field] - current[field]),
      0
    )
    let transitionProgress = 0
    const tick = (time: number) => {
      const previousTime = lastTransitionTime.current ?? time
      const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 1 / 240), 1 / 30)
      lastTransitionTime.current = time
      const { stiffness, damping } = getSequenceSpring(
        sequenceTransitionRef.current.transition,
        sequenceTransitionRef.current.transitionMs,
        springSpeedRef.current
      )
      const mass = 0.85
      const currentExpression = displayedPose.current.expression
      if (retargetStartedAt.current !== null && retargetFrom.current && retargetTo.current) {
        if (retargetStartedAt.current < 0) retargetStartedAt.current = time
        const linearProgress = Math.min((time - retargetStartedAt.current) / RETARGET_BLEND_MS, 1)
        const smoothProgress =
          linearProgress ** 3 * (linearProgress * (linearProgress * 6 - 15) + 10)
        const blendedTarget = { ...retargetTo.current }
        expressionFields.forEach(field => {
          blendedTarget[field] =
            retargetFrom.current![field] +
            (retargetTo.current![field] - retargetFrom.current![field]) * smoothProgress
        })
        transitionTarget.current = blendedTarget
        if (linearProgress === 1) {
          transitionTarget.current = retargetTo.current
          retargetFrom.current = null
          retargetTo.current = null
          retargetStartedAt.current = null
        }
      }
      const target = transitionTarget.current
      const remainingTransitionDistance = expressionFields.reduce(
        (total, field) => total + Math.abs(target[field] - currentExpression[field]),
        0
      )
      const geometricProgress =
        initialTransitionDistance <= 0
          ? 1
          : 1 - remainingTransitionDistance / initialTransitionDistance
      transitionProgress = Math.max(transitionProgress, bounded(geometricProgress, 0, 1))
      let settled = true
      const animated = { ...currentExpression }
      animated.eyeMotion = target.eyeMotion
      animated.bodyMotion = target.bodyMotion

      expressionFields.forEach(field => {
        const displacement = target[field] - currentExpression[field]
        const acceleration = (stiffness * displacement - damping * transitionVelocity[field]) / mass
        const velocity = transitionVelocity[field] + acceleration * deltaTime
        const value = currentExpression[field] + velocity * deltaTime
        transitionVelocity[field] = velocity
        animated[field] = value
        const tolerance = field === 'perspective' ? 0.0001 : 0.005
        if (Math.abs(displacement) > tolerance || Math.abs(velocity) > tolerance) settled = false
      })

      if (settled) {
        const finalExpression = canonicalTarget.current
        stopTransition(true)
        setExpression(finalExpression)
        paintPose(poseFromExpression(finalExpression))
        return
      }

      paintPose(poseFromExpression(animated), undefined, time, transitionProgress)
      if (modeRef.current === 'manual' && time - lastInspectorFrame.current >= INSPECTOR_FRAME_MS) {
        lastInspectorFrame.current = time
        setExpression(animated)
      }
      transitionFrame.current = requestAnimationFrame(tick)
    }
    transitionFrame.current = requestAnimationFrame(tick)
  }

  const blink = (durationMs?: number) => {
    blinkControls.current?.stop()
    blinkValue.jump(1)
    blinkAnimating.current = true
    const sequence = sequences.find(item => item.id === (activeState ?? selectedState))
    const blinkDuration = durationMs ?? sequence?.blink.durationMs ?? 280
    blinkControls.current = animate(blinkValue, [1, 0, 1], {
      duration: reduceMotion ? 0 : blinkDuration / 1000,
      times: [0, 0.42, 1],
      ease: ['easeIn', 'easeOut'],
      onComplete: () => {
        blinkAnimating.current = false
      },
    })
  }

  const updateDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    updateImmediate(updateEyeDimension(expression, side, dimension, value, linked[dimension]))
  }

  const updateSize = (side: Side, value: number) => {
    updateImmediate(scaleEye(expression, side, value, linked.size))
  }

  const updateSpacing = (value: number) => {
    updateImmediate({ ...expression, spacing: value })
  }

  const updateActiveAvatar = (update: (avatar: StudioAvatar) => StudioAvatar) => {
    const next = avatarsRef.current.map(avatar =>
      avatar.id === activeAvatarIdRef.current ? update(avatar) : avatar
    )
    avatarsRef.current = next
    setAvatars(next)
    if (!avatarEditSnapshot.current) {
      updateStudioLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: next })
    }
  }

  const currentBody = (primary = surfaceRef.current, nodes = bodyNodesRef.current) => ({
    primary,
    nodes,
    limbs: limbsRef.current,
  })

  const selectBodyNode = (id: 'primary' | string | null) => {
    setSelectedBodyNodeId(id)
    setSelectedLimbId(null)
    if (id) setSelectedEyeSide(null)
  }

  const selectLimb = (id: string | null) => {
    setSelectedLimbId(id)
    setSelectedBodyNodeId(null)
    if (id) setSelectedEyeSide(null)
  }

  const updateSurface = (next: SurfaceConfig) => {
    surfaceRef.current = next
    setSurface(next)
    updateActiveAvatar(avatar => ({
      ...avatar,
      body: currentBody(next),
    }))
    paintPose(displayedPose.current)
  }

  const updateBodyNodes = (next: BodyNode[]) => {
    bodyNodesRef.current = next
    setBodyNodes(next)
    updateActiveAvatar(avatar => ({
      ...avatar,
      body: currentBody(surfaceRef.current, next),
    }))
    paintPose(displayedPose.current)
  }

  const updateLimbs = (next: BodyLimb[]) => {
    limbsRef.current = next
    setLimbs(next)
    updateActiveAvatar(avatar => ({
      ...avatar,
      body: currentBody(),
    }))
    paintPose(displayedPose.current)
  }

  const updateAvatarColors = (changes: Partial<AvatarColors>) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar) return
    const colors = { ...avatar.colors, ...changes }
    updateActiveAvatar(current => ({ ...current, colors }))
    setDisplayColors(resolveColors(expression, colors))
  }

  const updateAvatarRenderStyle = (renderStyle: AvatarRenderStyle) => {
    updateActiveAvatar(avatar => ({ ...avatar, renderStyle }))
  }

  const updateAvatarPalette = (changes: Partial<AvatarPalette>) => {
    updateActiveAvatar(avatar => ({ ...avatar, palette: { ...avatar.palette, ...changes } }))
  }

  const applyPaletteHarmony = (harmony: PaletteHarmony) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar) return
    updateAvatarPalette(suggestPalette(avatar.colors.body, harmony))
  }

  const randomizeAvatarPalette = () => {
    const next = randomPalette(Math.floor(Math.random() * 1_000_000_000))
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar) return
    const colors = { ...avatar.colors, body: next.body }
    updateActiveAvatar(current => ({ ...current, colors, palette: next.palette }))
    setDisplayColors(resolveColors(expression, colors))
  }

  const updateAvatarShading = (changes: Partial<AvatarShading>) => {
    updateActiveAvatar(avatar => ({ ...avatar, shading: { ...avatar.shading, ...changes } }))
  }

  const [selectedMarkingId, setSelectedMarkingId] = useState<string | null>(null)

  const updateMarkings = (update: (markings: Marking[]) => Marking[]) => {
    updateActiveAvatar(avatar => ({ ...avatar, markings: update(avatar.markings) }))
    paintPose(displayedPose.current)
  }

  const addMarking = (preset: MarkingPresetId) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar || avatar.markings.length >= MAX_MARKINGS) return
    const marking = createMarking(preset, avatar.markings)
    updateMarkings(markings => [...markings, marking])
    setSelectedMarkingId(marking.id)
  }

  const updateMarking = (next: Marking) => {
    updateMarkings(markings => markings.map(item => (item.id === next.id ? next : item)))
  }

  const deleteMarking = (id: string) => {
    updateMarkings(markings => markings.filter(item => item.id !== id))
    setSelectedMarkingId(current => (current === id ? null : current))
  }

  const duplicateSelectedMarking = (id: string) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    const source = avatar?.markings.find(item => item.id === id)
    if (!avatar || !source || avatar.markings.length >= MAX_MARKINGS) return
    const copy = duplicateMarking(source)
    updateMarkings(markings => [...markings, copy])
    setSelectedMarkingId(copy.id)
  }

  const moveMarking = (id: string, direction: -1 | 1) => {
    updateMarkings(markings => {
      const index = markings.findIndex(item => item.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= markings.length) return markings
      const next = markings.slice()
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const updateSelectedLimbPaint = (paint: LimbPaint) => {
    const limb = limbsRef.current.find(item => item.id === selectedLimbId)
    if (!limb) return
    commitLimb({ ...limb, paint })
  }

  const updateSelectedBodyNodePaint = (paint: PaintRef) => {
    updateSelectedBodyNode(node => {
      const next: BodyNode = { ...node, paint }
      if (paint === 'body') delete next.paint
      return next
    })
  }

  const updateAvatarEyes = (changes: Partial<AvatarEyeDefaults>) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar) return
    const eyes = { ...(avatar.eyes ?? defaultAvatarEyes), ...changes }
    updateActiveAvatar(current => ({ ...current, eyes }))
    paintPose(displayedPose.current)
  }

  const activateAvatar = (id: string, editBody = false, preserveMode = false) => {
    const avatar = avatarsRef.current.find(item => item.id === id)
    if (!avatar) return
    stopTalk()
    const resumeActiveSequence = statePlaying
    if (resumeActiveSequence) pauseState(false)
    if (editBody) suspendStateForEditor()
    if (editBody && !avatarEditSnapshot.current) {
      avatarEditSnapshot.current = {
        avatars: avatarsRef.current,
        activeAvatarId: activeAvatarIdRef.current,
      }
    }
    const currentStateExpression = displayedPose.current.expression
    const nextBehavior = resolveAvatarBehavior(avatar, baseBehavior)
    const nextExpressions = nextBehavior.expressions
    const nextSequences = nextBehavior.sequences
    stopTransition(true)
    activeAvatarIdRef.current = id
    surfaceRef.current = avatar.body.primary
    bodyNodesRef.current = avatar.body.nodes
    limbsRef.current = avatar.body.limbs ?? []
    setActiveAvatarId(id)
    setSurface(avatar.body.primary)
    setBodyNodes(avatar.body.nodes)
    setLimbs(avatar.body.limbs ?? [])
    expressionsRef.current = nextExpressions
    sequencesRef.current = nextSequences
    expressionDragPreview.current = nextExpressions
    stateDragPreview.current = nextSequences
    setExpressions(nextExpressions)
    setSequences(nextSequences)
    setExportAnimationIds(nextSequences.map(animation => animation.id))
    const nextActiveSequence = activeState
      ? (nextSequences.find(sequence => sequence.id === activeState) ?? null)
      : null
    const nextSelectedState =
      nextActiveSequence?.id ??
      (nextSequences.some(sequence => sequence.id === 'idle')
        ? 'idle'
        : (nextSequences[0]?.id ?? ''))
    activeSequenceRef.current = nextActiveSequence
    setActiveState(nextActiveSequence?.id ?? null)
    setSelectedState(nextSelectedState)
    setPlaybackVisual(current => ({ ...current, position: null }))
    selectBodyNode('primary')
    setActiveExpression(null)
    setEditing(null)
    setBodyEditing(editBody)
    if (!preserveMode || editBody) setMode('manual')
    const nextExpression = nextActiveSequence
      ? currentStateExpression
      : { ...(nextExpressions[0] ?? defaultExpression) }
    setExpression(nextExpression)
    setDisplayColors(resolveColors(nextExpression, avatar.colors))
    canonicalTarget.current = nextExpression
    transitionTarget.current = nextExpression
    paintPose(poseFromExpression(nextExpression))
    if (nextActiveSequence && resumeActiveSequence) {
      pausedSequenceTransition.current = null
      launchSequence(nextActiveSequence, true, false)
    }
    if (!avatarEditSnapshot.current) {
      updateStudioLibrary({ activeAvatarId: id, avatars: avatarsRef.current })
    }
  }

  const createNewAvatar = () => {
    avatarEditSnapshot.current = {
      avatars: avatarsRef.current,
      activeAvatarId: activeAvatarIdRef.current,
    }
    const avatar = createAvatar('Unknown')
    const next = [...avatarsRef.current, avatar]
    avatarsRef.current = next
    setAvatars(next)
    setFocusAvatarName(true)
    activateAvatar(avatar.id, true)
  }

  const duplicateAvatar = (source: StudioAvatar, editDuplicate = false) => {
    const snapshotAvatars = avatarEditSnapshot.current?.avatars ?? avatarsRef.current
    const sourceIndex = snapshotAvatars.findIndex(avatar => avatar.id === source.id)
    const baseAvatars = sourceIndex < 0 ? [...snapshotAvatars, source] : snapshotAvatars
    const duplicate: StudioAvatar = {
      ...structuredClone(source),
      id: `avatar-${crypto.randomUUID()}`,
      name: `${source.name} ${t('copie')}`,
    }
    const next = [...baseAvatars, duplicate]
    avatarEditSnapshot.current = null
    avatarsRef.current = next
    setAvatars(next)
    updateStudioLibrary({ activeAvatarId: duplicate.id, avatars: next })
    activateAvatar(duplicate.id, editDuplicate)
  }

  const previewAvatarMove = (targetId: string) => {
    const draggedId = draggedAvatarId.current
    if (!draggedId || draggedId === targetId) return
    const current = avatarDragPreview.current
    const dragged = current.find(avatar => avatar.id === draggedId)
    const targetIndex = current.findIndex(avatar => avatar.id === targetId)
    if (!dragged || targetIndex < 0) return
    const next = current.filter(avatar => avatar.id !== draggedId)
    next.splice(targetIndex, 0, dragged)
    avatarDragPreview.current = next
    setAvatars(next)
  }

  const commitAvatarMove = (targetId: string) => {
    previewAvatarMove(targetId)
    const next = avatarDragPreview.current
    avatarsRef.current = next
    updateStudioLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: next })
    avatarDragOrigin.current = null
    draggedAvatarId.current = null
    setDraggingAvatarId(null)
  }

  const cancelAvatarMove = () => {
    if (draggedAvatarId.current && avatarDragOrigin.current) {
      avatarDragPreview.current = avatarDragOrigin.current
      setAvatars(avatarDragOrigin.current)
    }
    avatarDragOrigin.current = null
    draggedAvatarId.current = null
    setDraggingAvatarId(null)
  }

  const cancelAvatarEditing = () => {
    const snapshot = avatarEditSnapshot.current
    if (!snapshot) {
      setBodyEditing(false)
      setMode('avatars')
      restoreStateAfterEditor()
      return
    }
    avatarEditSnapshot.current = null
    avatarsRef.current = snapshot.avatars
    setAvatars(snapshot.avatars)
    activateAvatar(snapshot.activeAvatarId, false, true)
    setMode('avatars')
    restoreStateAfterEditor()
  }

  const saveAvatarEditing = () => {
    avatarEditSnapshot.current = null
    updateStudioLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: avatarsRef.current })
    setBodyEditing(false)
    restoreStateAfterEditor()
  }

  const renameActiveAvatar = (name: string) => {
    updateActiveAvatar(avatar => ({ ...avatar, name }))
  }

  const deleteActiveAvatar = () => {
    if (avatarsRef.current.length <= 1) return
    avatarEditSnapshot.current = null
    const remaining = avatarsRef.current.filter(avatar => avatar.id !== activeAvatarIdRef.current)
    avatarsRef.current = remaining
    setAvatars(remaining)
    updateStudioLibrary({ activeAvatarId: remaining[0].id, avatars: remaining })
    setDeleteAvatarOpen(false)
    activateAvatar(remaining[0].id)
    restoreStateAfterEditor()
  }

  const addBodyNode = (type: (typeof bodyPrimitiveTypes)[number]) => {
    if (bodyNodesRef.current.length >= MAX_BODY_NODES) return
    const node = createBodyNode(type, bodyNodesRef.current.length)
    updateBodyNodes([...bodyNodesRef.current, node])
    selectBodyNode(node.id)
  }

  const updateSelectedBodyNode = (update: (node: BodyNode) => BodyNode) => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(
      bodyNodesRef.current.map(node => (node.id === selectedBodyNodeId ? update(node) : node))
    )
  }

  const commitBodyNode = (nextNode: BodyNode) => {
    updateBodyNodes(bodyNodesRef.current.map(node => (node.id === nextNode.id ? nextNode : node)))
  }

  const previewSelectedBodyNode = (nextNode: BodyNode) => {
    const next = bodyNodesRef.current.map(node => (node.id === nextNode.id ? nextNode : node))
    bodyNodesRef.current = next
    setBodyNodes(next)
    paintPose(displayedPose.current)
  }

  const deleteSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(bodyNodesRef.current.filter(node => node.id !== selectedBodyNodeId))
    selectBodyNode('primary')
  }

  const duplicateSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary' || bodyNodesRef.current.length >= MAX_BODY_NODES) return
    const source = bodyNodesRef.current.find(node => node.id === selectedBodyNodeId)
    if (!source) return
    const duplicate = duplicateBodyNode(source)
    updateBodyNodes([...bodyNodesRef.current, duplicate])
    selectBodyNode(duplicate.id)
  }

  const addBodyLimb = (preset: BodyLimbPresetId) => {
    if (limbsRef.current.length >= MAX_BODY_LIMBS) return
    const limb = createBodyLimb(preset, limbsRef.current)
    updateLimbs([...limbsRef.current, limb])
    selectLimb(limb.id)
  }

  const commitLimb = (nextLimb: BodyLimb) => {
    updateLimbs(limbsRef.current.map(limb => (limb.id === nextLimb.id ? nextLimb : limb)))
  }

  const previewSelectedLimb = (nextLimb: BodyLimb) => {
    const next = limbsRef.current.map(limb => (limb.id === nextLimb.id ? nextLimb : limb))
    limbsRef.current = next
    setLimbs(next)
    paintPose(displayedPose.current)
  }

  const deleteSelectedLimb = () => {
    if (!selectedLimbId) return
    updateLimbs(limbsRef.current.filter(limb => limb.id !== selectedLimbId))
    selectLimb(null)
    selectBodyNode('primary')
  }

  const duplicateSelectedLimb = () => {
    if (!selectedLimbId || limbsRef.current.length >= MAX_BODY_LIMBS) return
    const source = limbsRef.current.find(limb => limb.id === selectedLimbId)
    if (!source) return
    const duplicate = duplicateBodyLimb(source)
    updateLimbs([...limbsRef.current, duplicate])
    selectLimb(duplicate.id)
  }

  const updateHighlight = (next: Highlight) => {
    if (next && statePlaying) pauseState()
    highlightRef.current = next
    setHighlight(next)
    if (next === 'head') paintPose(displayedPose.current)
  }

  const updateWireVisibility = (next: boolean) => {
    showWireRef.current = next
    setShowWire(next)
    if (next) paintPose(displayedPose.current)
  }

  const clearStateTimers = () => {
    if (stateTimer.current) clearTimeout(stateTimer.current)
    if (blinkTimer.current) clearTimeout(blinkTimer.current)
    stateTimer.current = null
    blinkTimer.current = null
    playbackTimeline.current = {
      ...playbackTimeline.current,
      stepDueAt: null,
      blinkDueAt: null,
    }
  }

  const pauseState = (persist = true) => {
    playbackTimeline.current = pausePlaybackTimeline(playbackTimeline.current, readSequenceClock())
    if (transitionFrame.current !== null && activeSequenceTransition.current) {
      cancelAnimationFrame(transitionFrame.current)
      transitionFrame.current = null
      pausedSequenceTransition.current = activeSequenceTransition.current
      activeSequenceTransition.current = null
    }
    if (blinkAnimating.current) blinkControls.current?.pause()
    clearStateTimers()
    setStatePlaying(false)
    setPlaybackStatus('paused')
    if (persist && activeState) persistStatePlayback({ stateId: activeState, playing: false })
  }

  const stopState = (persist = true) => {
    clearStateTimers()
    playbackTimeline.current = stopPlaybackTimeline(playbackTimeline.current)
    activeSequenceTransition.current = null
    pausedSequenceTransition.current = null
    stopTransition(true)
    blinkControls.current?.stop()
    blinkAnimating.current = false
    blinkValue.jump(1)
    paintPose(displayedPose.current, 1)
    setStatePlaying(false)
    setPlaybackStatus('stopped')
    setPlaybackVisual(current => ({ ...current, position: null }))
    if (persist) persistStatePlayback({ stateId: null, playing: false })
  }

  const launchSequence = (sequence: AvatarSequence, resume = false, persist = true) => {
    clearStateTimers()
    if (!sequence.steps.length) {
      stopState(persist)
      return
    }
    const id = sequence.id
    playbackTimeline.current = beginPlayback(playbackTimeline.current, resume)
    setSelectedState(id)
    setActiveState(id)
    activeSequenceRef.current = sequence
    setStatePlaying(true)
    setPlaybackStatus('playing')
    if (persist) persistStatePlayback({ stateId: id, playing: true })
    const scheduleAdvance = (delay: number) => {
      playbackTimeline.current = schedulePlaybackStep(
        playbackTimeline.current,
        readSequenceClock(),
        delay
      )
      stateTimer.current = setTimeout(advance, delay)
    }
    const playCurrentStep = () => {
      playbackTimeline.current = { ...playbackTimeline.current, stepDueAt: null }
      const step = sequence.steps[playbackTimeline.current.position]
      const availableExpressions = expressionsRef.current
      const expressionIndex = findExpressionIndex(availableExpressions, step.expressionId)
      const preset = availableExpressions[expressionIndex]
      const durationMs = (reduceMotion ? 0 : step.transitionMs) + step.holdMs
      setPlaybackVisual(current => ({
        position: playbackTimeline.current.position,
        run: current.run + 1,
        durationMs,
      }))
      if (preset) {
        transitionToExpression(preset, expressionIndex, step)
      }
      scheduleAdvance(durationMs)
    }
    const advance = () => {
      const advanced = advancePlaybackTimeline(playbackTimeline.current, sequence)
      playbackTimeline.current = advanced.timeline
      const { cursor } = advanced
      if (cursor.complete) {
        if (blinkTimer.current) clearTimeout(blinkTimer.current)
        blinkTimer.current = null
        playbackTimeline.current = { ...playbackTimeline.current, blinkDueAt: null }
        setStatePlaying(false)
        setPlaybackStatus('stopped')
        setPlaybackVisual(current => ({ ...current, position: null }))
        if (persist) persistStatePlayback({ stateId: null, playing: false })
        return
      }
      playCurrentStep()
    }
    const scheduleBlink = (delay: number) => {
      playbackTimeline.current = schedulePlaybackBlink(
        playbackTimeline.current,
        readSequenceClock(),
        delay
      )
      blinkTimer.current = setTimeout(blinkLoop, delay)
    }
    const blinkLoop = () => {
      playbackTimeline.current = { ...playbackTimeline.current, blinkDueAt: null }
      blink(sequence.blink.durationMs)
      const { minIntervalMs, maxIntervalMs } = sequence.blink
      scheduleBlink(
        sequence.blink.durationMs + minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs)
      )
    }
    if (resume) {
      const pausedTransition = pausedSequenceTransition.current
      if (pausedTransition) {
        transitionToExpression(pausedTransition.target, pausedTransition.index, {
          ...pausedTransition.settings,
          transitionMs: pausedTransition.remainingMs,
        })
        pausedSequenceTransition.current = null
      }
      if (blinkAnimating.current) blinkControls.current?.play()
      const currentStep = sequence.steps[playbackTimeline.current.position]
      scheduleAdvance(
        playbackTimeline.current.stepRemainingMs ||
          (reduceMotion ? 0 : currentStep.transitionMs) + currentStep.holdMs
      )
    } else {
      playCurrentStep()
    }
    if (sequence.blink.enabled) {
      scheduleBlink(
        resume
          ? playbackTimeline.current.blinkRemainingMs || sequence.blink.initialDelayMs
          : sequence.blink.initialDelayMs
      )
    }
  }

  const toggleStatePlayback = () => {
    if (!activeState || !activeSequenceRef.current) return
    if (statePlaying) pauseState()
    else launchSequence(activeSequenceRef.current, playbackStatus === 'paused')
  }

  const suspendStateForEditor = () => {
    if (editorStateSnapshot.current || !activeState) return
    editorStateSnapshot.current = {
      stateId: activeState,
      playing: statePlaying,
      expression: { ...displayedPose.current.expression },
    }
    if (statePlaying) pauseState(false)
    setActiveState(null)
  }

  const restoreStateAfterEditor = (availableSequences = sequences) => {
    const snapshot = editorStateSnapshot.current
    editorStateSnapshot.current = null
    if (!snapshot) return
    const sequence = availableSequences.find(item => item.id === snapshot.stateId)
    if (!sequence) {
      stopState(false)
      persistStatePlayback({ stateId: null, playing: false })
      return
    }
    activeSequenceRef.current = sequence
    setSelectedState(sequence.id)
    setActiveState(sequence.id)
    if (snapshot.playing) {
      launchSequence(sequence, true, false)
      return
    }
    setStatePlaying(false)
    transitionToExpression(snapshot.expression)
  }

  useEffect(() => {
    if (initialStatePlaybackApplied.current) return
    initialStatePlaybackApplied.current = true
    const sequence = sequences.find(item => item.id === selectedState)
    if (sequence && initialStatePlayback.stateId !== null) {
      activeSequenceRef.current = sequence
      setActiveState(sequence.id)
      if (initialStatePlayback.playing) launchSequence(sequence, false, false)
      else setPlaybackStatus('paused')
    }
    return () => {
      initialStatePlaybackApplied.current = false
    }
  }, [])

  const saveEditing = () => {
    if (!editing) return
    const index = editing.index ?? expressions.length
    const savedDraft =
      editing.index === null ? { ...editing.draft, id: createExpressionId() } : editing.draft
    const next =
      editing.index === null
        ? [...expressions, savedDraft]
        : expressions.map((item, itemIndex) =>
            itemIndex === editing.index ? { ...savedDraft } : item
          )
    setExpressions(next)
    updateStudioExpressions(next)
    setEditing(null)
    transitionToExpression(savedDraft, index)
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const duplicateExpression = (_index: number | null, draft: Expression, editDuplicate = false) => {
    const duplicate = { ...draft, id: createExpressionId() }
    const next = [...expressions, duplicate]
    const duplicateIndex = next.length - 1
    setExpressions(next)
    updateStudioExpressions(next)
    if (editDuplicate) openExpressionEditor(duplicateIndex, duplicate)
    else transitionToExpression(duplicate, duplicateIndex)
  }

  const previewExpressionMove = (targetId: string | null) => {
    const draggedId = draggedExpressionId.current
    if (!draggedId || draggedId === targetId) return
    const current = expressionDragPreview.current
    const dragged = current.find(item => item.id === draggedId)
    if (!dragged) return
    const activeId = activeExpression === null ? null : current[activeExpression]?.id
    const next = current.filter(item => item.id !== draggedId)
    const targetIndex = targetId ? next.findIndex(item => item.id === targetId) : next.length
    next.splice(targetIndex < 0 ? next.length : targetIndex, 0, dragged)
    expressionDragPreview.current = next
    setExpressions(next)
    if (activeId) setActiveExpression(next.findIndex(item => item.id === activeId))
  }

  const commitExpressionMove = (targetId: string | null) => {
    previewExpressionMove(targetId)
    updateStudioExpressions(expressionDragPreview.current)
    expressionDragOrigin.current = null
    draggedExpressionId.current = null
    setDraggingExpressionId(null)
  }

  const cancelExpressionMove = () => {
    if (draggedExpressionId.current && expressionDragOrigin.current) {
      expressionDragPreview.current = expressionDragOrigin.current
      setExpressions(expressionDragOrigin.current)
    }
    expressionDragOrigin.current = null
    draggedExpressionId.current = null
    setDraggingExpressionId(null)
  }

  const previewExpressionDraft = (draft: Expression) => {
    setEditing(current => (current ? { ...current, draft } : current))
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(draft, avatar.colors))
    paintPose(poseFromExpression(draft))
  }

  const previewCanvasExpression = (next: Expression, target: CanvasPreviewTarget) => {
    const now = performance.now()
    const updateInspector = now - lastInspectorFrame.current >= INSPECTOR_FRAME_MS
    if (updateInspector) {
      lastInspectorFrame.current = now
      if (editing) {
        setEditing(current => (current ? { ...current, draft: next } : current))
      } else {
        setExpression(next)
      }
    }
    if (bodyEditing) {
      paintRenderedRotationGizmo(renderedRotationGizmo, next)
      paintRenderedScene(
        renderedScene,
        renderAvatar(
          poseFromExpression(
            resolveCanvasPreviewExpression(next, activeAvatarEyes, bodyEditing, target)
          ),
          surfaceRef.current,
          blinkValue.get(),
          {
            includeWire: showWireRef.current || highlightRef.current === 'head',
            bodyNodes: bodyNodesRef.current,
            limbs: limbsRef.current,
            markings: avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
              ?.markings,
          }
        )
      )
      return
    }
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(next, avatar.colors))
    paintPose(poseFromExpression(next))
  }

  const openExpressionEditor = (index: number | null, draft: Expression) => {
    suspendStateForEditor()
    setBodyEditing(false)
    setMode('expressions')
    setEditing({
      index,
      draft: { ...draft, id: index === null ? createExpressionId() : draft.id },
    })
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(draft, avatar.colors))
    paintPose(poseFromExpression(draft))
  }

  const cancelExpressionEditing = () => {
    setEditing(null)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(expression, avatar.colors))
    paintPose(poseFromExpression(expression))
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const deleteEditing = () => {
    if (editing?.index === null || editing?.index === undefined) return
    const next =
      expressions.length <= 1
        ? [{ ...defaultExpression }]
        : expressions.filter((_, index) => index !== editing.index)
    const fallback = next[Math.min(editing.index, next.length - 1)] ?? defaultExpression
    const deletedExpressionId = expressions[editing.index]?.id ?? editing.draft.id
    const fallbackExpressionId = fallback.id
    const nextSequences = remapSequencesAfterExpressionDelete(
      sequences,
      deletedExpressionId,
      fallbackExpressionId
    )
    setExpressions(next)
    setSequences(nextSequences)
    if (sequenceEditing) {
      const draft = remapSequencesAfterExpressionDelete(
        [sequenceEditing.draft],
        deletedExpressionId,
        fallbackExpressionId
      )[0]
      setSequenceEditing({ ...sequenceEditing, draft })
    }
    updateStudioExpressions(next)
    updateStudioSequences(nextSequences)
    setActiveExpression(null)
    setEditing(null)
    setDeleteExpressionOpen(false)
    setExpression(fallback)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(fallback, avatar.colors))
    paintPose(poseFromExpression(fallback))
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const openSequenceEditor = (sequence?: AvatarSequence) => {
    suspendStateForEditor()
    setEditing(null)
    setBodyEditing(false)
    setMode('states')
    const draft = sequence
      ? {
          ...sequence,
          steps: sequence.steps.map(step => ({ ...step })),
          blink: { ...sequence.blink },
        }
      : createSequence(expressions[activeExpression ?? 0]?.id ?? expressions[0]?.id)
    setSequenceEditing({ sourceId: sequence?.id ?? null, draft })
    setSelectedSequenceStepId(draft.steps[0]?.id ?? null)
    const firstStep = draft.steps[0]
    const expressionIndex = firstStep
      ? findExpressionIndex(expressions, firstStep.expressionId)
      : -1
    const preset = expressions[expressionIndex]
    if (preset) transitionToExpression(preset, expressionIndex, firstStep)
  }

  const cancelSequenceEditing = () => {
    if (activeState === sequenceEditing?.draft.id) stopState(false)
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    restoreStateAfterEditor()
  }

  const saveSequenceEditing = () => {
    if (!sequenceEditing?.draft.steps.length || !sequenceEditing.draft.name.trim()) return
    const saved = {
      ...sequenceEditing.draft,
      name: sequenceEditing.draft.name.trim(),
      group: sequenceEditing.draft.group.trim() || 'Custom',
    }
    const next = sequenceEditing.sourceId
      ? sequences.map(sequence => (sequence.id === sequenceEditing.sourceId ? saved : sequence))
      : [...sequences, saved]
    setSequences(next)
    updateStudioSequences(next)
    setSelectedState(saved.id)
    if (activeState === saved.id) stopState(false)
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    restoreStateAfterEditor(next)
  }

  const duplicateSequenceEditing = () => {
    if (!sequenceEditing) return
    if (activeState === sequenceEditing.draft.id) stopState(false)
    const duplicate = duplicateSequence(sequenceEditing.draft)
    const next = [...sequences, duplicate]
    setSequences(next)
    updateStudioSequences(next)
    setSelectedState(duplicate.id)
    setSequenceEditing({ sourceId: duplicate.id, draft: duplicate })
    setSelectedSequenceStepId(duplicate.steps[0]?.id ?? null)
  }

  const duplicateState = (sequence: AvatarSequence) => {
    if (activeState === sequence.id) stopState(false)
    const duplicate = duplicateSequence(sequence)
    const next = [...sequences, duplicate]
    setSequences(next)
    updateStudioSequences(next)
    setSelectedState(duplicate.id)
  }

  const previewStateMove = (targetId: string | null, targetGroup: string) => {
    const draggedId = draggedStateId.current
    if (!draggedId || draggedId === targetId) return
    const current = stateDragPreview.current
    const dragged = current.find(sequence => sequence.id === draggedId)
    if (!dragged) return
    const next = current.filter(sequence => sequence.id !== draggedId)
    const moved = { ...dragged, group: targetGroup }
    if (targetId) {
      const targetIndex = next.findIndex(sequence => sequence.id === targetId)
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, moved)
    } else {
      let lastGroupIndex = -1
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (next[index].group !== targetGroup) continue
        lastGroupIndex = index
        break
      }
      next.splice(lastGroupIndex + 1, 0, moved)
    }
    stateDragPreview.current = next
    setSequences(next)
  }

  const commitStateMove = (targetId: string | null, targetGroup: string) => {
    previewStateMove(targetId, targetGroup)
    updateStudioSequences(stateDragPreview.current)
    stateDragOrigin.current = null
    draggedStateId.current = null
    setDraggingStateId(null)
  }

  const cancelStateMove = () => {
    if (draggedStateId.current && stateDragOrigin.current) {
      stateDragPreview.current = stateDragOrigin.current
      setSequences(stateDragOrigin.current)
    }
    stateDragOrigin.current = null
    draggedStateId.current = null
    setDraggingStateId(null)
  }

  const deleteSequenceEditing = () => {
    if (!sequenceEditing?.sourceId) return
    const next = sequences.filter(sequence => sequence.id !== sequenceEditing.sourceId)
    const fallback = next[0]
    setSequences(next)
    updateStudioSequences(next)
    if (activeState === sequenceEditing.sourceId) stopState(false)
    setSelectedState(fallback?.id ?? '')
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    setDeleteSequenceOpen(false)
    restoreStateAfterEditor(next)
  }

  const selectedBodyNode =
    selectedBodyNodeId === 'primary'
      ? null
      : (bodyNodes.find(node => node.id === selectedBodyNodeId) ?? null)
  const selectedLimb = limbs.find(limb => limb.id === selectedLimbId) ?? null

  const updateNodeVector = (property: 'position' | 'rotation', index: 0 | 1 | 2, value: number) => {
    updateSelectedBodyNode(node => {
      const vector = [...node[property]] as [number, number, number]
      vector[index] = value
      return { ...node, [property]: vector }
    })
  }
  const activeAvatar = avatars.find(avatar => avatar.id === activeAvatarId) ?? avatars[0]
  const activeAvatarEyes = activeAvatar.eyes ?? defaultAvatarEyes
  const activeSequence = sequences.find(sequence => sequence.id === activeState) ?? null
  const activeSequenceLabel = activeSequence
    ? activeSequence.builtIn
      ? t(activeSequence.name)
      : activeSequence.name
    : null
  const expressionById = new Map(expressions.map(item => [item.id, item]))
  const exportAnimationIdSet = new Set(exportAnimationIds)
  const selectedExportAnimations = sequences.filter(animation =>
    exportAnimationIdSet.has(animation.id)
  )
  const toggleExportAnimation = (animationId: string) => {
    setExportAnimationIds(current =>
      current.includes(animationId)
        ? current.filter(id => id !== animationId)
        : [...current, animationId]
    )
  }
  const downloadAvatarExport = () => {
    if (!selectedExportAnimations.length) return
    const payload = createAvatarExportPayload(activeAvatar, expressions, selectedExportAnimations)
    const isReact = exportFormat === 'react'
    const extension = 'zip'
    const blob = isReact
      ? generateReactAvatarPackage(payload)
      : generateJavaScriptAvatarPackage(payload, language)
    downloadBlob(blob, avatarExportFileName(activeAvatar.name, extension))
  }
  const currentStudioDocument = (): StudioDocument => ({
    version: 2,
    library: { activeAvatarId, avatars },
    expressions: baseBehavior.expressions,
    sequences: baseBehavior.sequences,
    playback: {
      stateId: playbackStatus === 'stopped' ? null : (activeState ?? (selectedState || null)),
      playing: statePlaying,
    },
    stageBackground,
    lookVersion: BUNDLED_LOOK_VERSION,
  })
  const downloadStudioProject = () => {
    const blob = new Blob([serializeStudioDocument(currentStudioDocument())], {
      type: 'application/json',
    })
    downloadBlob(blob, 'avatar-studio-project.json')
  }
  const currentSnapshotSvg = () =>
    serializeAvatarSnapshot(
      activeAvatar.name,
      renderedScene,
      {
        body: renderedColors.body.get(),
        eyes: renderedColors.eyes.get(),
      },
      {
        background: snapshotBackground,
        colorFrom: snapshotColorFrom,
        colorTo: snapshotColorTo,
        size: Number(snapshotSize),
      },
      activeAvatar.renderStyle,
      activeAvatar
    )

  const createPixelSnapshotCanvas = () => {
    const renderStyle = activeAvatar.renderStyle
    if (renderStyle.type !== 'pixel') return null
    const size = Number(snapshotSize)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) return null
    if (snapshotBackground === 'solid') {
      context.fillStyle = snapshotColorFrom
      context.fillRect(0, 0, size, size)
    } else if (snapshotBackground === 'linear') {
      const gradient = context.createLinearGradient(0, 0, size, size)
      gradient.addColorStop(0, snapshotColorFrom)
      gradient.addColorStop(1, snapshotColorTo)
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    } else if (snapshotBackground === 'radial') {
      const gradient = context.createRadialGradient(
        size * 0.5,
        size * 0.42,
        0,
        size * 0.5,
        size * 0.42,
        size * 0.7
      )
      gradient.addColorStop(0, snapshotColorFrom)
      gradient.addColorStop(1, snapshotColorTo)
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    }
    const avatarCanvas = document.createElement('canvas')
    avatarCanvas.width = renderStyle.resolution
    avatarCanvas.height = renderStyle.resolution
    const avatarContext = avatarCanvas.getContext('2d', { willReadFrequently: true })
    if (!avatarContext) return null
    paintPixelAvatar(
      avatarContext,
      readPixelFrame(renderedScene, renderedColors, activeAvatar),
      renderStyle
    )
    context.imageSmoothingEnabled = false
    context.drawImage(avatarCanvas, 0, 0, size, size)
    return canvas
  }
  const downloadSnapshotSvg = () => {
    const pixelCanvas = createPixelSnapshotCanvas()
    const source = pixelCanvas
      ? serializePixelSnapshot(
          activeAvatar.name,
          pixelCanvas.toDataURL('image/png'),
          Number(snapshotSize)
        )
      : currentSnapshotSvg()
    downloadBlob(
      new Blob([source], { type: 'image/svg+xml;charset=utf-8' }),
      snapshotFileName(activeAvatar.name)
    )
  }
  const downloadSnapshotPng = () => {
    const pixelCanvas = createPixelSnapshotCanvas()
    if (pixelCanvas) {
      pixelCanvas.toBlob(blob => {
        if (blob) downloadBlob(blob, snapshotFileName(activeAvatar.name, 'png'))
      }, 'image/png')
      return
    }
    const size = Number(snapshotSize)
    const source = new Blob([currentSnapshotSvg()], { type: 'image/svg+xml;charset=utf-8' })
    const sourceUrl = URL.createObjectURL(source)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d')?.drawImage(image, 0, 0, size, size)
      URL.revokeObjectURL(sourceUrl)
      canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, snapshotFileName(activeAvatar.name, 'png'))
      }, 'image/png')
    }
    image.onerror = () => URL.revokeObjectURL(sourceUrl)
    image.src = sourceUrl
  }
  const takePicture = () => {
    setPhotoFlash(current => current + 1)
    requestAnimationFrame(() => {
      if (snapshotFormat === 'png') downloadSnapshotPng()
      else downloadSnapshotSvg()
    })
  }
  const prepareStudioProjectImport = (file: File | undefined) => {
    if (!file) return
    setProjectImportError(null)
    if (file.size > 10_000_000) {
      setProjectImportError(
        t('Ce fichier ne contient pas un projet little guys valide et compatible.')
      )
      return
    }
    file
      .text()
      .then(source => {
        const imported = parseImportedStudioDocument(source, currentStudioDocument())
        setPendingProjectImport({ document: imported, fileName: file.name })
      })
      .catch(() => {
        setProjectImportError(
          t('Ce fichier ne contient pas un projet little guys valide et compatible.')
        )
      })
  }
  const confirmStudioProjectImport = () => {
    if (!pendingProjectImport) return
    if (!persistStudioDocument(pendingProjectImport.document)) {
      setProjectImportError(
        t(
          'Le projet n’a pas pu être enregistré dans ce navigateur. Libère de l’espace puis réessaie.'
        )
      )
      setPendingProjectImport(null)
      return
    }
    window.location.reload()
  }
  const canvasExpression = editing?.draft ?? expression
  const editorPageOpen = bodyEditing || editing !== null || sequenceEditing !== null
  const expressionPendingDeletionId =
    editing?.index !== null && editing?.index !== undefined
      ? (expressions[editing.index]?.id ?? editing.draft.id)
      : null
  const animationsAffectedByExpressionDeletion = expressionPendingDeletionId
    ? sequences.filter(sequence =>
        sequence.steps.some(step => step.expressionId === expressionPendingDeletionId)
      )
    : []

  useEffect(() => {
    if (!editorPageOpen || focusAvatarName) return
    const frame = requestAnimationFrame(() => workspaceBackButtonRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [editorPageOpen, focusAvatarName])

  const updateAvatarEyeDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    const next = updateEyeDimension(
      { ...defaultExpression, ...activeAvatarEyes },
      side,
      dimension,
      value,
      linked[dimension]
    )
    updateAvatarEyes({
      [`${dimension}Left`]: next[`${dimension}Left`],
      [`${dimension}Right`]: next[`${dimension}Right`],
    })
  }
  const updateAvatarEyeSize = (side: Side, value: number) => {
    const next = scaleEye({ ...defaultExpression, ...activeAvatarEyes }, side, value, linked.size)
    updateAvatarEyes({
      widthLeft: next.widthLeft,
      widthRight: next.widthRight,
      heightLeft: next.heightLeft,
      heightRight: next.heightRight,
    })
  }
  const updateAvatarEyePosition = (side: Side, axis: 'X' | 'Y', value: number) => {
    const next = updateEyePosition(
      { ...defaultExpression, ...activeAvatarEyes },
      side,
      axis,
      value,
      linked.position
    )
    updateAvatarEyes({
      [`position${axis}Left`]: next[`position${axis}Left`],
      [`position${axis}Right`]: next[`position${axis}Right`],
    })
  }
  const persistEditedEyeExpression = (next: Expression) => {
    updateAvatarEyes({
      widthLeft: next.widthLeft,
      widthRight: next.widthRight,
      heightLeft: next.heightLeft,
      heightRight: next.heightRight,
      spacing: next.spacing,
      positionXLeft: next.positionXLeft,
      positionXRight: next.positionXRight,
      positionYLeft: next.positionYLeft,
      positionYRight: next.positionYRight,
      leftAngle: next.leftAngle,
      rightAngle: next.rightAngle,
    })
  }
  return {
    activateAvatar,
    activeAvatar,
    activeAvatarEyes,
    activeAvatarId,
    activeExpression,
    activeSequence,
    activeSequenceLabel,
    activeState,
    addBodyLimb,
    addBodyNode,
    animationsAffectedByExpressionDeletion,
    avatarDragOrigin,
    avatarDragPreview,
    avatars,
    avatarsRef,
    blink,
    bodyEditing,
    bodyNodes,
    commitLimb,
    cancelAvatarEditing,
    cancelAvatarMove,
    cancelExpressionEditing,
    cancelExpressionMove,
    cancelSequenceEditing,
    cancelStateMove,
    canvasExpression,
    commitAvatarMove,
    commitBodyNode,
    commitExpressionMove,
    commitStateMove,
    confirmStudioProjectImport,
    createNewAvatar,
    deleteActiveAvatar,
    deleteAvatarOpen,
    deleteEditing,
    deleteExpressionOpen,
    deleteSelectedBodyNode,
    deleteSelectedLimb,
    deleteSequenceEditing,
    deleteSequenceOpen,
    downloadAvatarExport,
    downloadStudioProject,
    draggedAvatarId,
    draggedExpressionId,
    draggedStateId,
    draggingAvatarId,
    draggingExpressionId,
    draggingStateId,
    duplicateAvatar,
    duplicateExpression,
    duplicateSelectedBodyNode,
    duplicateSelectedLimb,
    duplicateSequenceEditing,
    duplicateState,
    editing,
    editorPageOpen,
    exportAnimationIdSet,
    exportFormat,
    expression,
    expressionById,
    expressionDragOrigin,
    expressionDragPreview,
    expressions,
    focusAvatarName,
    freezeLivePreviewForManipulation,
    highlight,
    language,
    launchSequence,
    limbs,
    linked,
    mode,
    openExpressionEditor,
    openSequenceEditor,
    pauseState,
    pendingProjectImport,
    persistEditedEyeExpression,
    photoFlash,
    playbackStatus,
    playbackVisual,
    prepareStudioProjectImport,
    previewAvatarMove,
    previewCanvasExpression,
    previewExpressionDraft,
    previewExpressionMove,
    previewSelectedBodyNode,
    previewSelectedLimb,
    previewStateMove,
    projectImportError,
    projectImportRef,
    reduceMotion,
    renameActiveAvatar,
    renderedColors,
    renderedRotationGizmo,
    renderedScene,
    saveAvatarEditing,
    saveEditing,
    saveSequenceEditing,
    selectBodyNode,
    selectLimb,
    selectedBodyNode,
    selectedBodyNodeId,
    selectedLimb,
    selectedLimbId,
    selectedExportAnimations,
    selectedEyeSide,
    selectedSequenceStepId,
    selectedState,
    sequenceEditing,
    sequences,
    setDeleteAvatarOpen,
    setDeleteExpressionOpen,
    setDeleteSequenceOpen,
    setDraggingAvatarId,
    setDraggingExpressionId,
    setDraggingStateId,
    setEditing,
    setExportAnimationIds,
    setExportFormat,
    setFocusAvatarName,
    setLanguage,
    setLinked,
    setMode,
    setPendingProjectImport,
    setSelectedEyeSide,
    setSelectedSequenceStepId,
    setSequenceEditing,
    setSnapshotBackground,
    setSnapshotColorFrom,
    setSnapshotColorTo,
    setSnapshotFormat,
    setSnapshotSize,
    setSpringSpeed,
    setStatePlayerExpanded,
    showWire,
    snapshotBackground,
    snapshotColorFrom,
    snapshotColorTo,
    snapshotFormat,
    snapshotSize,
    springSpeed,
    springSpeedRef,
    stateDragOrigin,
    stateDragPreview,
    statePlayerExpanded,
    statePlaying,
    stopState,
    surface,
    t,
    talkError,
    talkKey,
    talkLanguage,
    talkRegion,
    talkSpeed,
    talkStatus,
    talkStyle,
    talkText,
    playTalk,
    setTalkKey,
    setTalkRegion,
    stopTalk,
    updateTalkLanguage,
    updateTalkSpeed,
    updateTalkStyle,
    updateTalkText,
    takePicture,
    toggleExportAnimation,
    toggleStatePlayback,
    transitionToExpression,
    stageBackground,
    updateStageBackground,
    updateAvatarColors,
    updateAvatarRenderStyle,
    updateAvatarPalette,
    applyPaletteHarmony,
    randomizeAvatarPalette,
    updateAvatarShading,
    selectedMarkingId,
    setSelectedMarkingId,
    addMarking,
    updateMarking,
    deleteMarking,
    duplicateSelectedMarking,
    moveMarking,
    updateSelectedLimbPaint,
    updateSelectedBodyNodePaint,
    updateAvatarEyeDimension,
    updateAvatarEyePosition,
    updateAvatarEyeSize,
    updateAvatarEyes,
    updateDimension,
    updateHighlight,
    updateImmediate,
    updateNodeVector,
    updateSelectedBodyNode,
    updateSize,
    updateSpacing,
    updateSurface,
    updateWireVisibility,
    workspaceBackButtonRef,
  }
}

export type StudioController = ReturnType<typeof useStudioController>
