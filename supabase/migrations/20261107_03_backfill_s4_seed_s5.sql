-- Pasa la S4 al modelo multi-temporada y crea la S5 en modo setup.
do $$
declare
  s4 uuid := (select id from public.seasons where name = 'Season 4');
  s5 uuid;
  ca uuid; cb uuid; c5a uuid; c5b uuid;
  t record;
begin
  update public.seasons set number = 4, slug = 's4', status = 'finished',
    subtitle = 'FireRed · LeafGreen',
    theme = '{"accent":"#FFB62E","immune":"#4FA3FF"}'::jsonb
  where id = s4;
  update public.league_settings set regular_weeks = 9 where season_id = s4;

  insert into public.conferences(season_id, key, name, code, color, sort)
  values (s4,'a','FireRed','Kanto','#FF4B2B',1), (s4,'b','LeafGreen','Johto','#7ED13A',2)
  on conflict (season_id, key) do nothing;
  select id into ca from public.conferences where season_id = s4 and key = 'a';
  select id into cb from public.conferences where season_id = s4 and key = 'b';

  insert into public.season_teams(season_id, team_id, conference_id, display_name, abbr, coach_name, logo)
  select s4, tm.id,
    case tm.conference when 'Kanto' then ca when 'Johto' then cb end,
    case when tm.name = 'Los Niggers' then 'Los Diggers' else tm.name end,
    ab.abbr, tm.coach_name,
    case when tm.name = 'Los Niggers' then '/logos/diggers.webp' else tm.logo end
  from public.teams tm
  left join (values ('Inter Di Lorenzo','INT'),('CanoLovers','CNL'),('Chaewons','CHW'),('Clangourous Chromes','CLN'),
    ('Vampotros','VMP'),('Blue Cock','BLC'),('Mamitas La Paz','MMT'),('Los Niggers','LDG'),('Canolo Haters','CNH'),
    ('Los Griyos','LGR'),('Mega Avinites','MGV'),('Los Pats','LPT'),('Richampions VGC','RCH'),('Golden Tapus','GLD'),
    ('Brandogerpons','BRN'),('Pokevmon','PKV'),('Winstoni','WNS'),('Browtlans','BRW')) ab(n, abbr) on ab.n = tm.name
  on conflict (season_id, team_id) do nothing;

  update public.matches set season_id = s4,
    conference_id = case conference when 'Kanto' then ca when 'Johto' then cb end
  where season_id is null;
  update public.reports set season_id = s4 where season_id is null;
  update public.transactions set season_id = s4 where season_id is null;

  -- Stats por Pokemon y juego desde los reportes aprobados
  insert into public.pokemon_stats(season_id, match_id, report_id, week, stage, team_id, pokemon_id, pokemon_name, game, kills, deaths)
  select s4, m.id, r.id, m.week, coalesce(m.stage,'regular'),
    case side.s when 'a' then m.team_a else m.team_b end,
    pd.id, mon->>'name', (g->>'game')::int, coalesce((g->>'kills')::int,0), coalesce((g->>'deaths')::int,0)
  from public.reports r
  join public.matches m on m.id = r.match_id
  cross join lateral (values ('a', r.team_a_data), ('b', r.team_b_data)) side(s, data)
  cross join lateral jsonb_array_elements(coalesce(side.data,'[]'::jsonb)) mon
  cross join lateral jsonb_array_elements(coalesce(mon->'games','[]'::jsonb)) g
  left join public.pokedex pd on pd.name = mon->>'name'
  where r.status = 'approved'
    and not exists (select 1 from public.pokemon_stats ps where ps.report_id = r.id);

  -- Bracket de playoffs S4 (no estaba en la BD; tomado del rediseno)
  if not exists (select 1 from public.matches where season_id = s4 and stage = 'playoff') then
    insert into public.matches(season_id, stage, round, team_a, team_b, winner, status, games, replays)
    select s4, 'playoff', x.rnd, (select id from public.teams where name = x.a), (select id from public.teams where name = x.b),
      x.w, 'completed', '[]'::jsonb, '[]'::jsonb
    from (values
      ('A_WC','Chaewons','Richampions VGC','teamB'),
      ('A_QF','Mega Avinites','Richampions VGC','teamA'),
      ('A_SF','Inter Di Lorenzo','Mega Avinites','teamA'),
      ('B_WC','Los Pats','Clangourous Chromes','teamA'),
      ('B_QF','CanoLovers','Los Pats','teamB'),
      ('B_SF','Los Griyos','Los Pats','teamA'),
      ('FINAL','Inter Di Lorenzo','Los Griyos','teamB')) x(rnd, a, b, w);
  end if;
  update public.seasons set champion_team_id = (select id from public.teams where name = 'Los Griyos') where id = s4;

  -- Temporada 5 en modo setup (no activa todavia)
  insert into public.seasons(name, number, slug, status, is_active, subtitle, theme, next_event)
  values ('Season 5', 5, 's5', 'setup', false, 'HeartGold · SoulSilver',
    '{"accent":"#5CD6F0","immune":"#4FA3FF"}'::jsonb,
    '{"label":"Draft de la Temporada 5","at":"2026-11-21T20:00:00-06:00"}'::jsonb)
  on conflict (number) do nothing;
  select id into s5 from public.seasons where number = 5;

  insert into public.league_settings(season_id, roster_size, max_points, playoff_teams, max_teams, max_fa, trade_max_diff,
    points_win, points_loss, best_of, regular_weeks, draft_pick_seconds, faint_limit, faint_reset_on_transfer, faint_in_playoffs)
  select s5, roster_size, max_points, playoff_teams, max_teams, max_fa, trade_max_diff, points_win, points_loss, best_of,
    regular_weeks, draft_pick_seconds, null, true, false
  from public.league_settings where season_id = s4
  on conflict (season_id) do nothing;

  insert into public.conferences(season_id, key, name, color, sort)
  values (s5,'a','HeartGold','#F2B632',1), (s5,'b','SoulSilver','#B9C4D4',2)
  on conflict (season_id, key) do nothing;

  -- Equipos de la S4 pre-cargados en la S5 sin conferencia (el admin las asigna)
  insert into public.season_teams(season_id, team_id, display_name, abbr, coach_name, logo)
  select s5, team_id, display_name, abbr, coach_name, logo from public.season_teams where season_id = s4
  on conflict (season_id, team_id) do nothing;

  -- Pool de la S5 = copia del pool de la S4 (precios editables desde el admin)
  if not exists (select 1 from public.season_pokemon where season_id = s5) then
    insert into public.season_pokemon(season_id, pokemon_id, points, available, pokemon_name)
    select s5, pokemon_id, points, available, pokemon_name from public.season_pokemon where season_id = s4;
  end if;
end $$;
