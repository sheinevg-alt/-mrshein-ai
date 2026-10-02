-- Banana Zero database schema
-- Run once in Supabase SQL Editor.

create table if not exists public.trends (
  id text primary key,
  title_en text not null,
  title_ru text,
  category text not null check (category in ('video','image','audio','text')),
  image_url text not null,
  uses_count text not null default 'New',
  token_cost integer not null default 0 check (token_cost >= 0),
  input_schema jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  hidden_prompt text,
  published boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_users (
  chat_id bigint primary key,
  telegram_id bigint not null,
  first_name text,
  last_name text,
  username text,
  language_code text,
  notifications_enabled boolean not null default true,
  last_seen_at timestamptz not null default now()
);

create index if not exists bot_users_telegram_id_idx on public.bot_users(telegram_id);

create table if not exists public.app_users (
  telegram_id bigint primary key,
  first_name text,
  last_name text,
  username text,
  language_code text,
  token_balance integer not null default 120 check (token_balance >= 0),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  type text not null check (type in ('trend','tool')),
  source_id text,
  title text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  token_cost integer not null default 0,
  result_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_history_user_idx on public.generation_history(telegram_id, created_at desc);

-- Public preview images uploaded from the private admin API.
insert into storage.buckets (id, name, public)
values ('trend-previews', 'trend-previews', true)
on conflict (id) do update set public = true;

-- RLS can stay enabled because the app uses the server-only service-role key.
alter table public.trends enable row level security;
alter table public.bot_users enable row level security;
alter table public.app_users enable row level security;
alter table public.generation_history enable row level security;

-- Knowledge base used by Help & Support.
create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category text not null check (category in ('getting-started','generation','tokens','account')),
  title_en text not null,
  title_ru text,
  body_en text not null,
  body_ru text,
  published boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  first_name text,
  last_name text,
  username text,
  language_code text,
  topic text not null default 'other',
  message text not null,
  status text not null default 'open' check (status in ('open','answered','closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets(telegram_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status, created_at desc);

alter table public.support_tickets
  add column if not exists source text not null default 'miniapp';

alter table public.support_tickets
  drop constraint if exists support_tickets_source_check;

alter table public.support_tickets
  add constraint support_tickets_source_check
  check (source in ('miniapp','telegram'));

create table if not exists public.support_chat_threads (
  telegram_id bigint primary key,
  user_chat_id bigint not null,
  operator_thread_id bigint unique,
  first_name text,
  last_name text,
  username text,
  language_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_chat_threads_operator_thread_idx
  on public.support_chat_threads(operator_thread_id);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  direction text not null check (direction in ('user','operator')),
  text text,
  telegram_message_id bigint,
  operator_thread_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_user_idx
  on public.support_messages(telegram_id, created_at desc);
create index if not exists support_messages_thread_idx
  on public.support_messages(operator_thread_id, created_at desc);

create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  amount integer not null,
  event_type text not null check (event_type in ('credit','generation','refund','adjustment')),
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists token_ledger_user_idx on public.token_ledger(telegram_id, created_at desc);

alter table public.generation_history add column if not exists provider text;
alter table public.generation_history add column if not exists model text;
alter table public.generation_history add column if not exists error_code text;

-- Atomic Token debit. Service-role calls this server-side only.
create or replace function public.reserve_tokens(
  p_telegram_id bigint,
  p_amount integer,
  p_reference text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  update public.app_users
  set token_balance = token_balance - p_amount,
      last_seen_at = now()
  where telegram_id = p_telegram_id
    and token_balance >= p_amount
  returning token_balance into v_balance;

  if v_balance is null then
    raise exception 'INSUFFICIENT_TOKENS';
  end if;

  insert into public.token_ledger(telegram_id, amount, event_type, reference)
  values (p_telegram_id, -p_amount, 'generation', p_reference);

  return v_balance;
end;
$$;

create or replace function public.refund_tokens(
  p_telegram_id bigint,
  p_amount integer,
  p_reference text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  update public.app_users
  set token_balance = token_balance + p_amount,
      last_seen_at = now()
  where telegram_id = p_telegram_id
  returning token_balance into v_balance;

  if v_balance is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.token_ledger(telegram_id, amount, event_type, reference)
  values (p_telegram_id, p_amount, 'refund', p_reference);

  return v_balance;
end;
$$;

alter table public.knowledge_articles enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_chat_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.token_ledger enable row level security;

-- Starter knowledge-base articles. These are original MrShein AI copy and can be edited later in Admin.
insert into public.knowledge_articles (slug, category, title_en, title_ru, body_en, body_ru, sort_order)
values
  ('getting-started-with-trends','getting-started','How to use Trends','Как пользоваться трендами','Open a trend, add only the files or text requested on its card, check the Token price, then tap Generate. Some trends require no uploads at all.','Открой тренд, добавь только те файлы или текст, которые указаны в карточке, проверь стоимость в токенах и нажми Generate. Некоторые тренды вообще не требуют загрузок.',10),
  ('photo-quality','generation','What makes a good photo reference','Какие фото лучше использовать','Use a clear, well-lit image where the important subject is visible and not heavily blurred or covered. Follow the specific requirements shown inside each trend.','Используй чёткое фото с хорошим светом, где главный объект хорошо виден, не размыт и не перекрыт. Всегда учитывай отдельные требования внутри конкретного тренда.',20),
  ('generation-failed','generation','Why a generation can fail','Почему генерация может завершиться ошибкой','A generation can fail because of a provider outage, unsupported input, temporary capacity limits or a processing error. If the service reports a technical failure, reserved Tokens are returned automatically.','Генерация может завершиться ошибкой из-за сбоя провайдера, неподходящего исходника, временного лимита мощности или ошибки обработки. При технической ошибке зарезервированные токены возвращаются автоматически.',30),
  ('token-refunds','tokens','When Tokens are returned','Когда возвращаются токены','Tokens are reserved when a generation starts. If the generation fails for a technical reason before a usable result is delivered, the reserved Tokens are returned to your balance.','Токены резервируются при запуске генерации. Если генерация завершается технической ошибкой до получения пригодного результата, зарезервированные токены возвращаются на баланс.',40)
on conflict (slug) do nothing;


-- Banana Zero owner/admin audit trail and atomic manual Token adjustments.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  subject_type text not null,
  subject_id text,
  actor text not null default 'banana-zero-admin',
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;
grant select, insert on table public.admin_audit_log to service_role;

create or replace function public.admin_adjust_tokens(
  p_telegram_id bigint,
  p_amount integer,
  p_reference text default null,
  p_actor text default 'banana-zero-admin',
  p_idempotency_key text default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_balance integer;
  v_audit_id uuid;
begin
  if p_amount = 0 then raise exception 'INVALID_AMOUNT'; end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    insert into public.admin_audit_log(action, subject_type, subject_id, actor, metadata, idempotency_key)
    values ('tokens.adjust','telegram_user',p_telegram_id::text,coalesce(nullif(trim(p_actor),''),'banana-zero-admin'),
      jsonb_build_object('amount',p_amount,'reference',p_reference),trim(p_idempotency_key))
    on conflict (idempotency_key) do nothing returning id into v_audit_id;

    if v_audit_id is null then
      select token_balance into v_balance from public.app_users where telegram_id = p_telegram_id;
      if v_balance is null then raise exception 'USER_NOT_FOUND'; end if;
      return v_balance;
    end if;
  else
    insert into public.admin_audit_log(action, subject_type, subject_id, actor, metadata)
    values ('tokens.adjust','telegram_user',p_telegram_id::text,coalesce(nullif(trim(p_actor),''),'banana-zero-admin'),
      jsonb_build_object('amount',p_amount,'reference',p_reference));
  end if;

  update public.app_users
  set token_balance = token_balance + p_amount, last_seen_at = now()
  where telegram_id = p_telegram_id and token_balance + p_amount >= 0
  returning token_balance into v_balance;

  if v_balance is null then
    if exists (select 1 from public.app_users where telegram_id = p_telegram_id) then raise exception 'INSUFFICIENT_TOKENS'; end if;
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.token_ledger(telegram_id, amount, event_type, reference)
  values (p_telegram_id,p_amount,'adjustment',coalesce(nullif(trim(p_reference),''),'admin manual adjustment'));

  return v_balance;
end;
$$;

revoke all on function public.admin_adjust_tokens(bigint, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_adjust_tokens(bigint, integer, text, text, text) to service_role;


-- Banana Zero security hardening: server-side referral RPCs are never callable directly
-- by anon/authenticated clients. The Next.js server invokes them with service_role.
revoke execute on function public.apply_referral_attribution(bigint, text) from public, anon, authenticated;
revoke execute on function public.convert_referral_rub_to_tokens(bigint, numeric) from public, anon, authenticated;
revoke execute on function public.credit_referral_for_payment(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_referral_profile(bigint, text) from public, anon, authenticated;
revoke execute on function public.gift_referral_balance_as_tokens(bigint, text, numeric) from public, anon, authenticated;
revoke execute on function public.gift_referral_balance_as_tokens(bigint, bigint, numeric) from public, anon, authenticated;
revoke execute on function public.process_referral_payout_request(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.release_due_referral_commissions() from public, anon, authenticated;
revoke execute on function public.request_referral_payout(bigint, text, numeric, text) from public, anon, authenticated;
revoke execute on function public.reverse_referral_for_payment(uuid) from public, anon, authenticated;

grant execute on function public.apply_referral_attribution(bigint, text) to service_role;
grant execute on function public.convert_referral_rub_to_tokens(bigint, numeric) to service_role;
grant execute on function public.credit_referral_for_payment(uuid) to service_role;
grant execute on function public.ensure_referral_profile(bigint, text) to service_role;
grant execute on function public.gift_referral_balance_as_tokens(bigint, text, numeric) to service_role;
grant execute on function public.gift_referral_balance_as_tokens(bigint, bigint, numeric) to service_role;
grant execute on function public.process_referral_payout_request(uuid, text, text) to service_role;
grant execute on function public.release_due_referral_commissions() to service_role;
grant execute on function public.request_referral_payout(bigint, text, numeric, text) to service_role;
grant execute on function public.reverse_referral_for_payment(uuid) to service_role;

alter view public.referral_wallet_balances set (security_invoker = true);
alter function public.price_tokens_from_provider_cost(numeric) set search_path = public;


-- Banana Zero public customer pricing v2.
alter table public.token_packages
  add column if not exists beginner_price_rub integer,
  add column if not exists creator_price_rub integer;

update public.token_packages
set beginner_price_rub = round(price_rub * 0.90)::integer,
    creator_price_rub = round(price_rub * 0.88)::integer,
    professional_price_rub = round(price_rub * 0.85)::integer
where code in ('tokens_500','tokens_1000','tokens_3000','tokens_5000');

insert into public.app_settings(key,value,description)
values (
  'commercial_model_v2',
  '{
    "currency":"RUB",
    "token_value_rub":1,
    "one_off":{"subscription_required":false,"token_packages":[
      {"tokens":500,"price_rub":500},
      {"tokens":1000,"price_rub":1000},
      {"tokens":3000,"price_rub":3000},
      {"tokens":5000,"price_rub":5000}
    ]},
    "plans":[
      {"code":"beginner","name":"Beginner","period_days":30,"price_rub":990,"included_tokens":1100,"topup_discount_pct":10},
      {"code":"creator","name":"Creator","period_days":30,"price_rub":2490,"included_tokens":2850,"topup_discount_pct":12},
      {"code":"professional","name":"Professional","period_days":30,"price_rub":4990,"included_tokens":5900,"topup_discount_pct":15}
    ],
    "token_expiry":{"purchased_tokens":"do_not_expire_while_account_active","plan_included_tokens":"end_of_paid_period"},
    "generation_cost_multiplier":3.1,
    "payment_cost_reserve_pct":5
  }'::jsonb,
  'Canonical Banana Zero customer pricing v2.'
)
on conflict (key) do update set value=excluded.value, description=excluded.description, updated_at=now();


-- Public product announcements shown through the website/Mini App bell.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'info' check (kind in ('info','price','model','maintenance','promo')),
  title_ru text not null,
  title_en text not null,
  body_ru text not null,
  body_en text not null,
  link_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
revoke all on table public.announcements from anon, authenticated;
grant select, insert, update, delete on table public.announcements to service_role;

create index if not exists announcements_public_idx
  on public.announcements (is_published, published_at desc);


insert into public.app_settings(key,value,description)
values (
  'commercial_model_v3',
  '{
    "status":"active",
    "currency":"RUB",
    "reference_rub_per_token":2.5,
    "one_off_packages":[
      {"tokens":200,"price_rub":500},
      {"tokens":500,"price_rub":1250},
      {"tokens":1000,"price_rub":2500},
      {"tokens":2000,"price_rub":5000}
    ],
    "plans":[
      {"code":"beginner","name":"Beginner","period_days":30,"price_rub":1490,"regular_value_rub":1650,"included_tokens":660,"discount_pct":10,"discount_is_already_applied":true},
      {"code":"creator","name":"Creator","period_days":30,"price_rub":2990,"regular_value_rub":3525,"included_tokens":1410,"discount_pct":15,"discount_is_already_applied":true},
      {"code":"professional","name":"Professional","period_days":30,"price_rub":4990,"regular_value_rub":6250,"included_tokens":2500,"discount_pct":20,"discount_is_already_applied":true}
    ],
    "pricing_rule":{"usd_rub":90,"provider_cost_multiplier":3.1,"token_reference_value_rub":2.5,"round_generation_tokens_to":5,"tax_pct":7,"payment_and_fiscal_reserve_pct":5}
  }'::jsonb,
  'Canonical active Banana Zero pricing model.'
)
on conflict (key) do update set value=excluded.value, description=excluded.description, updated_at=now();


-- Legal/audit context for paid AI generations.
insert into public.app_settings(key,value,description)
values (
  'legal_offer_current_version',
  '{"version":"2026-10-02-v2","effective_at":"2026-10-02T00:00:00+07:00","pricing_version":"commercial_model_v3"}'::jsonb,
  'Current public offer version recorded into future generation audit context.'
)
on conflict (key) do update set value=excluded.value, description=excluded.description, updated_at=now();

create index if not exists payment_orders_user_created_idx
  on public.payment_orders (telegram_id, created_at desc);

create index if not exists admin_audit_log_subject_created_idx
  on public.admin_audit_log (subject_id, created_at desc);

create or replace function public.create_generation(
  p_telegram_id bigint,
  p_type text,
  p_source_id text,
  p_title text,
  p_token_cost integer,
  p_provider text default null::text,
  p_model text default null::text,
  p_input_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_generation_id uuid;
  v_balance integer;
  v_payload jsonb;
begin
  if p_token_cost < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_type not in ('trend','tool') then
    raise exception 'INVALID_GENERATION_TYPE';
  end if;

  update public.app_users
  set token_balance = token_balance - p_token_cost,
      last_seen_at = now()
  where telegram_id = p_telegram_id
    and token_balance >= p_token_cost
  returning token_balance into v_balance;

  if v_balance is null then
    if exists (select 1 from public.app_users where telegram_id = p_telegram_id) then
      raise exception 'INSUFFICIENT_TOKENS';
    else
      raise exception 'USER_NOT_FOUND';
    end if;
  end if;

  v_payload := coalesce(p_input_payload, '{}'::jsonb)
    || jsonb_build_object(
      '_audit',
      jsonb_build_object(
        'offer_version', '2026-10-02-v2',
        'pricing_version', 'commercial_model_v3',
        'generation_requested_at', now(),
        'token_cost', p_token_cost,
        'balance_after_debit', v_balance
      )
    );

  insert into public.generation_history(
    telegram_id, type, source_id, title, status, token_cost,
    provider, model, input_payload, queued_at
  )
  values (
    p_telegram_id, p_type, p_source_id, p_title, 'queued', p_token_cost,
    p_provider, p_model, v_payload, now()
  )
  returning id into v_generation_id;

  insert into public.token_ledger(
    telegram_id, amount, event_type, reference, generation_id
  )
  values (
    p_telegram_id, -p_token_cost, 'generation',
    'generation:' || v_generation_id::text, v_generation_id
  );

  return v_generation_id;
end;
$function$;

revoke execute on function public.create_generation(bigint,text,text,text,integer,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_generation(bigint,text,text,text,integer,text,text,jsonb) to service_role;
