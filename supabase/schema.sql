-- =====================================================================
-- NeuroConecta - Schema Supabase (rode no SQL Editor do seu projeto)
-- =====================================================================

-- PERFIL (1:1 com auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  username text,
  phone text,
  birth_date date,
  diagnosis text,
  avatar_url text,
  monthly_income numeric(12,2) not null default 0,
  is_premium boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- TAREFAS
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'media' check (priority in ('baixa','media','alta')),
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- METAS
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  deadline date,
  progress int not null default 0 check (progress between 0 and 100),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- LEMBRETES
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  remind_date date not null,
  remind_time time,
  created_at timestamptz not null default now()
);

-- FINANÇAS (despesas e receitas)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  kind text not null default 'despesa' check (kind in ('despesa','receita')),
  spent_on date not null default current_date,
  payment_method text,
  created_at timestamptz not null default now()
);

-- RELATAR PROBLEMA
create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  problem text not null,
  opinion text,
  image_url text,
  created_at timestamptz not null default now()
);

-- ASSINATURAS (Premium)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan text not null check (plan in ('mensal','anual')),
  price numeric(10,2) not null,
  payment_method text,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists tasks_user_idx on public.tasks(user_id, due_date);
create index if not exists reminders_user_idx on public.reminders(user_id, remind_date);
create index if not exists expenses_user_idx on public.expenses(user_id, spent_on);

-- ---------------------------------------------------------------------
-- RLS: cada usuário só enxerga/edita seus próprios dados
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['tasks','goals','reminders','expenses','problem_reports','subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_own" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Cria o perfil automaticamente ao cadastrar
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, birth_date, diagnosis)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    nullif(new.raw_user_meta_data->>'birth_date','')::date,
    new.raw_user_meta_data->>'diagnosis'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Storage: bucket "avatars" (fotos de perfil e imagens de relatório)
-- Arquivos ficam em <user_id>/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
  on conflict (id) do nothing;

create policy "avatars_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
