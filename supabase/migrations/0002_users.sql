-- 0002_users.sql
-- Datos de usuarios, organizaciones (B2B) y conversaciones con citas. Todo privado por RLS.

create type audience as enum ('family', 'clinical', 'research');
create type org_kind as enum ('patient_org', 'clinic', 'pharma', 'research');
create type plan_tier as enum ('free', 'community', 'clinic', 'enterprise');

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  audience    audience not null default 'family',
  locale      text not null default 'es',
  created_at  timestamptz not null default now()
);

create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       org_kind not null,
  plan       plan_tier not null default 'free',
  country    text,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null default 'member',   -- owner | admin | member
  primary key (org_id, user_id)
);

create table if not exists follows (
  user_id    uuid not null references profiles(id) on delete cascade,
  entity_id  uuid not null references entities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);

create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete set null,   -- null = anónimo
  audience   audience not null,
  agent      text not null,                                     -- family_guide | clinical_analyst | research_analyst
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  audio_url       text,
  verified        boolean,            -- resultado del verificador (solo assistant)
  dropped_claims  int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv on messages (conversation_id, created_at);

create table if not exists message_citations (
  message_id  uuid not null references messages(id) on delete cascade,
  evidence_id uuid not null references evidence(id) on delete cascade,
  primary key (message_id, evidence_id)
);

-- Consentimiento explícito para ser contactado sobre ensayos (nunca se vende)
create table if not exists trial_contact_consents (
  user_id     uuid not null references profiles(id) on delete cascade,
  entity_id   uuid not null references entities(id) on delete cascade,  -- enfermedad
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  primary key (user_id, entity_id)
);

-- Perfil automático al registrarse
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table profiles               enable row level security;
alter table organizations          enable row level security;
alter table memberships            enable row level security;
alter table follows                enable row level security;
alter table conversations          enable row level security;
alter table messages               enable row level security;
alter table message_citations      enable row level security;
alter table trial_contact_consents enable row level security;

create policy "own profile"   on profiles for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "own follows"   on follows  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own consents"  on trial_contact_consents for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own conversations" on conversations for all
  using (user_id is null or (select auth.uid()) = user_id)
  with check (user_id is null or (select auth.uid()) = user_id);

create policy "own messages" on messages for all
  using (exists (select 1 from conversations c where c.id = conversation_id and (c.user_id is null or c.user_id = (select auth.uid()))));

create policy "own citations" on message_citations for select
  using (exists (select 1 from messages m join conversations c on c.id = m.conversation_id
                 where m.id = message_id and (c.user_id is null or c.user_id = (select auth.uid()))));

create policy "member reads org" on organizations for select
  using (exists (select 1 from memberships m where m.org_id = id and m.user_id = (select auth.uid())));
create policy "member reads memberships" on memberships for select
  using (user_id = (select auth.uid()));
