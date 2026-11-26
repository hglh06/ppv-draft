-- T5: Emporio. Las cartas ya no se ofrecen al perder: cada quien junta monedas al perder,
-- compra a ciegas "una carta de tier N de tal tipo" y le toca una al azar del mazo.
-- Mano maxima configurable (3), 1 carta por jornada, cartas iniciales de tier 1.

-- 1) quitar el sistema anterior (no se llego a usar: 0 tarjetas repartidas)
drop trigger if exists match_cards on public.matches;
drop function if exists public.trg_match_cards();
drop function if exists public.grant_card_for_match(uuid);
drop function if exists public.choose_card(uuid, text);
drop function if exists public.admin_grant_card(uuid, uuid, integer);
drop function if exists public.card_board(uuid);
drop function if exists public.draw_cards(integer, text[]);
drop table if exists public.card_grants;
alter table public.league_settings
  drop column if exists cards_cutoff,
  drop column if exists cards_scope,
  drop column if exists cards_block_after_use;

-- tabla y pronosticos vuelven a su forma sin efectos de cartas
create or replace function public.season_standings(p_season uuid)
returns table(team_id uuid, conference_id uuid, w int, l int, d int, pts int, rank_conf int, rank_overall int)
language sql stable security definer set search_path = public as $$
  with s as (select coalesce(points_win,3) pw, coalesce(points_loss,0) pl, coalesce(season_format,'conferences') fmt
             from public.league_settings where season_id = p_season),
  m as (
    select mt.team_a, mt.team_b, mt.winner,
      (select count(*) from jsonb_array_elements(coalesce(mt.games,'[]')) g where g->>'winner' = 'teamA')::int ga,
      (select count(*) from jsonb_array_elements(coalesce(mt.games,'[]')) g where g->>'winner' = 'teamB')::int gb
    from public.matches mt
    where mt.season_id = p_season and coalesce(mt.stage,'regular') = 'regular' and mt.status = 'completed'),
  sides as (
    select m.team_a tid, (case when m.winner is not null then m.winner = 'teamA' else m.ga > m.gb end) won, m.ga - m.gb dd from m
    union all
    select m.team_b, (case when m.winner is not null then m.winner = 'teamB' else m.gb > m.ga end), m.gb - m.ga from m),
  agg as (
    select st.team_id, st.conference_id,
      count(*) filter (where x.won)::int w, count(*) filter (where x.won = false)::int l, coalesce(sum(x.dd),0)::int d
    from public.season_teams st left join sides x on x.tid = st.team_id
    where st.season_id = p_season group by st.team_id, st.conference_id)
  select agg.team_id, agg.conference_id, agg.w, agg.l, agg.d, (agg.w * s.pw + agg.l * s.pl)::int,
    (rank() over (partition by case when s.fmt = 'conferences' then agg.conference_id end order by agg.w * s.pw + agg.l * s.pl desc, agg.d desc))::int,
    (rank() over (order by agg.w * s.pw + agg.l * s.pl desc, agg.d desc))::int
  from agg cross join s;
$$;

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

-- 2) reglas del Emporio (todo opcional por temporada)
alter table public.league_settings
  add column if not exists card_price_t1 int not null default 2,
  add column if not exists card_price_t2 int not null default 4,
  add column if not exists card_price_t3 int not null default 7,
  add column if not exists coins_per_series_loss int not null default 2,
  add column if not exists coins_per_game_loss int not null default 0,
  add column if not exists coins_in_playoffs boolean not null default false,
  add column if not exists cards_max_hand int not null default 3,
  add column if not exists cards_starting int not null default 2;

-- 3) el mazo: 5 tipos x 3 tiers
alter table public.card_defs drop constraint if exists card_defs_category_check;
delete from public.card_defs;
alter table public.card_defs add column if not exists tier int not null default 1;
alter table public.card_defs add constraint card_defs_category_check check (category in ('info','limit','own','market','chaos'));
do $$ begin
  alter table public.card_defs add constraint card_defs_tier_check check (tier between 1 and 3);
