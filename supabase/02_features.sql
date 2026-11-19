-- =====================================================================
-- NeuroConecta - Atualização 02 (rode DEPOIS do schema.sql; pode rodar de novo sem problema)
--  1) Segurança do Premium (usuário não pode se autoconceder)
--  2) Login social / telefone: trigger de perfil atualizado
--  3) Pagamentos Mercado Pago (payments + funções grant/revoke)
--  4) Subtarefas, sessões de foco (Pomodoro)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) SEGURANÇA: o app NÃO pode mais alterar is_premium/premium_until nem criar assinaturas.
--    Somente as Edge Functions (service_role) fazem isso, após o Mercado Pago confirmar.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists premium_until timestamptz;

drop policy if exists "profiles_insert_own" on public.profiles;   -- o perfil é criado pelo trigger
revoke insert, update on public.profiles from anon, authenticated;
grant update (name, username, phone, birth_date, diagnosis, avatar_url, monthly_income, settings)
  on public.profiles to authenticated;

drop policy if exists "subscriptions_own" on public.subscriptions;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select using (user_id = auth.uid());
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Perfil automático também para login Google/Apple/telefone
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, birth_date, diagnosis, avatar_url, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    nullif(new.raw_user_meta_data->>'birth_date','')::date,
    new.raw_user_meta_data->>'diagnosis',
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    nullif(new.phone,'')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3) PAGAMENTOS (Mercado Pago). Usuário só LÊ os próprios; escrita só via service_role.
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),               -- = external_reference no Mercado Pago
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('mensal','anual')),
  amount numeric(10,2) not null,
  method text not null check (method in ('pix','cartao')),
  status text not null default 'pending',                      -- pending | approved | rejected | cancelled | refunded | charged_back
  mp_payment_id bigint unique,
  mp_status text,
  mp_status_detail text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments(user_id, created_at desc);

alter table public.payments enable row level security;
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments for select using (user_id = auth.uid());
revoke insert, update, delete on public.payments from anon, authenticated;

-- Libera o Premium. Idempotente: só a primeira chamada para um pagamento tem efeito.
create or replace function public.grant_premium(p_payment_id uuid, p_mp_payment_id bigint, p_mp_status text, p_mp_detail text)
returns boolean language plpgsql security definer set search_path = public as $$
declare pay public.payments; base timestamptz; newexp timestamptz; n_months int;
begin
  update public.payments
     set status = 'approved', approved_at = now(), mp_payment_id = p_mp_payment_id, mp_status = p_mp_status, mp_status_detail = p_mp_detail
   where id = p_payment_id and status <> 'approved'
  returning * into pay;
  if not found then return false; end if;

  n_months := case pay.plan when 'anual' then 12 else 1 end;
  select premium_until into base from public.profiles where id = pay.user_id;
  newexp := greatest(coalesce(base, now()), now()) + make_interval(months => n_months);   -- renovar antes de vencer soma o período

  update public.profiles set is_premium = true, premium_until = newexp where id = pay.user_id;
  insert into public.subscriptions (user_id, plan, price, payment_method, status, started_at, expires_at)
  values (pay.user_id, pay.plan, pay.amount, pay.method, 'active', now(), newexp);
  return true;
end $$;

-- Estorno / chargeback: desconta o período daquele pagamento.
create or replace function public.revoke_premium(p_payment_id uuid, p_mp_payment_id bigint, p_mp_status text, p_mp_detail text, p_status text)
returns boolean language plpgsql security definer set search_path = public as $$
declare pay public.payments; n_months int; newexp timestamptz;
begin
  update public.payments
     set status = p_status, mp_payment_id = p_mp_payment_id, mp_status = p_mp_status, mp_status_detail = p_mp_detail
   where id = p_payment_id and status = 'approved'
  returning * into pay;
  if not found then return false; end if;

  n_months := case pay.plan when 'anual' then 12 else 1 end;
  select premium_until - make_interval(months => n_months) into newexp from public.profiles where id = pay.user_id;
  update public.profiles set premium_until = newexp, is_premium = coalesce(newexp > now(), false) where id = pay.user_id;
  update public.subscriptions set status = 'canceled' where user_id = pay.user_id and started_at = pay.approved_at;   -- mesma transação do grant_premium => mesmo now()
  return true;
end $$;

revoke all on function public.grant_premium(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.revoke_premium(uuid, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_premium(uuid, bigint, text, text) to service_role;
grant execute on function public.revoke_premium(uuid, bigint, text, text, text) to service_role;

-- Vencimento: desliga o Premium expirado a cada 30 min (precisa da extensão pg_cron; o app também ignora Premium vencido).
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-premium', '*/30 * * * *',
    $q$update public.profiles set is_premium = false where is_premium and premium_until is not null and premium_until < now()$q$);
exception when others then
  raise notice 'pg_cron indisponível (%). Ative em Database > Extensions e rode este bloco de novo.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 4) SUBTAREFAS ("quebra de tarefas")
-- ---------------------------------------------------------------------
create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  done boolean not null default false,
  done_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists subtasks_task_idx on public.subtasks(task_id, position);
create index if not exists subtasks_user_idx on public.subtasks(user_id);

alter table public.subtasks enable row level security;
drop policy if exists "subtasks_own" on public.subtasks;
-- só o dono, e só em tarefas que também são dele (impede pendurar subtarefa na tarefa de outra pessoa)
create policy "subtasks_own" on public.subtasks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 5) SESSÕES DE FOCO (Pomodoro) — base da conquista "Foco mestre"
-- ---------------------------------------------------------------------
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  duration_min int not null check (duration_min between 1 and 180),
  created_at timestamptz not null default now()               -- momento em que o ciclo foi concluído
);
create index if not exists focus_user_idx on public.focus_sessions(user_id, created_at);

alter table public.focus_sessions enable row level security;
drop policy if exists "focus_sessions_own" on public.focus_sessions;
create policy "focus_sessions_own" on public.focus_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (task_id is null or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())));
