import { ChevronDown, ChevronUp, Copy, Dices, Shuffle, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useStudioLanguage } from '@/i18n'

import { InspectorCard, PanelTitle } from '@/app/components/common'
import { AmbientMotionField, ColorField, NumericField } from '@/app/components/controls'
import {
  defaultLimbPaint,
  limbRingCountRange,
  limbTipLengthRange,
  type LimbPaint,
} from '@/features/avatar/limbs'
import {
  markingKindLabels,
  markingPresetIds,
  markingPresetLabels,
  markingRanges,
  markingShapeLabels,
  markingShapes,
  MAX_MARKINGS,
  type Marking,
  type MarkingPresetId,
  type MarkingShape,
} from '@/features/avatar/markings'
import {
  isPaintRole,
  paintRoleLabels,
  paintRoles,
  paletteHarmonies,
  paletteHarmonyLabels,
  resolvePaintRef,
  shadingAmountRange,
  shadingAngleRange,
  shadingHighlightRange,
  shadingSizeRange,
  suggestPalette,
  type AvatarPalette,
  type AvatarShading,
  type PaintColors,
  type PaintRef,
  type PaletteHarmony,
} from '@/features/avatar/paint'

export function PaintPicker({
  label,
  value,
  colors,
  onChange,
  noneLabel,
}: {
  label: string
  value: PaintRef | null
  colors: PaintColors
  onChange: (next: PaintRef | null) => void
  noneLabel?: string
}) {
  const { t } = useStudioLanguage()
  const custom = value !== null && !isPaintRole(value)
  return (
    <div className="paint-picker">
      <span className="paint-picker-label">{t(label)}</span>
      <div className="paint-picker-options" role="group" aria-label={t(label)}>
        {noneLabel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="paint-option paint-option-none"
            aria-pressed={value === null}
            onClick={() => onChange(null)}
          >
            <i aria-hidden="true" />
            <span>{t(noneLabel)}</span>
          </Button>
        )}
        {paintRoles.map(role => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            key={role}
            className="paint-option"
            aria-pressed={value === role}
            onClick={() => onChange(role)}
          >
            <i aria-hidden="true" style={{ background: colors[role] }} />
            <span>{t(paintRoleLabels[role])}</span>
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="paint-option"
          aria-pressed={custom}
          onClick={() =>
            onChange(
              (value ? resolvePaintRef(value, colors) : colors.accent).toLowerCase() as PaintRef
            )
          }
        >
          <i
            aria-hidden="true"
            className="paint-option-custom"
            style={custom ? { background: value } : undefined}
          />
          <span>{t('Autre')}</span>
        </Button>
      </div>
      {custom && (
        <ColorField
          label={`${t(label)} · ${t('Autre')}`}
          value={value}
          onChange={next => onChange(next as PaintRef)}
        />
      )}
    </div>
  )
}

export function PalettePanel({
  body,
  palette,
  colors,
  onBodyChange,
  onPaletteChange,
  onHarmony,
  onRandomize,
}: {
  body: string
  palette: AvatarPalette
  colors: PaintColors
  onBodyChange: (body: string) => void
  onPaletteChange: (changes: Partial<AvatarPalette>) => void
  onHarmony: (harmony: PaletteHarmony) => void
  onRandomize: () => void
}) {
  const { t } = useStudioLanguage()
  return (
    <InspectorCard className="palette-panel">
      <PanelTitle
        level={3}
        title="Palette"
        subtitle="Deux couleurs d’accent que les parties et les motifs peuvent réutiliser."
      />
      <ColorField label="Corps" value={body} onChange={onBodyChange} />
      <ColorField
        label="Accent"
        value={palette.accent}
        onChange={accent => onPaletteChange({ accent })}
      />
      <ColorField
        label="Accent 2"
        value={palette.accent2}
        onChange={accent2 => onPaletteChange({ accent2 })}
      />
      <div className="palette-swatches" aria-hidden="true">
        {paintRoles.map(role => (
          <i key={role} style={{ background: colors[role] }} />
        ))}
      </div>
      <div className="palette-harmonies">
        <span>{t('Harmonies suggérées')}</span>
        <div>
          {paletteHarmonies.map(harmony => {
            const preview = suggestPalette(body, harmony)
            return (
              <Button
                type="button"
                variant="outline"
                size="sm"
                key={harmony}
                className="palette-harmony"
                onClick={() => onHarmony(harmony)}
              >
                <span className="palette-harmony-swatches" aria-hidden="true">
                  <i style={{ background: body }} />
                  <i style={{ background: preview.accent }} />
                  <i style={{ background: preview.accent2 }} />
                </span>
                <span>{t(paletteHarmonyLabels[harmony])}</span>
              </Button>
            )
          })}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onRandomize}>
          <Shuffle /> {t('Palette surprise')}
        </Button>
      </div>
    </InspectorCard>
  )
}

