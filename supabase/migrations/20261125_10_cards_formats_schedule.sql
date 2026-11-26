-- T5: tarjetas de bono, formato de temporada (conferencias / tabla / bombos),
-- calendario con revelado semanal y Pokemon repetidos como shiny (tope por equipo).

-- =========================================================
-- 1) Reglas nuevas por temporada
-- =========================================================
alter table public.league_settings
  add column if not exists season_format text not null default 'conferences',
  add column if not exists pots_count int not null default 3,
  add column if not exists max_copies_per_team int default 1,          -- null = sin tope
  add column if not exists reveal_weekly boolean not null default false,
  add column if not exists schedule_start timestamptz,                  -- momento en que se revela la jornada 1
  add column if not exists cards_enabled boolean not null default false,
  add column if not exists cards_cutoff int,                            -- lugar desde el que se reciben (null = cualquiera que pierda)
  add column if not exists cards_scope text not null default 'conference',
  add column if not exists cards_block_after_use boolean not null default true;

do $$ begin
  alter table public.league_settings add constraint league_settings_format_chk check (season_format in ('conferences','table','pots'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.league_settings add constraint league_settings_cards_scope_chk check (cards_scope in ('conference','overall'));
exception when duplicate_object then null; end $$;

alter table public.season_teams add column if not exists pot int;
alter table public.rosters add column if not exists is_copy boolean not null default false;
alter table public.draft_picks add column if not exists is_copy boolean not null default false;

-- =========================================================
-- 2) Repetidos: la segunda copia de un Pokemon es "shiny" y cada equipo tiene un tope
-- =========================================================
create or replace function public.copy_room(p_season uuid, p_team uuid, p_draft boolean, p_exclude uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select max_copies_per_team from public.league_settings where season_id = p_season), null) is null
      or (case when p_draft
            then (select count(*) from public.draft_picks where season_id = p_season and team_id = p_team and is_copy and id is distinct from p_exclude)
            else (select count(*) from public.rosters where season_id = p_season and team_id = p_team and is_copy and id is distinct from p_exclude) end)
         < (select max_copies_per_team from public.league_settings where season_id = p_season);
$$;

create or replace function public.trg_draft_pick_copy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.is_copy := exists (select 1 from public.draft_picks where season_id = new.season_id and pokemon_id = new.pokemon_id and team_id <> new.team_id);
  if new.is_copy and not public.copy_room(new.season_id, new.team_id, true) then
    raise exception 'Este equipo ya tiene el maximo de Pokemon repetidos (%)', (select max_copies_per_team from public.league_settings where season_id = new.season_id);
  end if;
  return new;
end $$;
drop trigger if exists draft_pick_copy on public.draft_picks;
create trigger draft_pick_copy before insert on public.draft_picks for each row execute function public.trg_draft_pick_copy();

create or replace function public.trg_roster_copy() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pick boolean;
begin
  if tg_op = 'INSERT' then
    if new.obtained_method = 'draft' then
      select dp.is_copy into v_pick from public.draft_picks dp
      where dp.season_id = new.season_id and dp.team_id = new.team_id and dp.pokemon_id = new.pokemon_id limit 1;
    end if;
    new.is_copy := coalesce(v_pick, exists (select 1 from public.rosters where season_id = new.season_id and pokemon_id = new.pokemon_id and team_id <> new.team_id));
  elsif new.team_id is not distinct from old.team_id then
    return new;
  end if;
  if new.is_copy and (tg_op = 'UPDATE' or new.obtained_method is distinct from 'draft') and not public.copy_room(new.season_id, new.team_id, false, new.id) then
    raise exception 'Este equipo ya tiene el maximo de Pokemon repetidos (%)', (select max_copies_per_team from public.league_settings where season_id = new.season_id);
  end if;
  return new;
end $$;
drop trigger if exists roster_copy on public.rosters;
create trigger roster_copy before insert or update of team_id on public.rosters for each row execute function public.trg_roster_copy();

