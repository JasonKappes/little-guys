import {
  hasCustomLook,
  mergeBundledAvatars,
  parseAvatarLibrary,
  parseExpressions,
  type AvatarBehaviorLibrary,
  type AvatarLibrary,
} from '../avatar/avatars'
import type { Expression } from '../avatar/geometry'
import {
  normalizeSequencesForExpressions,
  parseSequences,
  type AvatarSequence,
} from '../animation/sequences'
import defaultStudioDocument from './defaultStudioDocument.json'

export type StatePlaybackSelection = { stateId: string | null; playing: boolean }

export const defaultStageBackground = '#101316'
const hexColor = /^#[0-9a-f]{6}$/i

export const parseStageBackground = (value: unknown, fallback = defaultStageBackground) => {
  if (typeof value === 'string' && hexColor.test(value)) return value.toLowerCase()
  if (typeof fallback === 'string' && hexColor.test(fallback)) return fallback.toLowerCase()
  return defaultStageBackground
}

export type StudioDocument = {
  version: 2
  library: AvatarLibrary
  expressions: Expression[]
  sequences: AvatarSequence[]
  playback: StatePlaybackSelection
  stageBackground: string
  lookVersion: number
}

export const BUNDLED_LOOK_VERSION = 1

export type StudioDocumentPatch = Partial<Omit<StudioDocument, 'version'>>

const DOCUMENT_STORAGE_KEY = 'little-guys-studio-v2'
const LEGACY_DOCUMENT_STORAGE_KEY = 'bible-strong-avatar-studio-v2'

const defaultPlayback: StatePlaybackSelection = { stateId: 'idle', playing: true }

const parsePlayback = (
  value: unknown,
  fallback: StatePlaybackSelection = defaultPlayback
): StatePlaybackSelection => {
  const candidate = value as Partial<StatePlaybackSelection> | null
  if (!candidate || (typeof candidate.stateId !== 'string' && candidate.stateId !== null)) {
    return { ...fallback }
  }
  return { stateId: candidate.stateId, playing: candidate.playing === true }
}

export const parseStudioDocument = (value: unknown, fallback: StudioDocument): StudioDocument => {
  const candidate = value as Partial<StudioDocument> | null
  if (!candidate || candidate.version !== 2) return fallback
  const expressions =
    Array.isArray(candidate.expressions) && candidate.expressions.length
      ? parseExpressions(candidate.expressions)
      : fallback.expressions
  const sequences = Array.isArray(candidate.sequences)
    ? normalizeSequencesForExpressions(parseSequences(candidate.sequences), expressions)
    : fallback.sequences
  const baseBehavior: AvatarBehaviorLibrary = { expressions, sequences }
  const library = parseAvatarLibrary(candidate.library, fallback.library, baseBehavior)
  return {
    version: 2,
    library,
    expressions,
    sequences,
    playback: parsePlayback(candidate.playback, fallback.playback),
    stageBackground: parseStageBackground(candidate.stageBackground, fallback.stageBackground),
    lookVersion:
      typeof candidate.lookVersion === 'number' && Number.isFinite(candidate.lookVersion)
        ? candidate.lookVersion
        : 0,
  }
}

export const serializeStudioDocument = (document: StudioDocument) =>
  JSON.stringify(document, null, 2)

export const parseImportedStudioDocument = (
  source: string,
  fallback: StudioDocument
): StudioDocument => {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error('Invalid little guys project')
  }
  const candidate = value as Partial<StudioDocument> | null
  if (!candidate || candidate.version !== 2) {
    throw new Error('Unsupported little guys project')
  }
  if (
    !candidate.library ||
    !Array.isArray(candidate.library.avatars) ||
    !candidate.library.avatars.length ||
    !Array.isArray(candidate.expressions) ||
    !candidate.expressions.length ||
    !Array.isArray(candidate.sequences)
  ) {
    throw new Error('Invalid little guys project')
  }
  return parseStudioDocument(candidate, fallback)
}

const createBundledStudioDocument = () => {
  const snapshot = JSON.parse(JSON.stringify(defaultStudioDocument)) as StudioDocument
  return { ...parseStudioDocument(snapshot, snapshot), lookVersion: BUNDLED_LOOK_VERSION }
}

export const loadStudioDocument = (
  storage: Pick<Storage, 'getItem'> = window.localStorage
): StudioDocument => {
  const fallback = createBundledStudioDocument()
  try {
    const stored = JSON.parse(
      storage.getItem(DOCUMENT_STORAGE_KEY) ??
        storage.getItem(LEGACY_DOCUMENT_STORAGE_KEY) ??
        'null'
    )
    const loaded = parseStudioDocument(stored, fallback)
    const lookUpgradeIds =
      loaded === fallback || loaded.lookVersion >= BUNDLED_LOOK_VERSION
        ? new Set<string>()
        : new Set(
            loaded.library.avatars.filter(avatar => !hasCustomLook(avatar)).map(avatar => avatar.id)
          )
    const avatars = mergeBundledAvatars(
      loaded.library.avatars,
      fallback.library.avatars,
      lookUpgradeIds
    )
    const next = {
      ...loaded,
      lookVersion: BUNDLED_LOOK_VERSION,
      library: {
        ...loaded.library,
        avatars,
        activeAvatarId: avatars.some(avatar => avatar.id === loaded.library.activeAvatarId)
          ? loaded.library.activeAvatarId
          : avatars[0].id,
      },
    }
    return next
  } catch {
    return fallback
  }
}

export const persistStudioDocument = (document: StudioDocument) => {
  try {
    window.localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(document))
    window.localStorage.removeItem(LEGACY_DOCUMENT_STORAGE_KEY)
    return true
  } catch {
    // The in-memory document remains authoritative when storage is unavailable.
    return false
  }
}

export const createStudioDocumentStore = (
  initial: StudioDocument,
  persist: (document: StudioDocument) => void = persistStudioDocument
) => {
  let current = initial
  return {
    update: (patch: StudioDocumentPatch) => {
      const expressions = patch.expressions ?? current.expressions
      current = {
        ...current,
        ...patch,
        version: 2,
        expressions,
        sequences: normalizeSequencesForExpressions(
          patch.sequences ?? current.sequences,
          expressions
        ),
      }
      persist(current)
      return current
    },
  }
}
