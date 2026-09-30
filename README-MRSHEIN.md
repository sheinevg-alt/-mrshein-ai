# Shein AI — Telegram Mini App v0.4

This package is the next MVP foundation for the Telegram Mini App and the future Shein AI website.

## Included now

- Telegram Mini App layout and safe areas.
- Trends / Create / Favorites / Profile navigation.
- Russian + English UI.
- Telegram profile data when available.
- Favorites persistence.
- Real server-side architecture for Trends.
- Private `/admin` panel with three sections:
  - Trends;
  - Knowledge Base;
  - Care Team support tickets.
- Trend editor supports:
  - cover image;
  - category;
  - Token price;
  - zero, one or many photo/video/audio/text inputs;
  - hidden provider/model/prompt;
  - Draft / Published;
  - optional Telegram broadcast.
- New-trend Telegram broadcast with **Try Trend** deep link.
- Telegram `/start` welcome message.
- Knowledge Base inside Help & Support.
- Shein Care flow:
  - user selects a topic;
  - sees relevant knowledge articles first;
  - if they still need help, they create a support ticket;
  - admin replies from `/admin`;
  - reply can be delivered to the user in Telegram.
- User notification preference storage.
- Token balance foundation.
- Generation history foundation.
- Mock generation adapter for testing the complete product flow before paying AI providers:
  - `provider=mock`, `model=mock-success` → successful test generation;
  - `provider=mock-error` or `model=mock-error` → simulated provider error;
  - Token debit is atomic;
  - on simulated technical failure Tokens are refunded automatically.
- Token ledger for debits/refunds.

## Why this order

The app can now be configured and tested without purchasing credits from image/video/audio providers. Real provider APIs can be connected one by one later without redesigning the Mini App.

The future website should reuse the same backend, database, Trends, Tokens, History, Knowledge Base, Support and provider adapters. Telegram is the first client, not a separate backend.

## Security rules

- Provider/model IDs, provider pricing and hidden prompts never appear in the public `/api/trends` response.
- Real provider API keys, Telegram bot tokens and Supabase service-role keys must never be stored in client files or committed into the ZIP.
- Admin access uses a private `MRSHEIN_ADMIN_SECRET` stored in Vercel Environment Variables.

## One-time production setup

### 1. Deploy this package to Vercel

Use Vercel Drop for the current workflow. After deployment, copy the new `https://...vercel.app` URL.

### 2. Create Supabase

Create one Supabase project for Shein AI and run the complete `supabase/schema.sql` in Supabase SQL Editor.

### 3. Add Vercel Environment Variables

In Vercel → Project → Settings → Environment Variables add:

- `NEXT_PUBLIC_APP_URL=https://YOUR-V3-PROJECT.vercel.app`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `MRSHEIN_ADMIN_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then redeploy once so Vercel picks them up.

### 4. Open Admin

Open:

`https://YOUR-V3-PROJECT.vercel.app/admin`

Enter the exact `MRSHEIN_ADMIN_SECRET` value.

### 5. Connect Telegram webhook

In Admin tap **Подключить bot** once. This connects Telegram to:

`/api/telegram/webhook`

After that `/start`, user registration and new-trend notifications work without another ZIP upload.

## Telegram `/start`

Russian Telegram:

> 👋 Welcome!
>
> Создавай изображения и видео с AI.
> Нажми Generate, чтобы начать.

English Telegram:

> 👋 Welcome!
>
> Create images and videos with AI.
> Tap Generate to start.

## New Trend notification

Russian:

> 🔥 **New Trend**
>
> Новый тренд уже доступен.
> Будь одним из первых.
>
> **Try Trend**

The button opens the exact trend.

## Testing generations without real providers

Create a Trend in Admin and use:

- Provider: `mock`
- Model: `mock-success`

The app deducts the configured Token price, creates History and returns the preview as a test result.

To test an error and automatic refund:

- Provider: `mock-error`

The app deducts/reserves Tokens, records the failed job and refunds Tokens automatically.

## Intentionally not connected yet

- Real image/video/audio/text AI provider APIs.
- Telegram Stars / paid Token packs.
- Website authentication.
- Public website UI.

These are the next stages after the Mini App foundation is verified.
