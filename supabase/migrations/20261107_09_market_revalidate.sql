-- Mercado: al aprobar se vuelve a validar todo (el estado pudo cambiar desde la solicitud),
-- las solicitudes que compiten por un Pokemon sin copias se rechazan solas y no se duplican solicitudes.

drop function if exists public.approve_transaction(uuid);
create or replace function public.approve_transaction(p_transaction_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tx record; v_season uuid; v_set public.league_settings; v_pos int; v_max int; v_week int; n text; v_mon uuid;
  v_cost int := 0; v_total int; v_count int; v_used int; v_auto jsonb := '[]'::jsonb; va int; vb int; ta int; tb int; o record;
begin
  perform public.require_perm('market.approve');
  select * into v_tx from public.transactions where id = p_transaction_id and status = 'pending_admin' for update;
  if not found then raise exception 'Transaccion no valida'; end if;
  v_season := coalesce(v_tx.season_id, public.active_season_id());
  v_set := public.settings_for(v_season);
  v_week := public.current_week(v_season);

  if v_tx.type = 'free_agent' then
    -- lo que suelta debe seguir en su roster
    if exists (select 1 from jsonb_array_elements_text(coalesce(v_tx.give,'[]'::jsonb)) g where not exists (
      select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id where ro.season_id = v_season and ro.team_id = v_tx.team_a and p.name = g)) then
      raise exception 'El equipo ya no tiene a los Pokemon que iba a soltar';
    end if;
    for n in select jsonb_array_elements_text(coalesce(v_tx.receive,'[]'::jsonb)) loop
      select id into v_mon from public.pokedex where name = n;
      if public.copies_taken(v_season, v_mon, false) >= public.copies_allowed(v_season, v_mon) then raise exception '% ya no tiene copias libres', n; end if;
      if exists (select 1 from public.rosters where season_id = v_season and team_id = v_tx.team_a and pokemon_id = v_mon) then raise exception 'El equipo ya tiene a %', n; end if;
      v_cost := v_cost + public.next_copy_cost(v_season, v_mon, false);
    end loop;
    select coalesce(fa_used,0) into v_used from public.waiver_order where season_id = v_season and team_id = v_tx.team_a;
    if jsonb_array_length(coalesce(v_tx.receive,'[]'::jsonb)) > 0 and coalesce(v_used,0) >= v_set.max_fa then
      raise exception 'El equipo ya uso sus % movimientos de FA', v_set.max_fa;
    end if;
    v_total := public.team_points(v_tx.team_a, v_season) - public.roster_names_points(v_tx.team_a, v_tx.give, v_season) + v_cost;
    v_count := (select count(*) from public.rosters where team_id = v_tx.team_a and season_id = v_season)
      - jsonb_array_length(coalesce(v_tx.give,'[]'::jsonb)) + jsonb_array_length(coalesce(v_tx.receive,'[]'::jsonb));
    if v_total > v_set.max_points then raise exception 'Con esto el equipo queda en % pts (maximo %)', v_total, v_set.max_points; end if;
    if v_count > v_set.roster_size then raise exception 'Con esto el equipo queda con % Pokemon (maximo %)', v_count, v_set.roster_size; end if;

    delete from public.rosters where team_id = v_tx.team_a and season_id = v_season
      and pokemon_id in (select p.id from public.pokedex p where p.name in (select jsonb_array_elements_text(coalesce(v_tx.give,'[]'::jsonb))));
    for n in select jsonb_array_elements_text(coalesce(v_tx.receive,'[]'::jsonb)) loop
      select id into v_mon from public.pokedex where name = n;
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
    update public.transactions set status = 'approved', approved_at = now(), season_id = v_season where id = p_transaction_id;

    -- rechazar solicitudes que ya no pueden cumplirse: Pokemon sin copias, o que suelten algo que este equipo ya no tiene
    for o in select t.id, t.team_a, t.receive, t.give from public.transactions t
             where t.season_id = v_season and t.type = 'free_agent' and t.status = 'pending_admin' and t.id <> v_tx.id loop
      if exists (select 1 from jsonb_array_elements_text(o.receive) r join public.pokedex p on p.name = r
                 where public.copies_taken(v_season, p.id, false) >= public.copies_allowed(v_season, p.id)
                    or exists (select 1 from public.rosters ro where ro.season_id = v_season and ro.team_id = o.team_a and ro.pokemon_id = p.id))
         or (o.team_a = v_tx.team_a and exists (select 1 from jsonb_array_elements_text(coalesce(o.give,'[]'::jsonb)) g where not exists (
               select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id where ro.season_id = v_season and ro.team_id = o.team_a and p.name = g))) then
        update public.transactions set status = 'rejected', note = 'Rechazada automaticamente: el Pokemon ya fue asignado por waivers' where id = o.id;
        v_auto := v_auto || to_jsonb(o.id);
      end if;
    end loop;

  elsif v_tx.type = 'trade' then
    if exists (select 1 from jsonb_array_elements_text(coalesce(v_tx.give,'[]'::jsonb)) n2 where not exists (
         select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id where ro.season_id = v_season and ro.team_id = v_tx.team_a and p.name = n2))
    or exists (select 1 from jsonb_array_elements_text(coalesce(v_tx.receive,'[]'::jsonb)) n2 where not exists (
         select 1 from public.rosters ro join public.pokedex p on p.id = ro.pokemon_id where ro.season_id = v_season and ro.team_id = v_tx.team_b and p.name = n2)) then
      raise exception 'Algun Pokemon del trade ya no esta en el roster de su equipo';
    end if;
    va := public.roster_names_points(v_tx.team_a, v_tx.give, v_season); vb := public.roster_names_points(v_tx.team_b, v_tx.receive, v_season);
    ta := public.team_points(v_tx.team_a, v_season) - va + vb; tb := public.team_points(v_tx.team_b, v_season) - vb + va;
    if ta > v_set.max_points or tb > v_set.max_points then raise exception 'Con este trade un equipo se pasa de % pts', v_set.max_points; end if;

    create temp table _mv on commit drop as
      select r.*, case when r.team_id = v_tx.team_a then v_tx.team_b else v_tx.team_a end as to_team
      from public.rosters r join public.pokedex p on p.id = r.pokemon_id
      where r.season_id = v_season and ((r.team_id = v_tx.team_a and p.name in (select jsonb_array_elements_text(v_tx.give)))
                                     or (r.team_id = v_tx.team_b and p.name in (select jsonb_array_elements_text(v_tx.receive))));
    delete from public.rosters where id in (select id from _mv);
    insert into public.rosters(team_id, pokemon_id, season_id, obtained_method, obtained_week, transaction_id, points_paid)
    select to_team, pokemon_id, v_season, 'trade', v_week, v_tx.id, points_paid from _mv;
    update public.transactions set status = 'approved', approved_at = now(), season_id = v_season where id = p_transaction_id;

    -- otros trades o fichajes pendientes con esos Pokemon ya no son validos
    for o in select t.id from public.transactions t
             where t.season_id = v_season and t.status in ('pending_player','pending_admin') and t.id <> v_tx.id
               and t.type in ('trade','free_agent')
               and exists (select 1 from jsonb_array_elements_text(coalesce(t.give,'[]'::jsonb) || case when t.type = 'trade' then coalesce(t.receive,'[]'::jsonb) else '[]'::jsonb end) x
                           where x in (select jsonb_array_elements_text(v_tx.give)) or x in (select jsonb_array_elements_text(v_tx.receive))) loop
      update public.transactions set status = 'rejected', note = 'Rechazada automaticamente: un Pokemon cambio de equipo por otro trade' where id = o.id;
      v_auto := v_auto || to_jsonb(o.id);
    end loop;
  end if;
  return jsonb_build_object('auto_rejected', v_auto);
end $$;

-- no duplicar solicitudes de FA por el mismo Pokemon
create or replace function public.prevent_duplicate_fa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'free_agent' and new.status = 'pending_admin' and exists (
    select 1 from public.transactions t where t.type = 'free_agent' and t.status = 'pending_admin' and t.team_a = new.team_a
      and t.season_id is not distinct from new.season_id and t.receive ?| array(select jsonb_array_elements_text(new.receive))) then
    raise exception 'Ya tienes una solicitud abierta por ese Pokemon';
  end if;
  return new;
end $$;
drop trigger if exists trg_prevent_duplicate_fa on public.transactions;
create trigger trg_prevent_duplicate_fa before insert on public.transactions for each row execute function public.prevent_duplicate_fa();

-- quien propone tambien puede retirar su solicitud de FA
create or replace function public.cancel_trade(p_transaction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_tx record;
begin
  select * into v_tx from public.transactions where id = p_transaction_id;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_tx.proposed_by is distinct from auth.uid() and v_tx.team_a is distinct from public.my_team_id() then raise exception 'No autorizado'; end if;
  if not ((v_tx.type = 'trade' and v_tx.status = 'pending_player') or (v_tx.type = 'free_agent' and v_tx.status = 'pending_admin')) then
    raise exception 'Esta solicitud ya no puede cancelarse';
  end if;
  update public.transactions set status = 'cancelled' where id = p_transaction_id;
end $$;

revoke execute on function public.prevent_duplicate_fa() from public, anon, authenticated;
