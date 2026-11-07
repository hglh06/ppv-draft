-- Seguridad: RLS en todas las tablas, lectura publica de datos de liga,
-- escritura solo por admin o por RPCs que validan permisos.

-- 1) Quitar politicas abiertas heredadas
drop policy if exists "Allow update matches" on public.matches;
drop policy if exists "users can update transactions" on public.transactions;
drop policy if exists "users can create transactions" on public.transactions;
drop policy if exists "admin read transactions" on public.transactions;
drop policy if exists "allow read transactions" on public.transactions;
drop policy if exists "users can read own transactions" on public.transactions;
drop policy if exists "Allow insert for authenticated users" on public.reports;
drop policy if exists "Allow insert" on public.pokedex;
drop policy if exists "Allow insert temporarily" on public.pokedex;
drop policy if exists "Allow select" on public.pokedex;

-- 2) Activar RLS
do $$
declare t text;
begin
  foreach t in array array['teams','rosters','matches','reports','pokedex','seasons','season_pokemon','league_settings',
    'profiles','draft_state','draft_order','draft_picks','transactions','waiver_order','type_chart']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 3) Lectura publica + escritura admin para los datos de liga
do $$
declare t text;
begin
  foreach t in array array['teams','rosters','matches','reports','pokedex','seasons','season_pokemon','league_settings',
    'draft_state','draft_order','draft_picks','transactions','waiver_order','type_chart']
  loop
    execute format('drop policy if exists "public read %1$s" on public.%1$I', t);
    execute format('create policy "public read %1$s" on public.%1$I for select using (true)', t);
    execute format('drop policy if exists "admin write %1$s" on public.%1$I', t);
    execute format('create policy "admin write %1$s" on public.%1$I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- politicas duplicadas de lectura que ya cubre "public read"
drop policy if exists "Allow read teams" on public.teams;
drop policy if exists "read transactions" on public.transactions;
drop policy if exists "Allow select for authenticated users" on public.reports;
drop policy if exists "Public read pokedex" on public.pokedex;
drop policy if exists "Public read seasons" on public.seasons;
drop policy if exists "Public read season_pokemon" on public.season_pokemon;

-- 4) Perfiles: cada quien ve el suyo; el admin ve todos. Nadie cambia su propio rol.
create policy "own profile read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admin manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- 5) Un trainer puede subir el reporte de su propia serie (el sitio S4 lo hace directo)
create policy "trainer insert own report" on public.reports for insert to authenticated
with check (exists (select 1 from public.matches m where m.id = match_id
  and public.my_team_id() in (m.team_a, m.team_b) and m.status <> 'completed'));

-- 6) Un trainer puede editar el perfil de su equipo (nombre del coach, titulo, favorito)
create policy "owner update team" on public.teams for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7) Funciones: anon no ejecuta nada que escriba; los helpers internos no se exponen
do $$
declare f text;
begin
  foreach f in array array[
    'accept_trade(uuid)','decline_trade(uuid)','cancel_trade(uuid)','approve_report(uuid)','reject_report(uuid)',
    'submit_report(uuid,jsonb,jsonb,jsonb,text)','request_free_agent(uuid,jsonb,jsonb)','request_trade(uuid,uuid,jsonb,jsonb)',
    'approve_transaction(uuid)','reject_transaction(uuid)','make_draft_pick(uuid,uuid)','pass_draft_pick(uuid)',
    'force_auto_pick()','start_draft()','pause_draft()','resume_draft()','finish_draft()','reset_draft()',
    'initialize_waiver_order(uuid)','export_draft_to_rosters()','activate_season(uuid)','generate_schedule(uuid,boolean)',
    'copy_pool(uuid,uuid)','upsert_pool(uuid,jsonb)','create_season(integer,text,uuid)','set_draft_order(uuid,uuid[])',
    'generate_round_robin(text)','advance_waiver_order(uuid,uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['handle_new_user()','send_trade_email()','require_admin()','draft_next(uuid,integer)','settings_for(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

alter function public.handle_new_user() set search_path = public;
alter function public.cancel_trade(uuid) set search_path = public;
alter function public.send_trade_email() set search_path = public;
