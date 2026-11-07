-- Roles y permisos editables, pronosticos y apodos en BD, Pokemon repetidos con sobrecosto,
-- starters (inmunes a la regla de escape), deshacer el ultimo pick y publicaciones del CM.

-- =========================================================
-- 1) ROLES Y PERMISOS
-- =========================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.roles(key, name, description, permissions, is_system) values
  ('admin', 'Administrador', 'Acceso total a la liga', array['all'], true),
  ('cm', 'Community manager', 'Sube contenido y genera las imagenes para redes', array['admin.access','content.manage','media.access'], true),
  ('player', 'Jugador', 'Trainer de un equipo: draft, reportes, fichajes, trades, pronosticos y apodos', array['team.play','predictions.play'], true)
on conflict (key) do nothing;

alter table public.profiles add column if not exists role_id uuid references public.roles(id);
alter table public.profiles add column if not exists display_name text;
update public.profiles p set role_id = r.id from public.roles r
where p.role_id is null and r.key = case when p.role = 'admin' then 'admin' when p.role = 'cm' then 'cm' else 'player' end;

-- el texto profiles.role se mantiene igual a la clave del rol (compatibilidad con el sitio S4)
create or replace function public.sync_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role_id is null then select id into new.role_id from public.roles where key = coalesce(new.role, 'player'); end if;
  select key into new.role from public.roles where id = new.role_id;
  return new;
end $$;
drop trigger if exists trg_sync_profile_role on public.profiles;
create trigger trg_sync_profile_role before insert or update of role_id, role on public.profiles
for each row execute function public.sync_profile_role();

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles pr join public.roles r on r.id = pr.role_id
    where pr.id = auth.uid() and ('all' = any(r.permissions) or p = any(r.permissions)));
$$;
create or replace function public.my_permissions() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select r.permissions from public.profiles pr join public.roles r on r.id = pr.role_id where pr.id = auth.uid()), '{}');
$$;
-- is_admin = acceso total
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select public.has_perm('all'); $$;

create or replace function public.require_perm(p text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm(p) then raise exception 'No tienes permiso para esto (%)', p; end if;
end $$;

-- el rol admin siempre conserva 'all' y debe quedar al menos un admin
create or replace function public.guard_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.key = 'admin' then
    new.key := 'admin';
    if not ('all' = any(new.permissions)) then new.permissions := array_append(new.permissions, 'all'); end if;
  end if;
  if tg_op = 'DELETE' then
    if old.is_system then raise exception 'Los roles base no se pueden borrar'; end if;
    update public.profiles set role_id = (select id from public.roles where key = 'player') where role_id = old.id;
    return old;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_roles on public.roles;
create trigger trg_guard_roles before update or delete on public.roles for each row execute function public.guard_roles();

create or replace function public.set_user_role(p_user uuid, p_role_key text) returns void
language plpgsql security definer set search_path = public as $$
declare v_role uuid;
begin
  perform public.require_perm('roles.manage');
  select id into v_role from public.roles where key = p_role_key;
  if v_role is null then raise exception 'Rol no encontrado'; end if;
  update public.profiles set role_id = v_role where id = p_user;
  if not exists (select 1 from public.profiles pr join public.roles r on r.id = pr.role_id where 'all' = any(r.permissions)) then
    raise exception 'Debe quedar al menos un administrador';
  end if;
end $$;

-- usuarios nuevos entran como jugadores
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role, role_id)
  values (new.id, new.email, 'player', (select id from public.roles where key = 'player'));
  return new;
end $$;

alter table public.roles enable row level security;
create policy "public read roles" on public.roles for select using (true);
create policy "manage roles" on public.roles for all using (public.has_perm('roles.manage')) with check (public.has_perm('roles.manage'));

-- =========================================================
-- 2) POLITICAS POR PERMISO (reemplazan "admin write")
-- =========================================================
do $$
declare r record;
begin
  for r in select * from (values
    ('seasons','season.manage'),('league_settings','season.manage'),('conferences','season.manage'),('season_teams','season.manage'),('teams','season.manage'),
    ('season_pokemon','pool.manage'),('pokedex','pool.manage'),
    ('draft_state','draft.manage'),('draft_order','draft.manage'),('draft_picks','draft.manage'),
    ('matches','results.approve'),('reports','results.approve'),('pokemon_stats','results.approve'),
    ('transactions','market.approve'),('rosters','market.approve'),('waiver_order','market.approve'),('pokemon_escapes','market.approve'),
    ('type_chart','all')) x(t, p)
  loop
    execute format('drop policy if exists "admin write %1$s" on public.%1$I', r.t);
    execute format('drop policy if exists "perm write %1$s" on public.%1$I', r.t);
    execute format('create policy "perm write %1$s" on public.%1$I for all using (public.has_perm(%2$L)) with check (public.has_perm(%2$L))', r.t, r.p);
  end loop;
