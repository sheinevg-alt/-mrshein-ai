# Banana Zero — Project Handoff

Last updated: 2026-10-02

## Canonical product state

- Public site: https://bananazero.ru
- Stable app: https://mrshein-ai-v3.vercel.app
- Main Telegram bot: Banana Zero / @BananaZeroBot
- Support bot: @BananaZero_Care_bot
- Support operator group flow: one Telegram forum topic per client
- Production hosting: Vercel
- Database / financial source of truth: Supabase PostgreSQL
- Repository: sheinevg-alt/-mrshein-ai
- Owner Control Center: /admin/control
- Content admin: /admin
- Referral admin: /admin/referrals
- Current production commit: da0beb69a707f4d053e12cc200b61e894d650601

## Launch strategy v1

Use the already-funded APIMODELS account as the single generation provider first. Do not add another paid intermediary unless a required capability is unavailable.

All v1 AI model cards are visible to every user. Token balance gates only the final generation action.

### Video
1. Seedance 2.5 — premium trends, references and Video Edit
2. Gemini Omni 1.1 Flash — fast/low-cost video and image animation
3. Kling V3 — alternative text/image-to-video

### Image
1. Nano Banana 2 — APIMODELS id: gemini-3.1-flash-image-preview
2. Nano Banana Pro — gemini-3-pro-image
3. GPT Image 2.5 — gpt-image-2.5-flare

### Text
1. GPT-6 Sol
2. GPT-6 Luna
3. Claude Sonnet 5

### Audio
1. Suno v5
2. ElevenLabs TTS v3
3. Kling Sound Effects
4. Kling Video-to-Audio as the specialized video-audio mode

## Product navigation rule

Inside Video, Image, Text and Audio:
1. Show ready-made trends/templates first for casual users.
2. Show professional AI model tools on the same screen.
3. Never hide model cards because a user has zero Tokens.
4. Show the exact Token price before generation.
5. Reject the generation at the final action if balance is insufficient.

Mini App Profile includes a direct link to BananaZero.ru.
The main Telegram bot welcome keyboard includes both “Создать контент” and a BananaZero.ru website link.

## Owner Control Center

Route: /admin/control

Current capabilities:
- total users and 7-day active users
- aggregate user Token balances
- generation counts / processing / failures
- RUB sales summary
- referral commission and pending payout summaries
- real APIMODELS provider balance
- current model stack display
- searchable users by name, @username, Telegram ID or referral code
- each user's referral code, invited count and referral wallet
- manual Token grants/debits with a reason
- atomic Token adjustment through PostgreSQL
- idempotency protection against accidental duplicate grants
- token ledger entry and separate admin audit log for every manual adjustment
- recent generations and recent Token operations
- owner JSON snapshot export

Admin APIs require the configured admin bearer secret. Never expose the secret in Git history or client code.

## Generation and billing architecture

Generation history and the PostgreSQL ledger are the source of truth.

Implemented:
- unified APIMODELS execution route for Image / Video / Text / Audio
- dedicated Seedance 2.5 professional workspace
- model-specific professional controls
- live Token quote before generation
- atomic debit via create_generation
- automatic refund via fail_generation on provider failure
- signed APIMODELS callback URLs
- generic status polling for APIMODELS video/image/audio tasks
- provider usage/cost metadata stored server-side, not shown to customers
- Telegram completion notifications for async results
- My Works / History integration for async jobs

Important limitation:
- Full paid end-to-end execution of every selected APIMODELS model still needs a real Telegram Mini App session and should be smoke-tested model by model with small paid jobs.
- ElevenLabs TTS currently returns an immediate downloadable audio result; durable media persistence for that synchronous result is still pending.
- Some provider-hosted output URLs may expire. Durable re-hosting of completed outputs into Banana Zero Storage is still pending.

## Image v1 requirements

Image must be a marketplace of ready-made outcomes, not only an empty prompt box.

Required categories / tools:
- Birthday
- Wedding
- Luxury / Rich Life
- Avatars
- Fashion / Studio
- Business / Premium
- Photo for video / character reference
- Photo series
- Storyboard / 9-frame grid
- Different angles
- Outfit transfer / try-on
- Image editing / enhancement

Storyboard / Photo series is still pending:
- one user photo as input
- 9 frames in a 3x3 grid
- ideally also 9 separate downloadable images
- same identity across poses / angles
- hidden default prompt + editable prompt in advanced mode
- fixed Token price based on the generated output count