export function ShadingPanel({
  shading,
  onChange,
}: {
  shading: AvatarShading
  onChange: (changes: Partial<AvatarShading>) => void
}) {
  return (
    <InspectorCard className="shading-panel">
      <PanelTitle
        level={3}
        title="Ombrage cartoon"
        subtitle="Une ombre franche et un reflet qui suivent la silhouette, par-dessus n’importe quel rendu."
      />
      <div className="surface-fields">
        <NumericField
          label="Ombre"
          value={shading.amount}
          min={shadingAmountRange.min}
          max={shadingAmountRange.max}
          step={1}
          unit="%"
          onChange={amount => onChange({ amount })}
        />
        <NumericField
          label="Reflet"
          value={shading.highlight}
          min={shadingHighlightRange.min}
          max={shadingHighlightRange.max}
          step={1}
          unit="%"
          onChange={highlight => onChange({ highlight })}
        />
        <NumericField
          label="Épaisseur de l’ombre"
          value={shading.size}
          min={shadingSizeRange.min}
          max={shadingSizeRange.max}
          step={1}
          unit="u"
          onChange={size => onChange({ size })}
        />
        <NumericField
          label="Direction de la lumière"
          value={shading.angle}
          min={shadingAngleRange.min}
          max={shadingAngleRange.max}
          step={1}
          unit="°"
          onChange={angle => onChange({ angle })}
        />
      </div>
      <ColorField
        label="Couleur de l’ombre"
        value={shading.color}
        onChange={color => onChange({ color })}
      />
    </InspectorCard>
  )
}

function MarkingGlyph({ preset }: { preset: MarkingPresetId }) {
  const mark = {
    belly: <ellipse cx="12" cy="16" rx="6" ry="5" />,
    muzzle: <ellipse cx="12" cy="14.5" rx="5.5" ry="3.2" />,
    mask: <rect x="4.5" y="9" width="15" height="4.5" rx="2" />,
    blush: (
      <>
        <ellipse cx="7" cy="14" rx="2.4" ry="1.5" />
        <ellipse cx="17" cy="14" rx="2.4" ry="1.5" />
      </>
    ),
    gem: <path d="M12 4.5 14.2 8 12 11.5 9.8 8Z" />,
    star: <path d="m12 4 1.3 2.9 3.1.3-2.4 2 .8 3.1L12 10.6l-2.8 1.7.8-3.1-2.4-2 3.1-.3Z" />,
    heart: (
      <path d="M12 18s-4.5-2.8-4.5-5.6A2.3 2.3 0 0 1 12 11.3a2.3 2.3 0 0 1 4.5 1.1C16.5 15.2 12 18 12 18Z" />
    ),
    moon: <path d="M13.5 4.2a4 4 0 1 0 0 7.6 3.2 3.2 0 1 1 0-7.6Z" />,
    spots: (
      <>
        <circle cx="8" cy="9" r="1.8" />
        <circle cx="15" cy="7.5" r="1.4" />
        <circle cx="14.5" cy="14" r="2" />
        <circle cx="8.5" cy="15" r="1.2" />
      </>
    ),
    stripes: (
      <>
        <path d="M5 8.5c4-2 10-2 14 0v2c-4-2-10-2-14 0Z" />
        <path d="M4 13.5c5-2 11-2 16 0v2c-5-2-11-2-16 0Z" />
      </>
    ),
    'top-tone': <path d="M4 11a8 8 0 0 1 16 0c-5-1.8-11-1.8-16 0Z" />,
    'bottom-tone': <path d="M4 13c5 1.8 11 1.8 16 0a8 8 0 0 1-16 0Z" />,
    shine: <ellipse cx="8.5" cy="8" rx="2.2" ry="1.3" transform="rotate(-30 8.5 8)" fill="#fff" />,
  }[preset]
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="marking-glyph">
      <circle cx="12" cy="12" r="8.5" className="marking-glyph-body" />
      <g className="marking-glyph-mark">{mark}</g>
    </svg>
  )
}

