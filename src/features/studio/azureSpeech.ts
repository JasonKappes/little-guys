import type { SpeechViseme } from '@/features/avatar/mouth'

export const DEFAULT_SPEECH_REGION = 'eastus'
export const DEFAULT_TALK_LANGUAGE = 'english'
export const DEFAULT_TALK_SPEED = 'normal'
export const DEFAULT_TALK_STYLE = 'neutral'

export const talkSpeeds = [
  { id: 'slow', rate: 0.7 },
  { id: 'easy', rate: 0.85 },
  { id: 'normal', rate: 1 },
  { id: 'fast', rate: 1.2 },
] as const

export const talkLanguages = ['english', 'spanish'] as const
export const talkStyles = ['neutral', 'friendly', 'cheerful', 'excited', 'whispering'] as const

export type TalkSpeed = (typeof talkSpeeds)[number]['id']
export type TalkLanguage = (typeof talkLanguages)[number]
export type TalkStyle = (typeof talkStyles)[number]

export const talkStyleLabels: Record<TalkStyle, string> = {
  neutral: 'Neutre',
  friendly: 'Amical',
  cheerful: 'Enjoué',
  excited: 'Excité',
  whispering: 'Chuchoté',
}

export const talkVoices: Record<
  TalkLanguage,
  { locale: string; voice: string; styles: readonly TalkStyle[] }
> = {
  english: {
    locale: 'en-US',
    voice: 'en-US-AvaNeural',
    styles: ['neutral', 'friendly', 'cheerful', 'excited', 'whispering'],
  },
  spanish: {
    locale: 'es-MX',
    voice: 'es-MX-JorgeNeural',
    styles: ['neutral', 'cheerful', 'excited', 'whispering'],
  },
}

export const DEFAULT_SPEECH_VOICE = talkVoices.english.voice

export type SpeechLine = {
  text: string
  language: TalkLanguage
  speed: TalkSpeed
  style: TalkStyle
  audio: Blob
  visemes: SpeechViseme[]
}

const SENTENCE_BREAK = '<break time="280ms"/>'

const ticksToSeconds = (ticks: number) => ticks / 10_000_000

export const isTalkSpeed = (value: string): value is TalkSpeed =>
  talkSpeeds.some(speed => speed.id === value)

export const isTalkLanguage = (value: string): value is TalkLanguage =>
  talkLanguages.some(language => language === value)

export const isTalkStyle = (value: string): value is TalkStyle =>
  talkStyles.some(style => style === value)

export const talkRate = (speed: TalkSpeed) =>
  talkSpeeds.find(item => item.id === speed)?.rate ?? 1

export const talkVoice = (language: TalkLanguage) => talkVoices[language]

export const talkStylesForLanguage = (language: TalkLanguage) => talkVoice(language).styles

export const resolveTalkStyle = (language: TalkLanguage, style: TalkStyle): TalkStyle =>
  talkStylesForLanguage(language).includes(style) ? style : DEFAULT_TALK_STYLE

export const escapeSsml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const withSentenceBreaks = (text: string) =>
  escapeSsml(text).replace(/([.!?…]+)(\s+|$)/g, `$1${SENTENCE_BREAK}$2`)

export const talkSsml = (
  text: string,
  speed: TalkSpeed,
  style: TalkStyle,
  language: TalkLanguage = DEFAULT_TALK_LANGUAGE
) => {
  const voice = talkVoice(language)
  const resolvedStyle = resolveTalkStyle(language, style)
  const inner = `<prosody rate="${talkRate(speed)}">${withSentenceBreaks(text)}</prosody>`
  const voiced =
    resolvedStyle === 'neutral'
      ? inner
      : `<mstts:express-as style="${resolvedStyle}">${inner}</mstts:express-as>`
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.locale}"><voice name="${voice.voice}">${voiced}</voice></speak>`
}

export const talkLineMatches = (
  line: SpeechLine,
  text: string,
  speed: TalkSpeed,
  style: TalkStyle,
  language: TalkLanguage
) =>
  line.text === text &&
  line.speed === speed &&
  line.style === style &&
  line.language === language

export const synthesizeTalkLine = async (
  key: string,
  region: string,
  text: string,
  speed: TalkSpeed = DEFAULT_TALK_SPEED,
  style: TalkStyle = DEFAULT_TALK_STYLE,
  language: TalkLanguage = DEFAULT_TALK_LANGUAGE
): Promise<SpeechLine> => {
  const trimmed = text.trim()
  if (!key.trim()) throw new Error('missing-key')
  if (!region.trim()) throw new Error('missing-region')
  if (!trimmed) throw new Error('missing-text')

  const sdk = await import('microsoft-cognitiveservices-speech-sdk')
  const voice = talkVoice(language)
  const resolvedStyle = resolveTalkStyle(language, style)
  const speechConfig = sdk.SpeechConfig.fromSubscription(key.trim(), region.trim())
  speechConfig.speechSynthesisLanguage = voice.locale
  speechConfig.speechSynthesisVoiceName = voice.voice
  speechConfig.speechSynthesisOutputFormat =
    sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null)
  const visemes: SpeechViseme[] = []
  synthesizer.visemeReceived = (_sender, event) => {
    visemes.push({ t: ticksToSeconds(event.audioOffset), id: event.visemeId })
  }

  try {
    const result = await new Promise<InstanceType<typeof sdk.SpeechSynthesisResult>>(
      (resolve, reject) => {
        synthesizer.speakSsmlAsync(
          talkSsml(trimmed, speed, resolvedStyle, language),
          next => resolve(next),
          error => reject(new Error(String(error)))
        )
      }
    )
    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
      throw new Error(result.errorDetails || 'synthesis-failed')
    }
    const audio = new Blob([result.audioData], { type: 'audio/mpeg' })
    if (!audio.size) throw new Error('synthesis-failed')
    return {
      text: trimmed,
      language,
      speed,
      style: resolvedStyle,
      audio,
      visemes: visemes.length ? visemes : [{ t: 0, id: 0 }],
    }
  } finally {
    synthesizer.close()
  }
}