## Referral program v1

- 20% direct-referral commission
- first valid referrer is locked
- commission accounting in RUB
- pending + available balances
- 7-day hold before availability
- idempotent payment crediting
- refund reversal support
- convert referral RUB to internal Tokens
- gift Tokens to another Banana Zero Telegram user
- card and crypto payouts are planned but disabled until secure payout/KYC rails are connected
- user referral cabinet exists in Profile
- admin dashboard: /admin/referrals
- founder referral code: MRSHEIN

## Payments

### Russia
- Target provider: Tochka
- Currency: RUB
- Acquiring activation depends on final merchant approval / production credentials
- fiscal receipt service assumption: 1.5%
- bank cards: 2.8% acquiring; 4.3% incl. fiscalization
- SBP: ~1.0% acquiring provisional; ~2.5% incl. fiscalization
- T-Pay / T-Bank method: 2.5% acquiring; 4.0% incl. fiscalization
- replace provisional rates with the final approved contract tariff

### International
- Target customer currency: USD
- Provider intentionally not hardcoded yet
- select an international processor only after merchant onboarding / supported-country review
- keep checkout provider-abstracted
- Telegram Stars are not part of the intended Banana Zero payment model

## Authentication direction

Public site can be browsed without login.
Before website generation or token purchase, require sign-in.
Primary CTA: “Войти через Telegram”.
Secondary option later: email.
One account must share balance, history and generations between website and Telegram.
Website inline trend forms exist, but web generation still needs website authentication before it can run without opening the Mini App.

## Language

- Russian is the default language.
- Public website has a visible RU / EN toggle in the header.
- The website header, landing content and trend flow share one persisted locale state.
- Expand the same bilingual coverage to remaining legal/payment/auth pages when those flows are finalized.

## Support

- Public UI wording: “Служба поддержки”
- Support bot: @BananaZero_Care_bot
- Support config supports Supabase fallback when dedicated Vercel env variables are absent.
- Safe status route: /api/support/telegram/info
- Mutating Care setup route requires admin bearer auth.
- Production status was verified with configured operator chat, webhook pending count 0 and no last webhook error.

## Reliability and security

- Never calculate financial balances on the client.
- PostgreSQL ledger is the source of truth.
- Referral and payment operations must be idempotent.
- Sensitive referral SECURITY DEFINER RPCs are service-role only.
- Manual owner Token changes have a dedicated audit trail.
- APIMODELS callbacks use a signed token.
- Do not store full bank card data in Banana Zero.
- Do not put API keys, bot tokens, webhook secrets, admin secrets or payment credentials in this file or in Git history.

### Backup status

- Code/version history: GitHub main.
- Owner business-data snapshot: downloadable JSON from /admin/control.
- Supabase organization is currently on the Free plan.
- Do not describe the JSON snapshot as full PostgreSQL PITR.
- Before meaningful paid scale or referral cash payouts, add an external automated database backup and/or move to a Supabase plan with the required backup/PITR capability.

## Latest production validation

Production deploy da0beb69a707f4d053e12cc200b61e894d650601:
- Vercel deployment READY with bananazero.ru / www / stable Vercel aliases
- bananazero.ru returns HTTP 200 and Russian default HTML
- public metadata says AI Creative Platform for video, image, text and audio
- /admin/control returns the protected Control Center login page
- /api/admin/overview without auth returns 401
- @BananaZeroBot getInfo: correct bot, correct webhook, pending updates 0, no last error
- @BananaZero_Care_bot status: configured, operator chat configured, correct webhook, pending updates 0, no last error
- Care setup endpoint without admin auth returns 401
- recent production error/fatal log scan returned no entries

## Immediate next tasks

1. Run one small paid end-to-end generation through each v1 model from a real Telegram Mini App session and verify result persistence / refund behavior.
2. Build Image template marketplace starting with Birthday, Wedding, Luxury and Storyboard / 9-frame Photo Series.
3. Re-host completed provider outputs into Banana Zero storage for durable My Works downloads.
4. Finish / validate up to 10 video trends.
5. When Tochka approves acquiring, connect production payment credentials/webhooks and validate referral commission crediting.
6. Select an international payment provider after merchant onboarding review.
7. Add automated off-platform database backup / PITR strategy before meaningful paid scale.