export function MarkingsPanel({
  markings,
  selectedId,
  colors,
  onSelect,
  onAdd,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
}: {
  markings: Marking[]
  selectedId: string | null
  colors: PaintColors
  onSelect: (id: string | null) => void
  onAdd: (preset: MarkingPresetId) => void
  onChange: (next: Marking) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
}) {
  const { t } = useStudioLanguage()
  const selected = markings.find(marking => marking.id === selectedId) ?? null
  const update = (changes: Partial<Marking>) => selected && onChange({ ...selected, ...changes })
  const stripes = selected?.kind === 'stripes'
  return (
    <InspectorCard className="markings-panel">
      <PanelTitle
        level={3}
        title="Motifs"
        subtitle="Taches, rayures, gemmes et zones bicolores qui épousent la forme principale en 3D."
      />
      <div className="body-add">
        <span>
          {t('Ajouter un motif')} · {markings.length}/{MAX_MARKINGS}
        </span>
        <div className="marking-presets">
          {markingPresetIds.map(preset => (
            <Button
              className="surface-card body-add-card marking-preset"
              variant="outline"
              type="button"
              key={preset}
              disabled={markings.length >= MAX_MARKINGS}
              onClick={() => onAdd(preset)}
            >
              <MarkingGlyph preset={preset} />
              <span>{t(markingPresetLabels[preset])}</span>
            </Button>
          ))}
        </div>
      </div>
      {markings.length > 0 && (
        <div className="body-tree marking-list">
          {markings.map(marking => (
            <Button
              variant="outline"
              type="button"
              key={marking.id}
              aria-pressed={marking.id === selectedId}
              onClick={() => onSelect(marking.id === selectedId ? null : marking.id)}
            >
              <span
                className="body-node-icon marking-list-swatch"
                style={{ background: resolvePaintRef(marking.paint, colors) }}
              />
              <span>
                <strong>{t(marking.name)}</strong>
                <small>
                  {t(markingKindLabels[marking.kind])}
                  {marking.kind !== 'stripes' ? ` · ${t(markingShapeLabels[marking.shape])}` : ''}
                </small>
              </span>
            </Button>
          ))}
        </div>
      )}
      {selected && (
        <div className="body-node-editor marking-editor">
          <div className="body-node-actions">
            <strong>{t(selected.name)}</strong>
            <div>
              <Button
                variant="outline"
                size="icon-sm"
                type="button"
                aria-label={t('Monter')}
                onClick={() => onMove(selected.id, 1)}
              >
                <ChevronUp />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                type="button"
                aria-label={t('Descendre')}
                onClick={() => onMove(selected.id, -1)}
              >
                <ChevronDown />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                type="button"
                aria-label={t('Dupliquer')}
                disabled={markings.length >= MAX_MARKINGS}
                onClick={() => onDuplicate(selected.id)}
              >
                <Copy />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                type="button"
                aria-label={t('Supprimer')}
                onClick={() => onDelete(selected.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          <PaintPicker
            label="Couleur"
            value={selected.paint}
            colors={colors}
            onChange={paint => paint && update({ paint })}
          />
          {!stripes && (
            <AmbientMotionField<MarkingShape>
              label="Forme"
              value={selected.shape}
              options={markingShapes.map(shape => ({
                value: shape,
                label: markingShapeLabels[shape],
              }))}
              onChange={shape => update({ shape })}
            />
          )}
          <div className="surface-fields">
            <NumericField
              label="Horizontale"
              value={selected.yaw}
              min={markingRanges.yaw.min}
              max={markingRanges.yaw.max}
              step={1}
              unit="°"
              onChange={yaw => update({ yaw })}
            />
            <NumericField
              label="Verticale"
              value={selected.pitch}
              min={markingRanges.pitch.min}
              max={markingRanges.pitch.max}
              step={1}
              unit="°"
              onChange={pitch => update({ pitch })}
            />
            <NumericField
              label={stripes ? 'Étendue' : 'Largeur'}
              value={selected.width}
              min={markingRanges.width.min}
              max={markingRanges.width.max}
              step={1}
              unit="°"
              onChange={width => update({ width })}
            />
            <NumericField
              label={stripes ? 'Épaisseur' : 'Hauteur'}
              value={selected.height}
              min={markingRanges.height.min}
              max={markingRanges.height.max}
              step={1}
              unit="°"
              onChange={height => update({ height })}
            />
            <NumericField
              label="Rotation"
              value={selected.rotation}
              min={markingRanges.rotation.min}
              max={markingRanges.rotation.max}
              step={1}
              unit="°"
              onChange={rotation => update({ rotation })}
            />
            <NumericField
              label="Opacité"
              value={Math.round(selected.opacity * 100)}
              min={markingRanges.opacity.min}
              max={markingRanges.opacity.max}
              step={1}
              unit="%"
              onChange={opacity => update({ opacity: opacity / 100 })}
            />
            {selected.kind !== 'decal' && (
              <NumericField
                label="Nombre"
                value={selected.count}
                min={markingRanges.count.min}
                max={markingRanges.count.max}
                step={1}
                onChange={count => update({ count: Math.round(count) })}
              />
            )}
          </div>
          <div className="marking-toggles">
            <label className="marking-toggle">
              <Switch
                checked={selected.mirror}
                onCheckedChange={mirror => update({ mirror })}
                aria-label={t('Symétrie')}
              />
              <span>{t('Symétrie')}</span>
            </label>
            {selected.kind === 'spots' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update({ seed: Math.floor(Math.random() * 1_000_000) })}
              >
                <Dices /> {t('Nouveau tirage')}
              </Button>
            )}
          </div>
        </div>
      )}
    </InspectorCard>
  )
}

