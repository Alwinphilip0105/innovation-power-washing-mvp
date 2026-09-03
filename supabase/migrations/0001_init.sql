-- Innovation Power Washing platform - core schema.
--
-- Multi-tenant from the first table: every business-owned row carries
-- business_id, and the two tables that do not (addresses, messages) reach it
-- through exactly one parent. Nothing in the application resolves a row without
-- a business scope.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- businesses

create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  slug            text        not null unique,
  phone           text        not null,
  email           text        not null,
  website         text,
  address         text,
  timezone        text        not null default 'America/New_York',
  business_hours  jsonb       not null default '{}'::jsonb,
  settings        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- --------------------------------------------------------------------- users

create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid        not null references public.businesses (id) on delete cascade,
  auth_user_id uuid unique,
  name         text        not null,
  email        text        not null,
  role         text        not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  created_at   timestamptz not null default now(),
  unique (business_id, email)
);

create index if not exists users_business_idx on public.users (business_id);

-- ------------------------------------------------------------------ services

create table if not exists public.services (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid        not null references public.businesses (id) on delete cascade,
  slug            text        not null,
  name            text        not null,
  description     text        not null default '',
  pricing_model   text        not null default 'starting_at'
                  check (pricing_model in ('starting_at', 'per_sqft', 'flat', 'quote_only')),
  starting_price  numeric(10, 2),
  price_unit      text,
  duration_minutes integer    not null default 120 check (duration_minutes > 0),
  active          boolean     not null default true,
  highlights      text[]      not null default '{}',
  sort_order      integer     not null default 0,
  unique (business_id, slug),
  -- A priced service must actually carry a price.
  constraint services_price_present
    check (pricing_model = 'quote_only' or starting_price is not null)
);

create index if not exists services_business_idx on public.services (business_id, active, sort_order);

-- ----------------------------------------------------------------- customers

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses (id) on delete cascade,
  first_name  text        not null,
  last_name   text,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Phone is the de-duplication key, so it is unique per business when present.
create unique index if not exists customers_business_phone_key
  on public.customers (business_id, phone) where phone is not null;
create index if not exists customers_business_email_idx
  on public.customers (business_id, lower(email)) where email is not null;
create index if not exists customers_business_created_idx
  on public.customers (business_id, created_at desc);

-- ----------------------------------------------------------------- addresses

create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  street      text not null,
  city        text not null,
  state       text not null,
  zip         text not null,
  latitude    double precision,
  longitude   double precision
);

create index if not exists addresses_customer_idx on public.addresses (customer_id);

-- --------------------------------------------------------------------- leads

create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid        not null references public.businesses (id) on delete cascade,
  customer_id       uuid        not null references public.customers (id) on delete cascade,
  source            text        not null default 'website'
                    check (source in ('website', 'phone', 'sms', 'web_chat', 'referral', 'manual')),
  service_requested text,
  service_id        uuid references public.services (id) on delete set null,
  status            text        not null default 'new'
                    check (status in ('new', 'contacted', 'qualified', 'estimate_requested',
                                      'estimate_sent', 'booked', 'completed', 'lost')),
  estimated_value   numeric(10, 2),
  notes             text,
  assigned_to       uuid references public.users (id) on delete set null,
  preferred_date    date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists leads_business_created_idx on public.leads (business_id, created_at desc);
create index if not exists leads_business_status_idx on public.leads (business_id, status);
create index if not exists leads_customer_idx on public.leads (customer_id);

-- -------------------------------------------------------------- appointments

