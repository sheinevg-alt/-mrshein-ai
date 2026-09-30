export type KnowledgeCategory = 'getting-started' | 'generation' | 'tokens' | 'account'

export type KnowledgeArticle = {
  id: string
  slug: string
  category: KnowledgeCategory
  title: { en: string; ru?: string }
  body: { en: string; ru?: string }
  sortOrder: number
}

export const fallbackKnowledgeArticles: KnowledgeArticle[] = [
  {
    id: 'kb-getting-started',
    slug: 'getting-started-with-trends',
    category: 'getting-started',
    title: { en: 'How to use Trends', ru: 'Как пользоваться трендами' },
    body: {
      en: 'Open a trend, add only the files or text requested on its card, check the Token price, then tap Generate. Some trends require no uploads at all.',
      ru: 'Открой тренд, добавь только те файлы или текст, которые указаны в карточке, проверь стоимость в токенах и нажми Generate. Некоторые тренды вообще не требуют загрузок.',
    },
    sortOrder: 10,
  },
  {
    id: 'kb-photo-quality',
    slug: 'photo-quality',
    category: 'generation',
    title: { en: 'What makes a good photo reference', ru: 'Какие фото лучше использовать' },
    body: {
      en: 'Use a clear, well-lit image where the important subject is visible and not heavily blurred or covered. Follow the specific requirements shown inside each trend.',
      ru: 'Используй чёткое фото с хорошим светом, где главный объект хорошо виден, не размыт и не перекрыт. Всегда учитывай отдельные требования внутри конкретного тренда.',
    },
    sortOrder: 20,
  },
  {
    id: 'kb-generation-failed',
    slug: 'generation-failed',
    category: 'generation',
    title: { en: 'Why a generation can fail', ru: 'Почему генерация может завершиться ошибкой' },
    body: {
      en: 'A generation can fail because of a provider outage, unsupported input, temporary capacity limits or a processing error. If the service reports a technical failure, reserved Tokens are returned automatically.',
      ru: 'Генерация может завершиться ошибкой из-за сбоя провайдера, неподходящего исходника, временного лимита мощности или ошибки обработки. При технической ошибке зарезервированные токены возвращаются автоматически.',
    },
    sortOrder: 30,
  },
  {
    id: 'kb-token-refund',
    slug: 'token-refunds',
    category: 'tokens',
    title: { en: 'When Tokens are returned', ru: 'Когда возвращаются токены' },
    body: {
      en: 'Tokens are reserved when a generation starts. If the generation fails for a technical reason before a usable result is delivered, the reserved Tokens are returned to your balance.',
      ru: 'Токены резервируются при запуске генерации. Если генерация завершается технической ошибкой до получения пригодного результата, зарезервированные токены возвращаются на баланс.',
    },
    sortOrder: 40,
  },
  {
    id: 'kb-history',
    slug: 'generation-history',
    category: 'account',
    title: { en: 'Where to find previous generations', ru: 'Где найти предыдущие генерации' },
    body: {
      en: 'Open Profile → History. Completed and failed jobs are listed there after the backend is connected.',
      ru: 'Открой Профиль → История. После подключения backend там будут отображаться завершённые и ошибочные генерации.',
    },
    sortOrder: 50,
  },
]
