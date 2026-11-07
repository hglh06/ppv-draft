-- Las copias repetidas necesitan que dos equipos puedan elegir el mismo Pokemon; un equipo no puede repetirlo.
alter table public.draft_picks drop constraint if exists unique_pokemon_per_season;
alter table public.draft_picks add constraint draft_picks_team_pokemon_key unique (season_id, team_id, pokemon_id);