create table if not exists public.appointments (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid        not null references public.businesses (id) on delete cascade,
  customer_id          uuid        not null references public.customers (id) on delete cascade,
  lead_id              uuid references public.leads (id) on delete set null,
  service_id           uuid references public.services (id) on delete set null,
  start_time           timestamptz not null,
  end_time             timestamptz not null,
  status               text        not null default 'requested'
                       check (status in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes                text,
  source               text        not null default 'website',
  external_calendar_id text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint appointments_time_order check (end_time > start_time)
);

create index if not exists appointments_business_start_idx on public.appointments (business_id, start_time);
create index if not exists appointments_business_status_idx on public.appointments (business_id, status);
create index if not exists appointments_customer_idx on public.appointments (customer_id);

-- --------------------------------------------------------------------- calls

create table if not exists public.calls (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid        not null references public.businesses (id) on delete cascade,
  customer_id      uuid references public.customers (id) on delete set null,
  lead_id          uuid references public.leads (id) on delete set null,
  provider         text        not null,
  provider_call_id text,
  direction        text        not null check (direction in ('inbound', 'outbound')),
  phone_number     text        not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration         integer,
  status           text        not null default 'in_progress'
                   check (status in ('in_progress', 'completed', 'missed', 'failed', 'voicemail')),
  transcript       text,
  summary          text,
  outcome          text,
  recording_url    text
);

-- Upsert key for provider webhooks (started -> completed on the same call).
create unique index if not exists calls_provider_call_key
  on public.calls (business_id, provider, provider_call_id) where provider_call_id is not null;
create index if not exists calls_business_started_idx on public.calls (business_id, started_at desc);

-- ------------------------------------------------------------- conversations

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  lead_id     uuid references public.leads (id) on delete set null,
  channel     text        not null check (channel in ('phone', 'sms', 'web')),
  status      text        not null default 'open' check (status in ('open', 'escalated', 'closed')),
  subject     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversations_business_updated_idx
  on public.conversations (business_id, updated_at desc);
create index if not exists conversations_open_lookup_idx
  on public.conversations (business_id, customer_id, channel) where status <> 'closed';

-- ------------------------------------------------------------------ messages

create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid        not null references public.conversations (id) on delete cascade,
  direction           text        not null check (direction in ('inbound', 'outbound')),
  sender              text        not null check (sender in ('customer', 'ai', 'staff', 'system')),
  body                text        not null,
  provider_message_id text,
  status              text        not null default 'sent'
                      check (status in ('queued', 'sent', 'delivered', 'failed', 'received')),
  created_at          timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create unique index if not exists messages_provider_key
  on public.messages (provider_message_id) where provider_message_id is not null;

-- ----------------------------------------------------------------- estimates

create table if not exists public.estimates (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses (id) on delete cascade,
  customer_id uuid        not null references public.customers (id) on delete cascade,
  lead_id     uuid references public.leads (id) on delete set null,
  status      text        not null default 'requested'
              check (status in ('requested', 'draft', 'sent', 'accepted', 'declined', 'expired')),
  amount      numeric(10, 2),
  notes       text,
  sent_at     timestamptz,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists estimates_business_created_idx on public.estimates (business_id, created_at desc);

-- ---------------------------------------------------------------- ai_actions

create table if not exists public.ai_actions (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid        not null references public.businesses (id) on delete cascade,
  customer_id     uuid references public.customers (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  action_type     text        not null,
  input           jsonb,
  output          jsonb,
  success         boolean     not null default true,
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists ai_actions_business_created_idx on public.ai_actions (business_id, created_at desc);

-- ------------------------------------------------------------- notifications

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses (id) on delete cascade,
  user_id     uuid references public.users (id) on delete cascade,
  type        text        not null,
  title       text        not null,
  body        text        not null default '',
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_business_created_idx
  on public.notifications (business_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (business_id) where read = false;

-- ------------------------------------------------------------ webhook_events

-- Idempotency ledger. The unique constraint is the whole point: a duplicate
-- delivery fails the insert and the handler returns 200 without re-processing.
create table if not exists public.webhook_events (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid references public.businesses (id) on delete cascade,
  provider          text        not null,
  provider_event_id text        not null,
  received_at       timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists webhook_events_received_idx on public.webhook_events (received_at desc);

-- ---------------------------------------------------------- analytics_events

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses (id) on delete cascade,
  name        text        not null,
  properties  jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_business_created_idx
  on public.analytics_events (business_id, created_at desc);

-- ------------------------------------------------------- updated_at handling

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'businesses', 'customers', 'leads', 'appointments', 'conversations'
  ]
  loop
    execute format('drop trigger if exists touch_%1$s_updated_at on public.%1$s', target);
    execute format(
      'create trigger touch_%1$s_updated_at before update on public.%1$s
         for each row execute function public.touch_updated_at()',
      target
    );
  end loop;
end;
$$;
