alter table public.teams add column if not exists champions_id text;
update public.teams set champions_id = '677893762316' where name = 'Richampions VGC' and champions_id is null;