exception when duplicate_object then null; end $$;

insert into public.card_defs(id, category, tier, name, effect, rule, sort) values
  ('pista-objeto','info',1,'Pista de objeto','Eliges 1 Pokémon del roster de tu rival; si lo va a llevar, te dice su objeto.',null,1),
  ('naturaleza','info',1,'Naturaleza','Tu rival te dice la naturaleza de 1 Pokémon que tú eliges.',null,2),
  ('vistazo','info',2,'Vistazo','Tu rival te enseña 2 de los 6 Pokémon que va a llevar.','24 h antes de la serie.',3),
  ('set-descubierto','info',2,'Set al descubierto','Ves el set completo de 1 de los 6 de tu rival.','Objeto, habilidad y movimientos.',4),
  ('spread-revelado','info',2,'Spread revelado','Ves naturaleza y EVs de 2 de los 6 de tu rival.',null,5),
  ('velocimetro','info',2,'Velocímetro','Tu rival te dice la Velocidad final de 2 de sus Pokémon.',null,6),
  ('lista-completa','info',3,'Lista completa','Tu rival te enseña sus 6.','24 h antes de la serie.',7),
  ('los-4-elegidos','info',3,'Los 4 elegidos','Tu rival te dice qué 4 Pokémon llevará al game 1.',null,8),
  ('movimiento-vetado','limit',1,'Movimiento vetado','Prohíbes 1 movimiento a 1 Pokémon específico de tu rival.','En 1 game que eliges antes de jugarlo.',9),
  ('sin-danzas-clima','limit',1,'Sin danzas de clima','Tu rival no puede usar movimientos que pongan clima (Danza Lluvia, Día Soleado…).','Las habilidades sí. En 1 game.',10),
  ('veto','limit',2,'Veto','Prohíbes 1 Pokémon del roster de tu rival.','En 1 game. No puede ser el más caro de su roster.',11),
  ('sin-fake-out','limit',2,'Sin Fake Out','Nadie del equipo rival puede usar Fake Out.','En 1 game.',12),
  ('sin-tailwind','limit',2,'Sin Tailwind','Tu rival no puede usar Tailwind.','En 1 game.',13),
  ('veto-total','limit',3,'Veto total','Prohíbes 1 Pokémon del roster de tu rival, el que sea.','Toda la serie.',14),
  ('juega-con-5','limit',3,'Juega con 5','Tu rival registra solo 5 Pokémon en vez de 6.','Toda la serie.',15),
  ('ajuste-objeto','own',1,'Ajuste de objeto','Si pierdes el primer game, cambias el objeto de 1 de tus Pokémon.',null,16),
  ('ajuste-movimiento','own',1,'Ajuste de movimiento','Si pierdes el primer game, cambias 1 movimiento de 1 de tus Pokémon.',null,17),
  ('cambio-caliente','own',2,'Cambio en caliente','Después de perder un game, cambias 1 de tus 6 por otro de tu roster.',null,18),
  ('set-doble','own',2,'Set doble','1 Pokémon tiene 2 sets registrados; después de perder un game decides si lo cambias.',null,19),
  ('revancha-preparada','own',2,'Revancha preparada','Si pierdes un game, tu rival tiene que traer los mismos 4 Pokémon en el siguiente.',null,20),
  ('borron-cuenta-nueva','own',3,'Borrón y cuenta nueva','Si pierdes un game, se anula y se vuelve a jugar.','Una vez por serie.',21),
  ('plan-maestro','own',3,'Plan maestro','Registras 2 equipos de 6 de tu roster; después de perder un game puedes pasarte al otro equipo completo.',null,22),
  ('rebaja','market',1,'Rebaja','Tu siguiente agente libre cuesta 1 punto menos.',null,23),
  ('fichaje-tardio','market',1,'Fichaje fuera de tiempo','Puedes fichar hasta 1 día después del cierre de la semana.',null,24),
  ('primero-fila','market',2,'Primero en la fila','Tienes la prioridad #1 en waivers esa semana.',null,25),
  ('rebaja-doble','market',2,'Rebaja doble','Tu siguiente agente libre cuesta 2 puntos menos.',null,26),
  ('fichaje-sin-castigo','market',2,'Fichaje sin castigo','Tu siguiente movimiento no te manda al final de la cola de waivers.',null,27),
  ('presupuesto-5','market',3,'Presupuesto +5','Tu tope de puntos sube 5.','El resto de la temporada.',28),
  ('repetido-extra','market',3,'Repetido extra','Puedes tener 1 Pokémon repetido (shiny) más que el tope.',null,29),
  ('semana-sin-banda','chaos',1,'Semana sin Banda','Esta semana nadie en la liga puede usar Banda Focus.','Afecta a todos, también a ti.',30),
  ('semana-sin-bayas','chaos',1,'Sin bayas','Esta semana nadie en la liga puede usar bayas.','Afecta a todos, también a ti.',31),
  ('semana-sin-velocidad','chaos',2,'Semana sin velocidad','Esta semana nadie en la liga puede usar Tailwind ni Trick Room.','Afecta a todos, también a ti.',32),
  ('cts-para-todos','chaos',2,'CTS para todos','Esta semana todas las series se juegan con Close Team Sheet.','Afecta a todos, también a ti.',33),
  ('todos-con-5','chaos',2,'Todos con 5','Esta semana todos registran solo 5 Pokémon para su serie.','Afecta a todos, también a ti.',34),
  ('semana-singles','chaos',3,'Semana Singles','Esta semana todos los games 3 se juegan en Singles.','Afecta a todos, también a ti.',35),
  ('terremoto-mercado','chaos',3,'Terremoto de mercado','Cada equipo suelta al azar 1 de sus 4 Pokémon más baratos.','Afecta a todos, también a ti.',36);

