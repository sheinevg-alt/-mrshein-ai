import {
  AudioLines,
  AudioWaveform,
  BookOpen,
  Brush,
  Captions,
  Clapperboard,
  Eraser,
  Expand,
  FileText,
  Film,
  Hash,
  Headphones,
  ImageIcon,
  Languages,
  Layers,
  Lightbulb,
  Mail,
  Megaphone,
  MessageSquare,
  Mic,
  Music,
  Palette,
  PenLine,
  Play,
  ScanFace,
  Scissors,
  Type,
  Video,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import type { Locale } from './i18n'

export type CategoryId = 'video' | 'image' | 'audio' | 'text'
export type Badge = 'New' | 'Pro' | 'Popular'
export type TrendInputKind = 'photo' | 'video' | 'audio' | 'text'

export type LocalizedValue = {
  en: string
  ru?: string
}

export type Category = {
  id: CategoryId
  name: LocalizedValue
  tagline: LocalizedValue
  icon: LucideIcon
}

export type Tool = {
  id: string
  category: CategoryId
  name: LocalizedValue
  description: LocalizedValue
  icon: LucideIcon
  badge?: Badge
}

export type TrendInput = {
  id: string
  kind: TrendInputKind
  label: LocalizedValue
  hint?: LocalizedValue
  required: boolean
  tag?: string
  defaultAsset?: { url: string; name?: string }
  replaceable?: boolean
  removable?: boolean
}

export type Trend = {
  id: string
  title: LocalizedValue
  category: CategoryId
  image: string
  previewVideo?: string
  aspectRatio?: string
  uses: string
  tokens: number
  inputs: TrendInput[]
  resolutions?: Array<'480p' | '720p' | '1080p'>
  executionMode?: 'direct'
  cardBadge?: 'hit' | 'new' | 'popular'
}

export const TOKEN_BALANCE = 120

export function localize(value: LocalizedValue, locale: Locale) {
  return (locale === 'ru' ? value.ru : undefined) || value.en
}

export const categories: Category[] = [
  { id: 'video', name: { en: 'Video', ru: 'Видео' }, tagline: { en: 'Generate, edit & animate', ru: 'Генерация, монтаж и анимация' }, icon: Video },
  { id: 'image', name: { en: 'Image', ru: 'Изображения' }, tagline: { en: 'Create & enhance visuals', ru: 'Создание и улучшение визуала' }, icon: ImageIcon },
  { id: 'audio', name: { en: 'Audio', ru: 'Аудио' }, tagline: { en: 'Voice, music & sound', ru: 'Голос, музыка и звук' }, icon: AudioLines },
  { id: 'text', name: { en: 'Chat', ru: 'Чат' }, tagline: { en: 'GPT chat and AI assistants', ru: 'GPT-чат и AI-ассистенты' }, icon: Type },
]

const categoryTokens: Record<CategoryId, number> = { video: 40, image: 12, audio: 8, text: 2 }

export const tools: Tool[] = [
  { id: 'text-to-video', category: 'video', name: { en: 'Text to Video', ru: 'Текст в видео' }, description: { en: 'Turn a prompt into a short clip', ru: 'Создай короткое видео по описанию' }, icon: Clapperboard, badge: 'Popular' },
  { id: 'image-to-video', category: 'video', name: { en: 'Image to Video', ru: 'Фото в видео' }, description: { en: 'Bring a still photo to life', ru: 'Оживи статичное изображение' }, icon: Play, badge: 'New' },
  { id: 'lip-sync', category: 'video', name: { en: 'Lip Sync', ru: 'Lip Sync' }, description: { en: 'Match lips to any voice track', ru: 'Синхронизация губ с аудио' }, icon: ScanFace },
  { id: 'auto-captions', category: 'video', name: { en: 'Auto Captions', ru: 'Автосубтитры' }, description: { en: 'Accurate subtitles in seconds', ru: 'Точные субтитры за секунды' }, icon: Captions },
  { id: 'video-upscale', category: 'video', name: { en: 'Upscale', ru: 'Апскейл' }, description: { en: 'Sharpen footage up to 4K', ru: 'Улучшение качества видео до 4K' }, icon: Expand, badge: 'Pro' },
  { id: 'smart-cut', category: 'video', name: { en: 'Smart Cut', ru: 'Smart Cut' }, description: { en: 'Remove silences and pauses', ru: 'Убирает паузы и тишину' }, icon: Scissors },
  { id: 'video-remix', category: 'video', name: { en: 'Video Remix', ru: 'Видео Remix' }, description: { en: 'Restyle an existing clip', ru: 'Измени стиль готового видео' }, icon: Film },

  { id: 'text-to-image', category: 'image', name: { en: 'Text to Image', ru: 'Текст в изображение' }, description: { en: 'Generate images from a prompt', ru: 'Создай изображение по описанию' }, icon: WandSparkles, badge: 'Popular' },
  { id: 'remove-bg', category: 'image', name: { en: 'Remove Background', ru: 'Удалить фон' }, description: { en: 'Clean cutouts in one tap', ru: 'Аккуратно удалить фон в одно нажатие' }, icon: Eraser },
  { id: 'image-upscale', category: 'image', name: { en: 'Upscale', ru: 'Апскейл' }, description: { en: 'Increase resolution & detail', ru: 'Повысить разрешение и детализацию' }, icon: Expand },
  { id: 'style-transfer', category: 'image', name: { en: 'Style Transfer', ru: 'Перенос стиля' }, description: { en: 'Apply an artistic style', ru: 'Применить художественный стиль' }, icon: Palette, badge: 'New' },
  { id: 'face-swap', category: 'image', name: { en: 'Face Swap', ru: 'Face Swap' }, description: { en: 'Swap faces between photos', ru: 'Замена лица между фотографиями' }, icon: ScanFace, badge: 'Pro' },
  { id: 'inpaint', category: 'image', name: { en: 'Magic Edit', ru: 'Magic Edit' }, description: { en: 'Replace any part of an image', ru: 'Замени любую часть изображения' }, icon: Brush },
  { id: 'prompt-builder', category: 'image', name: { en: 'Prompt Builder', ru: 'Конструктор промптов' }, description: { en: 'Craft detailed image prompts', ru: 'Создавай детальные промпты' }, icon: Layers },

  { id: 'text-to-speech', category: 'audio', name: { en: 'Text to Speech', ru: 'Текст в речь' }, description: { en: 'Natural voices in many languages', ru: 'Естественные голоса на разных языках' }, icon: Volume2, badge: 'Popular' },
  { id: 'voice-clone', category: 'audio', name: { en: 'Voice Clone', ru: 'Клонирование голоса' }, description: { en: 'Create a digital copy of a voice', ru: 'Создай цифровую копию голоса' }, icon: Mic, badge: 'Pro' },
  { id: 'music-gen', category: 'audio', name: { en: 'Music Generator', ru: 'Генератор музыки' }, description: { en: 'Compose tracks from a mood', ru: 'Создавай музыку по настроению' }, icon: Music, badge: 'New' },
  { id: 'transcribe', category: 'audio', name: { en: 'Transcribe', ru: 'Транскрибация' }, description: { en: 'Convert speech into text', ru: 'Преобразуй речь в текст' }, icon: FileText },
  { id: 'noise-remove', category: 'audio', name: { en: 'Noise Removal', ru: 'Удаление шума' }, description: { en: 'Studio-clean recordings', ru: 'Очисти запись от посторонних шумов' }, icon: AudioWaveform },
  { id: 'stem-split', category: 'audio', name: { en: 'Stem Splitter', ru: 'Разделение дорожек' }, description: { en: 'Separate vocals & instruments', ru: 'Раздели вокал и инструменты' }, icon: Headphones },

  { id: 'ai-chat', category: 'text', name: { en: 'AI Chat', ru: 'AI Чат' }, description: { en: 'Ask anything, get clear answers', ru: 'Задавай вопросы и получай ответы' }, icon: MessageSquare, badge: 'Popular' },
  { id: 'copywriter', category: 'text', name: { en: 'Copywriter', ru: 'Копирайтер' }, description: { en: 'Ads, posts and product copy', ru: 'Реклама, посты и описания продуктов' }, icon: Megaphone },
  { id: 'translator', category: 'text', name: { en: 'Translator', ru: 'Переводчик' }, description: { en: 'Translate with natural tone', ru: 'Естественный перевод текста' }, icon: Languages },
  { id: 'summarizer', category: 'text', name: { en: 'Summarizer', ru: 'Саммари' }, description: { en: 'Key points from long text', ru: 'Главное из длинного текста' }, icon: BookOpen },
  { id: 'rewriter', category: 'text', name: { en: 'Rewriter', ru: 'Рерайтер' }, description: { en: 'Improve clarity and style', ru: 'Улучшай стиль и ясность текста' }, icon: PenLine, badge: 'New' },
  { id: 'hashtags', category: 'text', name: { en: 'Hashtags', ru: 'Хэштеги' }, description: { en: 'Captions & tags for socials', ru: 'Подписи и теги для соцсетей' }, icon: Hash },
  { id: 'email-writer', category: 'text', name: { en: 'Email Writer', ru: 'Письма' }, description: { en: 'Professional emails fast', ru: 'Профессиональные письма быстро' }, icon: Mail },
  { id: 'idea-gen', category: 'text', name: { en: 'Idea Generator', ru: 'Генератор идей' }, description: { en: 'Content ideas on demand', ru: 'Идеи для контента по запросу' }, icon: Lightbulb },
]

const defaultPhotoInput: TrendInput = {
  id: 'photo',
  kind: 'photo',
  label: { en: 'Photo', ru: 'Фото' },
  hint: { en: 'Use a clear, well-lit image', ru: 'Лучше использовать чёткое фото с хорошим светом' },
  required: true,
}

export const fallbackTrends: Trend[] = [
  { id: 'action-figure', title: { en: 'Action Figure Pack', ru: 'Action Figure Pack' }, category: 'image', image: '/trends/action-figure.png', uses: '48.2K', tokens: 15, inputs: [defaultPhotoInput] },
  { id: 'cinematic-portrait', title: { en: 'Cinematic Portrait', ru: 'Cinematic Portrait' }, category: 'image', image: '/trends/cinematic-portrait.png', uses: '31.7K', tokens: 12, inputs: [defaultPhotoInput] },
  { id: 'anime-style', title: { en: 'Anime Dusk', ru: 'Anime Dusk' }, category: 'image', image: '/trends/anime-style.png', uses: '27.9K', tokens: 10, inputs: [defaultPhotoInput] },
  { id: 'neon-city', title: { en: 'City Night Flythrough', ru: 'City Night Flythrough' }, category: 'video', image: '/trends/neon-city.png', uses: '19.4K', tokens: 35, inputs: [defaultPhotoInput] },
  { id: 'luxury-product', title: { en: 'Luxury Product Shot', ru: 'Luxury Product Shot' }, category: 'image', image: '/trends/luxury-product.png', uses: '15.1K', tokens: 12, inputs: [defaultPhotoInput] },
  { id: 'retro-polaroid', title: { en: '90s Polaroid', ru: '90s Polaroid' }, category: 'image', image: '/trends/retro-polaroid.png', uses: '12.6K', tokens: 8, inputs: [defaultPhotoInput] },
]

export function getCategory(id: CategoryId) {
  return categories.find((c) => c.id === id)!
}

export function getToolsByCategory(id: CategoryId) {
  return tools.filter((tool) => tool.category === id)
}

export function getToolTokens(tool: Tool) {
  const base = categoryTokens[tool.category]
  return tool.badge === 'Pro' ? base * 2 : base
}
