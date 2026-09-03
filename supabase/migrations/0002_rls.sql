-- Row Level Security.
--
-- The application server talks to Postgres with the service-role key and
-- enforces authorization itself (every query is scoped by business_id). These
-- policies are defence in depth: they make sure that anything reaching the
-- database with an end-user JWT - a browser using the anon key, a future
-- client-side query, a leaked publishable key - can only ever see its own
-- business's rows.
--
-- Deny by default: enabling RLS with no permissive policy for a role blocks it.

create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.business_id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_business_id() is
  'The business of the signed-in Supabase user, resolved through public.users.';

alter table public.businesses       enable row level security;
alter table public.users            enable row level security;
alter table public.services         enable row level security;
alter table public.customers        enable row level security;
alter table public.addresses        enable row level security;
alter table public.leads            enable row level security;
alter table public.appointments     enable row level security;
alter table public.calls            enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;
alter table public.estimates        enable row level security;
alter table public.ai_actions       enable row level security;
alter table public.notifications    enable row level security;
alter table public.webhook_events   enable row level security;
alter table public.analytics_events enable row level security;

-- Tables that carry business_id directly.
do $$
declare
  target text;
begin
  foreach target in array array[
    'services', 'customers', 'leads', 'appointments', 'calls',
    'conversations', 'estimates', 'ai_actions', 'notifications',
    'webhook_events', 'analytics_events'
  ]
  loop
    execute format('drop policy if exists %1$s_tenant_isolation on public.%1$s', target);
    execute format(
      'create policy %1$s_tenant_isolation on public.%1$s
         for all to authenticated
         using (business_id = public.current_business_id())
         with check (business_id = public.current_business_id())',
      target
    );
  end loop;
end;
$$;

-- A user sees their own business record, and may update it.
drop policy if exists businesses_tenant_isolation on public.businesses;
create policy businesses_tenant_isolation on public.businesses
  for all to authenticated
  using (id = public.current_business_id())
  with check (id = public.current_business_id());

-- A user sees the roster of their own business.
drop policy if exists users_tenant_isolation on public.users;
create policy users_tenant_isolation on public.users
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- Addresses reach business_id through their customer.
drop policy if exists addresses_tenant_isolation on public.addresses;
create policy addresses_tenant_isolation on public.addresses
  for all to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = addresses.customer_id
        and c.business_id = public.current_business_id()
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = addresses.customer_id
        and c.business_id = public.current_business_id()
    )
  );

-- Messages reach business_id through their conversation.
drop policy if exists messages_tenant_isolation on public.messages;
create policy messages_tenant_isolation on public.messages
  for all to authenticated
  using (
    exists (
      select 1 from public.conversations cv
      where cv.id = messages.conversation_id
        and cv.business_id = public.current_business_id()
    )
  )
  with check (
    exists (
      select 1 from public.conversations cv
      where cv.id = messages.conversation_id
        and cv.business_id = public.current_business_id()
    )
  );

-- The anon role gets nothing. Public pages read business and service data
-- through the server, never directly from the browser.
revoke all on all tables in schema public from anon;