end $$;
drop policy if exists "admin manage profiles" on public.profiles;
drop policy if exists "own profile read" on public.profiles;
create policy "profile read" on public.profiles for select using (id = auth.uid() or public.has_perm('roles.manage') or public.has_perm('season.manage'));
create policy "profile manage" on public.profiles for all using (public.has_perm('roles.manage')) with check (public.has_perm('roles.manage'));
create policy "own profile name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role_id is not distinct from (select role_id from public.profiles where id = auth.uid()));

-- =========================================================
-- 3) PRONOSTICOS
-- =========================================================
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  pick text not null check (pick in ('a','b')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, user_id)
);
alter table public.predictions enable row level security;
-- los picks de otros se ven solo cuando la serie ya termino
create policy "read predictions" on public.predictions for select using (
  user_id = auth.uid() or exists (select 1 from public.matches m where m.id = match_id and m.status = 'completed'));

create or replace function public.predictions_open(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches m where m.id = p_match and m.status <> 'completed'
    and (m.scheduled_at is null or now() < m.scheduled_at)
    and not exists (select 1 from public.reports r where r.match_id = m.id and r.status in ('pending','approved')));
$$;
create or replace function public.save_prediction(p_match uuid, p_pick text) returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid;
begin
  perform public.require_perm('predictions.play');
  if not public.predictions_open(p_match) then raise exception 'Los pronosticos de esta serie ya cerraron'; end if;
  select season_id into v_season from public.matches where id = p_match;
  if p_pick is null then delete from public.predictions where match_id = p_match and user_id = auth.uid(); return; end if;
  insert into public.predictions(season_id, match_id, user_id, pick) values (v_season, p_match, auth.uid(), p_pick)
  on conflict (match_id, user_id) do update set pick = excluded.pick, updated_at = now();
end $$;

-- tabla de aciertos de una temporada (con nombre visible: equipo, nombre o inicio del correo)
create or replace function public.prediction_table(p_season uuid)
returns table(user_id uuid, label text, team_id uuid, hits int, total int)
language sql stable security definer set search_path = public as $$
  select p.user_id,
    coalesce(st.display_name, t.name, pr.display_name, split_part(pr.email, '@', 1), 'Trainer'),
    t.id,
    count(*) filter (where (p.pick = 'a' and m.winner = 'teamA') or (p.pick = 'b' and m.winner = 'teamB'))::int,
    count(*)::int
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.status = 'completed'
  left join public.profiles pr on pr.id = p.user_id
  left join public.teams t on t.user_id = p.user_id
  left join public.season_teams st on st.team_id = t.id and st.season_id = p_season
  where p.season_id = p_season
  group by p.user_id, st.display_name, t.name, t.id, pr.display_name, pr.email;
$$;

-- =========================================================
-- 4) APODOS
-- =========================================================
create table if not exists public.pokemon_nicknames (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  pokemon_name text not null,
  nickname text not null check (char_length(nickname) between 1 and 16),
  updated_at timestamptz not null default now(),
  unique (season_id, team_id, pokemon_name)
);
alter table public.pokemon_nicknames enable row level security;
create policy "public read nicknames" on public.pokemon_nicknames for select using (true);
create policy "owner write nicknames" on public.pokemon_nicknames for all to authenticated
  using (team_id = public.my_team_id() or public.has_perm('season.manage'))
  with check ((team_id = public.my_team_id() and public.has_perm('team.play')) or public.has_perm('season.manage'));

-- =========================================================
-- 5) POKEMON REPETIDOS Y STARTERS
-- =========================================================
alter table public.league_settings
  add column if not exists allow_duplicates boolean not null default false,
  add column if not exists starters_per_team int not null default 0;
alter table public.season_pokemon
  add column if not exists max_copies int not null default 1,
  add column if not exists copy_surcharge int not null default 0;
alter table public.rosters
  add column if not exists points_paid int,
  add column if not exists is_starter boolean not null default false;
alter table public.draft_picks add column if not exists points_paid int;

