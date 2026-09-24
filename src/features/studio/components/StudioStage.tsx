import { Camera, Info } from 'lucide-react'
import { motion, useMotionValue } from 'motion/react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { AvatarCanvas } from '@/features/rendering/components/AvatarCanvas'
import { hexLuminance } from '@/features/rendering/vectorMaterials'
import { nextStageZoom, STAGE_ZOOM_DEFAULT } from '@/features/rendering/stageZoom'
import { StudioIdentity } from '@/features/studio/components/StudioIdentity'
import type { StudioController } from '@/features/studio/useStudioController'

export function StudioStage({ controller }: { controller: StudioController }) {
  const [photoHelpOpen, setPhotoHelpOpen] = useState(false)
  const stageRef = useRef<HTMLElement>(null)
  const stageZoom = useMotionValue(STAGE_ZOOM_DEFAULT)

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      stageZoom.set(nextStageZoom(stageZoom.get(), event.deltaY, event.deltaMode))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [stageZoom])
  const {
    activeAvatar,
    activeAvatarEyes,
    activeSequenceLabel,
    bodyEditing,
    canvasExpression,
    commitBodyNode,
    editing,
    expression,
    freezeLivePreviewForManipulation,
    highlight,
    linked,
    mode,
    persistEditedEyeExpression,
    photoFlash,
    playbackStatus,
    previewCanvasExpression,
    previewExpressionDraft,
    previewSelectedBodyNode,
    previewSelectedLimb,
    renderedColors,
    renderedRotationGizmo,
    renderedScene,
    commitLimb,
    limbs,
    selectBodyNode,
    selectLimb,
    selectedBodyNode,
    selectedBodyNodeId,
    selectedLimb,
    selectedLimbId,
    selectedEyeSide,
    setEditing,
    setSelectedEyeSide,
    showWire,
    surface,
    t,
    stageBackground,
    takePicture,
    transitionToExpression,
    updateHighlight,
    updateImmediate,
  } = controller
  return (
    <motion.section
      ref={stageRef}
      className="stage-column"
      data-stage-tone={hexLuminance(stageBackground) > 0.48 ? 'light' : 'dark'}
      style={
        {
          '--avatar-body-color': renderedColors.body,
          '--avatar-eye-color': renderedColors.eyes,
          '--stage-background': stageBackground,
        } as CSSProperties
      }
    >
      <StudioIdentity
        className="stage-identity"
        language={controller.language}
        setLanguage={controller.setLanguage}
        t={t}
      />
      <AvatarCanvas
        expression={canvasExpression}
        avatarEyes={activeAvatarEyes}
        surface={surface}
        scene={renderedScene}
        colors={renderedColors}
        renderStyle={activeAvatar.renderStyle}
        look={activeAvatar}
        rotationGizmo={renderedRotationGizmo}
        showWire={showWire}
        bodyEditing={bodyEditing}
        selectedBodyNodeId={selectedBodyNodeId}
        selectedBodyNode={selectedBodyNode}
        selectedLimbId={selectedLimbId}
        selectedLimb={selectedLimb}
        limbs={limbs}
        selectedSide={selectedEyeSide}
        linked={linked}
        highlight={highlight}
        onHighlightChange={updateHighlight}
        onBodyNodeSelect={selectBodyNode}
        onBodyNodePreview={previewSelectedBodyNode}
        onBodyNodeChange={commitBodyNode}
        onLimbSelect={selectLimb}
        onLimbPreview={previewSelectedLimb}
        onLimbChange={commitLimb}
        onEyeSelect={setSelectedEyeSide}
        onPreview={previewCanvasExpression}
        onChange={editing ? previewExpressionDraft : updateImmediate}
        onReset={next => {
          if (editing) {
            setEditing(current => (current ? { ...current, draft: next } : current))
          }
          transitionToExpression(next)
        }}
        onEyeChange={
          editing ? previewExpressionDraft : bodyEditing ? persistEditedEyeExpression : undefined
        }
        playback={
          activeSequenceLabel && playbackStatus !== 'stopped'
            ? { name: activeSequenceLabel, status: playbackStatus }
            : null
        }
        onManipulationStart={freezeLivePreviewForManipulation}
        stageZoom={stageZoom}
      />
      {photoFlash > 0 && (
        <motion.div
          className="photo-flash"
          key={photoFlash}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.92, 0] }}
          transition={{ duration: 0.38, times: [0, 0.16, 1], ease: 'easeOut' }}
        />
      )}
      <TooltipProvider>
        <div className="photo-capture-bar">
          <Button
            className="photo-capture-button"
            type="button"
            aria-label={t('Prendre une photo')}
            onClick={takePicture}
          >
            <Camera />
            <span className="photo-capture-label">{t('Prendre une photo')}</span>
          </Button>
          <Tooltip
            open={photoHelpOpen}
            onOpenChange={open => {
              if (!open) setPhotoHelpOpen(false)
            }}
          >
            <TooltipTrigger
              closeOnClick={false}
              render={
                <Button
                  className="photo-help-button"
                  variant="secondary"
                  size="icon-sm"
                  type="button"
                  aria-label={t('Informations sur le mode photo')}
                  aria-expanded={photoHelpOpen}
                  onClick={() => setPhotoHelpOpen(open => !open)}
                />
              }
            >
              <Info />
            </TooltipTrigger>
            <TooltipContent side="top" className="photo-help-tooltip">
              {t('Tu peux modifier le format, le fond et la définition du mode photo dans Export.')}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </motion.section>
  )
}
