import type { CategoryId } from './data'

export type ModelToolDefinition = {
  id: string
  category: CategoryId
  provider: 'apimodels'
  model: string
  displayName: string
  descriptionRu: string
  descriptionEn: string
  capabilities: string[]
}

export const MODEL_CATALOG: ModelToolDefinition[] = [
  {
    id: 'seedance-2-5',
    category: 'video',
    provider: 'apimodels',
    model: 'seedance-2.5',
    displayName: 'Seedance 2.5',
    descriptionRu: 'Генерация, референсы, редактирование и длинные ролики до 30 сек.',
    descriptionEn: 'Generation, references, editing and long clips up to 30 sec.',
    capabilities: ['text-to-video', 'image-to-video', 'video-edit', 'references', 'audio'],
  },
  {
    id: 'omni-flash',
    category: 'video',
    provider: 'apimodels',
    model: 'gemini-omni-1.1-flash',
    displayName: 'Omni Flash',
    descriptionRu: 'Быстрая генерация, first/last frame, референсы и video edit.',
    descriptionEn: 'Fast generation, first/last frame, references and video editing.',
    capabilities: ['text-to-video', 'image-to-video', 'first-last-frame', 'video-edit'],
  },
  {
    id: 'kling-v3',
    category: 'video',
    provider: 'apimodels',
    model: 'kling-v3',
    displayName: 'Kling V3',
    descriptionRu: 'Кинематографичное text/image-to-video, 720p/1080p и звук.',
    descriptionEn: 'Cinematic text/image-to-video, 720p/1080p and optional audio.',
    capabilities: ['text-to-video', 'image-to-video', 'audio'],
  },
  {
    id: 'kling-v3-omni',
    category: 'video',
    provider: 'apimodels',
    model: 'kling-v3-omni',
    displayName: 'Kling V3 Omni',
    descriptionRu: 'Мультимодальная генерация и редактирование видео с сохранением исходного звука.',
    descriptionEn: 'Multimodal generation and video editing with original-sound preservation.',
    capabilities: ['text-to-video', 'image-to-video', 'video-edit', 'references', 'audio'],
  },
  {
    id: 'kling-motion-control',
    category: 'video',
    provider: 'apimodels',
    model: 'kling-motion-control',
    displayName: 'Kling Motion',
    descriptionRu: 'Перенос движения: фотография персонажа + референс-видео движения.',
    descriptionEn: 'Motion transfer from a reference video to a character image.',
    capabilities: ['motion-transfer', 'image-to-video'],
  },
  {
    id: 'nano-banana-2',
    category: 'image',
    provider: 'apimodels',
    model: 'gemini-3.1-flash-image-preview',
    displayName: 'Nano Banana 2',
    descriptionRu: 'Основная модель изображений: генерация, edit и референсы.',
    descriptionEn: 'Main image model for generation, editing and references.',
    capabilities: ['text-to-image', 'image-edit', 'references'],
  },
  {
    id: 'nano-banana-pro',
    category: 'image',
    provider: 'apimodels',
    model: 'gemini-3-pro-image',
    displayName: 'Nano Banana Pro',
    descriptionRu: 'Премиум-качество для сложных референсов, рекламы и текста.',
    descriptionEn: 'Premium quality for complex references, ads and typography.',
    capabilities: ['text-to-image', 'image-edit', 'references', 'typography'],
  },
  {
    id: 'gpt-image-2-5',
    category: 'image',
    provider: 'apimodels',
    model: 'gpt-image-2.5-flare',
    displayName: 'GPT Image 2.5',
    descriptionRu: 'Точный edit, надписи, product shots и прозрачный PNG.',
    descriptionEn: 'Precise editing, typography, product shots and transparent PNG.',
    capabilities: ['text-to-image', 'image-edit', 'transparent', 'typography'],
  },
  {
    id: 'gpt-6-sol',
    category: 'text',
    provider: 'apimodels',
    model: 'gpt-6-sol',
    displayName: 'GPT-6 Sol',
    descriptionRu: 'Основная модель для промптов, сценариев и сложных текстов.',
    descriptionEn: 'Primary model for prompts, scripts and complex writing.',
    capabilities: ['chat', 'writing', 'reasoning'],
  },
  {
    id: 'gpt-6-luna',
    category: 'text',
    provider: 'apimodels',
    model: 'gpt-6-luna',
    displayName: 'GPT-6 Luna',
    descriptionRu: 'Быстрые подписи, переводы, рерайт и массовые задачи.',
    descriptionEn: 'Fast captions, translations, rewrites and high-volume tasks.',
    capabilities: ['chat', 'writing', 'translation'],
  },
  {
    id: 'claude-sonnet-5',
    category: 'text',
    provider: 'apimodels',
    model: 'claude-sonnet-5',
    displayName: 'Claude Sonnet 5',
    descriptionRu: 'Длинные документы, креативное письмо и большие контексты.',
    descriptionEn: 'Long documents, creative writing and large-context work.',
    capabilities: ['chat', 'writing', 'long-context'],
  },
  {
    id: 'suno-v5',
    category: 'audio',
    provider: 'apimodels',
    model: 'suno-v5',
    displayName: 'Suno v5',
    descriptionRu: 'Песни, инструменталы, lyrics, cover и музыкальные идеи.',
    descriptionEn: 'Songs, instrumentals, lyrics, covers and music concepts.',
    capabilities: ['music', 'song', 'instrumental'],
  },
  {
    id: 'elevenlabs-tts',
    category: 'audio',
    provider: 'apimodels',
    model: 'eleven-tts-v4',
    displayName: 'ElevenLabs',
    descriptionRu: 'Озвучка и естественная речь для роликов и контента.',
    descriptionEn: 'Natural speech and voice-over for videos and content.',
    capabilities: ['tts', 'voice-over'],
  },
  {
    id: 'kling-audio',
    category: 'audio',
    provider: 'apimodels',
    model: 'kling-sound-effects',
    displayName: 'Kling Audio',
    descriptionRu: 'Sound Effects и озвучивание немого видео.',
    descriptionEn: 'Sound effects and audio generation for silent video.',
    capabilities: ['sound-effects', 'video-to-audio'],
  },
]

export function getModelDefinition(id: string) {
  return MODEL_CATALOG.find((item) => item.id === id)
}
