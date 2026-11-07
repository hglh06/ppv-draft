-- RPCs por temporada: reglas desde league_settings, permisos de admin/dueño,
-- mecanica de escape por faints y herramientas del panel de admin.
-- Mantiene las firmas que usa el frontend de la S4.

-- approve_report cambia de void a jsonb
drop function if exists public.approve_report(uuid);

-- ========== helpers ==========
create or replace function public.active_season_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.seasons where is_active order by number desc nulls last limit 1;
$$;

create or replace function public.my_team_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.teams where user_id = auth.uid() limit 1;
$$;

create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el admin puede hacer esto'; end if;
end $$;

create or replace function public.settings_for(p_season uuid) returns public.league_settings
language sql stable security definer set search_path = public as $$
  select * from public.league_settings where season_id = p_season limit 1;
$$;

-- puntos usados por un equipo en una temporada (roster actual)
create or replace function public.team_points(p_team uuid, p_season uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(sp.points),0)::int from public.rosters r
  join public.season_pokemon sp on sp.pokemon_id = r.pokemon_id and sp.season_id = r.season_id
  where r.team_id = p_team and r.season_id = p_season;
$$;

create or replace function public.names_points(p_names jsonb, p_season uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(sp.points),0)::int from public.season_pokemon sp
  join public.pokedex p on p.id = sp.pokemon_id
  where sp.season_id = p_season and p.name in (select jsonb_array_elements_text(coalesce(p_names,'[]'::jsonb)));
$$;

