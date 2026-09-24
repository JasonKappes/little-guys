import { createAvatar } from '@/features/avatar/avatars'
import { createInitialSequences } from '@/features/animation/sequences'
import { initialExpressions } from '@/features/avatar/presets'
import { escapeSsml, talkLineMatches, talkSsml } from '@/features/studio/azureSpeech'
import {
  createStudioDocumentStore,
  loadStudioDocument,
  parseImportedStudioDocument,
  serializeStudioDocument,
  type StudioDocument,
} from '@/features/studio/studioDocument'

const documentFixture = (): StudioDocument => {
  const avatar = createAvatar('Strobi')
  return {
    version: 2,
    library: {
      activeAvatarId: avatar.id,
      avatars: [avatar],
    },
    expressions: initialExpressions,
    sequences: createInitialSequences(),
    playback: { stateId: 'idle', playing: true },
    stageBackground: '#101316',
    lookVersion: 1,
  }
}

describe('Studio document', () => {
  const storage = (value: string | null = null) => ({ getItem: () => value })

  it('loads the bundled Studio snapshot when no local project exists', () => {
    const document = loadStudioDocument(storage())

    expect(document.library.avatars).toHaveLength(22)
    expect(document.library.activeAvatarId).toBe(document.library.avatars[0].id)
    expect(document.library.avatars.map(avatar => avatar.name)).toEqual([
      'Strobi',
      'Strobek',
      'Strobar',
      'Freddy',
      'Citrus',
      'Nova',
      'Grok bot',
      'Sunee',
      'Kirby',
      'Cloudee',
      'Cubee',
      'Cuborn',
      'Cuboss',
      'Onee',
      'Onex',
      'Onara',
      'Zappi',
      'Zapplin',
      'Zapperon',
      'Budi',
      'Budwick',
      'Bloomarch',
    ])
    expect(document.library.avatars[0].name).toBe('Strobi')
    expect(document.expressions).toHaveLength(27)
    expect(document.sequences).toHaveLength(23)
    expect(document.playback).toEqual({ stateId: 'proud', playing: true })
    expect(document.stageBackground).toBe('#101316')
  })

  it('keeps a saved stage background and repairs a missing one', () => {
    const localDocument = { ...documentFixture(), stageBackground: '#f4e8d4' }

    expect(loadStudioDocument(storage(JSON.stringify(localDocument))).stageBackground).toBe(
      '#f4e8d4'
    )

    const { stageBackground: _ignored, ...withoutBackground } = documentFixture()
    expect(loadStudioDocument(storage(JSON.stringify(withoutBackground))).stageBackground).toBe(
      '#101316'
    )
  })

  it('keeps local avatar edits and adds missing bundled evolution forms', () => {
    const localDocument = documentFixture()
    const loaded = loadStudioDocument(storage(JSON.stringify(localDocument)))

    expect(
      loaded.library.avatars.some(avatar => avatar.id === localDocument.library.avatars[0].id)
    ).toBe(true)
    expect(loaded.library.avatars.map(avatar => avatar.name)).toEqual(
      expect.arrayContaining(['Strobi', 'Strobek', 'Strobar', 'Cubee', 'Cuborn', 'Onee', 'Onara'])
    )
    expect(loaded.playback).toEqual(localDocument.playback)
    expect(loaded.stageBackground).toBe(localDocument.stageBackground)
  })

  it('inserts evolution forms next to an older local cast without overwriting edits', () => {
    const bundled = loadStudioDocument(storage())
    const strobi = bundled.library.avatars.find(avatar => avatar.id === 'strobi')
    if (!strobi) throw new Error('missing strobi')
    const older = {
      ...bundled,
      library: {
        ...bundled.library,
        avatars: bundled.library.avatars
          .filter(
            avatar =>
              !['strobek', 'strobar', 'cuborn', 'cuboss', 'onex', 'onara'].includes(avatar.id)
          )
          .map(avatar =>
            avatar.id === 'strobi'
              ? { ...avatar, colors: { ...avatar.colors, body: '#ff00aa' } }
              : avatar
          ),
      },
    }
    const loaded = loadStudioDocument(storage(JSON.stringify(older)))

    expect(loaded.library.avatars.map(avatar => avatar.name).slice(0, 3)).toEqual([
      'Strobi',
      'Strobek',
      'Strobar',
    ])
    expect(loaded.library.avatars.find(avatar => avatar.id === 'strobi')?.colors.body).toBe(
      '#ff00aa'
    )
    expect(loaded.library.avatars).toHaveLength(22)
  })

  it('gives saved bundled avatars their new look once, without touching their shape or colors', () => {
    const bundled = loadStudioDocument(storage())
    const legacy = JSON.parse(JSON.stringify(bundled))
    delete legacy.lookVersion
    legacy.library.avatars = legacy.library.avatars.map(
      (avatar: Record<string, unknown> & { id: string; body: { limbs: object[] } }) => {
        const { palette: _palette, shading: _shading, markings: _markings, ...rest } = avatar
        void _palette
        void _shading
        void _markings
        return avatar.id === 'strobar'
          ? {
              ...rest,
              colors: { body: '#00ff88', eyes: '#111316' },
              body: {
                ...avatar.body,
                limbs: avatar.body.limbs.map(limb => {
                  const { paint: _paint, ...plain } = limb as { paint?: unknown }
                  void _paint
                  return plain
                }),
              },
            }
          : rest
      }
    )
    const loaded = loadStudioDocument(storage(JSON.stringify(legacy)))
    const strobar = loaded.library.avatars.find(avatar => avatar.id === 'strobar')
    const reference = bundled.library.avatars.find(avatar => avatar.id === 'strobar')

    expect(strobar?.colors.body).toBe('#00ff88')
    expect(strobar?.markings).toEqual(reference?.markings)
    expect(strobar?.palette).toEqual(reference?.palette)
    expect(strobar?.body.limbs.find(limb => limb.kind === 'horn')?.paint?.tip).toBe('accent')

    const edited = JSON.parse(JSON.stringify(bundled))
    edited.library.avatars[0].markings = []
    const kept = loadStudioDocument(storage(JSON.stringify(edited)))
    expect(kept.library.avatars[0].markings).toEqual([])
  })

  it('persists one coherent document after a mutation', () => {
    const persisted: StudioDocument[] = []
    const store = createStudioDocumentStore(documentFixture(), value => persisted.push(value))

    store.update({ playback: { stateId: 'idle', playing: false } })

    expect(persisted).toHaveLength(1)
    expect(persisted[0].playback).toEqual({ stateId: 'idle', playing: false })
    expect(persisted[0].expressions).toHaveLength(initialExpressions.length)
  })

  it('repairs sequence references in the same transaction as expression deletion', () => {
    const store = createStudioDocumentStore(documentFixture(), () => undefined)
    const remainingExpressions = initialExpressions.slice(1)

    const next = store.update({ expressions: remainingExpressions })

    expect(
      next.sequences.every(sequence =>
        sequence.steps.every(step =>
          remainingExpressions.some(item => item.id === step.expressionId)
        )
      )
    ).toBe(true)
  })

  it('round-trips a complete project document as portable JSON', () => {
    const document = documentFixture()
    const expression = { ...initialExpressions[0], widthLeft: 42 }
    const sequence = {
      ...createInitialSequences()[0],
      steps: createInitialSequences()[0].steps.map(step => ({
        ...step,
        expressionId: expression.id,
      })),
    }
    document.library.avatars[0].behavior = {
      expressions: [expression],
      sequences: [sequence],
    }

    const imported = parseImportedStudioDocument(serializeStudioDocument(document), document)

    expect(imported).toEqual(document)
    expect(imported.library.avatars[0].behavior?.expressions[0].widthLeft).toBe(42)
  })

  it('keeps the base library unchanged when an avatar owns customized behavior', () => {
    const document = documentFixture()
    const avatar = document.library.avatars[0]
    const customized = {
      ...avatar,
      behavior: {
        expressions: [{ ...initialExpressions[0], widthLeft: 47 }],
        sequences: createInitialSequences().slice(0, 1),
      },
    }
    const store = createStudioDocumentStore(document, () => undefined)

    const next = store.update({
      library: { activeAvatarId: avatar.id, avatars: [customized] },
    })

    expect(next.expressions[0].widthLeft).toBe(initialExpressions[0].widthLeft)
    expect(next.library.avatars[0].behavior?.expressions[0].widthLeft).toBe(47)
  })

  it('rejects files that are not versioned Studio projects', () => {
    const fallback = documentFixture()

    expect(() => parseImportedStudioDocument('{"version":1}', fallback)).toThrow(
      'Unsupported little guys project'
    )
    expect(() => parseImportedStudioDocument('{broken', fallback)).toThrow(
      'Invalid little guys project'
    )
  })

  it('repairs an imported active avatar and missing expression references', () => {
    const fallback = documentFixture()
    const avatar = createAvatar('Portable')
    const imported = parseImportedStudioDocument(
      JSON.stringify({
        ...fallback,
        library: { activeAvatarId: 'missing', avatars: [avatar] },
        sequences: [
          {
            ...createInitialSequences()[0],
            steps: [{ ...createInitialSequences()[0].steps[0], expressionId: 'missing' }],
          },
        ],
      }),
      fallback
    )

    expect(imported.library.activeAvatarId).toBe(avatar.id)
    expect(imported.sequences[0].steps[0].expressionId).toBe(imported.expressions[0].id)
  })

  it('sanitizes imported animation timing and playback values', () => {
    const fallback = documentFixture()
    const imported = parseImportedStudioDocument(
      JSON.stringify({
        ...fallback,
        sequences: [
          {
            ...fallback.sequences[0],
            playbackMode: 'unsupported',
            steps: [
              {
                ...fallback.sequences[0].steps[0],
                holdMs: -500,
                transitionMs: Number.POSITIVE_INFINITY,
              },
            ],
          },
        ],
      }),
      fallback
    )

    expect(imported.sequences[0].playbackMode).toBe('loop')
    expect(imported.sequences[0].steps[0].holdMs).toBeGreaterThanOrEqual(100)
    expect(Number.isFinite(imported.sequences[0].steps[0].transitionMs)).toBe(true)
  })
})