-- 4) monedero (movimientos) y mano
create table if not exists public.card_ledger (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  delta int not null,
  reason text not null,          -- loss_series, loss_game, purchase, admin
  match_id uuid references public.matches(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists card_ledger_match_once on public.card_ledger(match_id, team_id, reason) where match_id is not null;
create index if not exists card_ledger_team_idx on public.card_ledger(season_id, team_id);

create table if not exists public.card_hand (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  card_id text not null references public.card_defs(id),
  source text not null default 'shop',   -- start, shop, admin
  status text not null default 'held' check (status in ('held','used','discarded')),
  price int not null default 0,
  used_week int,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists card_hand_team_idx on public.card_hand(season_id, team_id, status);
create unique index if not exists card_hand_one_per_week on public.card_hand(season_id, team_id, used_week) where status = 'used';

alter table public.card_ledger enable row level security;
alter table public.card_hand enable row level security;
drop policy if exists "own or staff read card_ledger" on public.card_ledger;
create policy "own or staff read card_ledger" on public.card_ledger for select using (team_id = public.my_team_id() or public.has_perm('season.manage'));
drop policy if exists "manage card_ledger" on public.card_ledger;
create policy "manage card_ledger" on public.card_ledger for all using (public.has_perm('season.manage')) with check (public.has_perm('season.manage'));
drop policy if exists "own or staff read card_hand" on public.card_hand;
create policy "own or staff read card_hand" on public.card_hand for select using (team_id = public.my_team_id() or public.has_perm('season.manage'));
drop policy if exists "manage card_hand" on public.card_hand;
create policy "manage card_hand" on public.card_hand for all using (public.has_perm('season.manage')) with check (public.has_perm('season.manage'));

create or replace function public.card_balance(p_season uuid, p_team uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.card_ledger where season_id = p_season and team_id = p_team;
$$;

-- 5) monedas al perder (al completarse una serie)
create or replace function public.award_loss_coins(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_m record; v_set public.league_settings; v_loser uuid; v_ga int; v_gb int;
begin
  select * into v_m from public.matches where id = p_match;
  if not found or v_m.status <> 'completed' or v_m.winner not in ('teamA','teamB') then return; end if;
  v_set := public.settings_for(v_m.season_id);
  if v_set is null or not v_set.cards_enabled then return; end if;
  if coalesce(v_m.stage,'regular') <> 'regular' and not v_set.coins_in_playoffs then return; end if;
  v_loser := case when v_m.winner = 'teamA' then v_m.team_b else v_m.team_a end;
  if v_set.coins_per_series_loss <> 0 and v_loser is not null then
    insert into public.card_ledger(season_id, team_id, delta, reason, match_id, note)
    values (v_m.season_id, v_loser, v_set.coins_per_series_loss, 'loss_series', v_m.id, 'Serie perdida · jornada ' || coalesce(v_m.week::text, v_m.round, ''))
    on conflict do nothing;
  end if;
  if v_set.coins_per_game_loss <> 0 then
    select count(*) filter (where g->>'winner' = 'teamA'), count(*) filter (where g->>'winner' = 'teamB')
    into v_ga, v_gb from jsonb_array_elements(coalesce(v_m.games,'[]')) g;
    if v_gb > 0 and v_m.team_a is not null then
      insert into public.card_ledger(season_id, team_id, delta, reason, match_id, note)
      values (v_m.season_id, v_m.team_a, v_set.coins_per_game_loss * v_gb, 'loss_game', v_m.id, v_gb || ' game(s) perdido(s)') on conflict do nothing;
    end if;
    if v_ga > 0 and v_m.team_b is not null then
      insert into public.card_ledger(season_id, team_id, delta, reason, match_id, note)
      values (v_m.season_id, v_m.team_b, v_set.coins_per_game_loss * v_ga, 'loss_game', v_m.id, v_ga || ' game(s) perdido(s)') on conflict do nothing;
    end if;
  end if;
end $$;

create or replace function public.trg_match_coins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.award_loss_coins(new.id);
  end if;
  return new;
end $$;
drop trigger if exists match_coins on public.matches;
create trigger match_coins after update of status on public.matches for each row execute function public.trg_match_coins();

-- 6) comprar a ciegas: "una carta de tier N de tal tipo"
create or replace function public.buy_card(p_category text, p_tier int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_season uuid := public.active_season_id(); v_team uuid := public.my_team_id(); v_set public.league_settings;
        v_price int; v_card text; v_id uuid;
begin
  if v_team is null or not public.has_perm('team.play') then raise exception 'Necesitas un equipo para comprar'; end if;
  perform 1 from public.teams where id = v_team for update;   -- evita compras dobles simultaneas
  v_set := public.settings_for(v_season);
  if v_set is null or not v_set.cards_enabled then raise exception 'El Emporio esta cerrado en esta temporada'; end if;
  v_price := case p_tier when 1 then v_set.card_price_t1 when 2 then v_set.card_price_t2 when 3 then v_set.card_price_t3 end;
  if v_price is null then raise exception 'Tier invalido'; end if;
  if (select count(*) from public.card_hand where season_id = v_season and team_id = v_team and status = 'held') >= v_set.cards_max_hand then
    raise exception 'Ya tienes % cartas; usa una antes de comprar otra', v_set.cards_max_hand;
  end if;
  if public.card_balance(v_season, v_team) < v_price then raise exception 'No te alcanza: cuesta % monedas', v_price; end if;
  select id into v_card from public.card_defs where active and category = p_category and tier = p_tier order by random() limit 1;
  if v_card is null then raise exception 'No hay cartas de ese tipo y tier'; end if;
  insert into public.card_hand(season_id, team_id, card_id, source, price) values (v_season, v_team, v_card, 'shop', v_price) returning id into v_id;
  insert into public.card_ledger(season_id, team_id, delta, reason, note) values (v_season, v_team, -v_price, 'purchase', 'Compra tier ' || p_tier);
  return jsonb_build_object('hand_id', v_id, 'card_id', v_card, 'balance', public.card_balance(v_season, v_team));
end $$;

-- 7) usar una carta en una jornada (1 por jornada)
create or replace function public.use_card(p_hand uuid, p_week int) returns void
language plpgsql security definer set search_path = public as $$
declare v_h public.card_hand;
begin
  select * into v_h from public.card_hand where id = p_hand for update;
  if not found then raise exception 'Carta no encontrada'; end if;
  if not public.has_perm('season.manage') and (v_h.team_id is distinct from public.my_team_id() or not public.has_perm('team.play')) then raise exception 'No autorizado'; end if;
  if v_h.status <> 'held' then raise exception 'Esa carta ya se uso'; end if;
  if p_week is null or p_week < 1 then raise exception 'Jornada invalida'; end if;
  if exists (select 1 from public.card_hand where season_id = v_h.season_id and team_id = v_h.team_id and status = 'used' and used_week = p_week) then
    raise exception 'Ya usaste una carta en la jornada %', p_week;
  end if;
  update public.card_hand set status = 'used', used_week = p_week, used_at = now() where id = p_hand;
end $$;

-- 8) tablero publico: de cada equipo se ve tipo y tier de su mano (boca abajo) y las cartas ya usadas;
--    el dueno y el staff ven todo
create or replace function public.card_table(p_season uuid)
returns table(hand_id uuid, team_id uuid, status text, category text, tier int, card_id text, used_week int, used_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.id, h.team_id, h.status, d.category, d.tier,
    case when h.status = 'used' or h.team_id = public.my_team_id() or public.has_perm('season.manage') then h.card_id end,
    h.used_week, h.used_at
  from public.card_hand h join public.card_defs d on d.id = h.card_id
  where h.season_id = p_season and h.status in ('held','used');
$$;

-- 9) admin: cartas iniciales, dar/quitar cartas, ajustar monedas
create or replace function public.deal_starting_cards(p_season uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_set public.league_settings; v_t record; v_n int := 0; v_card text; i int;
begin
  perform public.require_perm('season.manage');
  v_set := public.settings_for(p_season);
  for v_t in select team_id from public.season_teams where season_id = p_season loop
    if exists (select 1 from public.card_hand where season_id = p_season and team_id = v_t.team_id and source = 'start') then continue; end if;
    for i in 1..coalesce(v_set.cards_starting, 2) loop
      select id into v_card from public.card_defs where active and tier = 1 order by random() limit 1;
      exit when v_card is null;
      insert into public.card_hand(season_id, team_id, card_id, source) values (p_season, v_t.team_id, v_card, 'start');
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

create or replace function public.admin_give_card(p_season uuid, p_team uuid, p_category text, p_tier int, p_card text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_card text := p_card;
begin
  perform public.require_perm('season.manage');
  if v_card is null then
    select id into v_card from public.card_defs where active and category = p_category and tier = p_tier order by random() limit 1;
  end if;
  if v_card is null then raise exception 'No hay cartas con ese tipo y tier'; end if;
  insert into public.card_hand(season_id, team_id, card_id, source) values (p_season, p_team, v_card, 'admin');
  return v_card;
end $$;

create or replace function public.admin_adjust_coins(p_season uuid, p_team uuid, p_delta int, p_note text default null) returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('season.manage');
  insert into public.card_ledger(season_id, team_id, delta, reason, note) values (p_season, p_team, p_delta, 'admin', nullif(p_note, ''));
  return public.card_balance(p_season, p_team);
end $$;

do $$
declare f text;
begin
  foreach f in array array['buy_card(text,integer)','use_card(uuid,integer)','deal_starting_cards(uuid)','admin_give_card(uuid,uuid,text,integer,text)','admin_adjust_coins(uuid,uuid,integer,text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['award_loss_coins(uuid)','trg_match_coins()','card_balance(uuid,uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