update public.rosters r set points_paid = sp.points from public.season_pokemon sp
where r.points_paid is null and sp.season_id = r.season_id and sp.pokemon_id = r.pokemon_id;
update public.draft_picks d set points_paid = sp.points from public.season_pokemon sp
where d.points_paid is null and sp.season_id = d.season_id and sp.pokemon_id = d.pokemon_id;

-- copias permitidas de un Pokemon en una temporada
create or replace function public.copies_allowed(p_season uuid, p_mon uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when coalesce((select allow_duplicates from public.league_settings where season_id = p_season), false)
    then greatest(1, coalesce((select max_copies from public.season_pokemon where season_id = p_season and pokemon_id = p_mon), 1)) else 1 end;
$$;
-- copias ya tomadas (en el draft si esta en curso; si no, en los rosters)
create or replace function public.copies_taken(p_season uuid, p_mon uuid, p_draft boolean) returns int
language sql stable security definer set search_path = public as $$
  select case when p_draft then (select count(*) from public.draft_picks where season_id = p_season and pokemon_id = p_mon)
    else (select count(*) from public.rosters where season_id = p_season and pokemon_id = p_mon) end::int;
$$;
-- costo de la siguiente copia: base + sobrecosto por cada copia ya tomada
create or replace function public.next_copy_cost(p_season uuid, p_mon uuid, p_draft boolean) returns int
language sql stable security definer set search_path = public as $$
  select sp.points + sp.copy_surcharge * public.copies_taken(p_season, p_mon, p_draft)
  from public.season_pokemon sp where sp.season_id = p_season and sp.pokemon_id = p_mon;
$$;

create or replace function public.team_points(p_team uuid, p_season uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce(r.points_paid, sp.points)),0)::int from public.rosters r
  left join public.season_pokemon sp on sp.pokemon_id = r.pokemon_id and sp.season_id = r.season_id
  where r.team_id = p_team and r.season_id = p_season;
$$;
-- puntos de Pokemon que un equipo ya tiene (lo que pago)
create or replace function public.roster_names_points(p_team uuid, p_names jsonb, p_season uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce(r.points_paid, sp.points)),0)::int from public.rosters r
  join public.pokedex p on p.id = r.pokemon_id
  left join public.season_pokemon sp on sp.pokemon_id = r.pokemon_id and sp.season_id = r.season_id
  where r.team_id = p_team and r.season_id = p_season and p.name in (select jsonb_array_elements_text(coalesce(p_names,'[]'::jsonb)));
$$;

-- marcar / quitar starter (inmune al escape)
create or replace function public.set_starter(p_roster_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_max int; v_status text; v_n int;
begin
  select * into r from public.rosters where id = p_roster_id;
  if not found then raise exception 'Pokemon no encontrado'; end if;
  select starters_per_team into v_max from public.league_settings where season_id = r.season_id;
  select status into v_status from public.seasons where id = r.season_id;
  if not public.has_perm('market.approve') then
    if r.team_id is distinct from public.my_team_id() or not public.has_perm('team.play') then raise exception 'No autorizado'; end if;
    if v_status not in ('setup','draft') then raise exception 'Los starters se eligen antes de que empiece la fase regular'; end if;
  end if;
  if p_on then
    if coalesce(v_max,0) = 0 then raise exception 'Esta temporada no usa starters'; end if;
    select count(*) into v_n from public.rosters where team_id = r.team_id and season_id = r.season_id and is_starter and id <> r.id;
    if v_n >= v_max then raise exception 'Solo puedes tener % starter(s)', v_max; end if;
  end if;
  update public.rosters set is_starter = p_on where id = p_roster_id;
end $$;

-- =========================================================
-- 6) PUBLICACIONES DEL CM
-- =========================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  title text not null,
  body text,
  image_url text,
  link_url text,
  pinned boolean not null default false,
  published boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "read posts" on public.posts for select using (published or public.has_perm('content.manage'));
create policy "manage posts" on public.posts for all using (public.has_perm('content.manage')) with check (public.has_perm('content.manage'));

insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
drop policy if exists "media public read" on storage.objects;
drop policy if exists "media cm write" on storage.objects;
drop policy if exists "media cm update" on storage.objects;
drop policy if exists "media cm delete" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media cm write" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.has_perm('content.manage'));
create policy "media cm update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.has_perm('content.manage'));
create policy "media cm delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.has_perm('content.manage'));
