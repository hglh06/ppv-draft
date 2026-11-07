-- Funciones con permisos por rol, copias repetidas con sobrecosto, starters y deshacer pick.

-- ---------- escape: los starters no se escapan ----------
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
    select ro.id, ro.team_id, ro.pokemon_id, pd.name
    from public.rosters ro join public.pokedex pd on pd.id = ro.pokemon_id
    where ro.season_id = v_match.season_id and ro.team_id in (v_match.team_a, v_match.team_b) and not ro.is_starter
  loop
    if v_set.faint_reset_on_transfer then
      select coalesce(sum(deaths),0) into v_faints from public.pokemon_stats ps
      where ps.roster_id = r.id and (v_set.faint_in_playoffs or ps.stage = 'regular');
    else
      select max(created_at) into v_last from public.pokemon_escapes where season_id = v_match.season_id and pokemon_id = r.pokemon_id;
      select coalesce(sum(deaths),0) into v_faints from public.pokemon_stats ps
      where ps.season_id = v_match.season_id and ps.pokemon_id = r.pokemon_id and ps.team_id = r.team_id
        and (v_set.faint_in_playoffs or ps.stage = 'regular') and (v_last is null or ps.created_at > v_last);
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

drop function if exists public.roster_faints(uuid);
create or replace function public.roster_faints(p_season uuid)
returns table(roster_id uuid, team_id uuid, pokemon_id uuid, pokemon_name text, faints int, faint_limit int, is_starter boolean)
language sql stable security definer set search_path = public as $$
  with s as (select * from public.league_settings where season_id = p_season limit 1)
  select ro.id, ro.team_id, ro.pokemon_id, pd.name,
    (case when s.faint_reset_on_transfer then
      (select coalesce(sum(deaths),0) from public.pokemon_stats ps where ps.roster_id = ro.id and (s.faint_in_playoffs or ps.stage = 'regular'))
     else
      (select coalesce(sum(deaths),0) from public.pokemon_stats ps where ps.season_id = p_season and ps.pokemon_id = ro.pokemon_id and ps.team_id = ro.team_id
         and (s.faint_in_playoffs or ps.stage = 'regular')
         and ps.created_at > coalesce((select max(e.created_at) from public.pokemon_escapes e where e.season_id = p_season and e.pokemon_id = ro.pokemon_id), '-infinity'))
     end)::int,
    s.faint_limit, ro.is_starter
  from public.rosters ro join public.pokedex pd on pd.id = ro.pokemon_id cross join s
  where ro.season_id = p_season;
$$;