describe('Azure talk settings', () => {
  it('wraps a line in SSML with speed, tone, and safe text', () => {
    const ssml = talkSsml('Hi <you> & me. Next.', 'slow', 'friendly', 'english')

    expect(ssml).toContain('rate="0.7"')
    expect(ssml).toContain('style="friendly"')
    expect(ssml).toContain('Hi &lt;you&gt; &amp; me.')
    expect(ssml).toContain('<break time="280ms"/>')
    expect(ssml).toContain('en-US-AvaNeural')
    expect(ssml).toContain('xml:lang="en-US"')
  })

  it('uses a Spanish male voice and drops styles that voice cannot speak', () => {
    const ssml = talkSsml('Hola. ¿Qué tal?', 'easy', 'friendly', 'spanish')

    expect(ssml).toContain('es-MX-JorgeNeural')
    expect(ssml).toContain('xml:lang="es-MX"')
    expect(ssml).not.toContain('style="friendly"')
    expect(ssml).toContain('Hola.')
  })

  it('skips a speaking style for a neutral tone', () => {
    expect(talkSsml('Hello.', 'normal', 'neutral')).not.toContain('express-as')
    expect(escapeSsml('a <b> & "c"')).toBe('a &lt;b&gt; &amp; &quot;c&quot;')
  })

  it('treats a cached line as stale when speed, tone, or language changes', () => {
    const line = {
      text: 'Hello',
      language: 'english' as const,
      speed: 'normal' as const,
      style: 'neutral' as const,
      audio: new Blob(),
      visemes: [{ t: 0, id: 0 }],
    }

    expect(talkLineMatches(line, 'Hello', 'normal', 'neutral', 'english')).toBe(true)
    expect(talkLineMatches(line, 'Hello', 'slow', 'neutral', 'english')).toBe(false)
    expect(talkLineMatches(line, 'Hello', 'normal', 'friendly', 'english')).toBe(false)
    expect(talkLineMatches(line, 'Hello', 'normal', 'neutral', 'spanish')).toBe(false)
  })
})