-- el autopick y el pick manual respetan el tope (mensaje claro y el autopick no se atora)
create or replace function public.make_draft_pick(p_team_id uuid, p_pokemon_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.draft_state; v_set public.league_settings; v_cost int; v_used int; v_count int;
begin
  select * into v_state from public.draft_state where season_id = public.active_season_id() and is_active and not coalesce(is_finished,false) for update;
  if not found then raise exception 'Draft no activo'; end if;
  if v_state.is_paused then raise exception 'Draft pausado'; end if;
  if not public.has_perm('draft.manage') and (v_state.current_team_id is distinct from public.my_team_id() or not public.has_perm('team.play')) then raise exception 'No autorizado'; end if;
  if v_state.current_team_id <> p_team_id then raise exception 'No es tu turno'; end if;
  v_set := public.settings_for(v_state.season_id);
  if not exists (select 1 from public.season_pokemon where season_id = v_state.season_id and pokemon_id = p_pokemon_id and available) then
    raise exception 'Pokemon no disponible';
  end if;
  if public.copies_taken(v_state.season_id, p_pokemon_id, true) >= public.copies_allowed(v_state.season_id, p_pokemon_id) then
    raise exception 'Ese Pokemon ya fue elegido';
  end if;
  if exists (select 1 from public.draft_picks where season_id = v_state.season_id and team_id = p_team_id and pokemon_id = p_pokemon_id) then
    raise exception 'Ya tienes ese Pokemon';
  end if;
  if public.copies_taken(v_state.season_id, p_pokemon_id, true) > 0 and not public.copy_room(v_state.season_id, p_team_id, true) then
    raise exception 'Ya tienes el maximo de Pokemon repetidos (%)', v_set.max_copies_per_team;
  end if;
  v_cost := public.next_copy_cost(v_state.season_id, p_pokemon_id, true);
  select count(*), coalesce(sum(coalesce(dp.points_paid, sp.points)),0) into v_count, v_used from public.draft_picks dp
  left join public.season_pokemon sp on sp.pokemon_id = dp.pokemon_id and sp.season_id = dp.season_id
  where dp.season_id = v_state.season_id and dp.team_id = p_team_id;
  if v_count >= v_set.roster_size then raise exception 'Ya tienes % Pokemon', v_set.roster_size; end if;
  if v_used + v_cost > v_set.max_points then raise exception 'Excedes % puntos', v_set.max_points; end if;
  insert into public.draft_picks(season_id, team_id, pokemon_id, round, pick_number, points_paid)
  values (v_state.season_id, p_team_id, p_pokemon_id, v_state.current_round, v_state.current_pick, v_cost);
  perform public.draft_advance(v_state.id);
end $$;

create or replace function public.force_auto_pick() returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.draft_state; v_set public.league_settings; v_used int; v_count int; v_best uuid; v_cost int; v_room boolean;
begin
  select * into v_state from public.draft_state where season_id = public.active_season_id() and is_active and not coalesce(is_finished,false) for update;
  if not found or v_state.is_paused then return; end if;
  v_set := public.settings_for(v_state.season_id);
  if not public.has_perm('draft.manage') and extract(epoch from (now() - v_state.turn_started_at)) < v_set.draft_pick_seconds then return; end if;
  select count(*), coalesce(sum(coalesce(dp.points_paid, sp.points)),0) into v_count, v_used from public.draft_picks dp
  left join public.season_pokemon sp on sp.pokemon_id = dp.pokemon_id and sp.season_id = dp.season_id
  where dp.season_id = v_state.season_id and dp.team_id = v_state.current_team_id;
  v_room := public.copy_room(v_state.season_id, v_state.current_team_id, true);
  if v_count < v_set.roster_size then
    select x.pokemon_id, x.cost into v_best, v_cost from (
      select sp.pokemon_id, p.name, public.next_copy_cost(v_state.season_id, sp.pokemon_id, true) cost
      from public.season_pokemon sp join public.pokedex p on p.id = sp.pokemon_id
      where sp.season_id = v_state.season_id and sp.available
        and public.copies_taken(v_state.season_id, sp.pokemon_id, true) < public.copies_allowed(v_state.season_id, sp.pokemon_id)
        and (v_room or public.copies_taken(v_state.season_id, sp.pokemon_id, true) = 0)
        and not exists (select 1 from public.draft_picks dp where dp.season_id = v_state.season_id and dp.team_id = v_state.current_team_id and dp.pokemon_id = sp.pokemon_id)
    ) x where x.cost <= v_set.max_points - v_used
    order by x.cost desc, x.name asc limit 1;
    if v_best is not null then
      insert into public.draft_picks(season_id, team_id, pokemon_id, round, pick_number, points_paid)
      values (v_state.season_id, v_state.current_team_id, v_best, v_state.current_round, v_state.current_pick, v_cost);
    end if;
  end if;
  perform public.draft_advance(v_state.id);
end $$;

-- =========================================================
-- 3) Calendario: revelado semanal y guardado desde el admin (cualquier formato)
-- =========================================================
create or replace function public.week_revealed(p_season uuid, p_week int) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select not ls.reveal_weekly or ls.schedule_start is null
                      or now() >= ls.schedule_start + make_interval(days => 7 * (greatest(coalesce(p_week,1),1) - 1))
                   from public.league_settings ls where ls.season_id = p_season), true);
