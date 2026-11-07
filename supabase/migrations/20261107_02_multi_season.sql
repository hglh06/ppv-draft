-- Esquema multi-temporada. Solo agrega; no rompe el sitio S4 actual.

-- 1) Temporadas: metadatos y tema visual
alter table public.seasons
  add column if not exists number int,
  add column if not exists slug text,
  add column if not exists status text not null default 'setup',
  add column if not exists subtitle text,
  add column if not exists theme jsonb not null default '{}'::jsonb,
  add column if not exists next_event jsonb,
  add column if not exists champion_team_id uuid references public.teams(id),
  add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table public.seasons add constraint seasons_status_chk
    check (status in ('setup','draft','regular','playoffs','finished'));
exception when duplicate_object then null; end $$;
create unique index if not exists seasons_number_key on public.seasons(number);
create unique index if not exists seasons_slug_key on public.seasons(slug);

-- 2) Reglas por temporada (league_settings ya existe: se amplía)
alter table public.league_settings
  add column if not exists max_fa int not null default 10,
  add column if not exists trade_max_diff int not null default 3,
  add column if not exists points_win int not null default 3,
  add column if not exists points_loss int not null default 0,
  add column if not exists best_of int not null default 3,
  add column if not exists regular_weeks int,
  add column if not exists draft_pick_seconds int not null default 30,
  add column if not exists faint_limit int,                       -- null = mecanica de escape apagada
  add column if not exists faint_reset_on_transfer boolean not null default true,
  add column if not exists faint_in_playoffs boolean not null default false;
create unique index if not exists league_settings_season_key on public.league_settings(season_id);

-- 3) Conferencias por temporada
create table if not exists public.conferences (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  key text not null,              -- 'a' / 'b' (clave interna estable)
  name text not null,             -- nombre visible (FireRed, HeartGold...)
  code text,                      -- nombre legado usado en matches.conference (Kanto/Johto)
  color text not null default '#FF4B2B',
  sort int not null default 0,
  unique (season_id, key)
);

-- 4) Participacion de cada equipo en cada temporada
create table if not exists public.season_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  conference_id uuid references public.conferences(id) on delete set null,
  display_name text,
  abbr text,
  coach_name text,
  logo text,
  seed int,
  created_at timestamptz not null default now(),
  unique (season_id, team_id)
);

-- 5) Partidos, reportes y transacciones con temporada
alter table public.matches
  add column if not exists season_id uuid references public.seasons(id),
  add column if not exists conference_id uuid references public.conferences(id),
  add column if not exists round text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists created_at timestamptz not null default now();
alter table public.reports
  add column if not exists season_id uuid references public.seasons(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists submitted_by uuid;
alter table public.transactions
  add column if not exists season_id uuid references public.seasons(id),
  add column if not exists note text;
alter table public.transactions alter column proposed_by drop not null;

-- 6) Stats por Pokemon y por juego (base del leaderboard y de los faints)
create table if not exists public.pokemon_stats (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  week int,
  stage text not null default 'regular',
  team_id uuid not null references public.teams(id),
  pokemon_id uuid references public.pokedex(id),
  pokemon_name text not null,
  roster_id uuid,                 -- fila de roster vigente cuando jugo (para reiniciar contador al cambiar de equipo)
  game int not null,
  kills int not null default 0,
  deaths int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pokemon_stats_season_idx on public.pokemon_stats(season_id, team_id);
create index if not exists pokemon_stats_roster_idx on public.pokemon_stats(roster_id);

-- 7) Bitacora de escapes
create table if not exists public.pokemon_escapes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  pokemon_id uuid not null references public.pokedex(id),
  faints int not null,
  match_id uuid references public.matches(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 8) Indices utiles por temporada
create index if not exists matches_season_idx on public.matches(season_id, week);
create index if not exists rosters_season_idx on public.rosters(season_id, team_id);
create index if not exists season_pokemon_season_idx on public.season_pokemon(season_id, pokemon_id);

-- 9) RLS en las tablas nuevas: lectura publica, escritura solo admin
alter table public.conferences enable row level security;
alter table public.season_teams enable row level security;
alter table public.pokemon_stats enable row level security;
alter table public.pokemon_escapes enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "public read conferences" on public.conferences for select using (true);
create policy "admin write conferences" on public.conferences for all using (public.is_admin()) with check (public.is_admin());
create policy "public read season_teams" on public.season_teams for select using (true);
create policy "admin write season_teams" on public.season_teams for all using (public.is_admin()) with check (public.is_admin());
create policy "public read pokemon_stats" on public.pokemon_stats for select using (true);
create policy "admin write pokemon_stats" on public.pokemon_stats for all using (public.is_admin()) with check (public.is_admin());
create policy "public read pokemon_escapes" on public.pokemon_escapes for select using (true);
create policy "admin write pokemon_escapes" on public.pokemon_escapes for all using (public.is_admin()) with check (public.is_admin());
