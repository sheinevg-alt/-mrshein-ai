# Banana Zero — Project Handoff

Last updated: 2026-10-01

## Canonical product state

- Public site: https://bananazero.ru
- Main Telegram bot: Banana Zero / @MrShein_AI_bot
- Support bot: @BananaZero_Care_bot
- Support operator group flow: one Telegram forum topic per client
- Production hosting: Vercel
- Database / financial source of truth: Supabase PostgreSQL
- Repository: sheinevg-alt/-mrshein-ai

## Launch strategy v1

Use one already-funded provider first. Do not add new paid intermediaries unless a required capability is unavailable.

Required video stack:
1. Seedance 2.5 — premium trends / reference video
2. Gemini Omni 1.1 Flash — low-cost short video / image animation
3. Kling 2.6 — alternative text-to-video and image-to-video

Primary launch goals:
- up to 10 polished video trends
- paid Image section with ready-made templates
- referral program
- Tochka acquiring once approved
- first real users and unit-economics validation

## Image v1 requirements

Image must be a marketplace of ready-made outcomes, not only an empty prompt box.

Required categories / tools:
- Birthday
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

Storyboard / Photo series:
- one user photo as input
- 9 frames in a 3x3 grid
- ideally also 9 separate images
- same identity across poses / angles
- editable prompt in advanced mode

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

## Payments / Tochka inputs

Application submitted to Tochka acquiring.

Current merchant-cost assumptions:
- fiscal receipt service: 1.5%
- bank cards: 2.8% acquiring; 4.3% incl. fiscalization
- SBP: ~1.0% acquiring provisional; ~2.5% incl. fiscalization
- T-Pay / T-Bank payment method: 2.5% acquiring; 4.0% incl. fiscalization

SBP rate must be replaced with the final approved Tochka tariff when received.

## Authentication direction

Public site can be browsed without login.
Before generation or token purchase, require sign-in.
Primary CTA: “Войти через Telegram”.
Secondary option later: email.
One account must share balance, history and generations between website and Telegram.
Do not use “Подключить Telegram” as the primary login wording.

## Language

Russian is the default first-launch language.
User may switch language in settings.

## Support wording

Public UI should display “Служба поддержки”, not the raw bot handle.
The clickable target is @BananaZero_Care_bot.

## Reliability rules

- Never calculate financial balances on the client.
- PostgreSQL ledger is the source of truth.
- Referral and payment operations must be idempotent.
- Before enabling real referral cash withdrawals, add PITR / database backup strategy and an external backup copy.
- Do not store full bank card data in Banana Zero.

## Immediate next tasks

1. Connect actual APIMODELS generation routes for Gemini Omni 1.1 Flash and Kling 2.6.
2. Finish the Image v1 product architecture and test which current-provider image model best handles:
   - one-photo identity preservation
   - 3x3 storyboard / 9-frame photo series
   - editable ready-made templates
3. Build the first Image template categories and examples.
4. Finish / validate up to 10 video trends.
5. When Tochka approves acquiring, connect payment webhooks and referral commission crediting.
6. Test the full real-user path: referral link -> login -> top-up -> generation -> commission -> result.

## Security

Do not put API keys, bot tokens, webhook secrets, admin secrets or payment credentials in this file or in Git history.