$$;

drop policy if exists "public read matches" on public.matches;
create policy "public read matches" on public.matches for select using (
  coalesce(stage, 'regular') <> 'regular' or public.week_revealed(season_id, week)
  or public.has_perm('draft.manage') or public.has_perm('results.approve'));

-- p_matches: [{"week":1,"a":"<team uuid>","b":"<team uuid>","conference_id":"<uuid|null>"}]
create or replace function public.save_schedule(p_season_id uuid, p_matches jsonb, p_replace boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  perform public.require_perm('draft.manage');
  if exists (select 1 from public.matches where season_id = p_season_id and coalesce(stage,'regular') = 'regular') then
    if not p_replace then raise exception 'La temporada ya tiene calendario'; end if;
    if exists (select 1 from public.matches where season_id = p_season_id and coalesce(stage,'regular') = 'regular' and status = 'completed') then
      raise exception 'Ya hay series jugadas; no se puede regenerar';
    end if;
    delete from public.matches where season_id = p_season_id and coalesce(stage,'regular') = 'regular';
  end if;
  insert into public.matches(season_id, conference_id, conference, week, team_a, team_b, status, stage, games, replays)
  select p_season_id, nullif(x->>'conference_id','')::uuid, c.name, (x->>'week')::int, (x->>'a')::uuid, (x->>'b')::uuid, 'pending', 'regular', '[]', '[]'
  from jsonb_array_elements(p_matches) x left join public.conferences c on c.id = nullif(x->>'conference_id','')::uuid;
  get diagnostics v_count = row_count;
  update public.league_settings set regular_weeks = (select max(week) from public.matches where season_id = p_season_id and coalesce(stage,'regular') = 'regular')
  where season_id = p_season_id;
  return v_count;
end $$;

-- =========================================================
-- 4) Tarjetas de bono
-- =========================================================
create table if not exists public.card_defs (
  id text primary key,
  category text not null check (category in ('info','limit','own','market','table','special')),
  name text not null,
  effect text not null,
  rule text,
  sort int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.card_grants (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  week int not null,          -- jornada que se perdio
  for_week int not null,      -- jornada en la que se usa
  offered text[] not null,
  chosen text references public.card_defs(id),
  status text not null default 'offered' check (status in ('offered','chosen','void')),
  mulligan_used boolean not null default false,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  chosen_at timestamptz,
  unique (season_id, team_id, week)
);
create index if not exists card_grants_season_idx on public.card_grants(season_id, for_week);

alter table public.card_defs enable row level security;
alter table public.card_grants enable row level security;
drop policy if exists "public read card_defs" on public.card_defs;
create policy "public read card_defs" on public.card_defs for select using (true);
drop policy if exists "manage card_defs" on public.card_defs;
create policy "manage card_defs" on public.card_defs for all using (public.has_perm('season.manage')) with check (public.has_perm('season.manage'));
drop policy if exists "own or staff read card_grants" on public.card_grants;
create policy "own or staff read card_grants" on public.card_grants for select using (
  team_id = public.my_team_id() or public.has_perm('season.manage') or public.has_perm('results.approve'));
drop policy if exists "manage card_grants" on public.card_grants;
create policy "manage card_grants" on public.card_grants for all using (public.has_perm('season.manage')) with check (public.has_perm('season.manage'));

insert into public.card_defs(id, category, name, effect, rule, sort) values
  ('vistazo','info','Vistazo','Tu rival te ensena 2 de los 6 Pokemon que va a llevar.','24 h antes de la serie, por mensaje al admin y a ti.',1),
  ('hoja-abierta','info','Hoja abierta','Tu rival te dice que objeto lleva en 2 de sus Pokemon.','Tu eliges los 2 Pokemon de los 6 que llevara.',2),
  ('set-descubierto','info','Set al descubierto','Ves el set completo de 1 Pokemon que tu rival va a llevar.','Objeto, habilidad y movimientos.',3),
  ('spread-revelado','info','Spread revelado','Tu rival te muestra naturaleza y EVs de 2 Pokemon que va a llevar.','Tu eliges los 2 Pokemon de los 6 que llevara.',4),
  ('veto','limit','Veto','Prohibes 1 Pokemon del roster de tu rival.','Solo en un game que eliges antes de jugarlo. No puede ser el mas caro de su roster.',5),
  ('objeto-vetado','limit','Objeto vetado','Tu rival no puede usar 1 objeto que tu eliges.','Solo en un game que eliges antes de jugarlo.',6),
  ('movimiento-vetado','limit','Movimiento vetado','Prohibes 1 movimiento a un Pokemon especifico de tu rival.','Solo en un game que eliges antes de jugarlo.',7),
  ('ajuste-objeto','own','Ajuste de objeto','Entre games cambias el objeto de 1 de tus Pokemon.','Avisas a tu rival antes del siguiente game.',8),
  ('cambio-caliente','own','Cambio en caliente','Cambias 1 de tus 6 por otro Pokemon de tu roster.','Solo despues de perder un game de la serie.',9),
  ('ajuste-movimiento','own','Ajuste de movimiento','Entre games cambias 1 movimiento de 1 de tus Pokemon.','Avisas a tu rival antes del siguiente game.',10),
  ('fichaje-tardio','market','Fichaje fuera de tiempo','Puedes hacer un movimiento de agente libre fuera de tiempo.','Hasta 1 dia despues del cierre de la semana.',11),
  ('primero-fila','market','Primero en la fila','Tienes la prioridad #1 en waivers.','Solo esa semana; despues vuelves a tu lugar.',12),
  ('rebaja','market','Rebaja','Tu siguiente agente libre cuesta 1 punto menos.','Se aplica al aprobar el movimiento.',13),
  ('prestamo','market','Prestamo','Usas cualquier agente libre sin pagarlo.','Solo esa semana; despues vuelve al pool.',14),
  ('pronostico-doble','table','Pronostico doble','Tus aciertos en los pronosticos valen doble.','Solo los de esa jornada.',15),
  ('bono-remontada','table','Bono de remontada','Si ganas tu serie, sumas +1 de diferencial.','Se aplica solo en la tabla.',16),
  ('seguro','table','Seguro','Si pierdes 0-2, en la tabla cuenta como 1-2.','Se aplica solo en la tabla.',17),
  ('antimagia','special','Antimagia','Anula la tarjeta de tu rival.','Solo esa semana.',18),
  ('espejo','special','Espejo','Copias el efecto de la tarjeta de tu rival.','Si tu rival no tiene tarjeta, no pasa nada.',19),
  ('mulligan','special','Mulligan','Descartas tus 3 opciones y te salen 3 nuevas.','Se usa al momento de elegir; no da efecto en la serie.',20)
on conflict (id) do nothing;

-- tabla de posiciones (con los efectos de Bono de remontada y Seguro)
create or replace function public.season_standings(p_season uuid)
returns table(team_id uuid, conference_id uuid, w int, l int, d int, pts int, rank_conf int, rank_overall int)
language sql stable security definer set search_path = public as $$
  with s as (select coalesce(points_win,3) pw, coalesce(points_loss,0) pl, coalesce(season_format,'conferences') fmt
             from public.league_settings where season_id = p_season),
  m as (
    select mt.id, mt.week, mt.team_a, mt.team_b, mt.winner,
      (select count(*) from jsonb_array_elements(coalesce(mt.games,'[]')) g where g->>'winner' = 'teamA')::int ga,
      (select count(*) from jsonb_array_elements(coalesce(mt.games,'[]')) g where g->>'winner' = 'teamB')::int gb
    from public.matches mt
    where mt.season_id = p_season and coalesce(mt.stage,'regular') = 'regular' and mt.status = 'completed'),
  sides as (
    select m.team_a tid, m.week, (case when m.winner is not null then m.winner = 'teamA' else m.ga > m.gb end) won, m.ga - m.gb dd from m
    union all
    select m.team_b, m.week, (case when m.winner is not null then m.winner = 'teamB' else m.gb > m.ga end), m.gb - m.ga from m),
  adj as (
    select x.tid, x.won, x.dd
      + case when cg.chosen = 'bono-remontada' and x.won then 1
             when cg.chosen = 'seguro' and not x.won and x.dd <= -2 then 1 else 0 end dd
    from sides x left join public.card_grants cg on cg.season_id = p_season and cg.team_id = x.tid and cg.for_week = x.week and cg.status = 'chosen'),
  agg as (
    select st.team_id, st.conference_id,
      count(*) filter (where a.won)::int w, count(*) filter (where a.won = false)::int l, coalesce(sum(a.dd),0)::int d
    from public.season_teams st left join adj a on a.tid = st.team_id
    where st.season_id = p_season group by st.team_id, st.conference_id)
  select agg.team_id, agg.conference_id, agg.w, agg.l, agg.d, (agg.w * s.pw + agg.l * s.pl)::int,
    (rank() over (partition by case when s.fmt = 'conferences' then agg.conference_id end order by agg.w * s.pw + agg.l * s.pl desc, agg.d desc))::int,
    (rank() over (order by agg.w * s.pw + agg.l * s.pl desc, agg.d desc))::int
  from agg cross join s;
$$;

create or replace function public.draw_cards(p_n int, p_exclude text[] default '{}') returns text[]
language sql volatile security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from (select id from public.card_defs where active and not (id = any(p_exclude)) order by random() limit p_n) x;
$$;

-- al cerrar una serie de fase regular, el perdedor puede recibir tarjeta
create or replace function public.grant_card_for_match(p_match uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_m record; v_set public.league_settings; v_loser uuid; v_rank int; v_id uuid;
begin
  select * into v_m from public.matches where id = p_match;
  if not found or v_m.status <> 'completed' or coalesce(v_m.stage,'regular') <> 'regular' or v_m.winner not in ('teamA','teamB') then return null; end if;
  v_set := public.settings_for(v_m.season_id);
  if v_set is null or not v_set.cards_enabled then return null; end if;
  v_loser := case when v_m.winner = 'teamA' then v_m.team_b else v_m.team_a end;
  if v_set.cards_block_after_use and exists (select 1 from public.card_grants where season_id = v_m.season_id and team_id = v_loser
       and for_week = v_m.week and status = 'chosen' and chosen <> 'mulligan') then
    return null;
  end if;
  if v_set.cards_cutoff is not null then
    select case when v_set.cards_scope = 'overall' or v_set.season_format <> 'conferences' then s.rank_overall else s.rank_conf end
    into v_rank from public.season_standings(v_m.season_id) s where s.team_id = v_loser;
    if coalesce(v_rank, 0) < v_set.cards_cutoff then return null; end if;
  end if;
  insert into public.card_grants(season_id, team_id, match_id, week, for_week, offered)
  values (v_m.season_id, v_loser, v_m.id, v_m.week, v_m.week + 1, public.draw_cards(3))
  on conflict (season_id, team_id, week) do nothing
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.trg_match_cards() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.grant_card_for_match(new.id);
  end if;
  return new;
end $$;
drop trigger if exists match_cards on public.matches;
create trigger match_cards after update of status on public.matches for each row execute function public.trg_match_cards();

-- el trainer elige 1 de sus 3 tarjetas (Mulligan: cambia las 3 por otras 3, una vez)
create or replace function public.choose_card(p_grant uuid, p_card text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_g public.card_grants; v_new text[];
begin
  select * into v_g from public.card_grants where id = p_grant for update;
  if not found then raise exception 'Tarjeta no encontrada'; end if;
  if not public.has_perm('season.manage') and (v_g.team_id is distinct from public.my_team_id() or not public.has_perm('team.play')) then
    raise exception 'No autorizado';
  end if;
  if v_g.status <> 'offered' then raise exception 'Esta tarjeta ya fue elegida'; end if;
  if not (p_card = any(v_g.offered)) then raise exception 'Esa tarjeta no esta entre tus opciones'; end if;
  if exists (select 1 from public.matches mt where mt.season_id = v_g.season_id and mt.week = v_g.for_week
       and coalesce(mt.stage,'regular') = 'regular' and v_g.team_id in (mt.team_a, mt.team_b)
       and (mt.status = 'completed' or exists (select 1 from public.reports r where r.match_id = mt.id and r.status <> 'rejected'))) then
    update public.card_grants set status = 'void' where id = p_grant;
    raise exception 'Tu serie de la jornada % ya se jugo; esta tarjeta vencio', v_g.for_week;
  end if;
  if p_card = 'mulligan' then
    if v_g.mulligan_used then raise exception 'Ya usaste el Mulligan'; end if;
    v_new := public.draw_cards(3, v_g.offered || array['mulligan']);
    update public.card_grants set offered = v_new, mulligan_used = true where id = p_grant;
    return jsonb_build_object('offered', to_jsonb(v_new));
  end if;
  update public.card_grants set chosen = p_card, status = 'chosen', chosen_at = now() where id = p_grant;
  return jsonb_build_object('chosen', p_card);
end $$;

-- tablero publico: todos ven el TIPO de tarjeta (boca abajo); la carta se revela al dueno,
-- al staff y a todos una vez que la serie de esa jornada termino
create or replace function public.card_board(p_season uuid)
returns table(grant_id uuid, team_id uuid, week int, for_week int, status text, category text, card_id text)
language sql stable security definer set search_path = public as $$
  select g.id, g.team_id, g.week, g.for_week, g.status, d.category,
    case when g.team_id = public.my_team_id() or public.has_perm('season.manage') or public.has_perm('results.approve')
           or exists (select 1 from public.matches mt where mt.season_id = g.season_id and mt.week = g.for_week
                      and coalesce(mt.stage,'regular') = 'regular' and g.team_id in (mt.team_a, mt.team_b) and mt.status = 'completed')
         then g.chosen end
  from public.card_grants g left join public.card_defs d on d.id = g.chosen
  where g.season_id = p_season and g.status = 'chosen';
$$;

-- admin: dar una tarjeta a mano (3 al azar) o anularla
create or replace function public.admin_grant_card(p_season uuid, p_team uuid, p_week int) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_perm('season.manage');
  insert into public.card_grants(season_id, team_id, week, for_week, offered, manual)
  values (p_season, p_team, p_week, p_week + 1, public.draw_cards(3), true)
  on conflict (season_id, team_id, week) do update set offered = excluded.offered, status = 'offered', chosen = null, chosen_at = null, mulligan_used = false, manual = true
  returning id into v_id;
  return v_id;
end $$;

-- pronosticos: con "Pronostico doble" los aciertos de esa jornada valen 2
create or replace function public.prediction_table(p_season uuid)
returns table(user_id uuid, label text, team_id uuid, hits int, total int)
language sql stable security definer set search_path = public as $$
  select p.user_id,
    coalesce(st.display_name, t.name, pr.display_name, split_part(pr.email, '@', 1), 'Trainer'),
    t.id,
    coalesce(sum(case when (p.pick = 'a' and m.winner = 'teamA') or (p.pick = 'b' and m.winner = 'teamB')
      then case when exists (select 1 from public.card_grants cg where cg.season_id = p_season and cg.team_id = t.id
                             and cg.for_week = m.week and cg.status = 'chosen' and cg.chosen = 'pronostico-doble') then 2 else 1 end
      else 0 end), 0)::int,
    count(*)::int
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.status = 'completed'
  left join public.profiles pr on pr.id = p.user_id
  left join public.teams t on t.user_id = p.user_id
  left join public.season_teams st on st.team_id = t.id and st.season_id = p_season
  where p.season_id = p_season
  group by p.user_id, st.display_name, t.name, t.id, pr.display_name, pr.email;
$$;

-- permisos de ejecucion
do $$
declare f text;
begin
  foreach f in array array['choose_card(uuid,text)','admin_grant_card(uuid,uuid,integer)','save_schedule(uuid,jsonb,boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['grant_card_for_match(uuid)','draw_cards(integer,text[])','trg_match_cards()','trg_roster_copy()','trg_draft_pick_copy()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