export function LimbPaintEditor({
  paint,
  colors,
  onChange,
}: {
  paint: LimbPaint | undefined
  colors: PaintColors
  onChange: (next: LimbPaint) => void
}) {
  const current = paint ?? defaultLimbPaint
  const update = (changes: Partial<LimbPaint>) => onChange({ ...current, ...changes })
  return (
    <div className="part-paint-editor">
      <PaintPicker
        label="Couleur de la partie"
        value={current.base}
        colors={colors}
        onChange={base => base && update({ base })}
      />
      <PaintPicker
        label="Pointe"
        value={current.tip}
        colors={colors}
        noneLabel="Aucune"
        onChange={tip => update({ tip })}
      />
      {current.tip && (
        <NumericField
          label="Longueur de la pointe"
          value={Math.round(current.tipLength * 100)}
          min={limbTipLengthRange.min}
          max={limbTipLengthRange.max}
          step={1}
          unit="%"
          onChange={value => update({ tipLength: value / 100 })}
        />
      )}
      <PaintPicker
        label="Anneaux"
        value={current.rings}
        colors={colors}
        noneLabel="Aucun"
        onChange={rings => update({ rings })}
      />
      {current.rings && (
        <NumericField
          label="Nombre d’anneaux"
          value={current.ringCount}
          min={limbRingCountRange.min}
          max={limbRingCountRange.max}
          step={1}
          onChange={value => update({ ringCount: Math.round(value) })}
        />
      )}
    </div>
  )
}

export function NodePaintEditor({
  paint,
  colors,
  onChange,
}: {
  paint: PaintRef | undefined
  colors: PaintColors
  onChange: (next: PaintRef) => void
}) {
  return (
    <div className="part-paint-editor">
      <PaintPicker
        label="Couleur de la forme"
        value={paint ?? 'body'}
        colors={colors}
        onChange={next => next && onChange(next)}
      />
    </div>
  )
}