create or replace function public.current_week(p_season uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(min(week) filter (where status <> 'completed'), max(week), 0)::int
  from public.matches where season_id = p_season and stage = 'regular';
$$;

-- ========== mecanica de escape ==========
-- Revisa los rosters de los equipos de una serie. Si un Pokemon llego al limite de faints,
-- sale del roster, queda en la bitacora y vuelve a estar libre en waivers.
create or replace function public.process_escapes(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_match record; v_set public.league_settings; r record; v_faints int; v_tx uuid;
  v_out jsonb := '[]'::jsonb; v_last timestamptz;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then return v_out; end if;
  v_set := public.settings_for(v_match.season_id);
  if v_set.faint_limit is null or v_set.faint_limit <= 0 then return v_out; end if;
  if v_match.stage <> 'regular' and not v_set.faint_in_playoffs then return v_out; end if;

  for r in
    select ro.id, ro.team_id, ro.pokemon_id, ro.created_at, pd.name
    from public.rosters ro join public.pokedex pd on pd.id = ro.pokemon_id
    where ro.season_id = v_match.season_id and ro.team_id in (v_match.team_a, v_match.team_b)
  loop
    if v_set.faint_reset_on_transfer then
      select coalesce(sum(deaths),0) into v_faints from public.pokemon_stats ps
      where ps.roster_id = r.id and (v_set.faint_in_playoffs or ps.stage = 'regular');
    else
      select max(created_at) into v_last from public.pokemon_escapes
      where season_id = v_match.season_id and pokemon_id = r.pokemon_id;
      select coalesce(sum(deaths),0) into v_faints from public.pokemon_stats ps
      where ps.season_id = v_match.season_id and ps.pokemon_id = r.pokemon_id
        and (v_set.faint_in_playoffs or ps.stage = 'regular')
        and (v_last is null or ps.created_at > v_last);
    end if;

    if v_faints >= v_set.faint_limit then
      insert into public.transactions(type, proposed_by, team_a, give, receive, status, created_at, approved_at, season_id, note)
      values ('escape', auth.uid(), r.team_id, jsonb_build_array(r.name), '[]'::jsonb, 'approved', now(), now(),
              v_match.season_id, format('%s se escapo tras %s faints', r.name, v_faints))
      returning id into v_tx;
      insert into public.pokemon_escapes(season_id, team_id, pokemon_id, faints, match_id, transaction_id)
      values (v_match.season_id, r.team_id, r.pokemon_id, v_faints, p_match_id, v_tx);
      delete from public.rosters where id = r.id;
      v_out := v_out || jsonb_build_object('team_id', r.team_id, 'pokemon', r.name, 'faints', v_faints);
    end if;
  end loop;
  return v_out;
end $$;

-- Faints acumulados por Pokemon del roster actual (para mostrar "en riesgo")
create or replace function public.roster_faints(p_season uuid)
returns table(roster_id uuid, team_id uuid, pokemon_id uuid, pokemon_name text, faints int, faint_limit int)
language sql stable security definer set search_path = public as $$
  with s as (select * from public.league_settings where season_id = p_season limit 1)
  select ro.id, ro.team_id, ro.pokemon_id, pd.name,
    (case when s.faint_reset_on_transfer then
      (select coalesce(sum(deaths),0) from public.pokemon_stats ps where ps.roster_id = ro.id
         and (s.faint_in_playoffs or ps.stage = 'regular'))
     else
      (select coalesce(sum(deaths),0) from public.pokemon_stats ps where ps.season_id = p_season and ps.pokemon_id = ro.pokemon_id
         and (s.faint_in_playoffs or ps.stage = 'regular')
         and ps.created_at > coalesce((select max(e.created_at) from public.pokemon_escapes e
              where e.season_id = p_season and e.pokemon_id = ro.pokemon_id), '-infinity'))
     end)::int,
    s.faint_limit
  from public.rosters ro join public.pokedex pd on pd.id = ro.pokemon_id cross join s
  where ro.season_id = p_season;
$$;

-- ========== reportes ==========
create or replace function public.approve_report(p_report_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_report record; v_match record; v_games jsonb; v_season uuid;
begin
  perform public.require_admin();
  select * into v_report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Reporte no encontrado'; end if;
  if v_report.status = 'approved' then raise exception 'Este reporte ya fue aprobado'; end if;
  select * into v_match from public.matches where id = v_report.match_id for update;
  if not found then raise exception 'Serie no encontrada'; end if;
  if v_report.winner not in ('teamA','teamB') then raise exception 'Ganador invalido'; end if;
  v_season := coalesce(v_match.season_id, v_report.season_id, public.active_season_id());

  select coalesce(jsonb_agg(jsonb_build_object('game', ord, 'winner', g->>'winner', 'replay', g->>'replay') order by ord), '[]'::jsonb)
  into v_games from jsonb_array_elements(coalesce(v_report.games,'[]'::jsonb)) with ordinality x(g, ord);

  update public.matches set status = 'completed', games = v_games, replays = coalesce(v_report.replays,'[]'::jsonb),
    winner = v_report.winner, season_id = v_season where id = v_match.id;

  -- si habia stats de un reporte anterior de esta serie, se reemplazan
  delete from public.pokemon_stats where match_id = v_match.id;
  insert into public.pokemon_stats(season_id, match_id, report_id, week, stage, team_id, pokemon_id, pokemon_name, roster_id, game, kills, deaths)
  select v_season, v_match.id, v_report.id, v_match.week, coalesce(v_match.stage,'regular'), tid, pd.id, mon->>'name',
    (select ro.id from public.rosters ro where ro.team_id = tid and ro.season_id = v_season and ro.pokemon_id = pd.id limit 1),
    (g->>'game')::int, coalesce((g->>'kills')::int,0), coalesce((g->>'deaths')::int,0)
  from (values (v_match.team_a, v_report.team_a_data), (v_match.team_b, v_report.team_b_data)) side(tid, data)
  cross join lateral jsonb_array_elements(coalesce(side.data,'[]'::jsonb)) mon
  cross join lateral jsonb_array_elements(coalesce(mon->'games','[]'::jsonb)) g
  left join public.pokedex pd on pd.name = mon->>'name';

  update public.reports set status = 'rejected', reviewed_at = now()
  where match_id = v_match.id and id <> p_report_id and status = 'pending';
  update public.reports set status = 'approved', reviewed_at = now(), season_id = v_season where id = p_report_id;

  return jsonb_build_object('escapes', public.process_escapes(v_match.id));
end $$;

create or replace function public.reject_report(p_report_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.reports set status = 'rejected', reviewed_at = now() where id = p_report_id;
end $$;

-- Un trainer reporta su propia serie
create or replace function public.submit_report(p_match_id uuid, p_games jsonb, p_team_a_data jsonb, p_team_b_data jsonb, p_winner text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_match record; v_id uuid; v_team uuid := public.my_team_id();
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Serie no encontrada'; end if;
  if not public.is_admin() and (v_team is null or v_team not in (v_match.team_a, v_match.team_b)) then
    raise exception 'Solo los trainers de esta serie pueden reportarla';
  end if;
  if v_match.status = 'completed' then raise exception 'Esta serie ya tiene resultado'; end if;
  if p_winner not in ('teamA','teamB') then raise exception 'Ganador invalido'; end if;
  insert into public.reports(match_id, games, replays, team_a_data, team_b_data, winner, status, season_id, submitted_by)
  values (p_match_id, p_games, (select coalesce(jsonb_agg(g->'replay'),'[]'::jsonb) from jsonb_array_elements(p_games) g),
          p_team_a_data, p_team_b_data, p_winner, 'pending', v_match.season_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ========== transacciones ==========
create or replace function public.request_free_agent(p_team_id uuid, p_give jsonb, p_receive jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id(); v_set public.league_settings; v_new_total int; v_new_count int; v_used int;
begin
  if p_team_id is distinct from public.my_team_id() and not public.is_admin() then raise exception 'No autorizado'; end if;
  v_set := public.settings_for(v_season);
  if v_set is null then raise exception 'La temporada activa no tiene reglas'; end if;

  -- lo que se recibe debe estar en el pool y libre
  if exists (select 1 from jsonb_array_elements_text(coalesce(p_receive,'[]'::jsonb)) n
     where not exists (select 1 from public.season_pokemon sp join public.pokedex p on p.id = sp.pokemon_id
                       where sp.season_id = v_season and sp.available and p.name = n)
        or exists (select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id
                   where ro.season_id = v_season and p.name = n)) then
    raise exception 'Uno de los Pokemon no esta libre';
  end if;
  -- lo que se suelta debe ser propio
  if exists (select 1 from jsonb_array_elements_text(coalesce(p_give,'[]'::jsonb)) n
     where not exists (select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id
                       where ro.season_id = v_season and ro.team_id = p_team_id and p.name = n)) then
    raise exception 'Solo puedes soltar Pokemon de tu roster';
  end if;

  select coalesce(fa_used,0) into v_used from public.waiver_order where season_id = v_season and team_id = p_team_id;
  if coalesce(v_used,0) >= v_set.max_fa and jsonb_array_length(coalesce(p_receive,'[]'::jsonb)) > 0 then
    raise exception 'Ya usaste tus % movimientos de FA', v_set.max_fa;
  end if;

  v_new_total := public.team_points(p_team_id, v_season) - public.names_points(p_give, v_season) + public.names_points(p_receive, v_season);
  v_new_count := (select count(*) from public.rosters where team_id = p_team_id and season_id = v_season)
    - jsonb_array_length(coalesce(p_give,'[]'::jsonb)) + jsonb_array_length(coalesce(p_receive,'[]'::jsonb));
  if v_new_total > v_set.max_points then
    raise exception 'Excedes el maximo de puntos (%). Nuevo total: %', v_set.max_points, v_new_total;
  end if;
  if v_new_count > v_set.roster_size then
    raise exception 'Excedes el tamano de roster (%). Nuevo tamano: %', v_set.roster_size, v_new_count;
  end if;

  insert into public.transactions(type, proposed_by, team_a, give, receive, status, season_id)
  values ('free_agent', auth.uid(), p_team_id, coalesce(p_give,'[]'::jsonb), coalesce(p_receive,'[]'::jsonb), 'pending_admin', v_season);
end $$;

create or replace function public.request_trade(p_team_a uuid, p_team_b uuid, p_give jsonb, p_receive jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id(); v_set public.league_settings; va int; vb int; ta int; tb int;
begin
  if p_team_a is distinct from public.my_team_id() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_team_a = p_team_b then raise exception 'No puedes tradear contigo mismo'; end if;
  v_set := public.settings_for(v_season);
  if exists (select 1 from jsonb_array_elements_text(coalesce(p_give,'[]'::jsonb)) n where not exists (
       select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id
       where ro.season_id = v_season and ro.team_id = p_team_a and p.name = n))
  or exists (select 1 from jsonb_array_elements_text(coalesce(p_receive,'[]'::jsonb)) n where not exists (
       select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id
       where ro.season_id = v_season and ro.team_id = p_team_b and p.name = n)) then
    raise exception 'Los Pokemon del trade deben estar en los rosters de cada equipo';
  end if;
  va := public.names_points(p_give, v_season); vb := public.names_points(p_receive, v_season);
  ta := public.team_points(p_team_a, v_season) - va + vb;
  tb := public.team_points(p_team_b, v_season) - vb + va;
  if abs(va - vb) > v_set.trade_max_diff then
    raise exception 'La diferencia no puede ser mayor a % puntos', v_set.trade_max_diff;
  end if;
  if ta > v_set.max_points then raise exception 'Tu equipo excede el limite de puntos'; end if;
  if tb > v_set.max_points then raise exception 'El otro equipo excede el limite de puntos'; end if;
  insert into public.transactions(type, proposed_by, team_a, team_b, give, receive, status, season_id)
  values ('trade', auth.uid(), p_team_a, p_team_b, p_give, p_receive, 'pending_player', v_season);
end $$;

create or replace function public.accept_trade(p_transaction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_tx record;
begin
  select * into v_tx from public.transactions where id = p_transaction_id and type = 'trade' and status = 'pending_player';
  if not found then raise exception 'Trade no valido'; end if;
  if v_tx.team_b is distinct from public.my_team_id() then raise exception 'No autorizado'; end if;
  update public.transactions set status = 'pending_admin' where id = p_transaction_id;
end $$;

create or replace function public.decline_trade(p_transaction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_tx record;
begin
  select * into v_tx from public.transactions where id = p_transaction_id and type = 'trade' and status = 'pending_player';
  if not found then raise exception 'Trade no valido'; end if;
  if v_tx.team_b is distinct from public.my_team_id() then raise exception 'No autorizado'; end if;
  update public.transactions set status = 'rejected' where id = p_transaction_id;
end $$;

create or replace function public.approve_transaction(p_transaction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_tx record; v_season uuid; v_set public.league_settings; v_pos int; v_max int; v_week int;
begin
  perform public.require_admin();
  select * into v_tx from public.transactions where id = p_transaction_id and status = 'pending_admin' for update;
  if not found then raise exception 'Transaccion no valida'; end if;
  v_season := coalesce(v_tx.season_id, public.active_season_id());
  v_set := public.settings_for(v_season);
  v_week := public.current_week(v_season);

  if v_tx.type = 'free_agent' then
    if exists (select 1 from jsonb_array_elements_text(v_tx.receive) n
               join public.pokedex p on p.name = n
               join public.rosters ro on ro.pokemon_id = p.id and ro.season_id = v_season) then
      raise exception 'Ese Pokemon ya tiene dueno';
    end if;
    delete from public.rosters where team_id = v_tx.team_a and season_id = v_season
      and pokemon_id in (select p.id from public.pokedex p where p.name in (select jsonb_array_elements_text(v_tx.give)));
    insert into public.rosters(team_id, pokemon_id, season_id, obtained_method, obtained_week, transaction_id)
    select v_tx.team_a, p.id, v_season, 'free_agent', v_week, v_tx.id
    from public.pokedex p where p.name in (select jsonb_array_elements_text(v_tx.receive));

    if jsonb_array_length(coalesce(v_tx.receive,'[]'::jsonb)) > 0 then
      update public.waiver_order set fa_used = coalesce(fa_used,0) + 1 where season_id = v_season and team_id = v_tx.team_a;
      select position into v_pos from public.waiver_order where season_id = v_season and team_id = v_tx.team_a;
      select max(position) into v_max from public.waiver_order where season_id = v_season;
      update public.waiver_order set position = position - 1 where season_id = v_season and position > v_pos;
      update public.waiver_order set position = v_max where season_id = v_season and team_id = v_tx.team_a;
    end if;
  elsif v_tx.type = 'trade' then
    delete from public.rosters where team_id = v_tx.team_a and season_id = v_season
      and pokemon_id in (select p.id from public.pokedex p where p.name in (select jsonb_array_elements_text(v_tx.give)));
    delete from public.rosters where team_id = v_tx.team_b and season_id = v_season
      and pokemon_id in (select p.id from public.pokedex p where p.name in (select jsonb_array_elements_text(v_tx.receive)));
    insert into public.rosters(team_id, pokemon_id, season_id, obtained_method, obtained_week, transaction_id)
    select v_tx.team_a, p.id, v_season, 'trade', v_week, v_tx.id from public.pokedex p
    where p.name in (select jsonb_array_elements_text(v_tx.receive));
    insert into public.rosters(team_id, pokemon_id, season_id, obtained_method, obtained_week, transaction_id)
    select v_tx.team_b, p.id, v_season, 'trade', v_week, v_tx.id from public.pokedex p
    where p.name in (select jsonb_array_elements_text(v_tx.give));
  end if;

  update public.transactions set status = 'approved', approved_at = now(), season_id = v_season where id = p_transaction_id;
end $$;

create or replace function public.reject_transaction(p_transaction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.transactions set status = 'rejected' where id = p_transaction_id;
end $$;

-- ========== draft (por temporada activa) ==========
create or replace function public.draft_next(p_season uuid, p_next_pick int, out next_round int, out next_team uuid)
language plpgsql stable security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count from public.draft_order where season_id = p_season;
  next_round := ceil(p_next_pick::numeric / v_count);
  if mod(next_round, 2) = 1 then
    select team_id into next_team from public.draft_order where season_id = p_season
    order by draft_position asc offset ((p_next_pick - 1) % v_count) limit 1;
  else
    select team_id into next_team from public.draft_order where season_id = p_season
    order by draft_position desc offset ((p_next_pick - 1) % v_count) limit 1;
  end if;
end $$;

create or replace function public.draft_advance(p_state_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.draft_state; v_set public.league_settings; v_total int; v_next int; n record;
begin
  select * into v_state from public.draft_state where id = p_state_id;
  v_set := public.settings_for(v_state.season_id);
  select count(*) * v_set.roster_size into v_total from public.draft_order where season_id = v_state.season_id;
  v_next := v_state.current_pick + 1;
  if v_next > v_total then
    update public.draft_state set is_finished = true, is_active = false, turn_started_at = null where id = p_state_id;
    return;
  end if;
  select * into n from public.draft_next(v_state.season_id, v_next);
  update public.draft_state set current_pick = v_next, current_round = n.next_round, current_team_id = n.next_team,
    turn_started_at = now() where id = p_state_id;
end $$;

create or replace function public.make_draft_pick(p_team_id uuid, p_pokemon_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.draft_state; v_set public.league_settings; v_points int; v_used int; v_count int;
begin
  select * into v_state from public.draft_state where season_id = public.active_season_id()
    and is_active and not coalesce(is_finished,false) for update;
  if not found then raise exception 'Draft no activo'; end if;
  if v_state.is_paused then raise exception 'Draft pausado'; end if;
  if not public.is_admin() and v_state.current_team_id is distinct from public.my_team_id() then raise exception 'No autorizado'; end if;
  if v_state.current_team_id <> p_team_id then raise exception 'No es tu turno'; end if;
  v_set := public.settings_for(v_state.season_id);

  select points into v_points from public.season_pokemon
  where season_id = v_state.season_id and pokemon_id = p_pokemon_id and available;
  if v_points is null then raise exception 'Pokemon no disponible'; end if;
  if exists (select 1 from public.draft_picks where season_id = v_state.season_id and pokemon_id = p_pokemon_id) then
    raise exception 'Ese Pokemon ya fue elegido';
  end if;
  select count(*), coalesce(sum(sp.points),0) into v_count, v_used from public.draft_picks dp
  join public.season_pokemon sp on sp.pokemon_id = dp.pokemon_id and sp.season_id = dp.season_id
  where dp.season_id = v_state.season_id and dp.team_id = p_team_id;
  if v_count >= v_set.roster_size then raise exception 'Ya tienes % Pokemon', v_set.roster_size; end if;
  if v_used + v_points > v_set.max_points then raise exception 'Excedes % puntos', v_set.max_points; end if;

  insert into public.draft_picks(season_id, team_id, pokemon_id, round, pick_number)
  values (v_state.season_id, p_team_id, p_pokemon_id, v_state.current_round, v_state.current_pick);
  perform public.draft_advance(v_state.id);
end $$;

create or replace function public.pass_draft_pick(p_team_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.draft_state;
begin
  select * into v_state from public.draft_state where season_id = public.active_season_id()
    and is_active and not coalesce(is_finished,false) for update;
  if not found then raise exception 'Draft no activo'; end if;
  if not public.is_admin() and p_team_id is distinct from public.my_team_id() then raise exception 'No autorizado'; end if;
  if v_state.current_team_id <> p_team_id then raise exception 'No es tu turno'; end if;
  perform public.draft_advance(v_state.id);
end $$;

create or replace function public.force_auto_pick() returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.draft_state; v_set public.league_settings; v_used int; v_count int; v_best uuid;
begin
  select * into v_state from public.draft_state where season_id = public.active_season_id()
    and is_active and not coalesce(is_finished,false) for update;
  if not found or v_state.is_paused then return; end if;
  v_set := public.settings_for(v_state.season_id);
  -- cualquiera puede disparar el autopick, pero solo cuando el tiempo del turno ya se acabo (el admin puede forzarlo)
  if not public.is_admin() and extract(epoch from (now() - v_state.turn_started_at)) < v_set.draft_pick_seconds then return; end if;

  select count(*), coalesce(sum(sp.points),0) into v_count, v_used from public.draft_picks dp
  join public.season_pokemon sp on sp.pokemon_id = dp.pokemon_id and sp.season_id = dp.season_id
  where dp.season_id = v_state.season_id and dp.team_id = v_state.current_team_id;

  if v_count < v_set.roster_size then
    select sp.pokemon_id into v_best from public.season_pokemon sp join public.pokedex p on p.id = sp.pokemon_id
    where sp.season_id = v_state.season_id and sp.available and sp.points <= (v_set.max_points - v_used)
      and not exists (select 1 from public.draft_picks dp where dp.season_id = v_state.season_id and dp.pokemon_id = sp.pokemon_id)
    order by sp.points desc, p.name asc limit 1;
    if v_best is not null then
      insert into public.draft_picks(season_id, team_id, pokemon_id, round, pick_number)
      values (v_state.season_id, v_state.current_team_id, v_best, v_state.current_round, v_state.current_pick);
    end if;
  end if;
  perform public.draft_advance(v_state.id);
end $$;

create or replace function public.start_draft() returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id(); v_state public.draft_state; v_first uuid;
begin
  perform public.require_admin();
  select * into v_state from public.draft_state where season_id = v_season limit 1;
  if not found then
    insert into public.draft_state(season_id, is_active, is_paused, is_finished) values (v_season, false, false, false)
    returning * into v_state;
  end if;
  if v_state.is_active then raise exception 'El draft ya esta activo'; end if;
  if coalesce(v_state.is_finished,false) then raise exception 'El draft ya termino; reinicialo primero'; end if;
  select team_id into v_first from public.draft_order where season_id = v_season order by draft_position asc limit 1;
  if v_first is null then raise exception 'Falta el orden del draft'; end if;
  update public.draft_state set is_active = true, is_paused = false, current_pick = 1, current_round = 1,
    current_team_id = v_first, turn_started_at = now() where id = v_state.id;
  update public.seasons set status = 'draft' where id = v_season and status = 'setup';
end $$;

create or replace function public.pause_draft() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.draft_state set is_paused = true where season_id = public.active_season_id() and not coalesce(is_finished,false);
end $$;

create or replace function public.resume_draft() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.draft_state set is_paused = false, turn_started_at = now()
  where season_id = public.active_season_id() and is_active and not coalesce(is_finished,false);
end $$;

create or replace function public.finish_draft() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.draft_state set is_active = false, is_finished = true, turn_started_at = null
  where season_id = public.active_season_id();
end $$;

create or replace function public.reset_draft() returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id();
begin
  perform public.require_admin();
  if (select status from public.seasons where id = v_season) in ('regular','playoffs','finished') then
    raise exception 'No se puede reiniciar el draft de una temporada ya en juego';
  end if;
  delete from public.draft_picks where season_id = v_season;
  update public.draft_state set is_active = false, is_paused = false, is_finished = false, current_pick = 1,
    current_round = 1, current_team_id = null, turn_started_at = null where season_id = v_season;
end $$;

create or replace function public.initialize_waiver_order(p_season_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.waiver_order where season_id = p_season_id;
  insert into public.waiver_order(season_id, team_id, position, fa_used)
  select p_season_id, team_id, row_number() over (order by draft_position desc), 0
  from public.draft_order where season_id = p_season_id;
end $$;

create or replace function public.export_draft_to_rosters() returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id();
begin
  perform public.require_admin();
  if not exists (select 1 from public.draft_state where season_id = v_season and is_finished) then
    raise exception 'El draft no ha finalizado';
  end if;
  if not exists (select 1 from public.draft_picks where season_id = v_season) then raise exception 'No hay picks para exportar'; end if;
  delete from public.rosters where season_id = v_season;
  insert into public.rosters(team_id, pokemon_id, season_id, obtained_method, obtained_week)
  select team_id, pokemon_id, v_season, 'draft', 0 from public.draft_picks where season_id = v_season;
  perform public.initialize_waiver_order(v_season);
end $$;

-- ========== panel de admin ==========
-- Activa una temporada (solo una a la vez)
create or replace function public.activate_season(p_season_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.seasons where id = p_season_id) then raise exception 'Temporada no encontrada'; end if;
  update public.seasons set is_active = (id = p_season_id) where id is not null;
  if not exists (select 1 from public.draft_state where season_id = p_season_id) then
    insert into public.draft_state(season_id, is_active, is_paused, is_finished) values (p_season_id, false, false, false);
  end if;
end $$;

-- Genera el calendario round robin de cada conferencia de la temporada
create or replace function public.generate_schedule(p_season_id uuid, p_replace boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare c record; ids uuid[]; n int; r int; i int; a uuid; b uuid; v_count int := 0;
begin
  perform public.require_admin();
  if exists (select 1 from public.matches where season_id = p_season_id and stage = 'regular') then
    if not p_replace then raise exception 'La temporada ya tiene calendario'; end if;
    if exists (select 1 from public.matches where season_id = p_season_id and stage = 'regular' and status = 'completed') then
      raise exception 'Ya hay series jugadas; no se puede regenerar';
    end if;
    delete from public.matches where season_id = p_season_id and stage = 'regular';
  end if;
  for c in select * from public.conferences where season_id = p_season_id order by sort loop
    select array_agg(team_id order by random()) into ids from public.season_teams
    where season_id = p_season_id and conference_id = c.id;
    n := coalesce(array_length(ids,1),0);
    continue when n < 2;
    if n % 2 = 1 then ids := ids || null::uuid; n := n + 1; end if;
    for r in 1..(n-1) loop
      for i in 1..(n/2) loop
        a := ids[i]; b := ids[n - i + 1];
        if a is not null and b is not null then
          insert into public.matches(season_id, conference_id, conference, week, team_a, team_b, status, stage, games, replays)
          values (p_season_id, c.id, c.name, r, a, b, 'pending', 'regular', '[]', '[]');
          v_count := v_count + 1;
        end if;
      end loop;
      ids := array[ids[1]] || ids[n] || ids[2:n-1];
    end loop;
  end loop;
  update public.league_settings set regular_weeks = (select max(week) from public.matches where season_id = p_season_id and stage='regular')
  where season_id = p_season_id;
  return v_count;
end $$;

-- Copia los precios del pool de otra temporada
create or replace function public.copy_pool(p_from uuid, p_to uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  perform public.require_admin();
  delete from public.season_pokemon where season_id = p_to;
  insert into public.season_pokemon(season_id, pokemon_id, points, available, pokemon_name)
  select p_to, pokemon_id, points, available, pokemon_name from public.season_pokemon where season_id = p_from;
  get diagnostics v = row_count;
  return v;
end $$;

-- Carga masiva de precios: [{"name":"Garchomp","points":18,"available":true}, ...]
create or replace function public.upsert_pool(p_season_id uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x jsonb; v_mon uuid; v_ok int := 0; v_missing jsonb := '[]'::jsonb;
begin
  perform public.require_admin();
  for x in select * from jsonb_array_elements(p_rows) loop
    select id into v_mon from public.pokedex where lower(name) = lower(trim(x->>'name'));
    if v_mon is null then v_missing := v_missing || to_jsonb(x->>'name'); continue; end if;
    update public.season_pokemon set points = coalesce((x->>'points')::int, points),
      available = coalesce((x->>'available')::boolean, true)
    where season_id = p_season_id and pokemon_id = v_mon;
    if not found then
      insert into public.season_pokemon(season_id, pokemon_id, points, available, pokemon_name)
      select p_season_id, v_mon, (x->>'points')::int, coalesce((x->>'available')::boolean, true), name from public.pokedex where id = v_mon;
    end if;
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('updated', v_ok, 'missing', v_missing);
end $$;

-- Crea una temporada nueva copiando reglas, conferencias, equipos y pool de otra
create or replace function public.create_season(p_number int, p_name text, p_copy_from uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_admin();
  insert into public.seasons(name, number, slug, status, is_active) values (p_name, p_number, 's'||p_number, 'setup', false)
  returning id into v_id;
  if p_copy_from is not null then
    insert into public.league_settings(season_id, roster_size, max_points, playoff_teams, max_teams, max_fa, trade_max_diff,
      points_win, points_loss, best_of, regular_weeks, draft_pick_seconds, faint_limit, faint_reset_on_transfer, faint_in_playoffs)
    select v_id, roster_size, max_points, playoff_teams, max_teams, max_fa, trade_max_diff, points_win, points_loss, best_of,
      null, draft_pick_seconds, faint_limit, faint_reset_on_transfer, faint_in_playoffs
    from public.league_settings where season_id = p_copy_from;
    insert into public.conferences(season_id, key, name, color, sort)
    select v_id, key, name, color, sort from public.conferences where season_id = p_copy_from;
    insert into public.season_teams(season_id, team_id, display_name, abbr, coach_name, logo)
    select v_id, team_id, display_name, abbr, coach_name, logo from public.season_teams where season_id = p_copy_from;
    insert into public.season_pokemon(season_id, pokemon_id, points, available, pokemon_name)
    select v_id, pokemon_id, points, available, pokemon_name from public.season_pokemon where season_id = p_copy_from;
  else
    insert into public.league_settings(season_id) values (v_id);
    insert into public.conferences(season_id, key, name, color, sort) values (v_id,'a','Conferencia 1','#FF4B2B',1),(v_id,'b','Conferencia 2','#7ED13A',2);
  end if;
  return v_id;
end $$;

-- Guarda el orden del draft: lista de team_id en orden
create or replace function public.set_draft_order(p_season_id uuid, p_team_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.draft_order where season_id = p_season_id;
  insert into public.draft_order(season_id, team_id, draft_position)
  select p_season_id, t, ord from unnest(p_team_ids) with ordinality u(t, ord);
end $$;

-- Las funciones viejas que ya no se usan quedan solo para el admin
create or replace function public.generate_round_robin(conf text) returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Usa generate_schedule(season_id)';
end $$;
create or replace function public.advance_waiver_order(p_team_id uuid, p_season_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pos int; v_last int;
begin
  perform public.require_admin();
  select position into v_pos from public.waiver_order where team_id = p_team_id and season_id = p_season_id;
  select max(position) into v_last from public.waiver_order where season_id = p_season_id;
  update public.waiver_order set position = position - 1 where season_id = p_season_id and position > v_pos;
  update public.waiver_order set position = v_last where team_id = p_team_id and season_id = p_season_id;
end $$;

-- helpers no deben llamarse directo desde la API
revoke execute on function public.draft_advance(uuid) from public, anon, authenticated;
revoke execute on function public.process_escapes(uuid) from public, anon, authenticated;
