-- Respaldo completo de la S4 antes de cualquier cambio. Esquema no expuesto por la API.
create schema if not exists backup_s4;
revoke all on schema backup_s4 from anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['teams','rosters','matches','reports','pokedex','seasons','season_pokemon',
    'league_settings','profiles','draft_state','draft_order','draft_picks','transactions','waiver_order','type_chart']
  loop
    execute format('drop table if exists backup_s4.%I', t);
    execute format('create table backup_s4.%I as table public.%I', t, t);
  end loop;
end $$;