-- ---------- reportes ----------
create or replace function public.approve_report(p_report_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_report record; v_match record; v_games jsonb; v_season uuid;
begin
  perform public.require_perm('results.approve');
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
  delete from public.pokemon_stats where match_id = v_match.id;
  insert into public.pokemon_stats(season_id, match_id, report_id, week, stage, team_id, pokemon_id, pokemon_name, roster_id, game, kills, deaths)
  select v_season, v_match.id, v_report.id, v_match.week, coalesce(v_match.stage,'regular'), tid, pd.id, mon->>'name',
    (select ro.id from public.rosters ro where ro.team_id = tid and ro.season_id = v_season and ro.pokemon_id = pd.id limit 1),
    (g->>'game')::int, coalesce((g->>'kills')::int,0), coalesce((g->>'deaths')::int,0)
  from (values (v_match.team_a, v_report.team_a_data), (v_match.team_b, v_report.team_b_data)) side(tid, data)
  cross join lateral jsonb_array_elements(coalesce(side.data,'[]'::jsonb)) mon
  cross join lateral jsonb_array_elements(coalesce(mon->'games','[]'::jsonb)) g
  left join public.pokedex pd on pd.name = mon->>'name';
  update public.reports set status = 'rejected', reviewed_at = now() where match_id = v_match.id and id <> p_report_id and status = 'pending';
  update public.reports set status = 'approved', reviewed_at = now(), season_id = v_season where id = p_report_id;
  return jsonb_build_object('escapes', public.process_escapes(v_match.id));
end $$;

create or replace function public.reject_report(p_report_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('results.approve');
  update public.reports set status = 'rejected', reviewed_at = now() where id = p_report_id;
end $$;

create or replace function public.submit_report(p_match_id uuid, p_games jsonb, p_team_a_data jsonb, p_team_b_data jsonb, p_winner text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_match record; v_id uuid; v_team uuid := public.my_team_id();
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Serie no encontrada'; end if;
  if not public.has_perm('results.approve') and (v_team is null or v_team not in (v_match.team_a, v_match.team_b) or not public.has_perm('team.play')) then
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

-- ---------- mercado ----------
create or replace function public.request_free_agent(p_team_id uuid, p_give jsonb, p_receive jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id(); v_set public.league_settings; v_new_total int; v_new_count int; v_used int; v_cost int := 0; n text; v_mon uuid;
begin
  if not public.has_perm('market.approve') and (p_team_id is distinct from public.my_team_id() or not public.has_perm('team.play')) then raise exception 'No autorizado'; end if;
  v_set := public.settings_for(v_season);
  if v_set is null then raise exception 'La temporada activa no tiene reglas'; end if;
  for n in select jsonb_array_elements_text(coalesce(p_receive,'[]'::jsonb)) loop
    select sp.pokemon_id into v_mon from public.season_pokemon sp join public.pokedex p on p.id = sp.pokemon_id
    where sp.season_id = v_season and sp.available and p.name = n;
    if v_mon is null then raise exception '% no esta en el pool', n; end if;
    if public.copies_taken(v_season, v_mon, false) >= public.copies_allowed(v_season, v_mon) then raise exception '% no tiene copias libres', n; end if;
    if exists (select 1 from public.rosters where season_id = v_season and team_id = p_team_id and pokemon_id = v_mon) then raise exception 'Ya tienes a %', n; end if;
    v_cost := v_cost + public.next_copy_cost(v_season, v_mon, false);
  end loop;
  if exists (select 1 from jsonb_array_elements_text(coalesce(p_give,'[]'::jsonb)) g
     where not exists (select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id
                       where ro.season_id = v_season and ro.team_id = p_team_id and p.name = g)) then
    raise exception 'Solo puedes soltar Pokemon de tu roster';
  end if;
  select coalesce(fa_used,0) into v_used from public.waiver_order where season_id = v_season and team_id = p_team_id;
  if coalesce(v_used,0) >= v_set.max_fa and jsonb_array_length(coalesce(p_receive,'[]'::jsonb)) > 0 then
    raise exception 'Ya usaste tus % movimientos de FA', v_set.max_fa;
  end if;
  v_new_total := public.team_points(p_team_id, v_season) - public.roster_names_points(p_team_id, p_give, v_season) + v_cost;
  v_new_count := (select count(*) from public.rosters where team_id = p_team_id and season_id = v_season)
    - jsonb_array_length(coalesce(p_give,'[]'::jsonb)) + jsonb_array_length(coalesce(p_receive,'[]'::jsonb));
  if v_new_total > v_set.max_points then raise exception 'Excedes el maximo de puntos (%). Nuevo total: %', v_set.max_points, v_new_total; end if;
  if v_new_count > v_set.roster_size then raise exception 'Excedes el tamano de roster (%). Nuevo tamano: %', v_set.roster_size, v_new_count; end if;
  insert into public.transactions(type, proposed_by, team_a, give, receive, status, season_id)
  values ('free_agent', auth.uid(), p_team_id, coalesce(p_give,'[]'::jsonb), coalesce(p_receive,'[]'::jsonb), 'pending_admin', v_season);
end $$;

create or replace function public.request_trade(p_team_a uuid, p_team_b uuid, p_give jsonb, p_receive jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id(); v_set public.league_settings; va int; vb int; ta int; tb int;
begin
  if not public.has_perm('market.approve') and (p_team_a is distinct from public.my_team_id() or not public.has_perm('team.play')) then raise exception 'No autorizado'; end if;
  if p_team_a = p_team_b then raise exception 'No puedes tradear contigo mismo'; end if;
  v_set := public.settings_for(v_season);
  if exists (select 1 from jsonb_array_elements_text(coalesce(p_give,'[]'::jsonb)) n where not exists (
       select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id where ro.season_id = v_season and ro.team_id = p_team_a and p.name = n))
  or exists (select 1 from jsonb_array_elements_text(coalesce(p_receive,'[]'::jsonb)) n where not exists (
       select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id where ro.season_id = v_season and ro.team_id = p_team_b and p.name = n)) then
    raise exception 'Los Pokemon del trade deben estar en los rosters de cada equipo';
  end if;
  if exists (select 1 from jsonb_array_elements_text(coalesce(p_receive,'[]'::jsonb)) n join public.pokedex p on p.name = n
             join public.rosters ro on ro.pokemon_id = p.id and ro.team_id = p_team_a and ro.season_id = v_season)
  or exists (select 1 from jsonb_array_elements_text(coalesce(p_give,'[]'::jsonb)) n join public.pokedex p on p.name = n
             join public.rosters ro on ro.pokemon_id = p.id and ro.team_id = p_team_b and ro.season_id = v_season) then
    raise exception 'Un equipo terminaria con el mismo Pokemon repetido';
  end if;
  va := public.roster_names_points(p_team_a, p_give, v_season); vb := public.roster_names_points(p_team_b, p_receive, v_season);
  ta := public.team_points(p_team_a, v_season) - va + vb;
  tb := public.team_points(p_team_b, v_season) - vb + va;
  if abs(va - vb) > v_set.trade_max_diff then raise exception 'La diferencia no puede ser mayor a % puntos', v_set.trade_max_diff; end if;
  if ta > v_set.max_points then raise exception 'Tu equipo excede el limite de puntos'; end if;
  if tb > v_set.max_points then raise exception 'El otro equipo excede el limite de puntos'; end if;
  insert into public.transactions(type, proposed_by, team_a, team_b, give, receive, status, season_id)
  values ('trade', auth.uid(), p_team_a, p_team_b, p_give, p_receive, 'pending_player', v_season);
end $$;

create or replace function public.approve_transaction(p_transaction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_tx record; v_season uuid; v_pos int; v_max int; v_week int; n text; v_mon uuid;
begin
  perform public.require_perm('market.approve');
  select * into v_tx from public.transactions where id = p_transaction_id and status = 'pending_admin' for update;
  if not found then raise exception 'Transaccion no valida'; end if;
  v_season := coalesce(v_tx.season_id, public.active_season_id());
  v_week := public.current_week(v_season);
  if v_tx.type = 'free_agent' then
    delete from public.rosters where team_id = v_tx.team_a and season_id = v_season
      and pokemon_id in (select p.id from public.pokedex p where p.name in (select jsonb_array_elements_text(v_tx.give)));
    for n in select jsonb_array_elements_text(v_tx.receive) loop
      select id into v_mon from public.pokedex where name = n;
      if public.copies_taken(v_season, v_mon, false) >= public.copies_allowed(v_season, v_mon) then raise exception '% ya no tiene copias libres', n; end if;
      if exists (select 1 from public.rosters where season_id = v_season and team_id = v_tx.team_a and pokemon_id = v_mon) then raise exception 'El equipo ya tiene a %', n; end if;
      insert into public.rosters(team_id, pokemon_id, season_id, obtained_method, obtained_week, transaction_id, points_paid)
      values (v_tx.team_a, v_mon, v_season, 'free_agent', v_week, v_tx.id, public.next_copy_cost(v_season, v_mon, false));
    end loop;
    if jsonb_array_length(coalesce(v_tx.receive,'[]'::jsonb)) > 0 then
      update public.waiver_order set fa_used = coalesce(fa_used,0) + 1 where season_id = v_season and team_id = v_tx.team_a;
      select position into v_pos from public.waiver_order where season_id = v_season and team_id = v_tx.team_a;
      select max(position) into v_max from public.waiver_order where season_id = v_season;
      update public.waiver_order set position = position - 1 where season_id = v_season and position > v_pos;
      update public.waiver_order set position = v_max where season_id = v_season and team_id = v_tx.team_a;
    end if;
  elsif v_tx.type = 'trade' then
    create temp table _mv on commit drop as
      select r.*, case when r.team_id = v_tx.team_a then v_tx.team_b else v_tx.team_a end as to_team
      from public.rosters r join public.pokedex p on p.id = r.pokemon_id
      where r.season_id = v_season and ((r.team_id = v_tx.team_a and p.name in (select jsonb_array_elements_text(v_tx.give)))
                                     or (r.team_id = v_tx.team_b and p.name in (select jsonb_array_elements_text(v_tx.receive))));
    delete from public.rosters where id in (select id from _mv);
    insert into public.rosters(team_id, pokemon_id, season_id, obtained_method, obtained_week, transaction_id, points_paid)
    select to_team, pokemon_id, v_season, 'trade', v_week, v_tx.id, points_paid from _mv;
  end if;
  update public.transactions set status = 'approved', approved_at = now(), season_id = v_season where id = p_transaction_id;
end $$;

create or replace function public.reject_transaction(p_transaction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('market.approve');
  update public.transactions set status = 'rejected' where id = p_transaction_id;
end $$;

-- ---------- draft ----------
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

create or replace function public.pass_draft_pick(p_team_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.draft_state;
begin
  select * into v_state from public.draft_state where season_id = public.active_season_id() and is_active and not coalesce(is_finished,false) for update;
  if not found then raise exception 'Draft no activo'; end if;
  if not public.has_perm('draft.manage') and (p_team_id is distinct from public.my_team_id() or not public.has_perm('team.play')) then raise exception 'No autorizado'; end if;
  if v_state.current_team_id <> p_team_id then raise exception 'No es tu turno'; end if;
  perform public.draft_advance(v_state.id);
end $$;

create or replace function public.force_auto_pick() returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.draft_state; v_set public.league_settings; v_used int; v_count int; v_best uuid; v_cost int;
begin
  select * into v_state from public.draft_state where season_id = public.active_season_id() and is_active and not coalesce(is_finished,false) for update;
  if not found or v_state.is_paused then return; end if;
  v_set := public.settings_for(v_state.season_id);
  if not public.has_perm('draft.manage') and extract(epoch from (now() - v_state.turn_started_at)) < v_set.draft_pick_seconds then return; end if;
  select count(*), coalesce(sum(coalesce(dp.points_paid, sp.points)),0) into v_count, v_used from public.draft_picks dp
  left join public.season_pokemon sp on sp.pokemon_id = dp.pokemon_id and sp.season_id = dp.season_id
  where dp.season_id = v_state.season_id and dp.team_id = v_state.current_team_id;
  if v_count < v_set.roster_size then
    select x.pokemon_id, x.cost into v_best, v_cost from (
      select sp.pokemon_id, p.name, public.next_copy_cost(v_state.season_id, sp.pokemon_id, true) cost
      from public.season_pokemon sp join public.pokedex p on p.id = sp.pokemon_id
      where sp.season_id = v_state.season_id and sp.available
        and public.copies_taken(v_state.season_id, sp.pokemon_id, true) < public.copies_allowed(v_state.season_id, sp.pokemon_id)
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

-- deshace el ultimo pick: el turno regresa a quien lo hizo y el draft queda en pausa
create or replace function public.undo_last_pick() returns text
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id(); v_pick record; v_name text;
begin
  perform public.require_perm('draft.manage');
  select dp.*, p.name into v_pick from public.draft_picks dp join public.pokedex p on p.id = dp.pokemon_id
  where dp.season_id = v_season order by dp.pick_number desc, dp.created_at desc limit 1;
  if not found then raise exception 'No hay picks que deshacer'; end if;
  delete from public.draft_picks where id = v_pick.id;
  update public.draft_state set current_pick = v_pick.pick_number, current_round = v_pick.round, current_team_id = v_pick.team_id,
    is_active = true, is_finished = false, is_paused = true, turn_started_at = now()
  where season_id = v_season;
  return v_pick.name;
end $$;

create or replace function public.start_draft() returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id(); v_state public.draft_state; v_first uuid;
begin
  perform public.require_perm('draft.manage');
  select * into v_state from public.draft_state where season_id = v_season limit 1;
  if not found then
    insert into public.draft_state(season_id, is_active, is_paused, is_finished) values (v_season, false, false, false) returning * into v_state;
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
  perform public.require_perm('draft.manage');
  update public.draft_state set is_paused = true where season_id = public.active_season_id() and not coalesce(is_finished,false);
end $$;
create or replace function public.resume_draft() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('draft.manage');
  update public.draft_state set is_paused = false, turn_started_at = now()
  where season_id = public.active_season_id() and is_active and not coalesce(is_finished,false);
end $$;
create or replace function public.finish_draft() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('draft.manage');
  update public.draft_state set is_active = false, is_finished = true, turn_started_at = null where season_id = public.active_season_id();
end $$;
create or replace function public.reset_draft() returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id();
begin
  perform public.require_perm('draft.manage');
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
  perform public.require_perm('draft.manage');
  delete from public.waiver_order where season_id = p_season_id;
  insert into public.waiver_order(season_id, team_id, position, fa_used)
  select p_season_id, team_id, row_number() over (order by draft_position desc), 0 from public.draft_order where season_id = p_season_id;
end $$;

create or replace function public.export_draft_to_rosters() returns void
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id();
begin
  perform public.require_perm('draft.manage');
  if not exists (select 1 from public.draft_state where season_id = v_season and is_finished) then raise exception 'El draft no ha finalizado'; end if;
  if not exists (select 1 from public.draft_picks where season_id = v_season) then raise exception 'No hay picks para exportar'; end if;
  delete from public.rosters where season_id = v_season;
  insert into public.rosters(team_id, pokemon_id, season_id, obtained_method, obtained_week, points_paid)
  select dp.team_id, dp.pokemon_id, v_season, 'draft', 0, coalesce(dp.points_paid, sp.points)
  from public.draft_picks dp left join public.season_pokemon sp on sp.pokemon_id = dp.pokemon_id and sp.season_id = dp.season_id
  where dp.season_id = v_season;
  perform public.initialize_waiver_order(v_season);
end $$;

create or replace function public.set_draft_order(p_season_id uuid, p_team_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('draft.manage');
  delete from public.draft_order where season_id = p_season_id;
  insert into public.draft_order(season_id, team_id, draft_position) select p_season_id, t, ord from unnest(p_team_ids) with ordinality u(t, ord);
end $$;

create or replace function public.advance_waiver_order(p_team_id uuid, p_season_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pos int; v_last int;
begin
  perform public.require_perm('market.approve');
  select position into v_pos from public.waiver_order where team_id = p_team_id and season_id = p_season_id;
  select max(position) into v_last from public.waiver_order where season_id = p_season_id;
  update public.waiver_order set position = position - 1 where season_id = p_season_id and position > v_pos;
  update public.waiver_order set position = v_last where team_id = p_team_id and season_id = p_season_id;
end $$;

create or replace function public.generate_schedule(p_season_id uuid, p_replace boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare c record; ids uuid[]; n int; r int; i int; a uuid; b uuid; v_count int := 0;
begin
  perform public.require_perm('draft.manage');
  if exists (select 1 from public.matches where season_id = p_season_id and stage = 'regular') then
    if not p_replace then raise exception 'La temporada ya tiene calendario'; end if;
    if exists (select 1 from public.matches where season_id = p_season_id and stage = 'regular' and status = 'completed') then
      raise exception 'Ya hay series jugadas; no se puede regenerar';
    end if;
    delete from public.matches where season_id = p_season_id and stage = 'regular';
  end if;
  for c in select * from public.conferences where season_id = p_season_id order by sort loop
    select array_agg(team_id order by random()) into ids from public.season_teams where season_id = p_season_id and conference_id = c.id;
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
  update public.league_settings set regular_weeks = (select max(week) from public.matches where season_id = p_season_id and stage='regular') where season_id = p_season_id;
  return v_count;
end $$;

-- ---------- temporadas y pool ----------
create or replace function public.activate_season(p_season_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('season.manage');
  if not exists (select 1 from public.seasons where id = p_season_id) then raise exception 'Temporada no encontrada'; end if;
  update public.seasons set is_active = (id = p_season_id) where id is not null;
  if not exists (select 1 from public.draft_state where season_id = p_season_id) then
    insert into public.draft_state(season_id, is_active, is_paused, is_finished) values (p_season_id, false, false, false);
  end if;
end $$;

create or replace function public.copy_pool(p_from uuid, p_to uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  perform public.require_perm('pool.manage');
  delete from public.season_pokemon where season_id = p_to;
  insert into public.season_pokemon(season_id, pokemon_id, points, available, pokemon_name, max_copies, copy_surcharge)
  select p_to, pokemon_id, points, available, pokemon_name, max_copies, copy_surcharge from public.season_pokemon where season_id = p_from;
  get diagnostics v = row_count;
  return v;
end $$;

-- filas: [{"name":"Garchomp","points":18,"available":true,"copies":2,"surcharge":4}]
create or replace function public.upsert_pool(p_season_id uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x jsonb; v_mon uuid; v_ok int := 0; v_missing jsonb := '[]'::jsonb;
begin
  perform public.require_perm('pool.manage');
  for x in select * from jsonb_array_elements(p_rows) loop
    select id into v_mon from public.pokedex where lower(name) = lower(trim(x->>'name'));
    if v_mon is null then v_missing := v_missing || to_jsonb(x->>'name'); continue; end if;
    update public.season_pokemon set points = coalesce((x->>'points')::int, points),
      available = coalesce((x->>'available')::boolean, true),
      max_copies = coalesce((x->>'copies')::int, max_copies), copy_surcharge = coalesce((x->>'surcharge')::int, copy_surcharge)
    where season_id = p_season_id and pokemon_id = v_mon;
    if not found then
      insert into public.season_pokemon(season_id, pokemon_id, points, available, pokemon_name, max_copies, copy_surcharge)
      select p_season_id, v_mon, (x->>'points')::int, coalesce((x->>'available')::boolean, true), name,
        coalesce((x->>'copies')::int, 1), coalesce((x->>'surcharge')::int, 0) from public.pokedex where id = v_mon;
    end if;
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('updated', v_ok, 'missing', v_missing);
end $$;

create or replace function public.create_season(p_number int, p_name text, p_copy_from uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_perm('season.manage');
  insert into public.seasons(name, number, slug, status, is_active) values (p_name, p_number, 's'||p_number, 'setup', false) returning id into v_id;
  if p_copy_from is not null then
    insert into public.league_settings(season_id, roster_size, max_points, playoff_teams, max_teams, max_fa, trade_max_diff,
      points_win, points_loss, best_of, regular_weeks, draft_pick_seconds, faint_limit, faint_reset_on_transfer, faint_in_playoffs, allow_duplicates, starters_per_team)
    select v_id, roster_size, max_points, playoff_teams, max_teams, max_fa, trade_max_diff, points_win, points_loss, best_of,
      null, draft_pick_seconds, faint_limit, faint_reset_on_transfer, faint_in_playoffs, allow_duplicates, starters_per_team
    from public.league_settings where season_id = p_copy_from;
    insert into public.conferences(season_id, key, name, color, sort) select v_id, key, name, color, sort from public.conferences where season_id = p_copy_from;
    insert into public.season_teams(season_id, team_id, display_name, abbr, coach_name, logo)
    select v_id, team_id, display_name, abbr, coach_name, logo from public.season_teams where season_id = p_copy_from;
    insert into public.season_pokemon(season_id, pokemon_id, points, available, pokemon_name, max_copies, copy_surcharge)
    select v_id, pokemon_id, points, available, pokemon_name, max_copies, copy_surcharge from public.season_pokemon where season_id = p_copy_from;
  else
    insert into public.league_settings(season_id) values (v_id);
    insert into public.conferences(season_id, key, name, color, sort) values (v_id,'a','Conferencia 1','#FF4B2B',1),(v_id,'b','Conferencia 2','#7ED13A',2);
  end if;
  return v_id;
end $$;

-- ---------- permisos de ejecucion ----------
do $$
declare f text;
begin
  foreach f in array array['undo_last_pick()','set_starter(uuid,boolean)','save_prediction(uuid,text)','set_user_role(uuid,text)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['require_perm(text)','sync_profile_role()','guard_roles()','handle_new_user()']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
-- los que tienen firma nueva vuelven a quedar fuera de anon
revoke execute on function public.process_escapes(uuid) from public, anon, authenticated;
